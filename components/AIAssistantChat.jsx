// components/AIAssistantChat.jsx
//
// Assistant Patrimonia - Phase 3 UI Chat (v4)
// Couleurs en inline style pour garantir le rendu visuel.

'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Mic, Loader2, Square } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Couleurs Patrimonia (sage)
const SAGE_DARK = '#5d6e5d';
const SAGE_DARKER = '#3d4d3d';

function renderMarkdown(text) {
  if (!text) return '';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

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

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  useEffect(() => {
    if (!open) {
      setMessages([]);
      setInput('');
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

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setLoading(true);

    try {
      const payload = { messages: newMessages };
      if (context) payload.context = context;

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

  const startRecording = async () => {
    try {
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
          // Récupère le token Supabase pour l'authentification
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
            setInput(prev => (prev ? prev + ' ' + transcript : transcript));
            if (inputRef.current) {
              inputRef.current.focus();
              inputRef.current.style.height = 'auto';
              inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
            }
          }
        } catch (err) {
          console.error('[AIAssistantChat] Transcription error:', err);
          alert('Erreur de transcription : ' + err.message);
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (err) {
      console.error('[AIAssistantChat] Mic error:', err);
      alert('Impossible d\'accéder au micro : ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

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

  // Style du gradient sage (inline pour garantir le rendu)
  const gradientStyle = {
    background: `linear-gradient(to bottom right, ${SAGE_DARK}, ${SAGE_DARKER})`
  };

  return (
    <>
      {/* Bouton flottant (uniquement si floating=true et non ouvert) */}
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

      {/* Fenêtre chat */}
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

          {/* Input */}
          <div className="border-t border-stone-200 bg-white p-3 flex-shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={recording ? 'Enregistrement en cours…' : (transcribing ? 'Transcription…' : 'Tape ou parle…')}
                disabled={loading || recording || transcribing}
                rows={1}
                style={{ maxHeight: '120px' }}
                className="flex-1 resize-none px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 disabled:bg-stone-50 disabled:text-stone-400 min-h-[36px]"
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
                disabled={!input.trim() || loading || recording || transcribing}
                aria-label="Envoyer"
                style={!input.trim() || loading || recording || transcribing ? {} : { backgroundColor: SAGE_DARK }}
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
