// components/AIAssistantChat.jsx
//
// Assistant Patrimonia - Phase 3 UI Chat (v7)
// + Pièces jointes : PDF (extraction texte côté backend) + images (compression + Vision GPT-4o)
// + Dictée hybride : Web Speech (direct) + Whisper (qualité finale)

'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Mic, Loader2, Square, Paperclip, FileText, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const SAGE_DARK = '#5d6e5d';
const SAGE_DARKER = '#3d4d3d';

// Limites de compression image
const IMAGE_MAX_DIM = 1280;       // max 1280px par côté
const IMAGE_JPEG_QUALITY = 0.75;  // qualité JPEG (75%)
// Limites strictes (Vercel hobby payload max = 4,5 Mo)
const MAX_FILE_SIZE = 3 * 1024 * 1024;     // 3 Mo max par fichier
const MAX_TOTAL_PAYLOAD = 4 * 1024 * 1024;  // 4 Mo max total

function renderMarkdown(text) {
  if (!text) return '';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

// =========================================================================
// Helpers : compression d'image
// =========================================================================

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        // Calcul nouvelles dimensions
        let { width, height } = img;
        if (width > IMAGE_MAX_DIM || height > IMAGE_MAX_DIM) {
          if (width > height) {
            height = Math.round((height * IMAGE_MAX_DIM) / width);
            width = IMAGE_MAX_DIM;
          } else {
            width = Math.round((width * IMAGE_MAX_DIM) / height);
            height = IMAGE_MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convertit en data URL JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY);
        resolve({
          name: file.name,
          type: 'image/jpeg',
          data: dataUrl,
          originalSize: file.size,
          compressedSize: Math.round(dataUrl.length * 0.75) // approx (base64 = 4/3 du binaire)
        });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      type: file.type,
      data: reader.result,
      originalSize: file.size,
      compressedSize: file.size
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' Ko';
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

// =========================================================================
// Composant principal
// =========================================================================

export default function AIAssistantChat({
  floating = false,
  context = null,
  open: controlledOpen,
  onOpenChange
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof controlledOpen === 'boolean';
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (val) => {
    if (isControlled) onOpenChange?.(val);
    else setInternalOpen(val);
  };

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [inputBeforeRecord, setInputBeforeRecord] = useState('');

  // PJ
  const [attachments, setAttachments] = useState([]); // { name, type, data, originalSize, compressedSize }
  const [processingFiles, setProcessingFiles] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const speechRecognitionRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  useEffect(() => {
    if (!open) {
      setMessages([]);
      setInput('');
      setLiveTranscript('');
      setInputBeforeRecord('');
      setAttachments([]);
    }
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  // ========================================================================
  // PIÈCES JOINTES
  // ========================================================================

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setProcessingFiles(true);
    const newAttachments = [];

    for (const file of files) {
      try {
        let processed;
        if (file.type.startsWith('image/')) {
          processed = await compressImage(file);
        } else if (file.type === 'application/pdf') {
          if (file.size > MAX_FILE_SIZE) {
            alert(`Le PDF "${file.name}" fait ${formatSize(file.size)}, trop volumineux (max ${formatSize(MAX_FILE_SIZE)}). Réduis-le avant d'essayer.`);
            continue;
          }
          processed = await readFileAsDataURL(file);
        } else {
          alert(`Type de fichier non supporté : ${file.name} (${file.type})`);
          continue;
        }

        // Vérif taille du fichier compressé
        if (processed.compressedSize > MAX_FILE_SIZE) {
          alert(`"${file.name}" reste trop volumineux après compression (${formatSize(processed.compressedSize)}, max ${formatSize(MAX_FILE_SIZE)}).`);
          continue;
        }

        // Vérif total payload (existant + en cours d'ajout)
        const existingSize = attachments.reduce((s, a) => s + a.compressedSize, 0);
        const newSize = newAttachments.reduce((s, a) => s + a.compressedSize, 0);
        if (existingSize + newSize + processed.compressedSize > MAX_TOTAL_PAYLOAD) {
          alert(`Limite totale dépassée (max ${formatSize(MAX_TOTAL_PAYLOAD)} au total). "${file.name}" non ajouté.`);
          continue;
        }

        newAttachments.push(processed);
      } catch (err) {
        console.error('[AIAssistantChat] File error:', err);
        alert('Erreur sur le fichier ' + file.name + ' : ' + err.message);
      }
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    setProcessingFiles(false);

    // Reset input file pour pouvoir re-sélectionner les mêmes fichiers
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  // ========================================================================
  // ENVOI DU MESSAGE
  // ========================================================================

  const sendMessage = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || loading) return;

    const newMessages = [...messages, {
      role: 'user',
      content: text || (attachments.length > 0 ? '(pièces jointes uniquement)' : '')
    }];
    setMessages(newMessages);
    const currentAttachments = attachments;
    setInput('');
    setAttachments([]);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setLoading(true);

    try {
      const payload = { messages: newMessages };
      if (context) payload.context = context;
      if (currentAttachments.length > 0) {
        payload.attachments = currentAttachments.map(a => ({
          name: a.name,
          type: a.type,
          data: a.data
        }));
      }

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Erreur serveur');
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.message || '(réponse vide)' }]);
    } catch (err) {
      console.error('[AIAssistantChat] Erreur:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Erreur : ' + (err.message || 'impossible de joindre l\'assistant')
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ========================================================================
  // VOCAL HYBRIDE
  // ========================================================================

  const startRecording = async () => {
    try {
      const currentInput = input;
      setInputBeforeRecord(currentInput);
      setLiveTranscript('');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (audioChunksRef.current.length === 0) return;

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setTranscribing(true);

        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token || '';

          const formData = new FormData();
          formData.append('audio', blob, 'voice.webm');
          formData.append('token', token);

          const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
          if (!res.ok) throw new Error('Transcription échouée');
          const data = await res.json();
          const transcript = data.text || data.transcript || '';

          if (transcript) {
            setInput(prev => {
              const base = inputBeforeRecord || '';
              return base ? base + ' ' + transcript : transcript;
            });
            if (inputRef.current) {
              inputRef.current.focus();
              setTimeout(() => {
                if (inputRef.current) {
                  inputRef.current.style.height = 'auto';
                  inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
                }
              }, 0);
            }
          }
        } catch (err) {
          console.error('[AIAssistantChat] Transcription error:', err);
          alert('Erreur de transcription : ' + err.message);
          setInput(inputBeforeRecord);
        } finally {
          setTranscribing(false);
          setLiveTranscript('');
        }
      };

      mediaRecorderRef.current = mr;
      mr.start();

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = 'fr-FR';
          recognition.continuous = true;
          recognition.interimResults = true;

          recognition.onresult = (event) => {
            let interim = '';
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const transcript = event.results[i][0].transcript;
              if (event.results[i].isFinal) final += transcript + ' ';
              else interim += transcript;
            }
            setLiveTranscript(() => (final + interim).trim());
          };

          recognition.onerror = (e) => {
            console.warn('[AIAssistantChat] Web Speech error:', e.error);
          };

          speechRecognitionRef.current = recognition;
          recognition.start();
        } catch (e) {
          console.warn('[AIAssistantChat] Web Speech start failed:', e);
        }
      }

      setRecording(true);
    } catch (err) {
      console.error('[AIAssistantChat] Mic error:', err);
      alert('Impossible d\'accéder au micro : ' + err.message);
    }
  };

  const stopRecording = () => {
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch (e) {}
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const displayValue = recording
    ? (inputBeforeRecord + (inputBeforeRecord && liveTranscript ? ' ' : '') + liveTranscript)
    : input;

  const getContextLabel = () => {
    if (!context) return null;
    if (context.type === 'mandat' && context.data) {
      return `Mandat : ${context.data.nom || context.data.adresse || 'sans nom'}`;
    }
    if (context.type === 'client' && context.data) {
      const c = context.data;
      const nom = [c.prenom, c.nom].filter(Boolean).join(' ') || c.societe || 'sans nom';
      return `Client : ${nom}`;
    }
    return null;
  };

  const contextLabel = getContextLabel();

  const gradientStyle = {
    background: `linear-gradient(to bottom right, ${SAGE_DARK}, ${SAGE_DARKER})`
  };

  return (
    <>
      {floating && !open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir l'Assistant Patrimonia"
          style={gradientStyle}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full text-white shadow-xl hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden"
          style={{
            width: '420px',
            height: '600px',
            maxWidth: 'calc(100vw - 3rem)',
            maxHeight: 'calc(100vh - 3rem)',
            resize: 'both'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-stone-50 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div
                style={gradientStyle}
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              >
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-stone-900">Assistant Patrimonia</div>
                {contextLabel ? (
                  <div className="text-xs text-stone-500 truncate" title={contextLabel}>{contextLabel}</div>
                ) : (
                  <div className="text-xs text-stone-500">Cherche dans tes mandats et clients</div>
                )}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="p-1.5 hover:bg-stone-200 rounded-lg transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4 text-stone-600" />
            </button>
          </div>

          {/* Zone messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-stone-50">
            {messages.length === 0 && (
              <div className="text-center text-stone-400 text-sm mt-12">
                <Sparkles className="w-6 h-6 mx-auto mb-2 text-stone-300" />
                <p>Pose-moi une question</p>
                {contextLabel ? (
                  <p className="text-xs mt-1">Ex : "Donne-moi un résumé"</p>
                ) : (
                  <p className="text-xs mt-1">Ex : "Combien de mandats à Paris ?"</p>
                )}
                <p className="text-xs mt-3 text-stone-400">Tu peux aussi joindre des PDF ou des photos.</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  style={msg.role === 'user' ? { backgroundColor: SAGE_DARK } : {}}
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'text-white rounded-br-sm'
                      : 'bg-white text-stone-900 border border-stone-200 rounded-bl-sm'
                  }`}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                />
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-sm px-3 py-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Vignettes PJ */}
          {attachments.length > 0 && (
            <div className="px-3 pt-2 pb-1 border-t border-stone-100 bg-white flex-shrink-0">
              <div className="flex gap-2 flex-wrap">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="relative group flex items-center gap-1.5 px-2 py-1 bg-stone-100 rounded-lg text-xs"
                  >
                    {att.type.startsWith('image/') ? (
                      <ImageIcon className="w-3.5 h-3.5 text-stone-500" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-stone-500" />
                    )}
                    <span className="max-w-[140px] truncate" title={att.name}>{att.name}</span>
                    <span className="text-stone-400">{formatSize(att.compressedSize)}</span>
                    <button
                      onClick={() => removeAttachment(idx)}
                      aria-label="Supprimer cette pièce jointe"
                      className="ml-1 hover:bg-stone-200 rounded p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {processingFiles && (
                  <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-stone-500">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Traitement…</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-stone-200 bg-white p-3 flex-shrink-0">
            {recording && (
              <div className="flex items-center gap-2 mb-2 text-xs text-red-600">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                <span>Je t'écoute…{!SpeechRecognition && ' (visualisation directe indisponible sur ce navigateur)'}</span>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf,image/*"
                onChange={handleFilesSelected}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || recording || transcribing || processingFiles}
                aria-label="Joindre des fichiers"
                title="Joindre PDF ou photos"
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-stone-100 text-stone-700 hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {processingFiles ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              </button>

              <textarea
                ref={inputRef}
                value={displayValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={recording ? 'Parle, je t\'écoute…' : (transcribing ? 'Transcription en cours…' : 'Tape ou parle…')}
                disabled={loading || recording || transcribing}
                rows={1}
                style={{
                  maxHeight: '120px',
                  color: recording ? '#888' : undefined,
                  fontStyle: recording ? 'italic' : undefined
                }}
                className="flex-1 resize-none px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 disabled:bg-stone-50 min-h-[36px]"
              />

              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={loading || transcribing}
                aria-label={recording ? 'Arrêter l\'enregistrement' : 'Enregistrer un message vocal'}
                className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                  recording
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {transcribing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : recording ? (
                  <Square className="w-4 h-4 fill-current" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>

              <button
                onClick={sendMessage}
                disabled={(!input.trim() && attachments.length === 0) || loading || recording || transcribing}
                aria-label="Envoyer"
                style={(!input.trim() && attachments.length === 0) || loading || recording || transcribing ? {} : { backgroundColor: SAGE_DARK }}
                className="w-9 h-9 rounded-lg text-white disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 transition-colors hover:opacity-90"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
