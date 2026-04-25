'use client';
import React, { useState, useEffect } from 'react';
import { Mail, Send, ExternalLink, Loader2, AlertCircle, X, ChevronDown, ChevronUp, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function ClientEmails({ client }) {
  const { user } = useAuth();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(null);
  const [error, setError] = useState(null);
  const [showCompose, setShowCompose] = useState(false);
  const [expandedEmail, setExpandedEmail] = useState(null);

  useEffect(() => {
    if (!user || !client?.email) return;
    checkConnection();
  }, [user, client]);

  useEffect(() => {
    if (outlookConnected && client?.email) loadEmails();
  }, [outlookConnected, client?.email]);

  async function checkConnection() {
    const { data } = await supabase
      .from('user_integrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .maybeSingle();
    setOutlookConnected(!!data);
  }

  async function loadEmails() {
    if (!client?.email) return;
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `/api/microsoft/emails?email=${encodeURIComponent(client.email)}`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur');
      }
      const { emails } = await res.json();
      setEmails(emails || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!client?.email) {
    return (
      <div className="text-sm text-ink/60 italic p-4 bg-cream-50 rounded-lg border border-cream-dark">
        Renseignez une adresse email sur ce client pour voir les échanges Outlook.
      </div>
    );
  }

  if (outlookConnected === false) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div className="flex items-start gap-2 text-sm">
          <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-900">Outlook non connecté.</strong>
            <span className="text-amber-800"> Connectez votre compte Microsoft 365 dans Intégrations pour voir les emails.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wide text-sage-dark font-medium">
          Emails échangés ({emails.length})
        </div>
        <div className="flex gap-2">
          <button onClick={loadEmails} disabled={loading}
            className="text-xs text-ink/60 hover:text-ink disabled:opacity-50">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : '↻'}
          </button>
          <button onClick={() => setShowCompose(true)}
            className="flex items-center gap-1 px-3 py-1 bg-sage-dark text-white rounded-md text-xs font-medium hover:opacity-90">
            <Send className="w-3 h-3" /> Nouvel email
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs bg-red-50 border border-red-200 rounded p-2 text-red-800 mb-3">
          {error}
        </div>
      )}

      {loading && emails.length === 0 ? (
        <div className="text-center py-6 text-xs text-ink/60">
          <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Chargement des emails...
        </div>
      ) : emails.length === 0 ? (
        <div className="text-center py-6 text-xs text-ink/60 bg-cream-50 rounded-lg border border-dashed border-cream-dark">
          Aucun échange par email avec {client.email}
        </div>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {emails.map(email => {
            const isFromMe = email.from?.emailAddress?.address?.toLowerCase() !== client.email.toLowerCase();
            const fromName = email.from?.emailAddress?.name || email.from?.emailAddress?.address || '?';
            const date = new Date(email.receivedDateTime);
            const isExpanded = expandedEmail === email.id;
            
            return (
              <div key={email.id} className="bg-white border border-cream-dark rounded-lg overflow-hidden">
                <div 
                  className="px-3 py-2 cursor-pointer hover:bg-cream-50"
                  onClick={() => setExpandedEmail(isExpanded ? null : email.id)}
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isFromMe ? 'bg-sage-50 text-sage-darker' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {isFromMe ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-medium text-ink truncate">
                          {isFromMe ? `Vers ${client.prenom || client.nom}` : fromName}
                        </div>
                        <div className="text-[10px] text-ink/50 flex-shrink-0">
                          {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                      <div className={`text-xs ${email.isRead ? 'text-ink/80' : 'text-ink font-semibold'} truncate`}>
                        {email.subject || '(Sans objet)'}
                      </div>
                      {!isExpanded && (
                        <div className="text-[11px] text-ink/60 truncate mt-0.5">
                          {email.bodyPreview}
                        </div>
                      )}
                    </div>
                    <button className="text-ink/40 hover:text-ink flex-shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-cream-dark bg-cream-50/50">
                    <div className="text-xs text-ink/80 mt-2 whitespace-pre-wrap leading-relaxed">
                      {email.bodyPreview}
                    </div>
                    {email.webLink && (
                      <a href={email.webLink} target="_blank" rel="noopener"
                        className="inline-flex items-center gap-1 text-[11px] text-sage-dark hover:underline mt-2">
                        <ExternalLink className="w-3 h-3" /> Ouvrir dans Outlook
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCompose && (
        <ComposeEmailModal 
          client={client}
          onClose={() => setShowCompose(false)}
          onSent={() => { setShowCompose(false); loadEmails(); }}
        />
      )}
    </div>
  );
}

function ComposeEmailModal({ client, onClose, onSent }) {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  // Templates rapides
  const templates = [
    { 
      name: 'Présentation', 
      subject: 'Opportunités d\'investissement immobilier - Immeubles & Patrimoine',
      content: `Bonjour ${client.prenom || ''},\n\nJ'espère que vous allez bien.\n\nJe me permets de vous contacter au sujet de plusieurs opportunités d'investissement immobilier qui pourraient correspondre à vos critères.\n\nSeriez-vous disponible cette semaine pour un échange ?\n\nCordialement,`
    },
    { 
      name: 'Suivi visite', 
      subject: 'Retour sur notre visite',
      content: `Bonjour ${client.prenom || ''},\n\nMerci pour le temps consacré à la visite ce jour.\n\nN'hésitez pas à revenir vers moi pour toute question complémentaire ou pour une nouvelle visite.\n\nDans l'attente de vous lire,\n\nCordialement,`
    },
    { 
      name: 'Proposition mandat', 
      subject: 'Nouveau mandat - {Adresse}',
      content: `Bonjour ${client.prenom || ''},\n\nJe pense avoir trouvé un bien qui correspond précisément à votre cahier des charges :\n\n• Adresse :\n• Type :\n• Surface :\n• Prix :\n\nLes documents complets sont en pièce jointe. Souhaitez-vous organiser une visite ?\n\nCordialement,`
    }
  ];

  const useTemplate = (t) => {
    setSubject(t.subject);
    setContent(t.content);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/microsoft/emails', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: client.email,
          subject,
          content: content.replace(/\n/g, '<br>'),
          clientId: client.id
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur');
      }
      onSent();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-cream-dark">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">Nouvel email</h2>
            <p className="text-xs text-ink/60 mt-0.5">À : {client.email}</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-ink"><X className="w-5 h-5" /></button>
        </div>

        {error && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSend} className="p-5 space-y-3 flex-1 overflow-y-auto">
          <div>
            <label className="text-xs text-ink/70 block mb-1">Templates rapides</label>
            <div className="flex flex-wrap gap-2">
              {templates.map((t, i) => (
                <button key={i} type="button" onClick={() => useTemplate(t)}
                  className="px-2 py-1 text-xs bg-cream-50 hover:bg-cream-100 border border-cream-dark rounded">
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-ink/70 block mb-1">Objet *</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} required
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-ink/70 block mb-1">Message *</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} required rows={10}
              placeholder="Tapez votre message..."
              className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm font-mono leading-relaxed" />
          </div>
        </form>

        <div className="flex gap-2 justify-end p-5 border-t border-cream-dark bg-cream-50/50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-ink/70 hover:bg-cream-100 rounded-lg">Annuler</button>
          <button onClick={handleSend} disabled={sending || !subject || !content}
            className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink disabled:opacity-50 flex items-center gap-1.5">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
