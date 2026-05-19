// ═══════════════════════════════════════════════════════════════════
// components/ReferenceForm.jsx
// Modal de création/édition d'une référence de vente
// ═══════════════════════════════════════════════════════════════════

'use client';
import React, { useState, useRef } from 'react';
import { X, Upload, Star, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { 
  TYPOLOGIES_REFERENCE, 
  TRANCHES_PRIX_REFERENCE, 
  TYPES_ACQUEREUR_SUGGESTIONS,
  getTrancheFromPrix 
} from '@/lib/references-constants';
import { Field } from '@/components/crm/SharedComponents';

export default function ReferenceForm({ reference, onSave, onClose }) {
  const [data, setData] = useState(reference || {
    nom: '', adresse: '', ville: '', arrondissement: '',
    typologies: [], surface: 0, nbLots: 0,
    prixVente: 0, tranchePrix: null,
    dateVente: null, dureeCommercialisationSemaines: 0,
    typeAcquereur: '', commentaireCommercial: '',
    medias: [],
    confidentiel: false,
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);

  const update = (k, v) => setData({ ...data, [k]: v });

  // Auto-calcul tranche si prix change
  const updatePrix = (v) => {
    const prix = parseFloat(v) || 0;
    const tranche = prix > 0 ? getTrancheFromPrix(prix) : null;
    setData({ ...data, prixVente: prix, tranchePrix: tranche });
  };

  const toggleTypologie = (val) => {
    const current = data.typologies || [];
    if (current.includes(val)) {
      update('typologies', current.filter(t => t !== val));
    } else {
      update('typologies', [...current, val]);
    }
  };

  async function compressImage(file) {
    if (!file.type.startsWith('image/')) return file;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_WIDTH = 1920;
          let { width, height } = img;
          if (width > MAX_WIDTH) { height = (MAX_WIDTH / width) * height; width = MAX_WIDTH; }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (!blob) { resolve(file); return; }
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.85);
        };
        img.onerror = () => resolve(file);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  }

  async function handlePhotoUpload(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setUploadingPhoto(true);
    try {
      const newMedias = [...(data.medias || [])];
      for (const file of files) {
        const compressed = await compressImage(file);
        const cleanName = (file.name || 'photo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `references/${Date.now()}_${Math.random().toString(36).slice(2,8)}_${cleanName}`;
        const { error: upErr } = await supabase.storage
          .from('mandat-docs') // on réutilise le bucket existant
          .upload(path, compressed, { 
            contentType: compressed.type || 'image/jpeg',
            upsert: false 
          });
        if (upErr) {
          alert(`Erreur upload "${file.name}" : ${upErr.message}`);
          continue;
        }
        const { data: { publicUrl } } = supabase.storage.from('mandat-docs').getPublicUrl(path);
        const isFirstPhoto = newMedias.filter(m => m.type === 'photo').length === 0;
        newMedias.push({
          type: 'photo',
          url: publicUrl,
          storage_path: path,
          isCover: isFirstPhoto, // première photo = cover par défaut
        });
      }
      update('medias', newMedias);
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
    setUploadingPhoto(false);
    if (photoInputRef.current) photoInputRef.current.value = '';
  }

  function setCover(index) {
    const newMedias = (data.medias || []).map((m, i) => ({
      ...m,
      isCover: i === index && m.type === 'photo',
    }));
    update('medias', newMedias);
  }

  function removeMedia(index) {
    const newMedias = (data.medias || []).filter((_, i) => i !== index);
    // Si on supprime la cover, on remet la première photo restante en cover
    const hasCover = newMedias.some(m => m.type === 'photo' && m.isCover);
    if (!hasCover) {
      const firstPhotoIdx = newMedias.findIndex(m => m.type === 'photo');
      if (firstPhotoIdx >= 0) newMedias[firstPhotoIdx].isCover = true;
    }
    update('medias', newMedias);
  }

  const fieldClass = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900";
  const sectionClass = "bg-cream-50/50 rounded-xl p-5 border border-cream-dark/50";
  const sectionTitle = "font-display text-base font-semibold text-stone-900 mb-4 flex items-center gap-2";

  const photos = (data.medias || []).filter(m => m.type === 'photo');

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-luxe-hover max-w-3xl w-full max-h-[92vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
        
        <div className="flex items-center justify-between p-6 border-b border-stone-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-display text-2xl font-semibold text-stone-900">
              {reference ? 'Modifier' : 'Nouvelle'} référence
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Ces données alimentent les slides "Nos dernières ventes" des avis de valeur
            </p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* SECTION 1 : Identité */}
          <div className={sectionClass}>
            <h3 className={sectionTitle}>🏠 Identité du bien</h3>
            <div className="space-y-3">
              <Field label="Nom de la référence">
                <input 
                  type="text" 
                  value={data.nom || ''} 
                  onChange={e => update('nom', e.target.value)} 
                  placeholder="ex: Immeuble mixte – Aubervilliers"
                  className={fieldClass} 
                />
              </Field>
              <Field label="Adresse">
                <input 
                  type="text" 
                  value={data.adresse || ''} 
                  onChange={e => update('adresse', e.target.value)} 
                  className={fieldClass} 
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ville">
                  <input 
                    type="text" 
                    value={data.ville || ''} 
                    onChange={e => update('ville', e.target.value)} 
                    className={fieldClass} 
                  />
                </Field>
                <Field label="Code postal / Arrdt">
                  <input 
                    type="text" 
                    value={data.arrondissement || ''} 
                    onChange={e => update('arrondissement', e.target.value)} 
                    placeholder="75010, 93300..."
                    className={fieldClass} 
                  />
                </Field>
              </div>
              <Field label="Typologies (plusieurs choix possibles)">
                <div className="flex flex-wrap gap-2">
                  {TYPOLOGIES_REFERENCE.map(t => {
                    const isActive = (data.typologies || []).includes(t.value);
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => toggleTypologie(t.value)}
                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                          isActive 
                            ? 'bg-sage-100 text-sage-darker border-sage-light font-medium' 
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        {t.icon} {t.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Surface (m²)">
                  <input 
                    type="number" 
                    value={data.surface || ''} 
                    onChange={e => update('surface', +e.target.value)} 
                    className={fieldClass} 
                  />
                </Field>
                <Field label="Nombre de lots">
                  <input 
                    type="number" 
                    value={data.nbLots || ''} 
                    onChange={e => update('nbLots', +e.target.value)} 
                    className={fieldClass} 
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* SECTION 2 : Données financières */}
          <div className={sectionClass}>
            <h3 className={sectionTitle}>💰 Vente</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prix de vente FAI (€)">
                  <input 
                    type="number" 
                    value={data.prixVente || ''} 
                    onChange={e => updatePrix(e.target.value)} 
                    className={fieldClass} 
                  />
                  {data.prixVente > 0 && data.surface > 0 && (
                    <span className="block text-[10px] text-stone-400 mt-1">
                      Soit {Math.round(data.prixVente / data.surface).toLocaleString('fr-FR')} €/m²
                    </span>
                  )}
                </Field>
                <Field label="Tranche de prix (auto)">
                  <select 
                    value={data.tranchePrix || ''} 
                    onChange={e => update('tranchePrix', e.target.value)} 
                    className={fieldClass}
                  >
                    <option value="">—</option>
                    {TRANCHES_PRIX_REFERENCE.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date de vente">
                  <input 
                    type="date" 
                    value={data.dateVente || ''} 
                    onChange={e => update('dateVente', e.target.value)} 
                    className={fieldClass} 
                  />
                </Field>
                <Field label="Durée commercialisation (semaines)">
                  <input 
                    type="number" 
                    value={data.dureeCommercialisationSemaines || ''} 
                    onChange={e => update('dureeCommercialisationSemaines', +e.target.value)} 
                    placeholder="ex: 6"
                    className={fieldClass} 
                  />
                </Field>
              </div>
              <Field label="Type d'acquéreur">
                <input 
                  type="text" 
                  value={data.typeAcquereur || ''} 
                  onChange={e => update('typeAcquereur', e.target.value)} 
                  placeholder="Family office, promoteur, investisseur privé…"
                  list="acquereur-suggestions"
                  className={fieldClass} 
                />
                <datalist id="acquereur-suggestions">
                  {TYPES_ACQUEREUR_SUGGESTIONS.map(s => <option key={s} value={s} />)}
                </datalist>
              </Field>
              <Field label="Commentaire commercial (argumentaire utilisé dans les avis de valeur)">
                <textarea 
                  value={data.commentaireCommercial || ''} 
                  onChange={e => update('commentaireCommercial', e.target.value)} 
                  rows={3} 
                  placeholder="ex: Vente en bloc à un family office en 6 semaines, prix au-dessus du marché."
                  className={fieldClass} 
                />
              </Field>
            </div>
          </div>

          {/* SECTION 3 : Photos */}
          <div className={sectionClass}>
            <h3 className={sectionTitle}>📸 Photos</h3>
            <input 
              ref={photoInputRef} 
              type="file" 
              accept="image/*" 
              multiple 
              onChange={handlePhotoUpload} 
              className="hidden" 
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-dashed border-sage-light text-sage-darker rounded-xl hover:bg-sage-50 disabled:opacity-50 mb-3"
            >
              {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span className="text-sm">{uploadingPhoto ? 'Upload en cours…' : 'Ajouter des photos'}</span>
            </button>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {(data.medias || []).map((m, idx) => {
                  if (m.type !== 'photo') return null;
                  return (
                    <div key={idx} className="relative aspect-[4/3] rounded-lg overflow-hidden bg-cream-100 group">
                      <img src={m.url} alt="" className="w-full h-full object-cover" />
                      {m.isCover && (
                        <div className="absolute top-1 left-1 bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-white" /> Principale
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                        {!m.isCover && (
                          <button 
                            type="button"
                            onClick={() => setCover(idx)}
                            className="p-1.5 bg-white rounded text-amber-600 hover:bg-amber-50" 
                            title="Définir comme principale"
                          >
                            <Star className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button 
                          type="button"
                          onClick={() => removeMedia(idx)}
                          className="p-1.5 bg-white rounded text-red-600 hover:bg-red-50" 
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 4 : Confidentialité */}
          <div className={sectionClass}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={!!data.confidentiel} 
                onChange={e => update('confidentiel', e.target.checked)} 
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium text-stone-900">Référence confidentielle</div>
                <div className="text-xs text-stone-500">N'apparaît jamais dans les avis de valeur générés (utile pour les ventes sensibles)</div>
              </div>
            </label>
          </div>
        </div>

        <div className="flex gap-2 justify-end p-6 border-t border-stone-200 bg-stone-50 sticky bottom-0">
          <button 
            onClick={onClose} 
            className="px-4 py-2 text-sm text-stone-700 hover:bg-cream-200 rounded-lg"
          >
            Annuler
          </button>
          <button 
            onClick={() => onSave(data)} 
            disabled={!data.nom?.trim() || !data.prixVente || (data.typologies || []).length === 0}
            className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
