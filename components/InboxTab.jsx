// components/InboxTab.jsx
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Mail, RefreshCw, Search, Inbox, User as UserIcon, Paperclip, Reply, ExternalLink, AlertCircle, X, UserPlus, Link2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import EmailPreviewModal from './EmailPreviewModal';
import InboxClientActionsModal from './InboxClientActionsModal';

const FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'unread', label: 'Non-lus' },
  { id: 'today', label: "Aujourd'hui" },
  { id: 'crm', label: 'Clients CRM' }
];

const POLL_INTERVAL_MS = 60_000; // refresh auto toutes les 60s

export default function InboxTab({ onUnreadCountChange, reload }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Modale réponse
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState(null);
  const [replyClient, setReplyClient] = useState(null);

  // Modale actions client (créer / lier)
  const [clientActionsOpen, setClientActionsOpen] = useState(false);
  const [clientActionsContext, setClientActionsContext] = useState(null);

  function openClientActions(msg) {
    setClientActionsContext({
      fromName: msg.from?.name || '',
      fromEmail: msg.from?.address || '',
      emailSubject: msg.subject || '',
      emailPreview: msg.bodyPreview || ''
    });
    setClientActionsOpen(true);
  }

  function handleClientActionSuccess(client) {
    // Refresh des messages pour que le badge "Pas dans le CRM" disparaisse
    load(true);
    // Refresh des clients globaux pour mettre à jour la liste de l'onglet Clients
    reload?.();
  }

  const pollRef = useRef(null);

  // ─────────────────────────────────────────────────────
  // Chargement
  // ─────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expirée.');

      // Filter 'crm' → géré côté front (load all puis filtre)
      const apiFilter = filter === 'crm' ? 'all' : filter;

      const res = await fetch(`/api/microsoft/inbox?limit=50&filter=${apiFilter}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === 'NOT_CONNECTED') {
          throw new Error('Microsoft n\'est pas connecté. Va dans Intégrations pour le connecter.');
        }
        throw new Error(json.error || `Erreur ${res.status}`);
      }

      setMessages(json.messages || []);
      onUnreadCountChange?.(json.unread_count || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, onUnreadCountChange]);

  // Initial + reload sur changement de filtre
  useEffect(() => {
    load();
  }, [load]);

  // Polling auto
  useEffect(() => {
    pollRef.current = setInterval(() => load(true), POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [load]);

  // ─────────────────────────────────────────────────────
  // Filtrage côté front (search + crm)
  // ─────────────────────────────────────────────────────
  const filteredMessages = useMemo(() => {
    let list = messages;

    if (filter === 'crm') {
      list = list.filter(m => m.crm_client);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(m =>
        (m.subject || '').toLowerCase().includes(q) ||
        (m.from?.address || '').toLowerCase().includes(q) ||
        (m.from?.name || '').toLowerCase().includes(q) ||
        (m.bodyPreview || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [messages, filter, search]);

  const selected = useMemo(
    () => messages.find(m => m.id === selectedId),
    [messages, selectedId]
  );

  // ─────────────────────────────────────────────────────
  // Sélection d'un message → marque comme lu
  // ─────────────────────────────────────────────────────
  async function handleSelect(msg) {
    setSelectedId(msg.id);
    if (msg.isRead) return; // déjà lu

    // Optimistic UI
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isRead: true } : m));
    onUnreadCountChange?.(messages.filter(m => !m.isRead && m.id !== msg.id).length);

    // PATCH côté serveur (best effort, on ne bloque pas l'UI)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/microsoft/inbox', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ messageId: msg.id, isRead: true })
      });
    } catch (e) {
      console.warn('[Inbox] mark as read KO:', e.message);
    }
  }

  // ─────────────────────────────────────────────────────
  // Action : Répondre
  // ─────────────────────────────────────────────────────
  function handleReply(msg) {
    const fromName = msg.from?.name || msg.from?.address || '';
    const draft = {
      to: msg.from?.address || '',
      subject: msg.subject?.startsWith('Re:') ? msg.subject : `Re: ${msg.subject || ''}`,
      body_html: `<p></p><p>---</p><p><em>De ${fromName}, le ${new Date(msg.receivedDateTime).toLocaleString('fr-FR')}:</em></p><blockquote>${(msg.bodyPreview || '').replace(/\n/g, '<br>')}</blockquote>`,
      intent: 'reponse'
    };
    setReplyDraft(draft);
    setReplyClient(msg.crm_client || { id: null, email: msg.from?.address });
    setReplyModalOpen(true);
  }

  // ─────────────────────────────────────────────────────
  // Rendu
  // ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Inbox className="w-6 h-6 text-stone-700" />
          <h1 className="font-display text-2xl font-semibold text-stone-900">Inbox</h1>
          <span className="text-sm text-stone-500">({filteredMessages.length})</span>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Rafraîchir
        </button>
      </div>

      {/* Filtres + Recherche */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 bg-stone-100 p-1 rounded-lg">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-xs rounded-md transition ${
                filter === f.id
                  ? 'bg-white text-stone-900 shadow-sm font-medium'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start gap-2 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Maître / Détail */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4 overflow-hidden">
        {/* LISTE */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-y-auto">
          {loading && (
            <div className="p-8 text-center text-stone-400 text-sm">Chargement...</div>
          )}

          {!loading && filteredMessages.length === 0 && (
            <div className="p-8 text-center text-stone-400 text-sm">
              <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Aucun email.
            </div>
          )}

          {!loading && filteredMessages.map(msg => (
            <MessageRow
              key={msg.id}
              msg={msg}
              isSelected={msg.id === selectedId}
              onClick={() => handleSelect(msg)}
            />
          ))}
        </div>

        {/* DÉTAIL */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-y-auto hidden lg:block">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-stone-400 text-sm">
              Sélectionne un email pour le lire
            </div>
          ) : (
            <MessageDetail
              msg={selected}
              onReply={() => handleReply(selected)}
              onCreateOrLink={() => openClientActions(selected)}
            />
          )}
        </div>
      </div>

      {/* Modale réponse */}
      <EmailPreviewModal
        isOpen={replyModalOpen}
        onClose={() => setReplyModalOpen(false)}
        draft={replyDraft}
        client={replyClient}
        onSent={() => {
          setReplyModalOpen(false);
        }}
      />

      <InboxClientActionsModal
        isOpen={clientActionsOpen}
        onClose={() => setClientActionsOpen(false)}
        fromName={clientActionsContext?.fromName}
        fromEmail={clientActionsContext?.fromEmail}
        emailSubject={clientActionsContext?.emailSubject}
        emailPreview={clientActionsContext?.emailPreview}
        onSuccess={handleClientActionSuccess}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Sous-composant : ligne de message dans la liste
// ─────────────────────────────────────────────────────────
function MessageRow({ msg, isSelected, onClick }) {
  const date = msg.receivedDateTime ? new Date(msg.receivedDateTime) : null;
  const today = new Date();
  const isToday = date && date.toDateString() === today.toDateString();
  const dateLabel = !date
    ? ''
    : isToday
      ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

  return (
    <div
      onClick={onClick}
      className={`px-3 py-2.5 border-b border-stone-100 cursor-pointer transition ${
        isSelected ? 'bg-purple-50' : 'hover:bg-stone-50'
      } ${!msg.isRead ? 'border-l-2 border-l-purple-500' : ''}`}
    >
      <div className="flex items-start gap-2">
        {!msg.isRead && (
          <span className="mt-1.5 w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className={`text-sm truncate ${!msg.isRead ? 'font-semibold text-stone-900' : 'text-stone-700'}`}>
              {msg.from?.name || msg.from?.address || '(inconnu)'}
            </div>
            <div className="text-xs text-stone-400 flex-shrink-0">{dateLabel}</div>
          </div>
          <div className={`text-sm truncate ${!msg.isRead ? 'font-medium text-stone-900' : 'text-stone-600'}`}>
            {msg.subject || '(sans objet)'}
          </div>
          <div className="text-xs text-stone-500 truncate mt-0.5">
            {msg.bodyPreview}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            {msg.crm_client ? (
              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1">
                <UserIcon className="w-2.5 h-2.5" />
                {msg.crm_client.prenom} {msg.crm_client.nom}
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded-full">
                Pas dans le CRM
              </span>
            )}
            {msg.hasAttachments && (
              <Paperclip className="w-3 h-3 text-stone-400" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Sous-composant : détail d'un message
// ─────────────────────────────────────────────────────────
function MessageDetail({ msg, onReply, onCreateOrLink }) {
  const date = msg.receivedDateTime ? new Date(msg.receivedDateTime).toLocaleString('fr-FR') : '';

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-stone-900 mb-2">
          {msg.subject || '(sans objet)'}
        </h2>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-stone-700">
            <div className="font-medium">{msg.from?.name || msg.from?.address}</div>
            <div className="text-xs text-stone-500">{msg.from?.address}</div>
          </div>
          <div className="text-xs text-stone-500">{date}</div>
        </div>
      </div>

      {msg.crm_client ? (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-sm">
          <UserIcon className="w-4 h-4 text-emerald-700" />
          <span className="text-emerald-900">
            <strong>{msg.crm_client.prenom} {msg.crm_client.nom}</strong>
            {msg.crm_client.societe && <span className="text-emerald-700"> · {msg.crm_client.societe}</span>}
          </span>
        </div>
      ) : (
        <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg flex flex-wrap items-center gap-2 text-sm">
          <span className="text-stone-600">⚠️ Cet expéditeur n'est pas dans le CRM</span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onCreateOrLink}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-600 text-white rounded-md text-xs font-medium hover:bg-purple-700"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Créer / Lier
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-stone-200 pt-4">
        <div className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
          {msg.bodyPreview || '(aperçu indisponible)'}
        </div>
        <div className="text-xs text-stone-400 mt-3 italic">
          ℹ️ Aperçu uniquement. Pour le contenu complet, ouvre l'email dans Outlook.
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-stone-100">
        <button
          onClick={onReply}
          className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
        >
          <Reply className="w-4 h-4" />
          Répondre
        </button>
        {msg.webLink && (
           <a
            href={msg.webLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-stone-200 text-stone-700 rounded-lg text-sm hover:bg-stone-50"
          >
            <ExternalLink className="w-4 h-4" />
            Ouvrir dans Outlook
          </a>
        )}
      </div>
    </div>
  );
}
