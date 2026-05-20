// ═══════════════════════════════════════════════════════════════════
// components/MandatAIAssistant.jsx — v3.1
// Assistant IA unifié avec function calling (GPT-4o)
// Notif visuelle des champs modifiés + auto-refresh
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Copy, Check, FileText, Mail, Target, Loader2, RefreshCw, CheckCircle2, Mic, MicOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const QUICK_ACTIONS = [
  { id: 'descriptif',    label: 'Descriptif',    icon: FileText, prompt: 'Génère un descriptif marketing court (3-5 phrases) pour les portails immobiliers.' },
  { id: 'argumentaire',  label: 'Arguments',     icon: Target,   prompt: 'Génère 4 arguments commerciaux pour valoriser ce mandat auprès des acquéreurs (utilise l\'outil dédié).' },
  { id: 'email_mandant', label: 'Email mandant', icon: Mail,     prompt: 'Rédige un email de point d\'étape au mandant, ton professionnel, court.' },
];

// Labels lisibles pour les champs modifiés
const FIELD_LABELS = {
  nom: 'Nom', adresse: 'Adresse', ville: 'Ville', prix: 'Prix', prix_net_vendeur: 'Prix net vendeur',
  prix_m2: 'Prix au m²', surface: 'Surface', nb_pieces: 'Nb pièces', nb_chambres: 'Nb chambres',
  etage: 'Étage', annee_construction: 'Année construction', nb_lots: 'Nb lots',
  loyers_annuels: 'Loyers actuels', loyers_projetes: 'Loyers projetés', rendement: 'Rendement',
  rendement_optimise: 'Rendement optimisé', charges_annuelles: 'Charges', taxe_fonciere: 'Taxe foncière',
  dpe_consommation: 'DPE conso', dpe_emissions: 'DPE émissions', dpe_date: 'DPE date',
  honoraires_taux: 'Honoraires (%)', honoraires_montant: 'Honoraires (€)', honoraires_charge: 'Honoraires à charge',
  mandat_numero: 'N° mandat', mandat_type: 'Type mandat', mandat_date_echeance: 'Échéance mandat',
  description: 'Description', arguments_commerciaux: 'Arguments commerciaux',
  commercialisation: 'Commercialisation', statut: 'Statut', type: 'Famille', sous_type: 'Sous-type', marche: 'Marché',
};

export default function MandatAIAssistant({ mandat, onMandatUpdate }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const messagesEndRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Charger l'historique au premier ouverture du panneau
  useEffect(() => {
    if (!open || historyLoaded || !mandat?.id) return;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const res = await fetch('/api/mandat-assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, mandat_id: mandat.id, action: 'load_history' }),
        });

        const data = await res.json();
        if (data.ok && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      } catch (e) {
        console.error('[AI] load history error:', e);
      } finally {
        setHistoryLoaded(true);
      }
    })();
  }, [open, historyLoaded, mandat?.id]);

  async function callAssistant(messageText) {
    if (!mandat?.id || !messageText.trim() || loading) return;
    setLoading(true);

    const userMsg = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '⚠️ Session expirée. Recharge la page et reconnecte-toi.',
        }]);
        setLoading(false);
        return;
      }

      const res = await fetch('/api/mandat-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, mandat_id: mandat.id, message: messageText }),
      });

      const data = await res.json();

      if (!data.ok) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `⚠️ Erreur : ${data.error || 'inconnue'}`,
        }]);
      } else {
        // Ajout de la réponse + éventuellement une notif visuelle de modif
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response,
          modified_fields: data.modified_fields || [],
        }]);
        // Auto-refresh de la fiche si l'IA a modifié quelque chose
        if (data.mandat_modified && typeof onMandatUpdate === 'function') {
          onMandatUpdate();
        }
      }
    } catch (err) {
      console.error('[AI] callAssistant error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Erreur réseau : ${err.message}`,
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    callAssistant(text);
  }

  function handleQuickAction(actionId) {
    if (loading) return;
    const action = QUICK_ACTIONS.find(a => a.id === actionId);
    if (action) callAssistant(action.prompt);
  }

  async function handleCopy(idx) {
    const msg = messages[idx];
    if (!msg) return;
    try {
      await navigator.clipboard.writeText(msg.content);
      setMessages(prev => prev.map((m, i) => i === idx ? { ...m, copied: true } : m));
      setTimeout(() => {
        setMessages(prev => prev.map((m, i) => i === idx ? { ...m, copied: false } : m));
      }, 2000);
    } catch (e) {
      // ignore
    }
  }

  async function handleClear() {
    if (messages.length === 0) return;
    if (!confirm('Effacer définitivement la conversation ?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        await fetch('/api/mandat-assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, mandat_id: mandat.id, action: 'reset' }),
        });
      }
    } catch (e) {
      console.error('[AI] clear error:', e);
    }

    setMessages([]);
  }

  async function startRecording() {
    if (recording || transcribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Arrête tous les tracks pour libérer le micro
        stream.getTracks().forEach(t => t.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size < 1000) return; // trop court

        setTranscribing(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (!token) {
            alert('Session expirée');
            return;
          }

          const formData = new FormData();
          formData.append('token', token);
          formData.append('audio', audioBlob, 'recording.webm');

          const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
          const data = await res.json();

          if (data.ok && data.text) {
            setInput(prev => prev ? prev + ' ' + data.text : data.text);
          } else {
            alert('Erreur transcription : ' + (data.error || 'inconnue'));
          }
        } catch (e) {
          alert('Erreur : ' + e.message);
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (e) {
      alert('Impossible d\'accéder au micro : ' + e.message);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }
  function handleRefresh() {
    if (typeof onMandatUpdate === 'function') onMandatUpdate();
  }

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3.5 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          style={{
            backgroundColor: '#9CAF88',
            backgroundImage: 'linear-gradient(135deg, #9CAF88 0%, #7B8F6A 100%)',
          }}
          title="Ouvrir l'assistant IA"
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-sm font-medium">Assistant IA</span>
        </button>
      )}

      {/* Panneau coulissant */}
      {open && (
        <div className="fixed top-0 right-0 z-50 h-screen w-[420px] max-w-[95vw] bg-white border-l border-stone-200 shadow-2xl flex flex-col">
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b border-stone-200"
            style={{ backgroundColor: '#9CAF88' }}
          >
            <div className="flex items-center gap-2 text-white">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-semibold">Assistant IA</h3>
              <span className="text-xs text-white/70">GPT-4o</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                className="text-white/80 hover:text-white p-1"
                title="Rafraîchir le mandat"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {messages.length > 0 && (
                <button
                  onClick={handleClear}
                  className="text-xs text-white/80 hover:text-white px-2 py-1 rounded"
                  title="Effacer la conversation"
                >
                  Effacer
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-white/80 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Sous-header avec nom du mandat */}
          <div className="px-5 py-3 border-b border-stone-100 bg-stone-50">
            <div className="text-xs text-stone-500 mb-0.5">Contexte</div>
            <div className="text-sm font-medium text-stone-800 truncate">{mandat?.nom || 'Mandat'}</div>
          </div>

          {/* Zone messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {!historyLoaded && (
              <div className="text-center text-sm text-stone-400 mt-4">
                <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin text-stone-300" />
                Chargement de la conversation...
              </div>
            )}

            {historyLoaded && messages.length === 0 && (
              <div className="text-center text-sm text-stone-400 mt-8">
                <Sparkles className="w-8 h-8 mx-auto mb-3 text-stone-300" />
                <p className="mb-1">Je peux modifier la fiche, lire les documents,</p>
                <p>générer des arguments, ou répondre à tes questions.</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-800'
                  }`}
                >
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  {/* Notif visuelle des champs modifiés */}
                  {msg.role === 'assistant' && msg.modified_fields && msg.modified_fields.length > 0 && (
                    <div className="mt-2 px-2 py-1.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600" />
                      <div>
                        <span className="font-medium">Fiche mise à jour :</span>{' '}
                        {msg.modified_fields.map(f => FIELD_LABELS[f] || f).join(', ')}
                      </div>
                    </div>
                  )}
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleCopy(i)}
                      className="mt-2 flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900"
                    >
                      {msg.copied ? (
                        <>
                          <Check className="w-3 h-3" /> Copié
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copier
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-stone-100 rounded-lg px-3.5 py-2.5 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-stone-500" />
                  <span className="text-xs text-stone-500">L'assistant réfléchit...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions */}
          <div className="px-4 py-3 border-t border-stone-100 bg-stone-50">
            <div className="text-xs text-stone-500 mb-2 uppercase tracking-wide font-medium">Actions rapides</div>
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map(action => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => handleQuickAction(action.id)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-stone-200 text-stone-700 rounded-lg text-xs hover:bg-stone-100 hover:border-stone-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </div>

         <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={loading || transcribing}
                placeholder={transcribing ? "Transcription en cours..." : (recording ? "🎤 Enregistrement..." : "Pose ta question ou clique sur le micro")}
                className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400 disabled:opacity-50"
              />
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={loading || transcribing}
                className={`flex items-center justify-center w-10 h-10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                  recording ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
                title={recording ? 'Arrêter l\'enregistrement' : 'Démarrer la dictée vocale'}
              >
                {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : (recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />)}
              </button>
              <button
                onClick={handleSend}
                disabled={loading || recording || transcribing || !input.trim()}
                className="flex items-center justify-center w-10 h-10 bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
