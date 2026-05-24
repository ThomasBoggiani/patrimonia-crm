// components/InboxTab.jsx
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Mail, RefreshCw, Search, Inbox, User as UserIcon, Paperclip, Reply, ExternalLink, AlertCircle, X, UserPlus, Link2, ArrowLeft, Trash2, Loader2, Eye, EyeOff, Briefcase, Bell, Building2, Receipt, Newspaper, HelpCircle, Sparkles, Undo2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import EmailPreviewModal from './EmailPreviewModal';
import InboxClientActionsModal from './InboxClientActionsModal';

const STATUT_FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'unread', label: 'Non-lus' },
  { id: 'today', label: "Aujourd'hui" },
  { id: 'crm', label: 'Clients CRM' }
];

const CATEGORIE_CONFIG = {
  business:     { label: 'Business',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Briefcase },
  notification: { label: 'Notification', color: 'bg-stone-100 text-stone-600 border-stone-200',       icon: Bell },
  internal:     { label: 'Interne',      color: 'bg-blue-100 text-blue-700 border-blue-200',          icon: Building2 },
  transaction:  { label: 'Transaction',  color: 'bg-amber-100 text-amber-700 border-amber-200',       icon: Receipt },
  newsletter:   { label: 'Newsletter',   color: 'bg-purple-100 text-purple-700 border-purple-200',    icon: Newspaper },
  autre:        { label: 'Autre',        color: 'bg-stone-100 text-stone-500 border-stone-200',       icon: HelpCircle }
};

const CATEGORIE_TABS = [
  { id: 'all',          label: 'Tous',         icon: Mail },
  { id: 'business',     label: 'Business',     icon: Briefcase },
  { id: 'internal',     label: 'Interne',      icon: Building2 },
  { id: 'transaction',  label: 'Transaction',  icon: Receipt },
  { id: 'notification', label: 'Notification', icon: Bell },
  { id: 'newsletter',   label: 'Newsletter',   icon: Newspaper },
  { id: 'autre',        label: 'Autre',        icon: HelpCircle }
];

const POLL_INTERVAL_MS = 60_000;
const SWIPE_THRESHOLD = 80;
const TOAST_DURATION = 5000;

export default function InboxTab({ onUnreadCountChange, reload, onOpenClient }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statutFilter, setStatutFilter] = useState('all');
  const [categorieFilter, setCategorieFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [undoToast, setUndoToast] = useState(null);

  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState(null);
  const [replyClient, setReplyClient] = useState(null);

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
    load(true);
    reload?.();
  }

  const pollRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expirée.');

      const apiFilter = statutFilter === 'crm' ? 'all' : statutFilter;

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

      if (Array.isArray(json.to_classify) && json.to_classify.length > 0) {
        fetch('/api/microsoft/inbox/classify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ messages: json.to_classify })
        })
          .then(r => r.json())
          .then(result => {
            console.log('[Inbox] Classification terminée:', result);
            load(true);
          })
          .catch(e => console.warn('[Inbox] classify error:', e.message));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statutFilter, onUnreadCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    pollRef.current = setInterval(() => load(true), POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [load]);

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const toArchive = messages
      .filter(m => (m.categorie === 'business' || m.categorie === 'internal') && !m.archived_at)
      .map(m => ({
        id: m.id,
        subject: m.subject || '',
        bodyPreview: m.bodyPreview || '',
        fromName: m.from?.name || '',
        fromAddress: m.from?.address || '',
        receivedDate: m.receivedDateTime,
        webLink: m.webLink,
        hasAttachments: m.hasAttachments || false,
        categorie: m.categorie,
        clientId: m.crm_client?.id || null
      }));

    if (toArchive.length === 0) return;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch('/api/microsoft/inbox/archive-and-extract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ emails: toArchive })
        });
        const json = await res.json();
        console.log('[Inbox] Archivage terminé:', json);
        if (json.archived > 0 || json.todosTotal > 0) {
          load(true);
        }
      } catch (e) {
        console.warn('[Inbox] archive error:', e.message);
      }
    })();
  }, [messages, load]);

  const categorieCounts = useMemo(() => {
    const counts = { all: messages.length };
    for (const tab of CATEGORIE_TABS) {
      if (tab.id !== 'all') {
        counts[tab.id] = messages.filter(m => m.categorie === tab.id).length;
      }
    }
    return counts;
  }, [messages]);

  const filteredMessages = useMemo(() => {
    let list = messages;
    if (statutFilter === 'crm') {
      list = list.filter(m => m.crm_client);
    }
    if (categorieFilter !== 'all') {
      list = list.filter(m => m.categorie === categorieFilter);
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
  }, [messages, statutFilter, categorieFilter, search]);

  const selected = useMemo(
    () => messages.find(m => m.id === selectedId),
    [messages, selectedId]
  );

  async function handleSelect(msg) {
    setSelectedId(msg.id);
    if (msg.isRead) return;
    await markAsRead(msg.id, true);
  }

  async function markAsRead(messageId, isRead) {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isRead } : m));
    const newUnread = messages.filter(m => !m.isRead && m.id !== messageId).length + (isRead ? 0 : 1);
    onUnreadCountChange?.(newUnread);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/microsoft/inbox', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ messageId, isRead })
      });
    } catch (e) {
      console.warn('[Inbox] mark as read KO:', e.message);
    }
  }

  function handleMarkUnread(msg) {
    markAsRead(msg.id, false);
  }

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

  async function handleDelete(msg) {
    if (!msg) return;

    if (msg.categorie === 'business') {
      const ok = window.confirm(
        `⚠️ ATTENTION : Cet email est classé BUSINESS.\n\n"${msg.subject || '(sans objet)'}"\n\nDe : ${msg.from?.name || msg.from?.address}\n\nEs-tu sûr de vouloir le supprimer ? Cette action ne peut pas être annulée facilement.`
      );
      if (!ok) return;
      await doDelete(msg, false);
      return;
    }

    await doDelete(msg, true);
  }

  async function doDelete(msg, withUndo) {
    setDeleting(true);
    setMessages(prev => prev.filter(m => m.id !== msg.id));
    if (selectedId === msg.id) setSelectedId(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/microsoft/inbox?messageId=${encodeURIComponent(msg.id)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Erreur ${res.status}`);
      }

      if (withUndo) {
        if (undoToast?.timeoutId) clearTimeout(undoToast.timeoutId);
        const timeoutId = setTimeout(() => setUndoToast(null), TOAST_DURATION);
        setUndoToast({ msg, timeoutId });
      }
    } catch (e) {
      console.error('[Inbox] Delete error:', e);
      setMessages(prev => [msg, ...prev].sort((a, b) =>
        new Date(b.receivedDateTime || 0) - new Date(a.receivedDateTime || 0)
      ));
      alert('Erreur de suppression : ' + e.message);
    } finally {
      setDeleting(false);
    }
  }

  function handleUndo() {
    if (undoToast?.timeoutId) clearTimeout(undoToast.timeoutId);
    setUndoToast(null);
    alert(
      'Pour récupérer cet email, va dans Outlook → dossier "Éléments supprimés" et déplace-le vers la boîte de réception.\n\nIl réapparaîtra ici au prochain rafraîchissement.'
    );
  }

  return (
    <div className="flex flex-col h-full p-3 md:p-6">
      <div className={`${selected ? 'hidden md:flex' : 'flex'} items-center justify-between mb-3 md:mb-4`}>
        <div className="flex items-center gap-2">
          <Inbox className="w-5 h-5 md:w-6 md:h-6 text-stone-700" />
          <h1 className="font-display text-xl md:text-2xl font-semibold text-stone-900">Inbox</h1>
          <span className="text-xs md:text-sm text-stone-500">({filteredMessages.length})</span>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs md:text-sm px-2.5 md:px-3 py-1.5 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Rafraîchir</span>
        </button>
      </div>

      {/* Onglets catégories (sticker bar) */}
      <div className={`${selected ? 'hidden md:block' : 'block'} mb-3`}>
        <div className="flex gap-1 overflow-x-auto scrollbar-thin pb-1">
          {CATEGORIE_TABS.map(tab => {
            const Icon = tab.icon;
            const count = categorieCounts[tab.id] || 0;
            const isActive = categorieFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCategorieFilter(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition border ${
                  isActive
                    ? 'bg-stone-900 text-white border-stone-900 font-medium shadow-sm'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`${selected ? 'hidden md:flex' : 'flex'} flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3 md:mb-4`}>
        <div className="flex gap-1 bg-stone-100 p-1 rounded-lg overflow-x-auto scrollbar-thin">
          {STATUT_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setStatutFilter(f.id)}
              className={`px-2.5 md:px-3 py-1.5 text-xs rounded-md transition whitespace-nowrap ${
                statutFilter === f.id
                  ? 'bg-white text-stone-900 shadow-sm font-medium'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-md">
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

      {error && (
        <div className="mb-3 md:mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start gap-2 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[400px_1fr] gap-4 overflow-hidden min-h-0">
        <div className={`${selected ? 'hidden md:block' : 'block'} bg-white border border-stone-200 rounded-xl overflow-y-auto`}>
          {loading && (
            <div className="p-8 text-center text-stone-400 text-sm">Chargement...</div>
          )}

          {!loading && filteredMessages.length === 0 && (
            <div className="p-8 text-center text-stone-400 text-sm">
              <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Aucun email dans cette catégorie.
            </div>
          )}

          {!loading && filteredMessages.map(msg => (
            <SwipeableMessageRow
              key={msg.id}
              msg={msg}
              isSelected={msg.id === selectedId}
              onClick={() => handleSelect(msg)}
              onMarkUnread={() => handleMarkUnread(msg)}
              onDelete={() => handleDelete(msg)}
            />
          ))}
        </div>

        <div className={`${selected ? 'block' : 'hidden md:block'} bg-white border border-stone-200 rounded-xl overflow-y-auto`}>
          {!selected ? (
            <div className="h-full flex items-center justify-center text-stone-400 text-sm p-6">
              Sélectionne un email pour le lire
            </div>
          ) : (
            <MessageDetail
              msg={selected}
              onReply={() => handleReply(selected)}
              onDelete={() => handleDelete(selected)}
              onCreateOrLink={() => openClientActions(selected)}
              onOpenClient={onOpenClient}
              onBack={() => setSelectedId(null)}
              deleting={deleting}
            />
          )}
        </div>
      </div>

      {/* Toast d'annulation suppression */}
      {undoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-stone-900 text-white px-4 py-3 rounded-xl shadow-xl border border-stone-700">
          <span className="text-sm">Email supprimé</span>
          <button
            onClick={handleUndo}
            className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Annuler
          </button>
        </div>
      )}

      <EmailPreviewModal
        isOpen={replyModalOpen}
        onClose={() => setReplyModalOpen(false)}
        draft={replyDraft}
        client={replyClient}
        onSent={() => setReplyModalOpen(false)}
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

function CategorieBadge({ categorie }) {
  if (!categorie) return null;
  const config = CATEGORIE_CONFIG[categorie] || CATEGORIE_CONFIG.autre;
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium uppercase tracking-wide ${config.color}`}>
      {config.label}
    </span>
  );
}

function SwipeableMessageRow({ msg, isSelected, onClick, onMarkUnread, onDelete }) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const hasMoved = useRef(false);

  const date = msg.receivedDateTime ? new Date(msg.receivedDateTime) : null;
  const today = new Date();
  const isToday = date && date.toDateString() === today.toDateString();
  const dateLabel = !date
    ? ''
    : isToday
      ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = touchStartX.current;
    hasMoved.current = false;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    touchCurrentX.current = e.touches[0].clientX;
    const delta = touchCurrentX.current - touchStartX.current;
    if (Math.abs(delta) > 5) hasMoved.current = true;
    const clamped = Math.max(-120, Math.min(120, delta));
    setTranslateX(clamped);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const delta = touchCurrentX.current - touchStartX.current;
    if (delta > SWIPE_THRESHOLD) {
      setTranslateX(0);
      onDelete();
    } else if (delta < -SWIPE_THRESHOLD) {
      setTranslateX(0);
      onMarkUnread();
    } else {
      setTranslateX(0);
    }
  };

  const handleClick = (e) => {
    if (hasMoved.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick();
  };

  return (
    <div className="relative overflow-hidden border-b border-stone-100">
      <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
        <div className={`flex items-center gap-2 text-red-600 transition-opacity ${translateX > 20 ? 'opacity-100' : 'opacity-0'}`}>
          <Trash2 className="w-5 h-5" />
          <span className="text-xs font-medium">Supprimer</span>
        </div>
        <div className={`flex items-center gap-2 text-purple-600 ml-auto transition-opacity ${translateX < -20 ? 'opacity-100' : 'opacity-0'}`}>
          <span className="text-xs font-medium">Non lu</span>
          <EyeOff className="w-5 h-5" />
        </div>
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        style={{ transform: `translateX(${translateX}px)`, transition: isDragging ? 'none' : 'transform 0.2s ease' }}
        className={`relative bg-white px-3 py-3 md:py-2.5 cursor-pointer transition-colors active:bg-purple-100 group ${
          isSelected ? 'md:bg-purple-50' : 'hover:bg-stone-50'
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
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <CategorieBadge categorie={msg.categorie} />
              {msg.todos_count > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-200 flex items-center gap-0.5 font-medium">
                  ✨ {msg.todos_count} tâche{msg.todos_count > 1 ? 's' : ''}
                </span>
              )}
              {msg.crm_client ? (
                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full flex items-center gap-1 border border-emerald-200">
                  <UserIcon className="w-2.5 h-2.5" />
                  {msg.crm_client.prenom} {msg.crm_client.nom}
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 bg-stone-50 text-stone-500 rounded-full border border-stone-200">
                  Pas dans le CRM
                </span>
              )}
              {msg.hasAttachments && (
                <Paperclip className="w-3 h-3 text-stone-400" />
              )}
            </div>
          </div>
        </div>

        {/* Boutons hover desktop */}
        <div className="hidden md:flex absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity gap-1 bg-white border border-stone-200 rounded-lg shadow-sm p-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onMarkUnread(); }}
            title="Marquer comme non lu"
            className="p-1.5 hover:bg-purple-50 rounded text-purple-600"
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Supprimer"
            className="p-1.5 hover:bg-red-50 rounded text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageDetail({ msg, onReply, onDelete, onCreateOrLink, onOpenClient, onBack, deleting }) {
  const date = msg.receivedDateTime ? new Date(msg.receivedDateTime).toLocaleString('fr-FR') : '';

  return (
    <div className="flex flex-col h-full">
      <div className="md:hidden sticky top-0 z-10 bg-white border-b border-stone-200 p-3 flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-2 py-1.5 -ml-1 text-sm text-purple-600 hover:bg-purple-50 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          Inbox
        </button>
      </div>

      <div className="p-4 md:p-6 space-y-4 flex-1">
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h2 className="font-display text-lg md:text-xl font-semibold text-stone-900 break-words">
              {msg.subject || '(sans objet)'}
            </h2>
            <CategorieBadge categorie={msg.categorie} />
          </div>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="text-sm text-stone-700 min-w-0">
              <div className="font-medium truncate">{msg.from?.name || msg.from?.address}</div>
              <div className="text-xs text-stone-500 truncate">{msg.from?.address}</div>
            </div>
            <div className="text-xs text-stone-500 flex-shrink-0">{date}</div>
          </div>
        </div>

        {msg.crm_client ? (
          <button
            onClick={() => onOpenClient?.(msg.crm_client.id)}
            className="w-full text-left p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-sm hover:bg-emerald-100 transition group"
          >
            <UserIcon className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            <span className="text-emerald-900 flex-1 min-w-0">
              <strong>{msg.crm_client.prenom} {msg.crm_client.nom}</strong>
              {msg.crm_client.societe && <span className="text-emerald-700"> · {msg.crm_client.societe}</span>}
            </span>
            <span className="text-xs text-emerald-700 hidden sm:inline opacity-0 group-hover:opacity-100 transition flex-shrink-0">
              Ouvrir →
            </span>
          </button>
        ) : (
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg flex flex-wrap items-center gap-2 text-sm">
            <span className="text-stone-600">⚠️ Pas dans le CRM</span>
            <button
              onClick={onCreateOrLink}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-purple-600 text-white rounded-md text-xs font-medium hover:bg-purple-700"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Créer / Lier
            </button>
          </div>
        )}

        <div className="border-t border-stone-200 pt-4">
          <div className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed break-words">
            {msg.bodyPreview || '(aperçu indisponible)'}
          </div>
          <div className="text-xs text-stone-400 mt-3 italic">
            ℹ️ Aperçu uniquement. Pour le contenu complet, ouvre l'email dans Outlook.
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 bg-white border-t border-stone-200 p-3 md:p-4 flex gap-2 flex-wrap">
        <button
          onClick={onReply}
          disabled={deleting}
          className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
        >
          <Reply className="w-4 h-4" />
          Répondre
        </button>
        {msg.webLink && (
          <a
            href={msg.webLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-stone-200 text-stone-700 rounded-lg text-sm hover:bg-stone-50"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">Outlook</span>
          </a>
        )}
        <button
          onClick={onDelete}
          disabled={deleting}
          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50 ml-auto"
          title="Supprimer cet email"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          <span className="hidden sm:inline">Supprimer</span>
        </button>
      </div>
    </div>
  );
}
