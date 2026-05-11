'use client';

import { useState, useEffect } from 'react';
import { X, Mail, Loader2, RefreshCw, Send, Check, AlertCircle, Sparkles, FileText, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function EmailDraftsModal({ mandat, clients, onClose, initialClientIds = [] }) {
  // matches[i] = { client, score, raisons, draft: { subject, body, htmlBody }, loading, error, selected, sent }
  const [matches, setMatches] = useState([]);
  const [globalSending, setGlobalSending] = useState(false);
  const [attachPlaquette, setAttachPlaquette] = useState(true);
  const [result, setResult] = useState(null); // { sentCount, failedCount, errors }

  // Au chargement : pré-remplit la liste avec les clients fournis OU calcule le matching côté serveur
  useEffect(() => {
    if (!mandat) return;
    initializeMatches();
  }, [mandat?.id]);

  async function initializeMatches() {
    // Filtre les clients passés en initialClientIds, sinon tous les clients actifs
    const filteredClients = initialClientIds.length > 0
      ? clients.filter(c => initialClientIds.includes(c.id))
      : clients.filter(c => c.statut === 'Actif');

    // Pour chaque client, on déclenche la génération en parallèle
    const initial = filteredClients.map(c => ({
      client: c,
      score: 0,
      raisons: [],
      draft: { subject: '', body: '', htmlBody: '' },
      loading: true,
      error: null,
      selected: true, // sélectionné par défaut
      sent: false,
    }));
    setMatches(initial);

    // Génération en parallèle
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setMatches(prev => prev.map(m => ({ ...m, loading: false, error: 'Pas de session' })));
      return;
    }

    await Promise.all(filteredClients.map(async (client, idx) => {
      try {
        const res = await fetch('/api/email-drafts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, mandatId: mandat.id, clientId: client.id }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Erreur génération');

        setMatches(prev => prev.map((m, i) =>
          i === idx ? {
            ...m,
            score: data.score,
            raisons: data.matchReasons,
            draft: { subject: data.subject, body: data.body, htmlBody: data.htmlBody },
            loading: false,
            error: null,
          } : m
        ));
      } catch (e) {
        setMatches(prev => prev.map((m, i) =>
          i === idx ? { ...m, loading: false, error: e.message } : m
        ));
      }
    }));
  }

  async function regenerateOne(idx) {
    const client = matches[idx]?.client;
    if (!client) return;
    setMatches(prev => prev.map((m, i) => i === idx ? { ...m, loading: true, error: null } : m));

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    try {
      const res = await fetch('/api/email-drafts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, mandatId: mandat.id, clientId: client.id }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Erreur génération');
      setMatches(prev => prev.map((m, i) =>
        i === idx ? {
          ...m,
          score: data.score,
          raisons: data.matchReasons,
          draft: { subject: data.subject, body: data.body, htmlBody: data.htmlBody },
          loading: false,
          error: null,
        } : m
      ));
    } catch (e) {
      setMatches(prev => prev.map((m, i) => i === idx ? { ...m, loading: false, error: e.message } : m));
    }
  }

  function updateField(idx, field, value) {
    setMatches(prev => prev.map((m, i) =>
      i === idx ? { ...m, draft: { ...m.draft, [field]: value } } : m
    ));
  }

  function toggleSelect(idx) {
    setMatches(prev => prev.map((m, i) => i === idx ? { ...m, selected: !m.selected } : m));
  }

  async function sendAll() {
    const toSend = matches.filter(m => m.selected && !m.sent && !m.loading && !m.error && m.draft.subject && m.draft.htmlBody && m.client.email);
    if (toSend.length === 0) {
      alert('Aucun email \u00e0 envoyer (s\u00e9lection vide ou clients sans email)');
      return;
    }
    if (!confirm(`Envoyer ${toSend.length} email(s) ?`)) return;

    setGlobalSending(true);
    setResult(null);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    try {
      const emails = toSend.map(m => ({
        clientId: m.client.id,
        to: m.client.email,
        subject: m.draft.subject,
        htmlBody: m.draft.htmlBody,
        body: m.draft.body,
      }));

      const res = await fetch('/api/email-drafts/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, mandatId: mandat.id, emails, attachPlaquette }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Erreur envoi');

      // Marquer les envois r\u00e9ussis
      const sentClientIds = new Set((data.sent || []).map(s => s.clientId));
      setMatches(prev => prev.map(m => sentClientIds.has(m.client.id) ? { ...m, sent: true } : m));
      setResult({ sentCount: data.sentCount, failedCount: data.failedCount, errors: data.errors });

    } catch (e) {
      alert('Erreur : ' + e.message);
    } finally {
      setGlobalSending(false);
    }
  }

  const selectedCount = matches.filter(m => m.selected && !m.sent && !m.loading).length;
  const sentCount = matches.filter(m => m.sent).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <Mail className="w-5 h-5 text-sage-dark" />
            Pr&eacute;parer emails clients matchant
            <span className="text-sm font-normal text-stone-500">&middot; {mandat?.nom}</span>
            {globalSending && <Loader2 className="w-4 h-4 animate-spin text-stone-400 ml-2" />}
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-stone-200 bg-stone-50 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
            <input type="checkbox" checked={attachPlaquette} onChange={(e) => setAttachPlaquette(e.target.checked)} className="rounded" />
            <FileText className="w-4 h-4" />
            Joindre la plaquette PDF
          </label>
          <div className="flex-1" />
          <span className="text-sm text-stone-600">{selectedCount} email(s) s&eacute;lectionn&eacute;(s)</span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {result && (
            <div className={`mb-4 p-3 rounded-lg border ${result.failedCount === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <div className="flex items-center gap-2 font-medium">
                {result.failedCount === 0 ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {result.sentCount} email(s) envoy&eacute;(s)
                {result.failedCount > 0 && ` &middot; ${result.failedCount} \u00e9chec(s)`}
              </div>
              {result.errors?.length > 0 && (
                <div className="text-xs mt-1 opacity-80">Erreurs : {result.errors.join(', ')}</div>
              )}
            </div>
          )}

          {matches.length === 0 && (
            <div className="text-center py-12 text-stone-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Recherche des clients matchant&hellip;
            </div>
          )}

          <div className="space-y-3">
            {matches.map((m, idx) => {
              const hasEmail = !!m.client.email;
              const clientName = `${m.client.prenom || ''} ${m.client.nom || ''}`.trim() || m.client.societe || 'Client';
              return (
                <div key={m.client.id} className={`border rounded-lg p-4 ${m.sent ? 'bg-emerald-50 border-emerald-300' : m.error ? 'bg-red-50 border-red-200' : 'bg-white border-stone-200'}`}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={m.selected && !m.sent} disabled={m.sent || m.loading || !hasEmail} onChange={() => toggleSelect(idx)} className="mt-1 rounded" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-3.5 h-3.5 text-stone-400" />
                        <span className="font-medium text-sm text-stone-900">{clientName}</span>
                        {m.client.email && <span className="text-xs text-stone-500">&middot; {m.client.email}</span>}
                        {!hasEmail && <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Pas d'email</span>}
                        {m.score > 0 && <span className="text-xs bg-sage-100 text-sage-darker px-2 py-0.5 rounded-full">Score {m.score}</span>}
                        {m.sent && <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><Check className="w-3 h-3" />Envoy&eacute;</span>}
                      </div>

                      {m.raisons.length > 0 && (
                        <div className="text-xs text-stone-500 mb-2 flex flex-wrap gap-1">
                          {m.raisons.map((r, i) => <span key={i} className="bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded">{r}</span>)}
                        </div>
                      )}

                      {m.loading ? (
                        <div className="flex items-center gap-2 text-sm text-stone-500 py-4">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          G&eacute;n&eacute;ration du draft IA&hellip;
                        </div>
                      ) : m.error ? (
                        <div className="text-sm text-red-700 py-2 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          {m.error}
                          <button onClick={() => regenerateOne(idx)} className="ml-auto text-xs text-sage-dark underline hover:no-underline">R&eacute;essayer</button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-0.5">Sujet</label>
                            <input type="text" value={m.draft.subject} onChange={(e) => updateField(idx, 'subject', e.target.value)} disabled={m.sent} className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-0.5">Corps</label>
                            <textarea value={m.draft.body} onChange={(e) => updateField(idx, 'body', e.target.value)} disabled={m.sent} rows={6} className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm font-sans" />
                            <p className="text-[10px] text-stone-400 mt-0.5">Le HTML sera g&eacute;n&eacute;r&eacute; automatiquement \u00e0 partir de ce texte si tu modifies.</p>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => regenerateOne(idx)} disabled={m.sent} className="flex items-center gap-1 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100 rounded">
                              <RefreshCw className="w-3 h-3" />
                              R&eacute;g&eacute;n&eacute;rer
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-200 flex items-center gap-3 bg-stone-50">
          {sentCount > 0 && <span className="text-sm text-emerald-700">{sentCount} envoy&eacute;(s)</span>}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50">
            {sentCount > 0 ? 'Fermer' : 'Annuler'}
          </button>
          {selectedCount > 0 && (
            <button onClick={sendAll} disabled={globalSending} className="px-4 py-2 text-sm bg-sage-dark text-white rounded-lg hover:bg-sage-darker disabled:opacity-50 flex items-center gap-2">
              {globalSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Envoyer aux {selectedCount} client(s)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
