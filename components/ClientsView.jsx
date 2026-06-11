'use client';

// components/ClientsView.jsx
// Vue Contacts unifiée — modèle Nature (catégorie) + Postures (acheteur/vendeur)
// Source : table contacts + agrégation roles via /api/contacts

import React, { useState, useEffect, useMemo, Fragment } from 'react';
import {
  Building2, Users, Handshake, MapPin, Trash2, Edit2, X, Check, Loader2,
  Search, Plus, Upload, ExternalLink, Paperclip, ChevronRight, User as UserIcon, ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, getCurrentUserInitials } from '@/lib/auth';
import { matchMandatsForClient } from '@/lib/matching';
import {
  formatPrixCompact,
  toSnake,
  toCamel,
  TYPES_ACTIF_B2B_TREE,
  TYPES_HABITATION_B2C,
  TYPOLOGIES_CLIENT,
  TYPOLOGIES_CLIENT_TREE,
  getMarcheFromTypologieClient,
  CATEGORIES_CONTACT, getCategorieLabel,
} from '@/lib/crm-constants';
import {
  Field,
  DetailItem,
  DealStatutBadge,
  MaturiteBadge,
  TypeInteractionBadge,
} from '@/components/crm/SharedComponents';
import AIAssistantChat from './AIAssistantChat';
import ClientMatches from './ClientMatches';
import ContactsImportModal from './ContactsImportModal';
import CascadeSelectMulti from './CascadeSelectMulti';
import ZonesSelectMulti from './ZonesSelectMulti';

// ─────────────────────────────────────────────────────────────────
// Configuration NATURE (catégorie du contact, 1 valeur)
// ─────────────────────────────────────────────────────────────────

const NATURE_CONFIG = {
  particulier:   { label: 'Particulier',       bg: 'bg-stone-100',    text: 'text-stone-800',    border: 'border-stone-300',    dot: 'bg-stone-500' },
  agence:        { label: 'Agence',            bg: 'bg-blue-50',      text: 'text-blue-800',     border: 'border-blue-200',     dot: 'bg-blue-500' },
  notaire:       { label: 'Notaire',           bg: 'bg-amber-50',     text: 'text-amber-800',    border: 'border-amber-200',    dot: 'bg-amber-500' },
  family_office: { label: 'Family Office',     bg: 'bg-purple-50',    text: 'text-purple-800',   border: 'border-purple-200',   dot: 'bg-purple-500' },
  fonciere:      { label: 'Foncière',          bg: 'bg-emerald-50',   text: 'text-emerald-800',  border: 'border-emerald-200',  dot: 'bg-emerald-500' },
  mdb:           { label: 'Marchand de biens', bg: 'bg-orange-50',    text: 'text-orange-800',   border: 'border-orange-200',   dot: 'bg-orange-500' },
  apporteur:     { label: 'Apporteur',         bg: 'bg-fuchsia-50',   text: 'text-fuchsia-800',  border: 'border-fuchsia-200',  dot: 'bg-fuchsia-500' },
  autre:         { label: 'Autre',             bg: 'bg-stone-50',     text: 'text-stone-600',    border: 'border-stone-200',    dot: 'bg-stone-400' },
};

const NATURE_ORDER = ['particulier', 'agence', 'notaire', 'family_office', 'fonciere', 'mdb', 'apporteur', 'autre'];

function NatureBadge({ categorie }) {
  const cfg = NATURE_CONFIG[categorie] || NATURE_CONFIG.autre;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function PostureBadge({ posture }) {
  const isAcheteur = posture === 'acheteur';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${isAcheteur ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}`}>
      {isAcheteur ? '↑ Achat' : '↓ Vente'}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// Configuration QUALITÉ (réputation du contact)
// ─────────────────────────────────────────────────────────────────

const QUALITE_CONFIG = {
  bon:           { label: 'Bon',           bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500', icon: '✓' },
  neutre:        { label: 'Neutre',        bg: 'bg-stone-100',  text: 'text-stone-700',   border: 'border-stone-300',   dot: 'bg-stone-400',   icon: '·' },
  a_surveiller:  { label: 'À surveiller',  bg: 'bg-amber-50',   text: 'text-amber-800',   border: 'border-amber-300',   dot: 'bg-amber-500',   icon: '⚠' },
  mauvais:       { label: 'Mauvais',       bg: 'bg-red-50',     text: 'text-red-800',     border: 'border-red-300',     dot: 'bg-red-500',     icon: '⛔' },
};

const QUALITE_ORDER = ['bon', 'neutre', 'a_surveiller', 'mauvais'];

function QualiteBadge({ qualite }) {
  if (!qualite || qualite === 'neutre') return null;
  const cfg = QUALITE_CONFIG[qualite];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

function QualiteSelector({ value, motif, onChange }) {
  const [editingMotif, setEditingMotif] = useState(false);
  const [motifDraft, setMotifDraft] = useState(motif || '');
  const showMotif = value === 'a_surveiller' || value === 'mauvais';

  async function saveMotif() {
    await onChange(value, motifDraft);
    setEditingMotif(false);
  }

  return (
    <div className="bg-white rounded-xl p-4 border border-stone-200 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wide text-stone-600 font-semibold">Qualité du contact</div>
        <QualiteBadge qualite={value} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {QUALITE_ORDER.map(q => {
          const cfg = QUALITE_CONFIG[q];
          const active = value === q;
          return (
            <button
              key={q}
              onClick={() => onChange(q, motif)}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                active
                  ? `${cfg.bg} ${cfg.text} ${cfg.border} ring-2 ring-offset-1 ring-stone-300`
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              <span>{cfg.icon}</span>
              <span>{cfg.label}</span>
            </button>
          );
        })}
      </div>
      {showMotif && (
        <div className="mt-3">
          <div className="text-xs uppercase tracking-wide text-stone-600 font-semibold mb-1.5">Motif</div>
          {editingMotif ? (
            <div className="flex gap-2">
              <textarea
                value={motifDraft}
                onChange={e => setMotifDraft(e.target.value)}
                rows={2}
                placeholder="Ex : non-respect d'un accord, négociation déloyale..."
                className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900"
              />
              <div className="flex flex-col gap-1">
                <button onClick={saveMotif} className="px-3 py-1.5 bg-ink-deep text-white rounded text-xs hover:bg-ink">OK</button>
                <button onClick={() => { setEditingMotif(false); setMotifDraft(motif || ''); }} className="px-3 py-1.5 bg-white border border-stone-200 text-stone-700 rounded text-xs hover:bg-stone-50">×</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditingMotif(true)}
              className="w-full text-left text-sm text-stone-700 px-3 py-2 bg-stone-50 rounded-lg hover:bg-stone-100 italic"
            >
              {motif || '+ Ajouter un motif'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Helper : notifier le matching (fire-and-forget)
async function triggerMatchingBatch({ mandatId, clientId }) {
  // (QW2) Batch de matching désactivé — voir note dans CRM.jsx.
  return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    fetch('/api/matching-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, mandatId, clientId }),
    }).catch(e => console.warn('[matching-batch] échec:', e.message));
  } catch (e) {
    console.warn('[matching-batch] init failed:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// OwnerSelector — sélecteur de responsable
// ─────────────────────────────────────────────────────────────────

export function OwnerSelector({ mandat, client, entity = 'mandat', reload }) {
  const target = entity === 'client' ? client : mandat;
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const ownerInitials = (target?.owner || '?').toUpperCase().slice(0, 2);

  useEffect(() => {
    supabase.from('profiles').select('id, prenom, nom').eq('actif', true)
      .then(({ data }) => setProfiles(data || []));
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!e.target.closest('.owner-selector')) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  const reassign = async (newInitials, profile) => {
    if (newInitials === target?.owner) { setOpen(false); return; }
    setSaving(true);
    try {
      const table = entity === 'client' ? 'clients' : 'mandats';
      await supabase.from(table).update({ owner: newInitials }).eq('id', target.id);

      if (profile && profile.id && profile.id !== user?.id) {
        const targetName = entity === 'client'
          ? `${target.prenom || ''} ${target.nom || ''}`.trim() || 'un client'
          : target.nom || 'un mandat';
        const titreEntity = entity === 'client' ? 'client' : 'mandat';
        await supabase.from('notifications').insert({
          user_id: profile.id,
          type: entity === 'client' ? 'client_assigned' : 'mandat_assigned',
          titre: `Nouveau ${titreEntity} assigné : ${targetName}`,
          message: `Tu as été désigné responsable de ce ${titreEntity}. Pense à le contacter rapidement.`,
          lue: false,
          created_by: user?.id
        });
      }

      if (reload) reload();
      setOpen(false);
    } catch (e) {
      console.error('Erreur réassignement:', e);
      alert('Erreur lors du réassignement');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (p) => `${(p.prenom || '').charAt(0)}${(p.nom || '').charAt(0)}`.toUpperCase() || '??';

  return (
    <div className="flex flex-col items-center owner-selector relative">
      <div className="text-[10px] uppercase text-stone-500 tracking-wide mb-1">Resp.</div>
      <button onClick={() => setOpen(!open)} disabled={saving}
        className="w-10 h-10 rounded-full gradient-sage-dark flex items-center justify-center text-white font-medium text-sm shadow-luxe hover:opacity-90 disabled:opacity-50 cursor-pointer relative"
        title={`Responsable : ${target?.owner || '—'} — clic pour réassigner`}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : ownerInitials}
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center shadow border border-cream-dark">
          <ChevronRight className="w-2.5 h-2.5 text-stone-600 rotate-90" />
        </div>
      </button>
      {open && (
        <div className="absolute top-full mt-2 right-0 bg-white rounded-lg shadow-luxe-hover border border-cream-dark py-1 z-30 min-w-[180px]">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-stone-500 border-b border-cream-dark">Réassigner à</div>
          {profiles.map(p => {
            const initials = getInitials(p);
            const isCurrent = initials === target?.owner;
            return (
              <button key={p.id} onClick={() => reassign(initials, p)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-cream-50 ${isCurrent ? 'bg-sage-50' : ''}`}>
                <div className="w-7 h-7 rounded-full gradient-sage-dark flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0">
                  {initials}
                </div>
                <span className="flex-1 text-stone-800">{p.prenom} {p.nom}</span>
                {isCurrent && <Check className="w-3.5 h-3.5 text-sage-dark" />}
              </button>
            );
          })}
          {profiles.length === 0 && (
            <div className="px-3 py-2 text-xs text-stone-500 italic">Aucun commercial actif</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// AddRoleModal — modale pour assigner un rôle à un contact
// ─────────────────────────────────────────────────────────────────

function AddRoleModal({ contactId, contactName, mandats, onClose, onSuccess }) {
  const [role, setRole] = useState('mandant');
  const [mandatId, setMandatId] = useState('');
  const [estPrincipal, setEstPrincipal] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const ROLE_OPTIONS = [
    { value: 'mandant', label: 'Mandant', desc: 'Propriétaire qui confie le mandat' },
    { value: 'proprietaire', label: 'Propriétaire', desc: 'Co-propriétaire / indivision' },
    { value: 'apporteur_mandat', label: 'Apporteur mandat', desc: 'A apporté ce mandat à I&P (côté entrée)' },
    { value: 'apporteur_acquereur', label: 'Apporteur acquéreur', desc: 'Apporte des acquéreurs sur ce mandat (côté sortie)' },
    { value: 'notaire_vendeur', label: 'Notaire (côté vendeur)', desc: 'Notaire du mandant' },
    { value: 'notaire_acquereur', label: 'Notaire (côté acquéreur)', desc: 'Notaire de l\'acheteur' },
    { value: 'interlocuteur', label: 'Interlocuteur', desc: 'Contact opérationnel sur ce mandat' },
  ];

  async function handleSave() {
    if (!mandatId) {
      alert('Sélectionne un mandat');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('mandat_contacts').insert({
        contact_id: contactId,
        mandat_id: mandatId,
        role,
        est_principal: estPrincipal,
        notes: notes.trim() || null,
      });
      if (error) {
        console.error('[AddRoleModal]', error);
        if (error.code === '23505') {
          alert('Ce rôle est déjà attribué à ce contact sur ce mandat.');
        } else {
          alert('Erreur : ' + error.message);
        }
        return;
      }
      onSuccess?.();
    } catch (e) {
      console.error('[AddRoleModal] crash', e);
      alert('Erreur inattendue');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-luxe-hover max-w-lg w-full max-h-[92vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-stone-200">
          <div>
            <h2 className="font-display text-xl font-semibold text-stone-900">Ajouter un rôle</h2>
            <p className="text-xs text-stone-500 mt-1">à {contactName}</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-stone-600 mb-2 font-semibold">Type de rôle</label>
            <div className="space-y-1.5">
              {ROLE_OPTIONS.map(opt => (
                <label key={opt.value} className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer ${role === opt.value ? 'border-stone-900 bg-stone-50' : 'border-stone-200 hover:bg-cream-50'}`}>
                  <input type="radio" name="role" value={opt.value} checked={role === opt.value} onChange={e => setRole(e.target.value)} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-stone-900">{opt.label}</div>
                    <div className="text-xs text-stone-500">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-stone-600 mb-2 font-semibold">Mandat concerné</label>
            <select value={mandatId} onChange={e => setMandatId(e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
              <option value="">— Sélectionner un mandat —</option>
              {(mandats || []).map(m => (
                <option key={m.id} value={m.id}>
                  {m.nom || m.adresse || `Mandat ${m.id.slice(0, 8)}`}
                  {m.ville ? ` · ${m.ville}` : ''}
                  {m.statut ? ` (${m.statut})` : ''}
                </option>
              ))}
            </select>
          </div>

          {(role === 'mandant' || role === 'proprietaire') && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={estPrincipal} onChange={e => setEstPrincipal(e.target.checked)} />
              <span className="text-sm text-stone-700">Mandant principal</span>
            </label>
          )}

          <div>
            <label className="block text-xs uppercase tracking-wide text-stone-600 mb-2 font-semibold">Notes (optionnel)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Ex : usufruitier, contact préféré..." className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
          </div>
        </div>

        <div className="flex gap-2 justify-end p-6 border-t border-stone-200 bg-stone-50 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-cream-200 rounded-lg">Annuler</button>
          <button onClick={handleSave} disabled={saving || !mandatId} className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Ajouter ce rôle'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// InteractionsHistorySection — Historique des échanges avec onglets
// ─────────────────────────────────────────────────────────────────

const INTERACTION_TYPE_GROUPS = {
  all:    { label: 'Tous',    types: null },
  email:  { label: 'Emails',  types: ['email_entrant', 'email_sortant', 'Email'] },
  call:   { label: 'Appels',  types: ['Appel', 'appel', 'call'] },
  rdv:    { label: 'RDV',     types: ['RDV', 'rdv', 'Visite', 'visite', 'Rendez-vous'] },
  note:   { label: 'Notes',   types: ['Note', 'note'] }
};

function InteractionsHistorySection({ interactions }) {
  const [tab, setTab] = useState('all');

  if (!interactions || interactions.length === 0) return null;

  // Compteurs par onglet
  const counts = {};
  for (const [key, group] of Object.entries(INTERACTION_TYPE_GROUPS)) {
    if (group.types === null) {
      counts[key] = interactions.length;
    } else {
      counts[key] = interactions.filter(i => group.types.includes(i.type)).length;
    }
  }

  // Filtrage
  const activeGroup = INTERACTION_TYPE_GROUPS[tab];
  const filtered = activeGroup.types === null
    ? interactions
    : interactions.filter(i => activeGroup.types.includes(i.type));

  // Tri par date desc
  const sorted = [...filtered].sort((a, b) => {
    const aDate = a.date || a.createdAt || a.created_at || '';
    const bDate = b.date || b.createdAt || b.created_at || '';
    return bDate.localeCompare(aDate);
  });

  return (
    <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark mb-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-display text-lg font-semibold text-stone-900">
          Historique des échanges ({interactions.length})
        </h2>
        <div className="flex gap-1 bg-stone-100 p-1 rounded-lg">
          {Object.entries(INTERACTION_TYPE_GROUPS).map(([key, group]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-1 text-xs rounded-md transition flex items-center gap-1.5 ${
                tab === key
                  ? 'bg-white text-stone-900 shadow-sm font-medium'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span>{group.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                tab === key ? 'bg-stone-100 text-stone-700' : 'bg-white/60 text-stone-500'
              }`}>
                {counts[key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-sm text-stone-400 italic py-4">Aucune interaction dans cette catégorie</div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
          {sorted.map(int => <InteractionItem key={int.id} interaction={int} />)}
        </div>
      )}
    </div>
  );
}

function InteractionItem({ interaction: int }) {
  const meta = int.metadata || {};
  const isEmail = ['email_entrant', 'email_sortant', 'Email'].includes(int.type);
  const isEntrant = int.type === 'email_entrant';
  const isSortant = int.type === 'email_sortant';

  // Date formatée
  const rawDate = int.date || int.createdAt || int.created_at;
  let dateLabel = '—';
  if (rawDate) {
    const d = new Date(rawDate);
    dateLabel = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // Sujet et contenu
  // Le 'resume' des emails archivés est "Sujet — preview 200 car". On split.
  let title = int.objet || int.resume || int.notes || '—';
  let preview = null;
  if (isEmail && int.resume && int.resume.includes(' — ')) {
    const parts = int.resume.split(' — ');
    title = parts[0];
    preview = parts.slice(1).join(' — ');
  }

  return (
    <div className="flex items-start gap-3 pb-3 border-b border-cream-dark last:border-0">
      <TypeInteractionBadge type={int.type} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-stone-900 font-medium break-words">
              {title}
            </div>
            {preview && (
              <div className="text-xs text-stone-500 mt-0.5 line-clamp-2 break-words">
                {preview}
              </div>
            )}
          </div>
          {meta.web_link && (
            <a
              href={meta.web_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 flex-shrink-0"
              title="Ouvrir dans Outlook"
            >
              <ExternalLink className="w-3 h-3" />
              Outlook
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5 flex-wrap">
          <span>{dateLabel}</span>
          {isEmail && meta.from_name && isEntrant && (
            <>
              <span>·</span>
              <span>De : <strong className="text-stone-700">{meta.from_name}</strong></span>
            </>
          )}
          {isSortant && (
            <>
              <span>·</span>
              <span className="text-emerald-700">↗ Envoyé</span>
            </>
          )}
          {isEntrant && (
            <>
              <span>·</span>
              <span className="text-blue-700">↙ Reçu</span>
            </>
          )}
          {meta.has_attachments && (
            <>
              <span>·</span>
              <Paperclip className="w-3 h-3" />
              <span>Pièces jointes</span>
            </>
          )}
          {meta.categorie && (
            <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 rounded-full font-medium uppercase">
              {meta.categorie}
            </span>
          )}
        </div>
        {int.next_step && (
          <div className="text-xs text-amber-700 mt-1.5 bg-amber-50 px-2 py-1 rounded">
            ➡️ Prochaine étape : {int.next_step}
            {int.date_next_step && ` (${new Date(int.date_next_step).toLocaleDateString('fr-FR')})`}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ClientDetail — fiche détail unifiée
// ─────────────────────────────────────────────────────────────────

export function ClientDetail({ client, onBack, onEdit, mandats, deals, interactions, reload, onOpenMandat }) {
  const [contactData, setContactData] = useState(null);
  const [loadingContact, setLoadingContact] = useState(true);
  const [showAddRole, setShowAddRole] = useState(false);
  const [qualite, setQualite] = useState('neutre');
  const [motifInactif, setMotifInactif] = useState('');

  async function loadContact() {
    if (!client?.contactId && !client?.contact_id) {
      setLoadingContact(false);
      return;
    }
    const contactId = client.contactId || client.contact_id;
    setLoadingContact(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`);
      const data = await res.json();
      setContactData(data);
      setQualite(data?.contact?.qualite || 'neutre');
      setMotifInactif(data?.contact?.motif_inactif || '');
    } catch (e) {
      console.error('[loadContact]', e);
    } finally {
      setLoadingContact(false);
    }
  }

  async function updateQualite(newQualite, newMotif) {
    const contactId = client.contactId || client.contact_id;
    if (!contactId) return;
    setQualite(newQualite);
    setMotifInactif(newMotif || '');
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qualite: newQualite, motif_inactif: newMotif || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert('Erreur : ' + (err.error || 'inconnue'));
      }
    } catch (e) {
      console.error('[updateQualite]', e);
      alert('Erreur réseau');
    }
  }

  useEffect(() => {
    loadContact();
  }, [client?.id]);

  const clientDeals = deals.filter(d => d.clientId === client.id);
  const clientInteractions = (interactions || []).filter(i => i.clientId === client.id);

  const matches = useMemo(() => {
    if (!client) return [];
    return matchMandatsForClient(client, mandats || []);
  }, [client, mandats]);

  // Postures depuis contactData
  const postures = contactData?.contact?.postures || ['acheteur'];
  const categorie = contactData?.contact?.categorie || 'autre';

  // Mandats par rôle
  const mandatsAsMandant = (contactData?.mandats || []).filter(mc => mc.role === 'mandant' || mc.role === 'proprietaire');
  const mandatsAsApporteurMandat = (contactData?.mandats || []).filter(mc => mc.role === 'apporteur_mandat');
  const mandatsAsApporteurAcquereur = (contactData?.mandats || []).filter(mc => mc.role === 'apporteur_acquereur');
  const mandatsAsNotaire = (contactData?.mandats || []).filter(mc => mc.role === 'notaire_vendeur' || mc.role === 'notaire_acquereur');

  return (
    <div className="p-8 max-w-6xl">
      <button onClick={onBack} className="text-sm text-stone-500 hover:text-stone-900 mb-4 flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Retour à la liste
      </button>

      {/* HEADER */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="font-display text-3xl font-semibold text-stone-900">
              {client.prenom} {client.nom}
            </h1>
            {client.societe && (
              <span className="text-stone-500 text-lg">· {client.societe}</span>
            )}
          </div>
          {/* Nature + Postures + Qualité */}
          <div className="flex items-center gap-2 flex-wrap">
            <NatureBadge categorie={categorie} />
            {postures.map(p => <PostureBadge key={p} posture={p} />)}
            <QualiteBadge qualite={qualite} />
            {client.typologie && (
              <span className="text-xs px-2 py-0.5 bg-stone-100 text-stone-700 rounded-full">{client.typologie}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <OwnerSelector client={client} entity="client" reload={reload} />
          <button
            onClick={() => setShowAddRole(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 text-stone-700 rounded-lg text-sm hover:bg-cream-50"
          >
            <Plus className="w-4 h-4" /> Ajouter un rôle
          </button>
          <button onClick={onEdit} className="flex items-center gap-2 px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink">
            <Edit2 className="w-4 h-4" /> Modifier
          </button>
        </div>
      </div>

      {/* QUALITÉ */}
      <QualiteSelector value={qualite} motif={motifInactif} onChange={updateQualite} />

      {/* COORDONNÉES */}
      <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark mb-4">
        <div className="flex items-center gap-2 mb-4">
          <UserIcon className="w-4 h-4 text-stone-500" />
          <h2 className="font-display text-lg font-semibold text-stone-900">Coordonnées</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <DetailItem label="Email" value={client.email || '—'} />
          <DetailItem label="Téléphone" value={client.tel || '—'} />
          {client.adresse && <DetailItem label="Adresse" value={client.adresse} />}
          {client.ville && <DetailItem label="Ville" value={client.ville} />}
        </div>
      </div>

      {/* CÔTÉ ACHAT (si posture acheteur) */}
      {postures.includes('acheteur') && (
        <div className="bg-emerald-50/30 rounded-xl p-6 border border-emerald-200 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <h2 className="font-display text-lg font-semibold text-emerald-900">Côté Achat</h2>
          </div>

          {(client.budgetMin || client.budgetMax || (client.zones || []).length > 0 || (client.typologiesRecherchees || []).length > 0) && (
            <div className="bg-white rounded-lg p-4 border border-emerald-200/50 mb-3">
              <div className="text-xs uppercase tracking-wide text-emerald-700 mb-3 font-semibold">Critères de recherche</div>
              <div className="grid grid-cols-2 gap-3">
                <DetailItem label="Budget" value={
                  client.budgetMin || client.budgetMax
                    ? `${formatPrixCompact(client.budgetMin || 0)} → ${formatPrixCompact(client.budgetMax || 0)}`
                    : '—'
                } />
                <DetailItem label="Surface" value={
                  client.surfaceMin || client.surfaceMax
                    ? `${client.surfaceMin || '?'}m² → ${client.surfaceMax || '?'}m²`
                    : '—'
                } />
                {(client.typologiesRecherchees || []).length > 0 && (
                  <div className="col-span-2">
                    <div className="text-xs uppercase tracking-wide text-stone-500 mb-2">Typologies</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(client.typologiesRecherchees || []).map((t, i) => (
                        <span key={i} className="text-xs px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(client.zones || []).length > 0 && (
                  <div className="col-span-2">
                    <div className="text-xs uppercase tracking-wide text-stone-500 mb-2">Zones</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(client.zones || []).map((z, i) => (
                        <span key={i} className="text-xs px-2 py-1 bg-stone-100 text-stone-700 rounded-full">{z}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-emerald-200/50">
            <ClientMatches client={client} mandats={mandats} interactions={interactions} onOpenMandat={onOpenMandat} reload={reload} />
          </div>
        </div>
      )}

      {/* CÔTÉ VENTE (si posture vendeur OU mandats associés) */}
      {(postures.includes('vendeur') || mandatsAsMandant.length > 0 || mandatsAsApporteurMandat.length > 0 || mandatsAsApporteurAcquereur.length > 0 || mandatsAsNotaire.length > 0) && (
        <div className="bg-orange-50/30 rounded-xl p-6 border border-orange-200 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            <h2 className="font-display text-lg font-semibold text-orange-900">Côté Vente</h2>
          </div>

          {mandatsAsMandant.length > 0 && (
            <div className="mb-3">
              <div className="text-xs uppercase tracking-wide text-blue-700 mb-2 font-semibold">Mandats portés (Mandant)</div>
              <div className="space-y-2">
                {mandatsAsMandant.map(mc => (
                  <button key={mc.id} onClick={() => onOpenMandat?.(mc.mandat.id)} className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200/50 hover:bg-blue-50 text-left">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-stone-900">{mc.mandat?.nom || 'Mandat inconnu'}</div>
                      <div className="text-xs text-stone-500">{mc.mandat?.ville || ''}{mc.est_principal ? ' · Principal' : ''}</div>
                    </div>
                    {mc.mandat?.statut && (<span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">{mc.mandat.statut}</span>)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mandatsAsApporteurMandat.length > 0 && (
            <div className="mb-3">
              <div className="text-xs uppercase tracking-wide text-purple-700 mb-2 font-semibold">Mandats apportés (entrée)</div>
              <div className="space-y-2">
                {mandatsAsApporteurMandat.map(mc => (
                  <button key={mc.id} onClick={() => onOpenMandat?.(mc.mandat.id)} className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-purple-200/50 hover:bg-purple-50 text-left">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-stone-900">{mc.mandat?.nom || 'Mandat inconnu'}</div>
                      <div className="text-xs text-stone-500">{mc.mandat?.ville || ''}</div>
                    </div>
                    {mc.mandat?.statut && (<span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full">{mc.mandat.statut}</span>)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mandatsAsApporteurAcquereur.length > 0 && (
            <div className="mb-3">
              <div className="text-xs uppercase tracking-wide text-fuchsia-700 mb-2 font-semibold">Apporte des acquéreurs sur</div>
              <div className="space-y-2">
                {mandatsAsApporteurAcquereur.map(mc => (
                  <button key={mc.id} onClick={() => onOpenMandat?.(mc.mandat.id)} className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-fuchsia-200/50 hover:bg-fuchsia-50 text-left">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-stone-900">{mc.mandat?.nom || 'Mandat inconnu'}</div>
                      <div className="text-xs text-stone-500">{mc.mandat?.ville || ''}</div>
                    </div>
                    {mc.mandat?.statut && (<span className="text-xs px-2 py-1 bg-fuchsia-100 text-fuchsia-800 rounded-full">{mc.mandat.statut}</span>)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mandatsAsNotaire.length > 0 && (
            <div className="mb-3">
              <div className="text-xs uppercase tracking-wide text-amber-700 mb-2 font-semibold">Mandats suivis (Notaire)</div>
              <div className="space-y-2">
                {mandatsAsNotaire.map(mc => (
                  <button key={mc.id} onClick={() => onOpenMandat?.(mc.mandat.id)} className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200/50 hover:bg-amber-50 text-left">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-stone-900">{mc.mandat?.nom || 'Mandat inconnu'}</div>
                      <div className="text-xs text-stone-500">{mc.role === 'notaire_vendeur' ? 'Côté vendeur' : 'Côté acquéreur'}</div>
                    </div>
                    {mc.mandat?.statut && (<span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded-full">{mc.mandat.statut}</span>)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DEALS */}
      {clientDeals.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark mb-4">
          <h2 className="font-display text-lg font-semibold text-stone-900 mb-4">Deals ({clientDeals.length})</h2>
          <div className="space-y-2">
            {clientDeals.map(d => {
              const mandat = mandats.find(m => m.id === d.mandatId);
              return (
                <button key={d.id} onClick={() => mandat && onOpenMandat?.(mandat.id)} className="w-full flex items-center justify-between p-3 bg-stone-50 rounded-lg hover:bg-stone-100 text-left">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-stone-900 truncate">{mandat?.nom || 'Mandat inconnu'}</div>
                    <div className="text-xs text-stone-500">{d.statut}</div>
                  </div>
                  <DealStatutBadge statut={d.statut} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* INTERACTIONS — Historique des échanges avec onglets */}
      <InteractionsHistorySection interactions={clientInteractions} />

      {showAddRole && (client.contactId || client.contact_id) && (
        <AddRoleModal
          contactId={client.contactId || client.contact_id}
          contactName={`${client.prenom || ''} ${client.nom || ''}`.trim()}
          mandats={mandats}
          onClose={() => setShowAddRole(false)}
          onSuccess={() => { setShowAddRole(false); loadContact(); }}
        />
      )}
      {/* (QW3) AIAssistantChat local retiré — instance globale unique dans CRM(). */}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ClientForm — formulaire d'édition
// ─────────────────────────────────────────────────────────────────

export function ClientForm({ client, onSave, onClose }) {
  const { profile } = useAuth();
  const userInitials = getCurrentUserInitials(profile);
  const [data, setData] = useState(() => {
    const base = {
      prenom: '', nom: '', societe: '', email: '', tel: '',
      adresse: '', ville: '', typologie: '', categorie: '',
      budgetMin: 0, budgetMax: 0, surfaceMin: 0, surfaceMax: 0,
      typologiesRecherchees: [], zones: [],
      rendementMin: 0, statut: 'Actif', maturite: 'Tiède',
      owner: userInitials, notes: '',
    };
    if (!client) return base;
    // Normalise le client (snake_case BDD) en camelCase pour le formulaire
    const c = toCamel(client);
    return {
      ...base,
      ...c,
      typologiesRecherchees: c.typologiesRecherchees || [],
      zones: c.zones || [],
    };
  });

  useEffect(() => {
    async function loadCategorie() {
      const contactId = client?.contactId || client?.contact_id;
      if (!contactId) return;
      try {
        const res = await fetch(`/api/contacts/${contactId}`);
        const json = await res.json();
        if (json?.contact?.categorie) {
          setData(d => ({ ...d, categorie: json.contact.categorie }));
        }
      } catch (e) {
        console.warn('[ClientForm] could not load categorie:', e);
      }
    }
    if (client?.id) loadCategorie();
  }, [client?.id]);

  const update = (k, v) => setData({ ...data, [k]: v });
  const marche = getMarcheFromTypologieClient(data.typologie);

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-luxe-hover max-w-2xl w-full max-h-[92vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-stone-200 sticky top-0 bg-white z-10">
          <h2 className="font-display text-2xl font-semibold text-stone-900">{client ? 'Modifier' : 'Nouveau'} client</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom"><input type="text" value={data.prenom || ''} onChange={e => update('prenom', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
            <Field label="Nom"><input type="text" value={data.nom || ''} onChange={e => update('nom', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
          </div>
          <Field label="Société (optionnel)"><input type="text" value={data.societe || ''} onChange={e => update('societe', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
          <Field label="Catégorie (nature du contact)">
            <select value={data.categorie || ''} onChange={e => update('categorie', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
              <option value="">— Choisir —</option>
              {CATEGORIES_CONTACT.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {data.categorie && (
              <p className="text-xs text-stone-500 mt-1 italic">
                {CATEGORIES_CONTACT.find(c => c.value === data.categorie)?.desc || ''}
              </p>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><input type="email" value={data.email || ''} onChange={e => update('email', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
            <Field label="Téléphone"><input type="text" value={data.tel || ''} onChange={e => update('tel', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
          </div>
          <Field label="Typologie">
            <select value={data.typologie || ''} onChange={e => update('typologie', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
              <option value="">— Choisir —</option>
              {TYPOLOGIES_CLIENT.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Budget min (€)"><input type="number" value={data.budgetMin || 0} onChange={e => update('budgetMin', +e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
            <Field label="Budget max (€)"><input type="number" value={data.budgetMax || 0} onChange={e => update('budgetMax', +e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Surface min (m²)"><input type="number" value={data.surfaceMin || 0} onChange={e => update('surfaceMin', +e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
            <Field label="Surface max (m²)"><input type="number" value={data.surfaceMax || 0} onChange={e => update('surfaceMax', +e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
          </div>
          <Field label="Typologies recherchées">
            {marche === 'b2c' ? (
              <CascadeSelectMulti
                tree={{ 'Résidentiel': TYPES_HABITATION_B2C }}
                value={data.typologiesRecherchees || []}
                onChange={(vals) => update('typologiesRecherchees', vals)}
              />
            ) : (
              <CascadeSelectMulti
                tree={TYPES_ACTIF_B2B_TREE}
                value={data.typologiesRecherchees || []}
                onChange={(vals) => update('typologiesRecherchees', vals)}
              />
            )}
          </Field>
          <Field label="Zones recherchées">
            <ZonesSelectMulti
              value={data.zones || []}
              onChange={(vals) => update('zones', vals)}
            />
          </Field>
          <Field label="Rendement minimum (%)">
            <input type="number" step="0.01" value={data.rendementMin || 0} onChange={e => update('rendementMin', +e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Statut">
              <select value={data.statut || 'Actif'} onChange={e => update('statut', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
                <option>Actif</option>
                <option>Inactif</option>
                <option>Mandant</option>
              </select>
            </Field>
            <Field label="Maturité">
              <select value={data.maturite || 'Tiède'} onChange={e => update('maturite', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
                <option>Chaud</option>
                <option>Tiède</option>
                <option>Froid</option>
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <textarea value={data.notes || ''} onChange={e => update('notes', e.target.value)} rows={3} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
          </Field>
        </div>

        <div className="flex gap-2 justify-end p-6 border-t border-stone-200 bg-stone-50 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-cream-200 rounded-lg">Annuler</button>
          <button onClick={() => onSave(data)} className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ClientsTab — onglet principal "Contacts"
// ─────────────────────────────────────────────────────────────────

export default function ClientsTab({ clients, reload, mandats, deals, interactions, pendingClientId, onPendingClientConsumed, onOpenMandat }) {
  const { user, profile } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [search, setSearch] = useState('');
  const [filterNature, setFilterNature] = useState('');
  const [filterPosture, setFilterPosture] = useState('');
  const [filterMarche, setFilterMarche] = useState('Tous'); // 'Tous' | 'b2b' | 'b2c'
  const [filterTypologie, setFilterTypologie] = useState('Tous');
  const [filterMine, setFilterMine] = useState(false);
  const myInitials = getCurrentUserInitials(profile);
  const [editingClient, setEditingClient] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  async function loadContacts() {
    setLoadingContacts(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      params.set('limit', '500');
      const res = await fetch(`/api/contacts?${params.toString()}`);
      const data = await res.json();
      setContacts(data?.contacts || []);
    } catch (e) {
      console.error('[ContactsTab] load error:', e);
    } finally {
      setLoadingContacts(false);
    }
  }

  useEffect(() => {
    const h = setTimeout(loadContacts, 250);
    return () => clearTimeout(h);
  }, [search]);

  useEffect(() => {
    if (pendingClientId && Array.isArray(clients) && clients.length > 0) {
      const c = clients.find(x => x.id === pendingClientId);
      if (c) { setSelectedClient(c); onPendingClientConsumed?.(); }
    }
  }, [pendingClientId, clients]);

  // Filtres combinés
  const filtered = contacts.filter(c => {
    if (filterMine) {
      const hasMyOwnedClient = (c.client_owners || []).includes(myInitials);
      if (!hasMyOwnedClient) return false;
    }
    if (filterNature && c.categorie !== filterNature) return false;
    if (filterPosture && !(c.postures || []).includes(filterPosture)) return false;

    // Filtre typologie (cible la typologie du client lié, ou la 1ère typologie)
    const cTypologie = c.client_typologie || c.typologie || (c.client_typologies && c.client_typologies[0]);
    if (filterTypologie !== 'Tous' && cTypologie !== filterTypologie) return false;

    // Filtre marché : si typologie présente, on utilise getMarcheFromTypologieClient
    if (filterMarche !== 'Tous') {
      const cMarche = cTypologie ? getMarcheFromTypologieClient(cTypologie) : null;
      if (cMarche !== filterMarche) return false;
    }

    return true;
  });

  function handleContactClick(contact) {
    const linkedClient = clients.find(c => c.contactId === contact.id || c.contact_id === contact.id);
    if (linkedClient) {
      setSelectedClient(linkedClient);
    } else if ((contact.postures || []).includes('acheteur')) {
      alert('Rechargement nécessaire — clique sur l\'onglet Mandats puis reviens sur Contacts.');
    } else {
      alert(`${contact.prenom || ''} ${contact.nom || ''} : édition coordonnées à venir.`);
    }
  }

  const handleSave = async (clientData) => {
    const snakeData = toSnake(clientData);
    // Ne garder que les vraies colonnes de la table clients (évite erreur 400 sur champs parasites comme 'adresse', 'ville')
    const COLONNES_CLIENTS = [
      'id', 'nom', 'prenom', 'societe', 'email', 'tel', 'typologie', 'sous_typologie',
      'nature', 'marche', 'budget_min', 'budget_max',
      'rendement_min', 'zones', 'typologies_recherchees', 'statut', 'maturite',
      'origine', 'owner', 'details_recherche', 'created_by', 'updated_by', 'contact_id'
    ];
    Object.keys(snakeData).forEach(k => {
      if (!COLONNES_CLIENTS.includes(k)) delete snakeData[k];
    });
    delete snakeData.created_at;
    delete snakeData.updated_at;

    const categorie = snakeData.categorie;
    delete snakeData.categorie;

    let clientId = clientData.id;
    let contactId = clientData.contactId || clientData.contact_id;

    if (clientData.id) {
      snakeData.updated_by = user?.id;
      await supabase.from('clients').update(snakeData).eq('id', clientData.id);
    } else {
      delete snakeData.id;
      snakeData.created_by = user?.id;
      const { data: created } = await supabase.from('clients').insert(snakeData).select().single();
      if (created) { clientId = created.id; contactId = created.contact_id; }
    }

    if (contactId && categorie !== undefined) {
      try {
        await fetch(`/api/contacts/${contactId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categorie: categorie || null }),
        });
      } catch (e) {
        console.warn('[handleSave] could not update categorie:', e);
      }
    }

    setShowNew(false);
    if (clientId) triggerMatchingBatch({ clientId });
    // Rester sur la fiche du client qu'on vient d'éditer (au lieu de revenir à la liste)
    if (clientId) {
      setSelectedClient({ ...clientData, id: clientId });
    }
    setEditingClient(null);
    reload();
    loadContacts();
  };

  // Compteurs par nature et posture
  const natureCounts = useMemo(() => {
    const counts = {};
    NATURE_ORDER.forEach(n => { counts[n] = 0; });
    contacts.forEach(c => {
      const cat = c.categorie || 'autre';
      if (counts[cat] !== undefined) counts[cat]++;
    });
    return counts;
  }, [contacts]);

  const postureCounts = useMemo(() => {
    const counts = { acheteur: 0, vendeur: 0 };
    contacts.forEach(c => {
      (c.postures || []).forEach(p => { if (counts[p] !== undefined) counts[p]++; });
    });
    return counts;
  }, [contacts]);

  if (selectedClient) {
    const current = clients.find(c => c.id === selectedClient.id) || selectedClient;
    return (
      <>
        <ClientDetail
          client={current}
          onBack={() => setSelectedClient(null)}
          onEdit={() => setEditingClient(current)}
          mandats={mandats}
          deals={deals}
          interactions={interactions}
          reload={reload}
          onOpenMandat={onOpenMandat}
        />
        {editingClient && (
          <ClientForm client={editingClient} onSave={handleSave} onClose={() => setEditingClient(null)} />
        )}
      </>
    );
  }

  return (
    <div className="p-6 max-w-none">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-semibold text-stone-900">Contacts</h1>
          <span className="text-stone-500 text-sm">{filtered.length} contact{filtered.length > 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-cream-50 text-sm">
            <Upload className="w-4 h-4" /> Importer
          </button>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-3 py-2 bg-ink-deep text-white rounded-lg hover:bg-stone-800 text-sm font-medium">
            <Plus className="w-4 h-4" /> Nouveau contact
          </button>
        </div>
      </div>

      {/* Recherche */}
      <div className="flex gap-3 mb-3 flex-wrap">
        <div className="flex-1 relative min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher (nom, société, email, tél…)"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
        </div>
        <label className="flex items-center gap-2 px-3 py-2.5 bg-white border border-stone-200 rounded-lg text-sm cursor-pointer">
          <input type="checkbox" checked={filterMine} onChange={e => setFilterMine(e.target.checked)} />
          <span>Mes contacts</span>
        </label>
      </div>

      {/* Filtres Nature */}
      <div className="flex gap-2 mb-2 flex-wrap items-center">
        <span className="text-xs uppercase text-stone-500 tracking-wide font-semibold mr-1">Nature :</span>
        <button onClick={() => setFilterNature('')} className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${filterNature === '' ? 'bg-ink-deep text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'}`}>
          Toutes ({contacts.length})
        </button>
        {NATURE_ORDER.map(nature => {
          const cfg = NATURE_CONFIG[nature];
          const active = filterNature === nature;
          const count = natureCounts[nature] || 0;
          if (count === 0) return null;
          return (
            <button key={nature} onClick={() => setFilterNature(nature)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${active ? `${cfg.bg} ${cfg.text} ${cfg.border} ring-2 ring-offset-1 ring-stone-300` : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Filtres Posture */}
      <div className="flex gap-2 mb-2 flex-wrap items-center">
        <span className="text-xs uppercase text-stone-500 tracking-wide font-semibold mr-1">Posture :</span>
        <button onClick={() => setFilterPosture('')} className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${filterPosture === '' ? 'bg-ink-deep text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'}`}>
          Toutes
        </button>
        <button onClick={() => setFilterPosture('acheteur')} className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${filterPosture === 'acheteur' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 ring-2 ring-offset-1 ring-stone-300' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'}`}>
          ↑ Acheteur ({postureCounts.acheteur || 0})
        </button>
        <button onClick={() => setFilterPosture('vendeur')} className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${filterPosture === 'vendeur' ? 'bg-orange-100 text-orange-800 border-orange-300 ring-2 ring-offset-1 ring-stone-300' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'}`}>
          ↓ Vendeur ({postureCounts.vendeur || 0})
        </button>
      </div>

      {/* Filtres Typologie (B2B/B2C + select détaillé) */}
      <div className="flex gap-2 mb-6 flex-wrap items-center">
        <span className="text-xs uppercase text-stone-500 tracking-wide font-semibold mr-1">Typologie :</span>
        <div className="inline-flex rounded-lg border border-stone-200 overflow-hidden">
          <button
            onClick={() => setFilterMarche('Tous')}
            className={`px-3 py-1.5 text-xs font-medium ${filterMarche === 'Tous' ? 'bg-ink-deep text-white' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
          >
            Tous
          </button>
          <button
            onClick={() => setFilterMarche('b2b')}
            className={`px-3 py-1.5 text-xs font-medium border-l border-stone-200 ${filterMarche === 'b2b' ? 'bg-sage-100 text-sage-darker' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
            title="Investissement (B2B)"
          >
            B2B
          </button>
          <button
            onClick={() => setFilterMarche('b2c')}
            className={`px-3 py-1.5 text-xs font-medium border-l border-stone-200 ${filterMarche === 'b2c' ? 'bg-amber-100 text-amber-800' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
            title="Habitation (B2C)"
          >
            B2C
          </button>
        </div>
        <select
          value={filterTypologie}
          onChange={e => setFilterTypologie(e.target.value)}
          className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-stone-900"
        >
          <option value="Tous">Typologie : Toutes</option>
          <optgroup label="Investissement (B2B)">
            {Object.entries(TYPOLOGIES_CLIENT_TREE).filter(([t]) => t !== 'Particuliers').map(([typo, sousTypos]) => (
              <Fragment key={typo}>
                <option value={typo}>{typo}</option>
                {(sousTypos || []).map(s => (
                  <option key={`${typo}-${s}`} value={s}>&nbsp;&nbsp;&middot; {s}</option>
                ))}
              </Fragment>
            ))}
          </optgroup>
          <optgroup label="Habitation (B2C)">
            <option value="Particuliers">Particuliers</option>
          </optgroup>
        </select>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl shadow-luxe border border-stone-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-stone-50 border-b border-cream-dark">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Nom</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Société</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Nature</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Postures</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Contact</th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide w-12">Owner</th>
            </tr>
          </thead>
          <tbody>
            {loadingContacts && (
              <tr><td colSpan="6" className="p-12 text-center text-sm text-stone-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Chargement…</td></tr>
            )}
            {!loadingContacts && filtered.map(c => (
              <tr key={c.id} className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer group" onClick={() => handleContactClick(c)}>
                <td className="px-3 py-3">
                  <div className="font-medium text-stone-900 text-sm">
                    {[c.prenom, c.nom].filter(Boolean).join(' ') || <span className="text-stone-400 italic">Sans nom</span>}
                  </div>
                </td>
                <td className="px-3 py-3 text-sm text-stone-700">{c.societe || '—'}</td>
                <td className="px-3 py-3"><NatureBadge categorie={c.categorie} /></td>
                <td className="px-3 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {(c.postures || []).length > 0
                      ? (c.postures || []).map(p => <PostureBadge key={p} posture={p} />)
                      : <span className="text-xs text-stone-400 italic">—</span>
                    }
                  </div>
                </td>
                <td className="px-3 py-3 text-sm text-stone-600">
                  <div className="truncate max-w-[220px]">{c.email || c.tel || '—'}</div>
                </td>
                <td className="px-3 py-3 text-center">
                  {(c.client_owners || []).length > 0 ? (
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-sage-100 text-sage-darker text-xs font-semibold border border-sage-light" title={'Owners: ' + (c.client_owners || []).join(', ')}>
                      {c.client_owners[0]}
                    </div>
                  ) : (
                    <span className="text-stone-400 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
            {!loadingContacts && filtered.length === 0 && (
              <tr><td colSpan="6" className="p-12 text-center text-sm text-stone-500">Aucun contact trouvé</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {(editingClient || showNew) && (
        <ClientForm
          client={editingClient}
          onSave={handleSave}
          onClose={() => { setEditingClient(null); setShowNew(false); }}
        />
      )}
      {showImport && (
        <ContactsImportModal onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); reload(); loadContacts(); }} />
      )}
    </div>
  );
}
