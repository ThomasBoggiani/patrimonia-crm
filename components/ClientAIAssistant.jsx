// components/ClientAIAssistant.jsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import EmailPreviewModal from './EmailPreviewModal';

const QUICK_ACTIONS = [
  { id: 'matchs', label: '🎯 Trouver des mandats matchs', prompt: 'Trouve-moi les mandats actifs qui correspondent le mieux au profil de ce client. Justifie tes choix.' },
  { id: 'relance', label: '📧 Rédiger une relance', prompt: 'Rédige un email de relance court et chaleureux pour ce client. Adapte-toi à son historique.' },
  { id: 'resume', label: '📊 Résumer l\'historique', prompt: 'Fais-moi un résumé synthétique de la relation avec ce client : où on en est, ce qui a été dit/fait, et quels sont les points d\'attention.' },
  { id: 'presentation', label: '✨ Email de présentation', prompt: 'Propose-moi un email de présentation des mandats actifs qui matchent le profil de ce client. Sois précis et persuasif.' }
];

export default function ClientAIAssistant({ client, currentUser, mandats = [], onMandatClick }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  // Modale email
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [currentDraft, setCurrentDraft] = useState(null);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const clientId = client?.id;

  // ─────────────────────────────────────────────────────
  // Chargement initial de la conversation
  // ─────────────────────────────────────────────────────
  const loadConversation = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expirée.');

      const res = await fetch(`/api/clients/${clientId}/ai-chat`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Erreur ${res.status}`);
      }
      const json = await res.json();
      setMessages(json.messages || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // Scroll auto en bas quand un nouveau message arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, suggestion]);

  // ─────────────────────────────────────────────────────
  // Envoi d'un message
  // ─────────────────────────────────────────────────────
  async function sendMessage(text) {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;

    setSending(true);
    setError('');
    setInput('');

    // Optimistic UI
    setMessages(prev => [...prev, { role: 'user', content: msg, ts: new Date().toISOString() }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expirée.');

      const res = await fetch(`/api/clients/${clientId}/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ message: msg })
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);

      // Push réponse assistant avec tools
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: json.reply || '(action exécutée)',
        tools: json.tools || [],
        ts: new Date().toISOString()
      }]);

      // Si l'IA a généré un brouillon d'email, ouvrir auto la modale
      const emailTool = (json.tools || []).find(t => t.name === 'draft_email');
      if (emailTool?.result?.payload) {
        setCurrentDraft(emailTool.result.payload);
        setEmailModalOpen(true);
      }

    } catch (e) {
      setError(e.message);
      // Rollback du message user en cas d'erreur (optionnel — ici on le garde)
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  // ─────────────────────────────────────────────────────
  // Génération suggestion proactive
  // ─────────────────────────────────────────────────────
  async function generateSuggestion() {
    setLoadingSuggestion(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expirée.');

      const res = await fetch(`/api/clients/${clientId}/ai-suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);

      setSuggestion(json.suggestions || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingSuggestion(false);
    }
  }

  // ─────────────────────────────────────────────────────
  // Reset conversation
  // ─────────────────────────────────────────────────────
  async function resetConversation() {
    if (!confirm('Effacer toute la conversation IA pour ce client ?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expirée.');
      await fetch(`/api/clients/${clientId}/ai-chat`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      setMessages([]);
      setSuggestion('');
    } catch (e) {
      setError(e.message);
    }
  }

  // ─────────────────────────────────────────────────────
  // Rendu
  // ─────────────────────────────────────────────────────
  if (!clientId) {
    return <div className="p-4 text-sm text-gray-500">Aucun client sélectionné.</div>;
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="flex items-center gap-2">
          <span className="text-xl">✨</span>
          <div>
            <div className="font-semibold text-sm">Assistant IA</div>
            <div className="text-xs text-gray-500">
              {client?.prenom} {client?.nom} {client?.societe ? `· ${client.societe}` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generateSuggestion}
            disabled={loadingSuggestion}
            className="text-xs px-2.5 py-1.5 bg-white border border-purple-200 text-purple-700 rounded-md hover:bg-purple-50 disabled:opacity-50 flex items-center gap-1"
            title="Générer une suggestion contextuelle"
          >
            {loadingSuggestion ? '...' : '💡'} Suggestion
          </button>
          <button
            onClick={resetConversation}
            className="text-xs px-2 py-1.5 text-gray-400 hover:text-red-500"
            title="Effacer la conversation"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-gray-100 bg-gray-50">
        {QUICK_ACTIONS.map(qa => (
          <button
            key={qa.id}
            onClick={() => sendMessage(qa.prompt)}
            disabled={sending}
            className="text-xs px-2.5 py-1 bg-white border border-gray-200 rounded-full hover:bg-purple-50 hover:border-purple-200 disabled:opacity-50"
          >
            {qa.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && (
          <div className="text-sm text-gray-400 text-center py-8">Chargement de la conversation...</div>
        )}

        {!loading && messages.length === 0 && !suggestion && (
          <div className="text-sm text-gray-400 text-center py-12">
            <div className="text-3xl mb-2">✨</div>
            <div>Bonjour ! Pose-moi une question sur ce client,</div>
            <div>ou clique sur une action rapide ci-dessus.</div>
          </div>
        )}

        {/* Bloc Suggestion (au-dessus de la conversation) */}
        {suggestion && (
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-3 text-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-purple-900 flex items-center gap-1">
                💡 Suggestion contextuelle
              </span>
              <button
                onClick={() => setSuggestion('')}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                ×
              </button>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {suggestion}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((m, i) => (
          <MessageBubble
            key={i}
            message={m}
            mandats={mandats}
            onMandatClick={onMandatClick}
            onOpenDraft={(draft) => {
              setCurrentDraft(draft);
              setEmailModalOpen(true);
            }}
          />
        ))}

        {sending && (
          <div className="flex items-center gap-2 text-sm text-gray-400 italic">
            <span className="inline-block w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
            <span className="inline-block w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
            <span className="inline-block w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
            L'IA réfléchit...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3 bg-white">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ||
                  (e.key === 'Enter' && !e.shiftKey && input.length < 200)) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Pose une question ou demande une action... (Entrée pour envoyer)"
            disabled={sending}
            rows={2}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={sending || !input.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? '...' : 'Envoyer'}
          </button>
        </div>
        <div className="text-[10px] text-gray-400 mt-1 px-1">
          Modèle : Claude Haiku 4.5 · La conversation est sauvegardée et privée pour vous.
        </div>
      </div>

      {/* Modale email */}
      <EmailPreviewModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        draft={currentDraft}
        client={client}
        onSent={() => {
          // Push un message système dans la conversation locale
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: '✅ Email envoyé avec succès via Outlook. Une interaction a été loggée.',
            ts: new Date().toISOString()
          }]);
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Sous-composant : bulle de message
// ─────────────────────────────────────────────────────────
function MessageBubble({ message, mandats, onMandatClick, onOpenDraft }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
          isUser
            ? 'bg-purple-600 text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-900 rounded-bl-sm'
        }`}
      >
        {/* Texte principal */}
        {message.content && (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        )}

        {/* Rendu des tools */}
        {!isUser && message.tools && message.tools.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.tools.map((t, idx) => (
              <ToolRender
                key={idx}
                tool={t}
                mandats={mandats}
                onMandatClick={onMandatClick}
                onOpenDraft={onOpenDraft}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Sous-composant : rendu d'un tool (mandats / email / tâche / ...)
// ─────────────────────────────────────────────────────────
function ToolRender({ tool, mandats, onMandatClick, onOpenDraft }) {
  if (!tool || !tool.result) return null;
  const { name, input, result } = tool;

  if (!result.ok) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md px-2 py-1.5 text-xs text-red-700">
        ⚠️ Action {name} a échoué : {result.error}
      </div>
    );
  }

  // 1) Recommandation de mandats
  if (name === 'recommend_mandats') {
    const ids = input?.mandat_ids || [];
    const notes = input?.per_mandat_notes || [];
    const justif = input?.justification || '';
    const matched = ids.map(id => mandats.find(m => m.id === id)).filter(Boolean);

    return (
      <div className="bg-white border border-purple-200 rounded-lg p-2.5 space-y-2">
        <div className="text-xs font-medium text-purple-900 flex items-center gap-1">
          🎯 {matched.length} mandat{matched.length > 1 ? 's' : ''} recommandé{matched.length > 1 ? 's' : ''}
        </div>
        {justif && <div className="text-xs text-gray-600 italic">{justif}</div>}
        {matched.length === 0 && (
          <div className="text-xs text-gray-500">Les mandats référencés ne sont plus chargés. Réessaie.</div>
        )}
        {matched.map((m, i) => (
          <div
            key={m.id}
            onClick={() => onMandatClick?.(m)}
            className="border border-gray-200 rounded-md p-2 hover:border-purple-300 hover:bg-purple-50/50 cursor-pointer transition"
          >
            <div className="font-medium text-xs text-gray-900">
              {m.titre || m.adresse || m.type_bien || 'Mandat'}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              {[m.ville, m.quartier].filter(Boolean).join(' · ')}
              {m.surface ? ` · ${m.surface}m²` : ''}
              {m.prix_affichage ? ` · ${Number(m.prix_affichage).toLocaleString('fr-FR')} €` : ''}
            </div>
            {notes[i] && (
              <div className="text-[11px] text-purple-700 mt-1 italic">→ {notes[i]}</div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // 2) Brouillon d'email
  if (name === 'draft_email') {
    return (
      <div className="bg-white border border-blue-200 rounded-lg p-2.5">
        <div className="text-xs font-medium text-blue-900 mb-1">
          ✉️ Brouillon d'email préparé
        </div>
        <div className="text-xs text-gray-600 mb-1.5">
          <span className="font-medium">Objet :</span> {input?.subject}
        </div>
        <button
          onClick={() => onOpenDraft?.(result.payload)}
          className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Voir et envoyer
        </button>
      </div>
    );
  }

  // 3) Tâche créée
  if (name === 'create_task') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-md px-2 py-1.5 text-xs text-green-800">
        ✅ Tâche créée : <strong>{input?.titre}</strong>
        {input?.echeance && <span className="text-green-700"> · échéance {input.echeance}</span>}
      </div>
    );
  }

  // 4) Interaction loggée
  if (name === 'log_interaction') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-md px-2 py-1.5 text-xs text-blue-800">
        📝 Interaction loggée ({input?.type}) : {input?.resume?.slice(0, 80)}...
      </div>
    );
  }

  // 5) Fiche client mise à jour
  if (name === 'update_client') {
    const fields = Object.keys(input || {}).join(', ');
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 text-xs text-amber-800">
        ✏️ Fiche client mise à jour : {fields}
      </div>
    );
  }

  // Fallback
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-xs text-gray-600">
      🔧 {name}
    </div>
  );
}
