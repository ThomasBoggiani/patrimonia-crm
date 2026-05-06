// components/EmailPreviewModal.jsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function EmailPreviewModal({
  isOpen,
  onClose,
  draft,           // { to, subject, body_html, intent }
  client,          // objet client complet
  onSent           // callback (optionnel) : (result) => void
}) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [previewMode, setPreviewMode] = useState('html'); // 'html' | 'edit'

  useEffect(() => {
    if (draft) {
      setTo(draft.to || client?.email || '');
      setSubject(draft.subject || '');
      setBodyHtml(draft.body_html || '');
      setError('');
      setPreviewMode('html');
    }
  }, [draft, client]);

  if (!isOpen || !draft) return null;

  // ─────────────────────────────────────────────────────
  // Envoi via /api/microsoft/emails (POST)
  // Payload attendu par cette route : { to, subject, content, clientId }
  // ─────────────────────────────────────────────────────
  async function handleSend() {
    if (!to || !subject || !bodyHtml) {
      setError('Destinataire, objet et corps obligatoires.');
      return;
    }
    setSending(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expirée, reconnecte-toi.');

      const res = await fetch('/api/microsoft/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          to,
          subject,
          content: bodyHtml,        // ⚠️ "content" (pas body_html)
          clientId: client?.id      // ⚠️ camelCase
        })
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (json?.code === 'NOT_CONNECTED') {
          throw new Error('Microsoft n\'est pas connecté. Connecte-toi via /integrations.');
        }
        throw new Error(json.error || `Erreur Microsoft (${res.status})`);
      }

      // L'API logge déjà l'interaction côté serveur si clientId fourni.
      // (Bug connu : le champ utilisé est "notes" au lieu de "resume" — à corriger côté API.)

      onSent?.({ ok: true });
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  // ─────────────────────────────────────────────────────
  // Fallback : ouvrir dans le client mail (mailto)
  // ─────────────────────────────────────────────────────
  function handleOpenInMail() {
    const stripHtml = (html) => {
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      return tmp.textContent || tmp.innerText || '';
    };
    const params = new URLSearchParams({
      subject,
      body: stripHtml(bodyHtml)
    });
    window.open(`mailto:${to}?${params.toString()}`, '_blank');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl">✉️</span>
            <h3 className="font-semibold text-lg">Aperçu de l'email</h3>
            {draft.intent && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                {draft.intent}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Destinataire */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">À</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="destinataire@exemple.com"
            />
          </div>

          {/* Objet */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Objet</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Toggle Aperçu / Édition */}
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-gray-600">Corps du message</label>
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => setPreviewMode('html')}
                className={`px-3 py-1 rounded-l-md ${previewMode === 'html' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                Aperçu
              </button>
              <button
                onClick={() => setPreviewMode('edit')}
                className={`px-3 py-1 rounded-r-md ${previewMode === 'edit' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                Modifier (HTML)
              </button>
            </div>
          </div>

          {previewMode === 'html' ? (
            <div
              className="border border-gray-200 rounded-lg p-4 bg-gray-50 min-h-[240px] max-h-[400px] overflow-y-auto prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          ) : (
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={14}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="<p>Bonjour...</p>"
            />
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              ⚠️ {error}
            </div>
          )}

          <div className="text-xs text-gray-500 italic">
            💡 L'envoi passe par votre compte Microsoft connecté. Une interaction sera automatiquement loggée côté CRM.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            onClick={handleOpenInMail}
            className="text-sm text-gray-600 hover:text-gray-900 underline"
            disabled={sending}
          >
            Ouvrir dans Outlook
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
              {sending ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Envoi...
                </>
              ) : (
                <>📤 Envoyer</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
