'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  List, LayoutGrid, Search, Trash2, Sparkles, CheckCircle2, Plus, AlertTriangle, Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';
import { formatPrix, formatPrixCompact, STATUTS_DEAL } from '@/lib/crm-constants';
import { MaturiteBadge } from '@/components/crm/SharedComponents';
import { matchClientsForMandat, filterAcheteurs } from '@/lib/matching';

// ═══════════════════════════════════════════════════════════════════
// DealsKanbanView - Vue kanban drag&drop pour les deals
// ═══════════════════════════════════════════════════════════════════
function DealsKanbanView({ deals, onStatutChange }) {
  const [dragging, setDragging] = useState(null);
  const columns = ['À proposer', 'Envoyé', 'En étude', 'Visite', 'Offre', 'Gagné'];

  return (
    <div className="flex gap-4 overflow-x-auto scrollbar-thin pb-4">
      {columns.map(col => {
        const items = deals.filter(d => d.statut === col);
        return (
          <div key={col} className="flex-shrink-0 w-72 bg-stone-100 rounded-xl p-3"
            onDragOver={e => e.preventDefault()}
            onDrop={() => { if (dragging) { onStatutChange(dragging, col); setDragging(null); } }}>
            <div className="flex items-center justify-between px-2 mb-3">
              <h3 className="font-semibold text-stone-900 text-sm">{col}</h3>
              <span className="text-xs font-medium bg-white text-stone-600 px-2 py-0.5 rounded-full">{items.length}</span>
            </div>
            <div className="space-y-2 min-h-[200px]">
              {items.map(d => (
                <div key={d.id} draggable onDragStart={() => setDragging(d.id)} onDragEnd={() => setDragging(null)}
                  className="bg-white rounded-lg p-3 shadow-luxe cursor-move hover:shadow-luxe-hover">
                  <div className="font-medium text-sm text-stone-900 mb-1 line-clamp-1">{d.mandat.nom}</div>
                  <div className="text-xs text-stone-500 mb-2">{d.client.prenom} {d.client.nom} &bull; {d.client.societe}</div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-emerald-700">{formatPrix(d.mandat.prix)}</span>
                    {d.dateEnvoi && <span className="text-stone-500">{new Date(d.dateEnvoi).toLocaleDateString('fr-FR', {day:'2-digit', month:'short'})}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DealsTab - Tableau ou kanban des deals
// ═══════════════════════════════════════════════════════════════════
export function DealsTab({ deals, reload, mandats, clients }) {
  const [view, setView] = useState('table');
  const [search, setSearch] = useState('');

  const enriched = deals.map(d => ({
    ...d,
    mandat: mandats.find(m => m.id === d.mandatId),
    client: clients.find(c => c.id === d.clientId)
  })).filter(d => d.mandat && d.client);

  const filtered = enriched.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.mandat.nom.toLowerCase().includes(q) || `${d.client.prenom || ''} ${d.client.nom} ${d.client.societe || ''}`.toLowerCase().includes(q);
  });

  const updateDealStatut = async (id, statut) => {
    const deal = deals.find(d => d.id === id);
    const update = { statut };
    if (statut === 'Envoyé' && !deal.dateEnvoi) update.date_envoi = new Date().toISOString().split('T')[0];
    await supabase.from('deals').update(update).eq('id', id);
    reload();
  };

  const deleteDeal = async (id) => {
    if (confirm('Supprimer ce deal ?')) {
      await supabase.from('deals').delete().eq('id', id);
      reload();
    }
  };

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl font-semibold text-stone-900 mb-1">Deals</h1>
          <p className="text-stone-500">{filtered.length} rapprochement{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg p-1">
          <button onClick={() => setView('table')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${view === 'table' ? 'bg-ink-deep text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
            <List className="w-4 h-4" /> Tableau
          </button>
          <button onClick={() => setView('kanban')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${view === 'kanban' ? 'bg-ink-deep text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
            <LayoutGrid className="w-4 h-4" /> Kanban
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
        </div>
      </div>

      {view === 'table' ? (
        <div className="bg-white rounded-xl shadow-luxe border border-stone-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-cream-dark">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-600 uppercase">Bien</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-600 uppercase">Acquéreur</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-600 uppercase">Statut</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-600 uppercase">Date envoi</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-600 uppercase">Commentaire</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} className="border-b border-stone-100 hover:bg-cream-50">
                  <td className="px-5 py-4">
                    <div className="font-medium text-stone-900 text-sm">{d.mandat.nom}</div>
                    <div className="text-xs text-stone-500">{formatPrix(d.mandat.prix)}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-medium text-stone-900 text-sm">{d.client.prenom} {d.client.nom}</div>
                    <div className="text-xs text-stone-500">{d.client.societe}</div>
                  </td>
                  <td className="px-5 py-4">
                    <select value={d.statut} onChange={e => updateDealStatut(d.id, e.target.value)}
                      className="text-xs font-medium px-2 py-1 border border-stone-200 rounded-md focus:outline-none focus:border-stone-900 bg-white">
                      {STATUTS_DEAL.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-4 text-sm text-stone-700">{d.dateEnvoi ? new Date(d.dateEnvoi).toLocaleDateString('fr-FR') : '-'}</td>
                  <td className="px-5 py-4 text-sm text-stone-600">{d.commentaire || '-'}</td>
                  <td className="px-5 py-4">
                    <button onClick={() => deleteDeal(d.id)} className="p-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="p-12 text-center text-stone-500 text-sm">Aucun deal</div>}
        </div>
      ) : (
        <DealsKanbanView deals={filtered} onStatutChange={updateDealStatut} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MatchingTab - Rapprochement automatique mandats <-> clients
// Utilise désormais le vrai algorithme de lib/matching.js
// avec filtre d'éligibilité (posture acheteur, qualité, statut)
// ═══════════════════════════════════════════════════════════════════
export function MatchingTab({ mandats, clients, deals, reload, initialMandatId, onInitialMandatConsumed }) {
  const [selectedMandatId, setSelectedMandatId] = useState(initialMandatId || mandats[0]?.id || null);
  const [contactsByContactId, setContactsByContactId] = useState({});
  const [loadingContacts, setLoadingContacts] = useState(true);
  const mandat = mandats.find(m => m.id === selectedMandatId);

  useEffect(() => {
    if (initialMandatId && initialMandatId !== selectedMandatId) {
      setSelectedMandatId(initialMandatId);
      onInitialMandatConsumed?.();
    }
  }, [initialMandatId]);

  // Charge tous les contacts pour avoir les postures et qualités
  useEffect(() => {
    async function loadContacts() {
      setLoadingContacts(true);
      try {
        const res = await apiFetch('/api/contacts?limit=500');
        const data = await res.json();
        const map = {};
        (data?.contacts || []).forEach(c => { map[c.id] = c; });
        setContactsByContactId(map);
      } catch (e) {
        console.error('[MatchingTab] load contacts error:', e);
      } finally {
        setLoadingContacts(false);
      }
    }
    loadContacts();
  }, []);

  // Enrichit chaque client avec son contact (postures, qualité, catégorie)
  const enrichedClients = useMemo(() => {
    return (clients || []).map(c => {
      const contactId = c.contactId || c.contact_id;
      const contact = contactId ? contactsByContactId[contactId] : null;
      return { ...c, contact };
    });
  }, [clients, contactsByContactId]);

  // Filtre les acheteurs éligibles (posture, qualité, statut)
  const eligibleClients = useMemo(() => filterAcheteurs(enrichedClients), [enrichedClients]);

  // Calcule les matches avec le vrai algorithme
  const matches = useMemo(() => {
    if (!mandat || loadingContacts) return [];
    const results = matchClientsForMandat(mandat, eligibleClients);
    return results.map(r => ({
      ...r,
      alreadyLinked: deals.some(d => d.mandatId === mandat.id && d.clientId === r.client.id)
    }));
  }, [mandat, eligibleClients, deals, loadingContacts]);

  const addMatch = async (clientId) => {
    await supabase.from('deals').insert({
      mandat_id: mandat.id, client_id: clientId,
      statut: 'À proposer', commentaire: 'Créé via matching auto'
    });
    reload();
  };

  // Nombre de contacts filtrés (pour stats)
  const totalClients = clients?.length || 0;
  const filteredOut = totalClients - eligibleClients.length;

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="font-display text-4xl font-semibold text-stone-900 mb-1">Matching automatique</h1>
        <p className="text-stone-500">Rapprochement intelligent acquéreurs &harr; mandats</p>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-luxe border border-stone-200 mb-6">
        <label className="text-xs font-medium text-stone-600 uppercase tracking-wide mb-2 block">Sélectionner un mandat</label>
        <select value={selectedMandatId || ''} onChange={e => setSelectedMandatId(e.target.value)}
          className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
          {mandats.map(m => <option key={m.id} value={m.id}>{m.nom} - {formatPrix(m.prix)} &bull; Rdt {m.rendement}%</option>)}
        </select>
      </div>

      {loadingContacts && (
        <div className="text-center py-12 text-stone-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
          Chargement des contacts...
        </div>
      )}

      {!loadingContacts && mandat && (
        <>
          {/* Stats de filtrage */}
          {filteredOut > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 inline mr-1.5" />
              {filteredOut} contact{filteredOut > 1 ? 's exclus' : ' exclu'} du matching (posture vendeur, qualité mauvais, ou inactif/perdu)
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-sage-dark" />
              <h2 className="font-display text-xl font-semibold text-stone-900">Acquéreurs compatibles</h2>
              <span className="text-sm text-stone-500">({matches.length} matches sur {eligibleClients.length} acheteurs éligibles)</span>
            </div>

            {matches.map(({ client, score, raisons, aQualifier, alreadyLinked }) => (
              <div key={client.id} className={`bg-white rounded-xl p-5 shadow-luxe border flex items-center gap-4 ${aQualifier ? 'border-amber-200' : 'border-stone-200'}`}>
                <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                  score >= 80 ? 'bg-emerald-100 text-emerald-700' : score >= 50 ? 'bg-sage-100 text-sage-dark' : 'bg-cream-100 text-ink/80'
                }`}>
                  <div className="font-display text-2xl font-bold">{score}</div>
                  <div className="text-[9px] uppercase font-medium">Score</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-display text-lg font-semibold text-stone-900">{client.prenom} {client.nom}</div>
                    {aQualifier && (
                      <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-medium border border-amber-200">
                        ⚠ À qualifier
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-stone-600 mb-2">{client.societe}</div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {client.typologie && <span className="text-xs px-2 py-0.5 bg-cream-100 text-ink rounded-full">{client.typologie}</span>}
                    {(client.budgetMin || client.budgetMax) && (
                      <span className="text-xs px-2 py-0.5 bg-sage-50 text-sage-dark rounded-full">
                        {formatPrixCompact(client.budgetMin)} - {formatPrixCompact(client.budgetMax)}
                      </span>
                    )}
                    <MaturiteBadge maturite={client.maturite} />
                  </div>
                  {raisons && raisons.length > 0 && (
                    <div className="text-[11px] text-stone-500 italic">
                      {raisons.slice(0, 3).join(' · ')}
                    </div>
                  )}
                </div>
                {alreadyLinked ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cream-100 text-ink/80 rounded-lg text-sm flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4" /> Déjà lié
                  </span>
                ) : (
                  <button onClick={() => addMatch(client.id)} className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-stone-800 flex items-center gap-1.5 flex-shrink-0">
                    <Plus className="w-4 h-4" /> Rapprocher
                  </button>
                )}
              </div>
            ))}

            {matches.length === 0 && (
              <div className="text-center py-12 text-stone-500 text-sm bg-white rounded-xl border border-stone-200">
                Aucun acquéreur compatible avec les critères de ce mandat.
                <div className="text-xs mt-2 text-stone-400">
                  ({eligibleClients.length} acheteurs éligibles testés, aucun ne correspond aux critères marché/budget/type/zone)
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
