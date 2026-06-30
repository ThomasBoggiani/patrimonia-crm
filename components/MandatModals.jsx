'use client';
import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Phone, Mail, MapPin, Key, User, Building2, Home, Star, GripVertical, Trash2, Eye, Camera, Upload, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import PhotoUploader from './PhotoUploader';

// ════════════════════════════════════════════════════════════════
// MODAL VISITE — codes, gardien, accès
// ════════════════════════════════════════════════════════════════
export function VisiteModal({ mandat, onClose, onUpdate }) {
  const [data, setData] = useState({
    digicode: '',
    codePorte: '',
    etage: '',
    numeroPorte: '',
    gardien: false,
    nomGardien: '',
    horairesGardien: '',
    instructions: '',
    notes: '',
    ...(mandat.visiteInfo || mandat.visite_info || {})
  });
  const [saving, setSaving] = useState(false);

  const update = (k, v) => setData({ ...data, [k]: v });

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from('mandats').update({ visite_info: data }).eq('id', mandat.id);
      if (onUpdate) onUpdate();
      onClose();
    } catch (e) {
      console.error('Erreur sauvegarde visite:', e);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-luxe-hover max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-cream-dark sticky top-0 bg-white z-10">
          <h2 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
            <Key className="w-5 h-5 text-sage-dark" />Modalités de visite
          </h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-5">
          {/* Bloc accès immeuble */}
          <div>
            <h3 className="text-xs font-semibold text-stone-700 uppercase tracking-wide mb-3">Accès à l'immeuble</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-stone-600 mb-1">Digicode entrée</label>
                <input type="text" value={data.digicode} onChange={e => update('digicode', e.target.value)} placeholder="Ex: 1234A"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono focus:outline-none focus:border-stone-900" />
              </div>
              <div>
                <label className="block text-xs text-stone-600 mb-1">Code porte / appartement</label>
                <input type="text" value={data.codePorte} onChange={e => update('codePorte', e.target.value)} placeholder="Ex: 5678B"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono focus:outline-none focus:border-stone-900" />
              </div>
              <div>
                <label className="block text-xs text-stone-600 mb-1">Étage</label>
                <input type="text" value={data.etage} onChange={e => update('etage', e.target.value)} placeholder="Ex: 3e, RDC, R+2"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
              </div>
              <div>
                <label className="block text-xs text-stone-600 mb-1">Numéro / position porte</label>
                <input type="text" value={data.numeroPorte} onChange={e => update('numeroPorte', e.target.value)} placeholder="Ex: Porte 12, à droite"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
              </div>
            </div>
          </div>

          {/* Bloc gardien */}
          <div>
            <h3 className="text-xs font-semibold text-stone-700 uppercase tracking-wide mb-3">Gardien / concierge</h3>
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input type="checkbox" checked={data.gardien} onChange={e => update('gardien', e.target.checked)}
                className="rounded accent-[#6B7F5A]" />
              <span className="text-sm text-stone-700">Présence d'un gardien dans l'immeuble</span>
            </label>
            {data.gardien && (
              <div className="grid grid-cols-2 gap-3 pl-6">
                <div>
                  <label className="block text-xs text-stone-600 mb-1">Nom du gardien</label>
                  <input type="text" value={data.nomGardien} onChange={e => update('nomGardien', e.target.value)} placeholder="Ex: M. Martin"
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
                </div>
                <div>
                  <label className="block text-xs text-stone-600 mb-1">Horaires</label>
                  <input type="text" value={data.horairesGardien} onChange={e => update('horairesGardien', e.target.value)} placeholder="Ex: 8h-12h / 14h-18h"
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wide mb-2">Instructions particulières</label>
            <textarea value={data.instructions} onChange={e => update('instructions', e.target.value)} rows={3}
              placeholder="Ex: Récupérer clés à l'agence avant 17h, prévenir locataire 24h en avance, ..."
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wide mb-2">Notes internes</label>
            <textarea value={data.notes} onChange={e => update('notes', e.target.value)} rows={2}
              placeholder="Notes pour l'équipe..."
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
          </div>
        </div>
        <div className="flex gap-2 justify-end p-5 border-t border-stone-200 bg-cream-50 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-cream-200 rounded-lg">Annuler</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MODAL MANDANT — coordonnées détaillées
// ════════════════════════════════════════════════════════════════
export function MandantModal({ mandat, onClose, onUpdate }) {
  const [data, setData] = useState({
    civilite: 'M.',
    typeMandant: 'Propriétaire',
    nom: '',
    prenom: '',
    raisonSociale: '',
    telephones: [],
    email: '',
    adresse: '',
    notes: '',
    ...(mandat.mandantInfo || mandat.mandant_info || {})
  });
  const [saving, setSaving] = useState(false);

  // Sprint 3 — Chantier 3 : source unique = contacts via le pivot mandat_contacts.
  // Si aucun mandant_info JSON n'a encore été saisi mais qu'un contact mandant
  // est déjà relié (pivot), on préremplit le formulaire depuis ce contact — ça
  // évite qu'un enregistrement « formulaire vide » écrase un bon contact.
  useEffect(() => {
    const dejaJson = mandat.mandantInfo || mandat.mandant_info;
    if (dejaJson || !mandat?.id) return;
    (async () => {
      const { data: links } = await supabase
        .from('mandat_contacts')
        .select('contact:contacts(prenom, nom, societe, email, tel, type_contact)')
        .eq('mandat_id', mandat.id)
        .eq('role', 'mandant')
        .limit(1);
      const c = links?.[0]?.contact;
      if (!c) return;
      const isSociete = c.type_contact === 'personne_morale';
      setData(prev => ({
        ...prev,
        civilite: isSociete ? 'Société' : prev.civilite,
        nom: c.nom || prev.nom,
        prenom: isSociete ? prev.prenom : (c.prenom || prev.prenom),
        raisonSociale: isSociete ? (c.societe || c.nom || prev.raisonSociale) : prev.raisonSociale,
        email: c.email || prev.email,
        telephones: c.tel ? [{ label: 'Mobile', numero: c.tel }] : prev.telephones,
      }));
    })();
  }, [mandat?.id]);

  const update = (k, v) => setData({ ...data, [k]: v });

  const addPhone = () => update('telephones', [...(data.telephones || []), { label: 'Mobile', numero: '' }]);
  const updatePhone = (i, key, value) => {
    const tels = [...(data.telephones || [])];
    tels[i] = { ...tels[i], [key]: value };
    update('telephones', tels);
  };
  const removePhone = (i) => update('telephones', (data.telephones || []).filter((_, idx) => idx !== i));

  // Sprint 3 — Chantier 3 : à l'enregistrement, on range le mandant comme une
  // PERSONNE dans `contacts` (source unique) et on garantit le lien dans le pivot
  // `mandat_contacts` (rôle « mandant »). On continue d'écrire le JSON
  // `mandant_info` pendant la transition (rien n'est retiré).
  async function syncMandantContact() {
    const isSociete = data.civilite === 'Société' || data.civilite === 'SCI';
    const nom = (isSociete ? data.raisonSociale : data.nom) || '';
    const prenom = isSociete ? '' : (data.prenom || '');
    const societe = isSociete ? (data.raisonSociale || null) : null;
    const email = (data.email || '').toLowerCase().trim() || null;
    const tel = (data.telephones || []).map(t => t?.numero).find(n => n && n.trim()) || null;

    // Rien d'exploitable → on ne crée pas un contact vide.
    if (!nom && !prenom && !societe && !email && !tel) return;

    const identity = { prenom: prenom || null, nom: nom || 'Sans nom', societe, email, tel };

    // a) Un lien mandant existe déjà sur ce mandat ? → on met à jour CE contact.
    const { data: links } = await supabase
      .from('mandat_contacts')
      .select('id, contact_id')
      .eq('mandat_id', mandat.id)
      .eq('role', 'mandant');
    const existingLink = links?.[0] || null;
    let contactId = existingLink?.contact_id || null;

    // b) Sinon, on cherche un contact existant par email.
    if (!contactId && email) {
      const { data: byEmail } = await supabase
        .from('contacts').select('id').eq('email', email).maybeSingle();
      if (byEmail?.id) contactId = byEmail.id;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!contactId) {
      // c) Toujours rien → on crée le contact.
      const { data: created, error } = await supabase
        .from('contacts')
        .insert({
          ...identity,
          type_contact: isSociete ? 'personne_morale' : 'personne_physique',
          postures: ['vendeur'],
          qualite: 'neutre',
          created_by: user?.id || null,
        })
        .select('id').single();
      if (error) { console.error('[MandantModal] création contact:', error); return; }
      contactId = created.id;
    } else {
      // Contact déjà connu → on y synchronise l'identité (source de vérité).
      const { error: syncErr } = await supabase
        .from('contacts')
        .update({ ...identity, updated_at: new Date().toISOString() })
        .eq('id', contactId);
      if (syncErr) console.warn('[MandantModal] sync identité contact:', syncErr);
    }

    // d) On garantit le lien pivot (rôle mandant) s'il n'existe pas encore.
    if (!existingLink && contactId) {
      const { error: linkErr } = await supabase.from('mandat_contacts').insert({
        mandat_id: mandat.id, contact_id: contactId, role: 'mandant', est_principal: true,
      });
      if (linkErr) console.warn('[MandantModal] lien mandat_contacts:', linkErr);
    }
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from('mandats').update({ mandant_info: data }).eq('id', mandat.id);
      await syncMandantContact();
      if (onUpdate) onUpdate();
      onClose();
    } catch (e) {
      console.error('Erreur sauvegarde mandant:', e);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-luxe-hover max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-cream-dark sticky top-0 bg-white z-10">
          <h2 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
            <User className="w-5 h-5 text-sage-dark" />Mandant / Vendeur
          </h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900"><X className="w-5 h-5" /></button>
        </div>

        {/* Aperçu legacy si existant */}
        {(mandat.contact || mandat.tel) && (
          <div className="m-5 mb-0 p-3 bg-cream-50 border border-cream-dark rounded-lg text-xs">
            <div className="text-stone-500 uppercase tracking-wide font-medium mb-1">Données existantes (à reporter ci-dessous si pertinent)</div>
            <div className="text-stone-700">
              {mandat.contact && <span>Contact : <strong>{mandat.contact}</strong></span>}
              {mandat.contact && mandat.tel && <span> · </span>}
              {mandat.tel && <span>Tél : <strong>{mandat.tel}</strong></span>}
            </div>
          </div>
        )}

        <div className="p-5 space-y-5">
          {/* Identité */}
          <div>
            <h3 className="text-xs font-semibold text-stone-700 uppercase tracking-wide mb-3">Identité</h3>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs text-stone-600 mb-1">Civilité</label>
                <select value={data.civilite} onChange={e => update('civilite', e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
                  <option>M.</option><option>Mme</option><option>Société</option><option>SCI</option><option>Autre</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-stone-600 mb-1">Type de mandant</label>
                <select value={data.typeMandant} onChange={e => update('typeMandant', e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
                  <option>Propriétaire</option>
                  <option>Indivisaire</option>
                  <option>Mandataire</option>
                  <option>Notaire</option>
                  <option>Apporteur</option>
                  <option>Autre</option>
                </select>
              </div>
            </div>
            {data.civilite === 'Société' || data.civilite === 'SCI' ? (
              <div>
                <label className="block text-xs text-stone-600 mb-1">Raison sociale</label>
                <input type="text" value={data.raisonSociale} onChange={e => update('raisonSociale', e.target.value)} placeholder="Ex: SCI Patrimoine"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-stone-600 mb-1">Prénom</label>
                  <input type="text" value={data.prenom} onChange={e => update('prenom', e.target.value)}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
                </div>
                <div>
                  <label className="block text-xs text-stone-600 mb-1">Nom</label>
                  <input type="text" value={data.nom} onChange={e => update('nom', e.target.value)}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
                </div>
              </div>
            )}
          </div>

          {/* Téléphones */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Téléphones</h3>
              <button onClick={addPhone} className="text-xs text-sage-dark hover:underline">+ Ajouter</button>
            </div>
            {(data.telephones || []).length === 0 ? (
              <p className="text-xs text-stone-500 italic">Aucun téléphone enregistré</p>
            ) : (
              <div className="space-y-2">
                {(data.telephones || []).map((t, i) => (
                  <div key={i} className="flex gap-2">
                    <select value={t.label} onChange={e => updatePhone(i, 'label', e.target.value)}
                      className="px-2 py-2 border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-stone-900 w-24">
                      <option>Mobile</option><option>Fixe</option><option>Bureau</option><option>Autre</option>
                    </select>
                    <input type="tel" value={t.numero} onChange={e => updatePhone(i, 'numero', e.target.value)} placeholder="06 12 34 56 78"
                      className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
                    <button onClick={() => removePhone(i)} className="px-2 text-stone-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Email + adresse */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs text-stone-600 mb-1">Email</label>
              <input type="email" value={data.email} onChange={e => update('email', e.target.value)} placeholder="contact@exemple.fr"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
            </div>
            <div>
              <label className="block text-xs text-stone-600 mb-1">Adresse postale</label>
              <textarea value={data.adresse} onChange={e => update('adresse', e.target.value)} rows={2}
                placeholder="Adresse de correspondance si différente du bien"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wide mb-2">Notes</label>
            <textarea value={data.notes} onChange={e => update('notes', e.target.value)} rows={3}
              placeholder="Préférences, contraintes, infos importantes..."
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
          </div>
        </div>
        <div className="flex gap-2 justify-end p-5 border-t border-stone-200 bg-cream-50 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-cream-200 rounded-lg">Annuler</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
