'use client';

import { useState, useMemo, useEffect } from 'react';
import { Sparkles, ExternalLink, Send, Building2, MapPin, Check, Circle } from 'lucide-react';
import { matchMandatsForClient } from '@/lib/matching';
import EmailPreviewModal from './EmailPreviewModal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function ClientMatches({ client, mandats, interactions, onOpenMandat, reload }) {
  const { user } = useAuth();
  const [filter, setFilter] = useState('all'); // 'all' | 'todo' | 'done'
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState(null);
  const [drafting, setDrafting] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [error, setError] = useState('');

  // ─────────────────────────────────────────────────────
  // Calcul des matchs
  // ─────────────────────────────────────────────────────
  const matches = useMemo(() => {
    return matchMandatsForClient(client, mandats || []);
  }, [client, mandats]);

  // Set des mandat_id qui sont déjà "match_traite" dans les interactions
  const treatedSet = useMemo(() => {
    const s = new Set();
    for (const i of (interactions || [])) {
      if (i.type === 'match_traite' && (i.mandatId || i.mandat_id) && (i.clientId === client.id || i.client_id === client.id)) {
        s.add(i.mandatId || i.mandat_id);
      }
    }
    return s;
  }, [interactions, client.id]);

  // Filtre selon onglet
  const filtered = matches.filter(({ mandat }) => {
    if (filter === 'all') return true;
    if (filter === 'todo') return !treatedSet.has(mandat.id);
    if (filter === 'done') return treatedSet.has(mandat.id);
    return true;
  });

  const nbTodo = matches.filter(m => !treatedSet.has(m.mandat.id)).length;
  const nbDone = matches.filter(m => treatedSet.has(m.mandat.id)).length;

  // ─────────────────────────────────────────────────────
  // Toggle "Traité / À traiter" via interaction
  // ─────────────────────────────────────────────────────
  async function toggleTreated(mandat) {
    setToggling(mandat.id);
    try {
      if (treatedSet.has(mandat.id)) {
        // Supprime l'interaction match_traite pour ce couple
        await supabase
          .from('interactions')
          .delete()
          .eq('client_id', client.id)
          .eq('mandat_id', mandat.id)
          .eq('type', 'match_traite');
      } else {
        await supabase.from('interactions').insert({
          client_id: client.id,
          mandat_id: mandat.id,
          type: 'match_traite',
          resume: `Match traité : ${mandat.nom || mandat.adresse || 'mandat'}`,
          date: new Date().toISOString().split('T')[0],
          created_by: user?.id
        });
      }
      reload?.();
    } catch (e) {
      console.error('[toggleTreated]', e);
      setError(e.message);
    } finally {
      setToggling(null);
    }
  }

  // ─────────────────────────────────────────────────────
  // Bouton "Envoyer" : génère un brouillon IA + ouvre la modale
  // ─────────────────────────────────────────────────────
  async function handleSend(mandat) {
    setDrafting(mandat.id);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/clients/${client.id}/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          message: `Rédige un email court et professionnel à ${client.prenom} ${client.nom} pour lui présenter le mandat "${mandat.nom}" (prix: ${mandat.prix}€${mandat.rendement ? `, rendement ${mandat.rendement}%` : ''}, ${mandat.adresse || mandat.ville || ''}). Utilise OBLIGATOIREMENT le tool draft_email. Ton chaleureux mais sobre, signature "Thomas Boggiani".`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur génération');

      const draftTool = (data.tools || []).find(t => t.name === 'draft_email');
      if (draftTool && draftTool.result?.payload) {
        setEmailDraft(draftTool.result.payload);
      } else {
        setEmailDraft({
          to: client.email,
          subject: `Nouveau bien : ${mandat.nom}`,
          body_html: `<p>Bonjour ${client.prenom},</p><p>${data.reply || 'Je souhaiterais vous présenter ce bien.'}</p><p>Cordialement,<br>Thomas Boggiani</p>`,
          intent: 'presentation_bien'
        });
      }
      setEmailModalOpen(true);
    } catch (e) {
      console.error('[handleSend]', e);
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
          Aucun mandat actif ne correspond aux critères de ce client. Affinez les critères de recherche pour augmenter les chances de match.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-luxe border border-cream-dark overflow-hidden">
        {/* Header avec filtres */}
        <div className="p-4 border-b border-cream-dark flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-sage-dark" />
            Biens correspondants
            <span className="text-sm font-normal text-stone-500">({matches.length})</span>
          </h2>
          <div className="flex items-center gap-1 text-xs">
            <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
              Tous ({matches.length})
            </FilterButton>
            <FilterButton active={filter === 'todo'} onClick={() => setFilter('todo')} highlight>
              À traiter ({nbTodo})
            </FilterButton>
            <FilterButton active={filter === 'done'} onClick={() => setFilter('done')}>
              Traités ({nbDone})
            </FilterButton>
          </div>
        </div>

        {error && (
          <div className="mx-4 my-2 p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
            {error}
          </div>
        )}

        {/* Liste des matchs en lignes plates */}
        <div className="divide-y divide-cream-dark">
          {filtered.map(({ mandat, score }) => (
            <MatchRow
              key={mandat.id}
              mandat={mandat}
              score={score}
              treated={treatedSet.has(mandat.id)}
              onOpen={() => onOpenMandat?.(mandat.id)}
              onSend={() => handleSend(mandat)}
              onToggleTreated={() => toggleTreated(mandat)}
              sending={drafting === mandat.id}
              toggling={toggling === mandat.id}
            />
          ))}
          {filtered.length === 0 && (
            <div className="p-6 text-center text-sm text-stone-400 italic">
              Aucun match dans cette catégorie.
            </div>
          )}
        </div>
      </div>

      <EmailPreviewModal
        isOpen={emailModalOpen}
        onClose={() => { setEmailModalOpen(false); setEmailDraft(null); }}
        draft={emailDraft}
        client={client}
        onSent={() => { setEmailModalOpen(false); reload?.(); }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Bouton de filtre
// ─────────────────────────────────────────────────────────
function FilterButton({ active, onClick, children, highlight }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md font-medium transition ${
        active
          ? highlight
            ? 'bg-sage-dark text-white'
            : 'bg-stone-900 text-white'
          : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
      }`}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────
// Une ligne de match
// ─────────────────────────────────────────────────────────
function MatchRow({ mandat, score, treated, onOpen, onSend, onToggleTreated, sending, toggling }) {
  const prix = mandat.prix ? `${(parseFloat(mandat.prix) / 1e6).toFixed(2)} M€` : '—';
  const rdt = mandat.rendement ? `${mandat.rendement}%` : null;
  const lieu = [mandat.ville, mandat.quartier, mandat.arrondissement].filter(Boolean).join(' ') || mandat.adresse || '';

  const scoreColor = score >= 85 ? 'bg-emerald-100 text-emerald-700'
    : score >= 65 ? 'bg-sage-100 text-sage-darker'
    : 'bg-stone-100 text-stone-600';

  return (
    <div className={`p-3 hover:bg-cream-50 transition flex items-center gap-3 flex-wrap ${treated ? 'opacity-60' : ''}`}>
      {/* Score */}
      <div className={`flex-shrink-0 px-2 py-1 rounded-md text-xs font-bold w-12 text-center ${scoreColor}`}>
        {score}%
      </div>

      {/* Infos mandat (en ligne) */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`font-medium text-sm ${treated ? 'line-through text-stone-500' : 'text-stone-900'} truncate`}>
            {mandat.nom || mandat.adresse || '(sans nom)'}
          </span>
          {mandat.type && <span className="text-xs text-stone-500">· {mandat.type}</span>}
          <span className="text-xs font-medium text-stone-700">· {prix}</span>
          {rdt && <span className="text-xs text-emerald-700">· {rdt}</span>}
          {lieu && (
            <span className="text-xs text-stone-500 flex items-center gap-0.5">
              · <MapPin className="w-3 h-3" /> {lieu}
            </span>
          )}
        </div>
      </div>

      {/* Badge À traiter / Traité */}
      <button
        onClick={onToggleTreated}
        disabled={toggling}
        className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition disabled:opacity-50 ${
          treated
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
        }`}
      >
        {toggling ? (
          <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : treated ? (
          <><Check className="w-3 h-3" /> Traité</>
        ) : (
          <><Circle className="w-3 h-3" /> À traiter</>
        )}
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onOpen}
          className="text-xs px-2.5 py-1 bg-white border border-stone-200 text-stone-700 rounded-md hover:bg-stone-50 flex items-center gap-1"
          title="Voir la fiche mandat"
        >
          <ExternalLink className="w-3 h-3" /> Voir
        </button>
        <button
          onClick={onSend}
          disabled={sending}
          className="text-xs px-2.5 py-1 bg-sage-dark text-white rounded-md hover:bg-sage-darker disabled:opacity-50 flex items-center gap-1"
          title="Envoyer ce bien au client par email"
        >
          {sending ? (
            <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <><Send className="w-3 h-3" /> Envoyer</>
          )}
        </button>
      </div>
    </div>
  );
}
