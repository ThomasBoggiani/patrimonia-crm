'use client';

// components/ClientsView.jsx
// Extrait depuis CRM.jsx — Commit 1 (extraction sans changement de comportement)
// Contient : ClientsTab, ClientDetail, ClientForm, OwnerSelector

import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2, Users, Handshake, MapPin, Trash2, Edit2, X, Check, Loader2,
  Search, Plus, Upload, ChevronRight, User as UserIcon, ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, getCurrentUserInitials } from '@/lib/auth';
import { matchMandatsForClient } from '@/lib/matching';
import {
  formatPrixCompact,
  toSnake,
  TYPES_ACTIF_B2B_TREE,
  TYPES_HABITATION_B2C,
  TYPOLOGIES_CLIENT,
  getMarcheFromTypologieClient,
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

// Helper utilisé pour notifier le matching (fire-and-forget)
async function triggerMatchingBatch({ mandatId, clientId }) {
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
    if (newInitials === target?.owner) {
      setOpen(false);
      return;
    }
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
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-stone-500 border-b border-cream-dark">
            Réassigner à
          </div>
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
// ClientDetail — fiche détail d'un client
// ─────────────────────────────────────────────────────────────────

export function ClientDetail({ client, onBack, onEdit, mandats, deals, interactions, reload, onOpenMandat }) {
  const clientDeals = deals.filter(d => d.clientId === client.id);
  const clientInteractions = (interactions || []).filter(i => i.clientId === client.id);

  const matches = useMemo(() => {
    if (!client) return [];
    return matchMandatsForClient(client, mandats || []);
  }, [client, mandats]);

  return (
    <div className="p-8 max-w-6xl">
      <button onClick={onBack} className="text-sm text-stone-500 hover:text-stone-900 mb-4 flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Retour à la liste
      </button>

      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="font-display text-3xl font-semibold text-stone-900">
              {client.prenom} {client.nom}
            </h1>
            {client.societe && (
              <span className="text-stone-500 text-lg">· {client.societe}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-stone-500 flex-wrap">
            {client.typologie && <span className="px-2 py-0.5 bg-sage-50 text-sage-darker rounded-full text-xs border border-sage-light">{client.typologie}</span>}
            {client.maturite && <MaturiteBadge maturite={client.maturite} />}
            {client.statut && <span className="text-xs">{client.statut}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <OwnerSelector client={client} entity="client" reload={reload} />
          <button onClick={onEdit} className="flex items-center gap-2 px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink">
            <Edit2 className="w-4 h-4" /> Modifier
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark mb-4">
        <h2 className="font-display text-xl font-semibold text-stone-900 mb-4">Coordonnées</h2>
        <div className="grid grid-cols-2 gap-4">
          <DetailItem label="Email" value={client.email || '—'} />
          <DetailItem label="Téléphone" value={client.tel || '—'} />
          {client.adresse && <DetailItem label="Adresse" value={client.adresse} />}
          {client.ville && <DetailItem label="Ville" value={client.ville} />}
        </div>
      </div>

      {(client.budgetMin || client.budgetMax || (client.zones || []).length > 0 || (client.typologiesRecherchees || []).length > 0) && (
        <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark mb-4">
          <h2 className="font-display text-xl font-semibold text-stone-900 mb-4">Critères de recherche</h2>
          <div className="grid grid-cols-2 gap-4">
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
                <div className="text-xs uppercase tracking-wide text-stone-500 mb-2">Typologies recherchées</div>
                <div className="flex flex-wrap gap-1.5">
                  {(client.typologiesRecherchees || []).map((t, i) => (
                    <span key={i} className="text-xs px-2 py-1 bg-sage-50 text-sage-darker rounded-full border border-sage-light">{t}</span>
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

      <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark mb-4">
        <ClientMatches client={client} mandats={mandats} interactions={interactions} onOpenMandat={onOpenMandat} reload={reload} />
      </div>

      {clientDeals.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark mb-4">
          <h2 className="font-display text-xl font-semibold text-stone-900 mb-4">Deals ({clientDeals.length})</h2>
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

      {clientInteractions.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark mb-4">
          <h2 className="font-display text-xl font-semibold text-stone-900 mb-4">Historique des échanges ({clientInteractions.length})</h2>
          <div className="space-y-3">
            {clientInteractions.slice(0, 10).map(int => (
              <div key={int.id} className="flex items-start gap-3 pb-3 border-b border-cream-dark last:border-0">
                <TypeInteractionBadge type={int.type} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-stone-900">{int.objet || int.notes || '—'}</div>
                  <div className="text-xs text-stone-500 mt-0.5">
                    {int.date && new Date(int.date).toLocaleDateString('fr-FR')} · {int.par || '—'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AIAssistantChat floating context={{ type: 'client', data: client }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ClientForm — formulaire d'édition
// ─────────────────────────────────────────────────────────────────

export function ClientForm({ client, onSave, onClose }) {
  const { profile } = useAuth();
  const userInitials = getCurrentUserInitials(profile);
  const [data, setData] = useState(client || {
    prenom: '', nom: '', societe: '', email: '', tel: '',
    adresse: '', ville: '', typologie: '',
    budgetMin: 0, budgetMax: 0, surfaceMin: 0, surfaceMax: 0,
    typologiesRecherchees: [], zones: [],
    rendementMin: 0, statut: 'Actif', maturite: 'Tiède',
    owner: userInitials, notes: '',
  });
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
                tree={{ 'Habitation': TYPES_HABITATION_B2C }}
                values={data.typologiesRecherchees || []}
                onChange={(vals) => update('typologiesRecherchees', vals)}
              />
            ) : (
              <CascadeSelectMulti
                tree={TYPES_ACTIF_B2B_TREE}
                values={data.typologiesRecherchees || []}
                onChange={(vals) => update('typologiesRecherchees', vals)}
              />
            )}
          </Field>
          <Field label="Zones recherchées">
            <input
              type="text"
              value={(data.zones || []).join(', ')}
              onChange={e => update('zones', e.target.value.split(',').map(z => z.trim()).filter(Boolean))}
              placeholder="Paris 1er, Paris 7e, Neuilly..."
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900"
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
// ClientsTab — onglet principal "Clients"
// ─────────────────────────────────────────────────────────────────

export default function ClientsTab({ clients, reload, mandats, deals, interactions, pendingClientId, onPendingClientConsumed, onOpenMandat }) {
  const { user, profile } = useAuth();
  const [search, setSearch] = useState('');
  const [filterTypo, setFilterTypo] = useState('Tous');
  const [filterMarche, setFilterMarche] = useState('Tous');
  const [filterMine, setFilterMine] = useState(false);
  const myInitials = getCurrentUserInitials(profile);
  const [editingClient, setEditingClient] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  useEffect(() => {
    if (pendingClientId && Array.isArray(clients) && clients.length > 0) {
      const c = clients.find(x => x.id === pendingClientId);
      if (c) { setSelectedClient(c); onPendingClientConsumed?.(); }
    }
  }, [pendingClientId, clients]);

  const filtered = clients.filter(c => {
    if (filterMine && c.owner !== myInitials) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${c.prenom || ''} ${c.nom || ''} ${c.societe || ''} ${c.email || ''} ${c.tel || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filterTypo !== 'Tous' && c.typologie !== filterTypo) return false;
    if (filterMarche !== 'Tous') {
      const m = getMarcheFromTypologieClient(c.typologie);
      if (m !== filterMarche) return false;
    }
    return true;
  });

  const handleSave = async (clientData) => {
    const snakeData = toSnake(clientData);
    delete snakeData.created_at;
    delete snakeData.updated_at;
    let clientId = clientData.id;
    if (clientData.id) {
      snakeData.updated_by = user?.id;
      await supabase.from('clients').update(snakeData).eq('id', clientData.id);
    } else {
      delete snakeData.id;
      snakeData.created_by = user?.id;
      const { data: created } = await supabase.from('clients').insert(snakeData).select().single();
      if (created) clientId = created.id;
    }
    setEditingClient(null);
    setShowNew(false);
    reload();
    if (clientId) triggerMatchingBatch({ clientId });
  };

  const handleDelete = async (id) => {
    if (confirm('Supprimer ce client ?')) {
      await supabase.from('clients').delete().eq('id', id);
      reload();
    }
  };

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
          <h1 className="font-display text-2xl font-semibold text-stone-900">Clients</h1>
          <span className="text-stone-500 text-sm">{filtered.length} client{filtered.length > 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-cream-50 text-sm">
            <Upload className="w-4 h-4" /> Importer
          </button>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-3 py-2 bg-ink-deep text-white rounded-lg hover:bg-stone-800 text-sm font-medium">
            <Plus className="w-4 h-4" /> Nouveau client
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex-1 relative min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher (nom, société, email…)"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
        </div>
        <div className="flex bg-white border border-stone-200 rounded-lg overflow-hidden">
          <button onClick={() => setFilterMarche('Tous')} className={`px-3 py-2.5 text-xs font-medium ${filterMarche === 'Tous' ? 'bg-ink-deep text-white' : 'text-stone-600 hover:bg-stone-50'}`}>Tous</button>
          <button onClick={() => setFilterMarche('b2b')} className={`px-3 py-2.5 text-xs font-medium border-l border-stone-200 ${filterMarche === 'b2b' ? 'bg-sage-100 text-sage-darker' : 'text-stone-600 hover:bg-stone-50'}`}>B2B</button>
          <button onClick={() => setFilterMarche('b2c')} className={`px-3 py-2.5 text-xs font-medium border-l border-stone-200 ${filterMarche === 'b2c' ? 'bg-blue-100 text-blue-900' : 'text-stone-600 hover:bg-stone-50'}`}>B2C</button>
        </div>
        <select value={filterTypo} onChange={e => setFilterTypo(e.target.value)} className="px-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
          <option>Tous</option>
          {TYPOLOGIES_CLIENT.map(t => <option key={t}>{t}</option>)}
        </select>
        <label className="flex items-center gap-2 px-3 py-2.5 bg-white border border-stone-200 rounded-lg text-sm cursor-pointer">
          <input type="checkbox" checked={filterMine} onChange={e => setFilterMine(e.target.checked)} />
          <span>Mes clients</span>
        </label>
      </div>

      <div className="bg-white rounded-xl shadow-luxe border border-stone-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-stone-50 border-b border-cream-dark">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Nom</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Société</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Typologie</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Budget</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Contact</th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide w-12">Owner</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer group" onClick={() => setSelectedClient(c)}>
                <td className="px-3 py-3">
                  <div className="font-medium text-stone-900 text-sm">{c.prenom} {c.nom}</div>
                </td>
                <td className="px-3 py-3 text-sm text-stone-700">{c.societe || '—'}</td>
                <td className="px-3 py-3 text-sm">
                  {c.typologie ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-sage-50 text-sage-darker border border-sage-light">{c.typologie}</span>
                  ) : <span className="text-stone-400">—</span>}
                </td>
                <td className="px-3 py-3 text-sm text-stone-700">
                  {c.budgetMin || c.budgetMax ? `${formatPrixCompact(c.budgetMin || 0)} → ${formatPrixCompact(c.budgetMax || 0)}` : '—'}
                </td>
                <td className="px-3 py-3 text-sm text-stone-600">
                  <div className="truncate max-w-[200px]">{c.email || c.tel || '—'}</div>
                </td>
                <td className="px-3 py-3 text-center">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-sage-100 text-sage-darker text-xs font-semibold border border-sage-light" title={'Owner: ' + (c.owner || '—')}>
                    {c.owner || '?'}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setEditingClient(c)} className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(c.id)} className="p-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-12 text-center text-stone-500 text-sm">Aucun client trouvé</div>}
      </div>

      {(editingClient || showNew) && (
        <ClientForm
          client={editingClient}
          onSave={handleSave}
          onClose={() => { setEditingClient(null); setShowNew(false); }}
        />
      )}
      {showImport && (
        <ContactsImportModal onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); reload(); }} />
      )}
    </div>
  );
}
