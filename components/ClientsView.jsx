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
                    <div className="text-sm font-med
