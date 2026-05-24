'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, getCurrentUserName } from '@/lib/auth';
import { formatPrix, PORTAILS, STATUTS_PORTAIL } from '@/lib/crm-constants';
import { TaskInline } from '@/components/crm/SharedComponents';

// ═══════════════════════════════════════════════════════════════════
// TodosTab v2 - Tri par échéance, section terminées repliable, filtre par mandat
// ═══════════════════════════════════════════════════════════════════
// REMPLACER UNIQUEMENT LA FONCTION export function TodosTab() {...}
// DANS components/crm/OperationalTables.jsx
// (Garder les imports en haut et la fonction AnnoncesTab en bas)
// ═══════════════════════════════════════════════════════════════════

export function TodosTab({ todos, reload, mandats, clients, deals, allProfiles = [] }) {
  const { user, profile } = useAuth();
  const [filter, setFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [newTodo, setNewTodo] = useState({ titre: '', priorite: 'Moyenne', statut: 'À faire', echeance: '', assignee: '', assignedToUserId: null, lienType: null, lienId: null });
  const [filterPerson, setFilterPerson] = useState('me');
  const [filterMandat, setFilterMandat] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    if (profile && !newTodo.assignee) {
      setNewTodo(prev => ({ ...prev, assignee: getCurrentUserName(profile), assignedToUserId: user?.id }));
    }
  }, [profile, user]);

  // Tri : à faire en haut (par échéance ASC + priorité), terminées en bas (par updated_at DESC)
  const PRIORITE_ORDER = { 'Haute': 0, 'Moyenne': 1, 'Basse': 2 };

  const sortPending = (a, b) => {
    // 1. Date d'échéance ASC (null en dernier)
    const aEch = a.echeance || '9999-12-31';
    const bEch = b.echeance || '9999-12-31';
    if (aEch !== bEch) return aEch.localeCompare(bEch);
    // 2. Priorité
    return PRIORITE_ORDER[a.priorite] - PRIORITE_ORDER[b.priorite];
  };

  const sortCompleted = (a, b) => {
    return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
  };

  // Filtrage commun (person + mandat)
  const matchesCommonFilters = (t) => {
    if (filterPerson === 'me' && t.assignedToUserId !== user?.id) return false;
    if (filterPerson !== 'all' && filterPerson !== 'me' && t.assignedToUserId !== filterPerson) return false;
    if (filterMandat !== 'all' && (t.lienType !== 'mandat' || t.lienId !== filterMandat)) return false;
    return true;
  };

  // Séparation à faire / terminées
  const pendingTodos = todos
    .filter(t => t.statut !== 'Terminé' && matchesCommonFilters(t))
    .filter(t => {
      if (filter === 'todo' && t.statut !== 'À faire') return false;
      if (filter === 'doing' && t.statut !== 'En cours') return false;
      if (filter === 'urgent' && t.priorite !== 'Haute') return false;
      return true;
    })
    .sort(sortPending);

  const completedTodos = todos
    .filter(t => t.statut === 'Terminé' && matchesCommonFilters(t))
    .sort(sortCompleted);

  const showPending = filter !== 'done';
  const showCompletedSection = filter === 'all' || filter === 'done';

  const addTodo = async () => {
    if (!newTodo.titre) return;
    await supabase.from('todos').insert({
      titre: newTodo.titre,
      priorite: newTodo.priorite,
      statut: newTodo.statut,
      echeance: newTodo.echeance || null,
      assignee: newTodo.assignee || getCurrentUserName(profile),
      assigned_to_user_id: newTodo.assignedToUserId || user?.id,
      created_by: user?.id,
      lien_type: newTodo.lienType,
      lien_id: newTodo.lienId || null
    });
    setNewTodo({ titre: '', priorite: 'Moyenne', statut: 'À faire', echeance: '', assignee: getCurrentUserName(profile), assignedToUserId: user?.id, lienType: null, lienId: null });
    setShowNew(false);
    reload();
  };

  // Calcul des compteurs pour les onglets (sur todos respectant les filtres common)
  const visibleTodos = todos.filter(matchesCommonFilters);
  const counts = {
    all: visibleTodos.length,
    urgent: visibleTodos.filter(t => t.priorite === 'Haute' && t.statut !== 'Terminé').length,
    todo: visibleTodos.filter(t => t.statut === 'À faire').length,
    doing: visibleTodos.filter(t => t.statut === 'En cours').length,
    done: visibleTodos.filter(t => t.statut === 'Terminé').length
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl font-semibold text-stone-900 mb-1">To-do personnelle</h1>
          <p className="text-stone-500">Vos priorités, triées par urgence</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-ink-deep text-white rounded-lg hover:bg-stone-800 text-sm font-medium">
          <Plus className="w-4 h-4" /> Nouvelle tâche
        </button>
      </div>

      {/* Onglets statut */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {[
          { id: 'all', label: 'Toutes', count: counts.all },
          { id: 'urgent', label: 'Urgentes', count: counts.urgent },
          { id: 'todo', label: 'À faire', count: counts.todo },
          { id: 'doing', label: 'En cours', count: counts.doing },
          { id: 'done', label: 'Terminées', count: counts.done }
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === f.id ? 'bg-ink-deep text-white' : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'}`}>
            {f.label} <span className="opacity-70">({f.count})</span>
          </button>
        ))}
      </div>

      {/* Filtre par personne */}
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <span className="text-xs uppercase tracking-wide text-sage-dark">Assignée à :</span>
        <button onClick={() => setFilterPerson('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium ${filterPerson === 'all' ? 'bg-sage-dark text-white' : 'bg-white text-ink/70 hover:bg-cream-100 border border-cream-dark'}`}>
          Tout le monde
        </button>
        <button onClick={() => setFilterPerson('me')}
          className={`px-3 py-1 rounded-full text-xs font-medium ${filterPerson === 'me' ? 'bg-sage-dark text-white' : 'bg-white text-ink/70 hover:bg-cream-100 border border-cream-dark'}`}>
          Moi ({todos.filter(t => t.assignedToUserId === user?.id).length})
        </button>
        {allProfiles.filter(p => p.id !== user?.id).map(p => (
          <button key={p.id} onClick={() => setFilterPerson(p.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${filterPerson === p.id ? 'bg-sage-dark text-white' : 'bg-white text-ink/70 hover:bg-cream-100 border border-cream-dark'}`}>
            {p.prenom} ({todos.filter(t => t.assignedToUserId === p.id).length})
          </button>
        ))}
      </div>

      {/* Filtre par mandat */}
      <div className="flex gap-2 mb-6 flex-wrap items-center">
        <span className="text-xs uppercase tracking-wide text-sage-dark">Mandat :</span>
        <select
          value={filterMandat}
          onChange={e => setFilterMandat(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs border border-stone-200 bg-white focus:outline-none focus:border-stone-900"
        >
          <option value="all">Tous les mandats</option>
          {mandats.map(m => (
            <option key={m.id} value={m.id}>{m.nom}</option>
          ))}
        </select>
        {filterMandat !== 'all' && (
          <button
            onClick={() => setFilterMandat('all')}
            className="text-xs text-stone-500 hover:text-stone-700 underline"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Formulaire nouvelle tâche */}
      {showNew && (
        <div className="bg-white rounded-xl p-5 shadow-luxe border border-stone-200 mb-4 space-y-3">
          <input autoFocus value={newTodo.titre} onChange={e => setNewTodo({...newTodo, titre: e.target.value})} placeholder="Que devez-vous faire ?"
            className="w-full px-3 py-2 border-b border-stone-200 text-base focus:outline-none focus:border-stone-900" />
          <div className="grid grid-cols-4 gap-3">
            <select value={newTodo.priorite} onChange={e => setNewTodo({...newTodo, priorite: e.target.value})} className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
              <option>Haute</option><option>Moyenne</option><option>Basse</option>
            </select>
            <input type="date" value={newTodo.echeance} onChange={e => setNewTodo({...newTodo, echeance: e.target.value})} className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
            <select
              value={newTodo.assignedToUserId || ''}
              onChange={e => {
                const selected = allProfiles.find(p => p.id === e.target.value);
                setNewTodo({
                  ...newTodo,
                  assignedToUserId: e.target.value,
                  assignee: selected ? `${selected.prenom} ${selected.nom}` : ''
                });
              }}
              className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
              {allProfiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.prenom} {p.nom}{p.id === user?.id ? ' (moi)' : ''}
                </option>
              ))}
            </select>
            <select value={newTodo.lienType || ''} onChange={e => setNewTodo({...newTodo, lienType: e.target.value || null, lienId: null})} className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
              <option value="">Aucun lien</option>
              <option value="mandat">Mandat</option>
              <option value="client">Client</option>
              <option value="deal">Deal</option>
            </select>
          </div>
          {newTodo.lienType && (
            <select value={newTodo.lienId || ''} onChange={e => setNewTodo({...newTodo, lienId: e.target.value})} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
              <option value="">Sélectionner...</option>
              {newTodo.lienType === 'mandat' && mandats.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              {newTodo.lienType === 'client' && clients.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
              {newTodo.lienType === 'deal' && deals.map(d => {
                const m = mandats.find(x => x.id === d.mandatId);
                const c = clients.find(x => x.id === d.clientId);
                return m && c ? <option key={d.id} value={d.id}>{m.nom} x {c.nom}</option> : null;
              })}
            </select>
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(false)} className="px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">Annuler</button>
            <button onClick={addTodo} className="px-3 py-1.5 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink">Ajouter</button>
          </div>
        </div>
      )}

      {/* Section À TRAITER */}
      {showPending && (
        <div className="space-y-2 mb-6">
          {pendingTodos.length > 0 && (
            <div className="text-xs uppercase tracking-wide text-stone-600 font-medium mb-2 px-1">
              À traiter ({pendingTodos.length})
            </div>
          )}
          {pendingTodos.map(t => (
            <TaskInline key={t.id} task={t} mandats={mandats} clients={clients} allProfiles={allProfiles} onUpdate={reload} />
          ))}
          {pendingTodos.length === 0 && filter !== 'done' && (
            <div className="text-center py-8 text-stone-500 text-sm bg-white rounded-xl border border-cream-dark">
              {filter === 'all' && completedTodos.length > 0
                ? '🎉 Aucune tâche en cours !'
                : 'Aucune tâche dans cette catégorie'}
            </div>
          )}
        </div>
      )}

      {/* Section TERMINÉES (repliable) */}
      {showCompletedSection && completedTodos.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowCompleted(s => !s)}
            className="w-full flex items-center justify-between px-3 py-2 bg-cream-100 hover:bg-cream-200 rounded-lg text-sm font-medium text-stone-700 transition"
          >
            <span className="flex items-center gap-2">
              <span className="text-xs">{showCompleted ? '▼' : '▶'}</span>
              Terminées ({completedTodos.length})
            </span>
            <span className="text-xs text-stone-500">
              {showCompleted ? 'Masquer' : 'Afficher'}
            </span>
          </button>
          {showCompleted && (
            <div className="space-y-2 opacity-70">
              {completedTodos.map(t => (
                <TaskInline key={t.id} task={t} mandats={mandats} clients={clients} allProfiles={allProfiles} onUpdate={reload} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// AnnoncesTab - Suivi diffusion multi-portails
// ═══════════════════════════════════════════════════════════════════
export function AnnoncesTab({ annonces, reload, mandats }) {
  const [showNew, setShowNew] = useState(false);

  const updatePortail = async (annonceId, portail, statut) => {
    const annonce = annonces.find(a => a.id === annonceId);
    const newPortails = { ...annonce.portails, [portail]: statut };
    await supabase.from('annonces').update({
      portails: newPortails,
      last_update: new Date().toISOString().split('T')[0]
    }).eq('id', annonceId);
    reload();
  };

  const addAnnonce = async (mandatId) => {
    await supabase.from('annonces').insert({
      mandat_id: mandatId,
      portails: { seloger: 'Non diffusé', leboncoin: 'Non diffusé', bienici: 'Non diffusé', figaro: 'Non diffusé' }
    });
    setShowNew(false);
    reload();
  };

  const deleteAnnonce = async (id) => {
    if (confirm('Supprimer cette annonce ?')) {
      await supabase.from('annonces').delete().eq('id', id);
      reload();
    }
  };

  const getColorStatut = (s) => {
    if (s === 'En ligne') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (s === 'En attente') return 'bg-sage-100 text-sage-dark border-sage-light';
    if (s === 'À corriger') return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-stone-100 text-stone-500 border-stone-200';
  };

  const portailLabels = { seloger: 'SeLoger', leboncoin: 'LeBonCoin', bienici: "Bien'ici", figaro: 'Figaro Immo' };
  const mandatsDispo = mandats.filter(m => !annonces.some(a => a.mandatId === m.id));

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl font-semibold text-stone-900 mb-1">Suivi des annonces</h1>
          <p className="text-stone-500">Diffusion multi-portails — alimentation manuelle en attendant l'API</p>
        </div>
        <button onClick={() => setShowNew(!showNew)} disabled={mandatsDispo.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-ink-deep text-white rounded-lg hover:bg-stone-800 disabled:opacity-40 text-sm font-medium">
          <Plus className="w-4 h-4" /> Publier un bien
        </button>
      </div>

      {showNew && mandatsDispo.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-luxe border border-stone-200 mb-6">
          <h3 className="font-display text-lg font-semibold mb-3">Sélectionner un mandat</h3>
          <div className="grid grid-cols-2 gap-2">
            {mandatsDispo.map(m => (
              <button key={m.id} onClick={() => addAnnonce(m.id)}
                className="text-left p-3 border border-stone-200 rounded-lg hover:border-stone-900 hover:bg-cream-50">
                <div className="font-medium text-sm text-stone-900">{m.nom}</div>
                <div className="text-xs text-stone-500 mt-0.5">{m.type} &bull; {formatPrix(m.prix)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {annonces.map(a => {
          const m = mandats.find(x => x.id === a.mandatId);
          if (!m) return null;
          const nbEnLigne = Object.values(a.portails || {}).filter(p => p === 'En ligne').length;
          return (
            <div key={a.id} className="bg-white rounded-xl p-5 shadow-luxe border border-cream-dark">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-display text-lg font-semibold text-stone-900">{m.nom}</div>
                  <div className="text-xs text-stone-500 flex items-center gap-3 mt-1">
                    {a.datePublication && <span>Publié le {new Date(a.datePublication).toLocaleDateString('fr-FR')}</span>}
                    {a.lastUpdate && <><span>&bull;</span><span>Maj {new Date(a.lastUpdate).toLocaleDateString('fr-FR')}</span></>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-display text-2xl font-semibold text-stone-900">{nbEnLigne}<span className="text-stone-400 text-lg">/4</span></div>
                    <div className="text-xs text-stone-500">en ligne</div>
                  </div>
                  <button onClick={() => deleteAnnonce(a.id)} className="p-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {PORTAILS.map(p => (
                  <div key={p} className="border border-stone-200 rounded-lg p-3">
                    <div className="text-xs font-medium text-stone-700 uppercase tracking-wide mb-2">{portailLabels[p]}</div>
                    <select value={(a.portails || {})[p] || 'Non diffusé'} onChange={e => updatePortail(a.id, p, e.target.value)}
                      className={`w-full text-xs font-medium px-2 py-1.5 rounded-md border focus:outline-none ${getColorStatut((a.portails || {})[p])}`}>
                      {STATUTS_PORTAIL.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {annonces.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-stone-200 text-stone-500 text-sm">
            Aucun bien publié pour le moment
          </div>
        )}
      </div>
    </div>
  );
}
