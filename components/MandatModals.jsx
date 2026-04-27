'use client';
import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Phone, Mail, MapPin, Key, User, Building2, Home, Star, GripVertical, Trash2, Eye, Camera, Upload, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import PhotoUploader from './PhotoUploader';

// ════════════════════════════════════════════════════════════════
// MODAL PHOTOS — réutilise PhotoUploader dans une modal
// ════════════════════════════════════════════════════════════════
export function PhotosModal({ mandat, onClose, onUpdate }) {
  const [photos, setPhotos] = useState(mandat.photos || []);
  const [saving, setSaving] = useState(false);

  const handleChange = async (newPhotos) => {
    setPhotos(newPhotos);
    setSaving(true);
    try {
      await supabase.from('mandats').update({ photos: newPhotos }).eq('id', mandat.id);
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error('Erreur sauvegarde photos:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-luxe-hover max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-cream-dark">
          <div>
            <h2 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-sage-dark" />Photos du bien
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">{photos.length} photo{photos.length > 1 ? 's' : ''} · La 1re est utilisée comme couverture</p>
          </div>
          <div className="flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin text-sage-dark" />}
            <button onClick={onClose} className="text-stone-500 hover:text-stone-900"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <PhotoUploader 
            mandatId={mandat.id}
            photos={photos}
            onChange={handleChange}
            storage="supabase"
          />
        </div>
      </div>
    </div>
  );
}

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

  const update = (k, v) => setData({ ...data, [k]: v });

  const addPhone = () => update('telephones', [...(data.telephones || []), { label: 'Mobile', numero: '' }]);
  const updatePhone = (i, key, value) => {
    const tels = [...(data.telephones || [])];
    tels[i] = { ...tels[i], [key]: value };
    update('telephones', tels);
  };
  const removePhone = (i) => update('telephones', (data.telephones || []).filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from('mandats').update({ mandant_info: data }).eq('id', mandat.id);
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
