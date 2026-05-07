'use client';

import { useState, useMemo } from 'react';
import { Sparkles, ExternalLink, Send, Building2, MapPin, Euro, TrendingUp } from 'lucide-react';
import { matchMandatsForClient } from '@/lib/matching';
import EmailPreviewModal from './EmailPreviewModal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function ClientMatches({ client, mandats, onOpenMandat }) {
  const { user } = useAuth();
  const [showAll, setShowAll] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState(null);
  const [drafting, setDrafting] = useState(null); // mandat.id en cours de génération
  const [error, setError] = useState('');

  // Calcul des matchs (mémorisé)
  const matches = useMemo(() => {
    return matchMandatsForClient(client, mandats || []);
  }, [client, mandats]);

  const visible = showAll ? matches : matches.slice(0, 5);

  // ─────────────────────────────────────────────────────
  // Bouton "Envoyer" : génère un brouillon IA puis ouvre la modale
  // ─────────────────────────────────────────────────────
  async function handleSend(mandat) {
    setDrafting(mandat.id);
    setError('');
    try {
      // On utilise l'API ai-chat existante avec un prompt forcé "draft_email"
      const res = await fetch(`/api/clients/${client.id}/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          message: `Rédige un email court et professionnel à ${client.prenom} ${client.nom} pour lui présenter le mandat "${mandat.nom}" (ID: ${mandat.id}, prix: ${mandat.prix}€, ${mandat.adresse || mandat.ville || ''}). Utilise le tool draft_email pour préparer le message. Ton chaleureux mais sobre, signature "Thomas Boggiani".`
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur génération');

      // Cherche le résultat du tool draft_email
      const draftTool = (data.tools || []).find(t => t.name === 'draft_email');
      if (draftTool && draftTool.result?.payload) {
        setEmailDraft(draftTool.result.payload);
        setEmailModalOpen(true);
      } else {
        // Fallback : pas de tool draft_email exécuté, on prend juste le texte de la réponse
        setEmailDraft({
          to: client.email,
          subject: `Nouveau bien : ${mandat.nom}`,
          body_html: `<p>Bonjour ${client.prenom},</p><p>${data.reply || 'Je souhaiterais vous présenter ce bien qui pourrait vous intéresser.'}</p><p>Cordialement,<br>Thomas Boggiani</p>`,
          intent: 'presentation_bien'
        });
        setEmailModalOpen(true);
      }
    } catch (e) {
      console.error('[ClientMatches] handleSend KO:', e);
      setError(e.message);
    } finally {
      setDrafting(null);
    }
  }

  // ─────────────────────────────────────────────────────
  // Rendu
  // ─────────────────────────────────────────────────────
  if (!matches.length) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
        <h2 className="font-display text-xl font-semibold text-stone-900 mb-2 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-sage-dark" />
          Biens correspondants
        </h2>
        <div className="text-sm text-stone-500 italic py-4 text-center">
          Aucun bien actuellement disponible ne correspond aux critères de ce client.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
        <h2 className="font-display text-xl font-semibold text-stone-900 mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-sage-dark" />
          Biens correspondants
          <span className="text-sm font-normal text-stone-500">({matches.length})</span>
        </h2>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {visible.map(({ mandat, score, raisons }) => (
            <MatchCard
              key={mandat.id}
              mandat={mandat}
              score={score}
              raisons={raisons}
              onOpen={() => onOpenMandat?.(mandat.id)}
              onSend={() => handleSend(mandat)}
              sending={drafting === mandat.id}
            />
          ))}
        </div>

        {matches.length > 5 && (
          <button
            onClick={() => setShowAll(s => !s)}
            className="mt-4 w-full text-center text-xs text-sage-dark hover:text-sage-darker font-medium py-2 hover:bg-sage-50 rounded-lg"
          >
            {showAll ? `Réduire` : `Voir les ${matches.length - 5} autres biens`}
          </button>
        )}
      </div>

      <EmailPreviewModal
        isOpen={emailModalOpen}
        onClose={() => { setEmailModalOpen(false); setEmailDraft(null); }}
        draft={emailDraft}
        client={client}
        onSent={() => setEmailModalOpen(false)}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Carte d'un match
// ─────────────────────────────────────────────────────────
function MatchCard({ mandat, score, raisons, onOpen, onSend, sending }) {
  const photo = mandat.photos?.[0]?.url || mandat.photos?.[0] || null;
  const prix = mandat.prix ? `${(parseFloat(mandat.prix) / 1e6).toFixed(2)} M€` : '—';
  const rdt = mandat.rendement ? `${mandat.rendement}%` : null;
  const lieu = [mandat.ville, mandat.quartier, mandat.arrondissement].filter(Boolean).join(' ') || mandat.adresse || '';

  // Couleur du score
  const scoreColor = score >= 85 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : score >= 65 ? 'bg-sage-50 text-sage-darker border-sage-light'
    : 'bg-stone-50 text-stone-600 border-stone-200';

  return (
    <div className="flex gap-3 p-3 rounded-lg border border-cream-dark hover:bg-cream-50 transition">
      {/* Photo */}
      <div className="w-20 h-20 flex-shrink-0 rounded-lg bg-cream-100 overflow-hidden">
        {photo ? (
          <img src={photo} alt={mandat.nom} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400">
            <Building2 className="w-6 h-6" />
          </div>
        )}
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="font-medium text-sm text-stone-900 truncate">{mandat.nom || mandat.adresse || '(sans nom)'}</div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${scoreColor} flex-shrink-0`}>
            {score}%
          </span>
        </div>

        <div className="text-xs text-stone-500 flex items-center gap-3 flex-wrap mb-1">
          {mandat.type && <span>{mandat.type}</span>}
          {lieu && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {lieu}</span>}
        </div>

        <div className="text-xs flex items-center gap-3 mb-2">
          <span className="font-medium text-stone-900 flex items-center gap-1">
            <Euro className="w-3 h-3" />{prix}
          </span>
          {rdt && (
            <span className="text-emerald-700 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />{rdt}
            </span>
          )}
        </div>

        {/* Boutons */}
        <div className="flex gap-2">
          <button
            onClick={onOpen}
            className="flex-1 text-xs px-2.5 py-1.5 bg-white border border-stone-200 text-stone-700 rounded-md hover:bg-stone-50 flex items-center justify-center gap-1.5"
          >
            <ExternalLink className="w-3 h-3" /> Voir
          </button>
          <button
            onClick={onSend}
            disabled={sending}
            className="flex-1 text-xs px-2.5 py-1.5 bg-sage-dark text-white rounded-md hover:bg-sage-darker disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {sending ? (
              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Send className="w-3 h-3" /> Envoyer</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
