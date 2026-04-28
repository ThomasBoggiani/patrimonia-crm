// ═══════════════════════════════════════════════════════════════════
// components/MandatAIAssistant.jsx
// Sidebar IA contextuelle pour un mandat (FAB + panneau coulissant)
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Copy, Check, FileText, Mail, Target, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase'; // adapte ce chemin si besoin

// Quick actions disponibles
const QUICK_ACTIONS = [
  { id: 'descriptif',     label: 'Descriptif',      icon: FileText, hint: 'Génère un descriptif marketing pour les portails' },
  { id: 'email_mandant',  label: 'Email mandant',   icon: Mail,     hint: 'Rédige un email de point d\'étape au vendeur' },
  { id: 'argumentaire',   label: 'Argumentaire',    icon: Target,   hint: 'Construit un argumentaire de vente avec objections' },
];

export default function MandatAIAssistant({ mandat }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // [{ role, content, copied? }]
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll vers le dernier message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  async function callAI({ action, message }) {
    if (!mandat?.id) return;
    setLoading(true);

    // Ajouter le message user (visible)
    const userLabel = action
      ? QUICK_ACTIONS.find(a => a.id === action)?.label || action
      : message;
    const userVisible = action ? `[Action] ${userLabel}` : message;

    setMessages(prev => [...prev, { role: 'user', content: userVisible }]);

    try {
      // Récupérer le token Supabase
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

      // Construire l'historique pour le contexte (uniquement les messages textuels)
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .filter(m => !m.content.startsWith('[Action]')) // exclure les pseudo-messages d'actions
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch(`/api/mandats/${mandat.id}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action, message, history }),
      });

      const data = await res.json();

      if (!data.ok) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `⚠️ Erreur : ${data.error || 'inconnue'}`,
        }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
      }
    } catch (err) {
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
    callAI({ message: text });
  }

  function handleQuickAction(actionId) {
    if (loading) return;
    callAI({ action: actionId });
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

  function handleClear() {
    if (messages.length === 0) return;
    if (confirm('Effacer la conversation ?')) {
      setMessages([]);
    }
  }

  return (
    <>
      {/* FAB — Bouton flottant */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3.5 bg-gradient-to-br from-sage-600 to-sage-700 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all"
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
        <div
          className="fixed top-0 right-0 z-50 h-screen w-[420px] max-w-[95vw] bg-white border-l border-stone-200 shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b border-stone-200"
            style={{ backgroundColor: '#9CAF88' }}
          >
            <div className="flex items-center gap-2 text-white">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-semibold">Assistant IA</h3>
            </div>
            <div className="flex items-center gap-2">
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
            {messages.length === 0 && (
              <div className="text-center text-sm text-stone-400 mt-8">
                <Sparkles className="w-8 h-8 mx-auto mb-3 text-stone-300" />
                Lance une action rapide ou pose ta question.
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
                <div className="bg-stone-100 rounded-lg px-3.5 py-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-stone-500" />
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
                    title={action.hint}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-stone-200 text-stone-700 rounded-lg text-xs hover:bg-stone-100 hover:border-stone-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Zone input */}
          <div className="p-4 border-t border-stone-200 bg-white">
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
                disabled={loading}
                placeholder="Pose ta question..."
                className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="flex items-center justify-center w-10 h-10 bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
