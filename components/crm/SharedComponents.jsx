'use client';

import React, { useState } from 'react';
import {
  Calendar, Phone, Mail, MessageSquare, Eye, Plus, Trash2, Check
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────
// Field : label + enfant pour les formulaires
// ─────────────────────────────────────────────────────────
export function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-600 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// DetailItem : label + valeur, version compact ou highlight
// ─────────────────────────────────────────────────────────
export function DetailItem({ label, value, highlight }) {
  return (
    <div>
      <div className="text-xs text-stone-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={highlight ? 'font-display text-xl font-semibold text-stone-900' : 'text-sm font-medium text-stone-900'}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// KpiCard : carte KPI personnalisée pour Dashboard
// ─────────────────────────────────────────────────────────
export function KpiCard({ label, value, icon: Icon, accent, sublabel, isAmount }) {
  const accentColors = {
    sage: 'bg-sage-50 text-sage-dark border-sage-light',
    stone: 'bg-stone-50 text-stone-700 border-stone-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-100',
  };
  return (
    <div className="bg-white rounded-xl p-5 shadow-luxe border border-cream-dark">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${accentColors[accent] || accentColors.stone}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-xs uppercase tracking-wide text-stone-500 mb-1">{label}</div>
      <div className={`font-display font-semibold text-stone-900 ${isAmount ? 'text-2xl' : 'text-3xl'}`}>{value}</div>
      {sublabel && <div className="text-xs text-stone-500 mt-1">{sublabel}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// KpiBox : carte KPI compacte (utilisée dans MandatDetail)
// ─────────────────────────────────────────────────────────
export function KpiBox({ label, value, icon: Icon, sublabel }) {
  return (
    <div className="bg-cream-50 rounded-lg p-4 border border-cream-dark">
      <div className="flex items-start justify-between mb-2">
        <Icon className="w-4 h-4 text-sage-dark" />
        <div className="font-display text-2xl font-semibold text-stone-900 leading-none">{value}</div>
      </div>
      <div className="text-xs text-stone-700 font-medium">{label}</div>
      {sublabel && <div className="text-[10px] text-stone-500 mt-0.5">{sublabel}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// TaskRow : ligne de tâche pour Dashboard
// ─────────────────────────────────────────────────────────
export function TaskRow({ task, mandats, variant }) {
  const variantStyles = {
    late: 'bg-red-50/50 border-red-100',
    today: 'bg-amber-50/50 border-amber-100',
    week: 'bg-sage-50/40 border-sage-light/50',
  };
  const linkedMandat = task.mandatId || task.mandat_id ? mandats.find(m => m.id === (task.mandatId || task.mandat_id)) : null;
  const echeanceLabel = task.echeance
    ? new Date(task.echeance).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    : '-';
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border ${variantStyles[variant] || variantStyles.week}`}>
      <div className="w-3 h-3 rounded border-2 border-stone-300 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-stone-900 truncate">{task.titre}</div>
        {linkedMandat && (
          <div className="text-xs text-stone-500 truncate">&rarr; {linkedMandat.nom}</div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {task.priorite === 'Haute' && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">Haute</span>}
        <span className="text-xs text-stone-500 flex items-center gap-1">
          <Calendar className="w-3 h-3" />{echeanceLabel}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// AlertRow : ligne d'alerte pour Dashboard
// ─────────────────────────────────────────────────────────
export function AlertRow({ level, count, label, items }) {
  const levelStyles = {
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    danger: 'bg-red-50 border-red-200 text-red-900',
  };
  return (
    <div className={`p-3 rounded-lg border ${levelStyles[level] || levelStyles.info}`}>
      <div className="flex items-start gap-2">
        <div className="font-medium text-sm">
          <span className="font-bold">{count}</span> {label}
        </div>
      </div>
      {items && items.length > 0 && (
        <div className="mt-1 text-xs opacity-80">
          {items.join(' &middot; ')}{items.length < count ? '...' : ''}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// CommerceBadge : type de commercialisation (Off-market, Exclusif...)
// ─────────────────────────────────────────────────────────
export function CommerceBadge({ comm, dateSignature }) {
  const config = {
    'Off-market': { dot: 'bg-amber-400', bg: 'bg-stone-900', text: 'text-amber-300', label: 'Off-market' },
    'Mandat exclusif': { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Exclusif' },
    'Mandat simple': { dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', label: 'Simple' }
  };
  const c = config[comm] || config['Off-market'];
  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${c.bg}`}>
        <div className={`w-1 h-1 rounded-full ${c.dot}`} />
        <span className={`text-[10px] font-medium ${c.text}`}>{c.label}</span>
      </div>
      {dateSignature && <span className="text-[9px] text-stone-500 ml-1.5">Signe {new Date(dateSignature).toLocaleDateString('fr-FR')}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// StatutBadge : badge statut mandat
// ─────────────────────────────────────────────────────────
export function StatutBadge({ statut }) {
  const colors = {
    'Sourcing': 'bg-cream-100 text-ink',
    'Analyse': 'bg-sage-50 text-sage-dark',
    'Mandat signe': 'bg-blue-50 text-blue-700',
    'Mandat signé': 'bg-blue-50 text-blue-700',
    'Commercialisation': 'bg-emerald-50 text-emerald-700',
    'Offre': 'bg-purple-50 text-purple-700',
    'Promesse': 'bg-indigo-50 text-indigo-700',
    'Acte': 'bg-green-100 text-green-800',
    'Vendu par autres': 'bg-amber-50 text-amber-800',
    'Perdu': 'bg-red-50 text-red-700'
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[statut] || 'bg-cream-100 text-ink'}`}>{statut}</span>;
}

// ─────────────────────────────────────────────────────────
// DealStatutBadge : badge statut deal
// ─────────────────────────────────────────────────────────
export function DealStatutBadge({ statut }) {
  const colors = {
    'A proposer': 'bg-cream-100 text-ink',
    'À proposer': 'bg-cream-100 text-ink',
    'Envoye': 'bg-blue-50 text-blue-700',
    'Envoyé': 'bg-blue-50 text-blue-700',
    'En etude': 'bg-sage-50 text-sage-dark',
    'En étude': 'bg-sage-50 text-sage-dark',
    'Visite': 'bg-indigo-50 text-indigo-700',
    'Offre': 'bg-purple-50 text-purple-700',
    'Refuse': 'bg-red-50 text-red-700',
    'Refusé': 'bg-red-50 text-red-700',
    'Gagne': 'bg-emerald-50 text-emerald-700',
    'Gagné': 'bg-emerald-50 text-emerald-700',
    'Perdu': 'bg-stone-100 text-stone-500'
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[statut]}`}>{statut}</span>;
}

// ─────────────────────────────────────────────────────────
// MaturiteBadge : badge maturite client
// ─────────────────────────────────────────────────────────
export function MaturiteBadge({ maturite }) {
  const colors = {
    'Haute': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Moyen': 'bg-sage-50 text-sage-dark border-sage-light',
    'Basse': 'bg-cream-100 text-ink/80 border-stone-200'
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[maturite]}`}>{maturite}</span>;
}

// ─────────────────────────────────────────────────────────
// TypeInteractionBadge : badge type d'interaction
// ─────────────────────────────────────────────────────────
export function TypeInteractionBadge({ type }) {
  const config = {
    'Appel': { icon: Phone, color: 'bg-blue-50 text-blue-700' },
    'Email': { icon: Mail, color: 'bg-purple-50 text-purple-700' },
    'Rendez-vous': { icon: Calendar, color: 'bg-sage-50 text-sage-dark' },
    'Visite': { icon: Eye, color: 'bg-emerald-50 text-emerald-700' },
    'Message': { icon: MessageSquare, color: 'bg-cream-100 text-ink' }
  };
  const c = config[type] || config['Message'];
  const Icon = c.icon;
  return <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${c.color}`}><Icon className="w-3 h-3" />{type}</span>;
}

// ─────────────────────────────────────────────────────────
// TaskInline : tache affichable et editable inline
// ─────────────────────────────────────────────────────────
export function TaskInline({ task, mandats = [], clients = [], allProfiles = [], onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    titre: task.titre,
    echeance: task.echeance || '',
    priorite: task.priorite || 'Moyenne',
    statut: task.statut || 'A faire',
    assignedToUserId: task.assignedToUserId || null,
    assignee: task.assignee || ''
  });

  const isLate = task.echeance && new Date(task.echeance) < new Date(new Date().toDateString()) && task.statut !== 'Termine' && task.statut !== 'Terminé';
  const isToday = task.echeance && new Date(task.echeance).toDateString() === new Date().toDateString();
  const isDone = task.statut === 'Termine' || task.statut === 'Terminé';

  const linkedMandat = task.lienId && task.lienType === 'mandat' ? mandats.find(m => m.id === task.lienId) : null;
  const linkedClient = task.lienId && task.lienType === 'client' ? clients.find(c => c.id === task.lienId) : null;

  async function toggle() {
    await supabase.from('todos').update({
      statut: isDone ? 'A faire' : 'Termine',
      updated_at: new Date().toISOString(),
    }).eq('id', task.id);
    if (onUpdate) onUpdate();
  }

  async function saveEdit() {
    await supabase.from('todos').update({
      titre: editData.titre,
      echeance: editData.echeance || null,
      priorite: editData.priorite,
      statut: editData.statut,
      assigned_to_user_id: editData.assignedToUserId || null,
      assignee: editData.assignee || null,
    }).eq('id', task.id);
    setEditing(false);
    if (onUpdate) onUpdate();
  }

  async function deleteTask() {
    if (!confirm('Supprimer cette tache ?')) return;
    await supabase.from('todos').delete().eq('id', task.id);
    if (onUpdate) onUpdate();
  }

  if (editing) {
    return (
      <div className="p-3 bg-white border border-stone-300 rounded-lg space-y-2">
        <input type="text" value={editData.titre} onChange={e => setEditData({ ...editData, titre: e.target.value })}
          className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm" autoFocus />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={editData.echeance} onChange={e => setEditData({ ...editData, echeance: e.target.value })}
            className="px-2 py-1.5 border border-stone-200 rounded text-sm" />
          <select value={editData.priorite} onChange={e => setEditData({ ...editData, priorite: e.target.value })}
            className="px-2 py-1.5 border border-stone-200 rounded text-sm bg-white">
            <option>Haute</option>
            <option>Moyenne</option>
            <option>Basse</option>
          </select>
        </div>
        <select value={editData.statut} onChange={e => setEditData({ ...editData, statut: e.target.value })}
          className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm bg-white">
          <option>A faire</option>
          <option>En cours</option>
          <option>Termine</option>
        </select>
        <select value={editData.assignedToUserId || ''} onChange={e => {
          const userId = e.target.value || null;
          const profile = allProfiles.find(p => p.id === userId);
          setEditData({ ...editData, assignedToUserId: userId, assignee: profile ? `${profile.prenom} ${profile.nom}` : '' });
        }} className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm bg-white">
          <option value="">Non assigne</option>
          {allProfiles.map(p => (
            <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button onClick={saveEdit} className="flex-1 px-3 py-1.5 bg-stone-900 text-white rounded text-sm hover:bg-stone-800">Enregistrer</button>
          <button onClick={() => setEditing(false)} className="px-3 py-1.5 bg-white border border-stone-200 text-stone-700 rounded text-sm hover:bg-stone-100">Annuler</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border ${
      isDone ? 'bg-stone-50 border-stone-200 opacity-60' :
      isLate ? 'bg-red-50/50 border-red-100' :
      isToday ? 'bg-amber-50/50 border-amber-100' :
      'bg-white border-stone-200 hover:bg-stone-50'
    }`}>
      <button onClick={toggle} className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
        isDone ? 'bg-emerald-500 border-emerald-500' : 'border-stone-300 hover:border-stone-500'
      }`}>
        {isDone && <Check className="w-2.5 h-2.5 text-white" />}
      </button>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !isDone && setEditing(true)}>
        <div className={`text-sm font-medium ${isDone ? 'line-through text-stone-500' : 'text-stone-900'}`}>{task.titre}</div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {linkedMandat && <span className="text-[10px] text-stone-500">&rarr; {linkedMandat.nom}</span>}
          {linkedClient && <span className="text-[10px] text-stone-500">&rarr; {linkedClient.prenom} {linkedClient.nom}</span>}
          {task.priorite === 'Haute' && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">Haute</span>}
          {task.echeance && (
            <span className={`text-[10px] flex items-center gap-1 ${isLate ? 'text-red-600 font-medium' : isToday ? 'text-amber-700 font-medium' : 'text-stone-500'}`}>
              <Calendar className="w-2.5 h-2.5" />
              {new Date(task.echeance).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
            </span>
          )}
          {task.assignee && <span className="text-[10px] text-stone-400">&middot; {task.assignee}</span>}
        </div>
      </div>

      <button onClick={deleteTask} className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded flex-shrink-0" title="Supprimer">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// QuickAddTask : ajout rapide de tache en 1 ligne
// ─────────────────────────────────────────────────────────
export function QuickAddTask({ lienType = null, lienId = null, defaultAssignee, defaultUserId, onAdd }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ titre: '', echeance: '', priorite: 'Moyenne' });

  async function save() {
    if (!data.titre.trim()) return;
    await supabase.from('todos').insert({
      titre: data.titre,
      priorite: data.priorite,
      statut: 'À faire',
      echeance: data.echeance || null,
      assignee: defaultAssignee || null,
      assigned_to_user_id: defaultUserId || null,
      lien_type: lienType,
      lien_id: lienId,
    });
    setData({ titre: '', echeance: '', priorite: 'Moyenne' });
    setOpen(false);
    if (onAdd) onAdd();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-500 hover:text-stone-900 hover:bg-stone-50 border border-dashed border-stone-300 rounded-lg">
        <Plus className="w-4 h-4" /> Ajouter une tache
      </button>
    );
  }

  return (
    <div className="p-3 bg-white border border-stone-300 rounded-lg space-y-2">
      <input type="text" placeholder="Titre de la tache..." value={data.titre} onChange={e => setData({ ...data, titre: e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setOpen(false); }}
        className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm" autoFocus />
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={data.echeance} onChange={e => setData({ ...data, echeance: e.target.value })}
          className="px-2 py-1.5 border border-stone-200 rounded text-sm" />
        <select value={data.priorite} onChange={e => setData({ ...data, priorite: e.target.value })}
          className="px-2 py-1.5 border border-stone-200 rounded text-sm bg-white">
          <option>Haute</option>
          <option>Moyenne</option>
          <option>Basse</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={!data.titre.trim()} className="flex-1 px-3 py-1.5 bg-stone-900 text-white rounded text-sm hover:bg-stone-800 disabled:opacity-50">Ajouter</button>
        <button onClick={() => { setOpen(false); setData({ titre: '', echeance: '', priorite: 'Moyenne' }); }} className="px-3 py-1.5 bg-white border border-stone-200 text-stone-700 rounded text-sm hover:bg-stone-100">Annuler</button>
      </div>
    </div>
  );
}
