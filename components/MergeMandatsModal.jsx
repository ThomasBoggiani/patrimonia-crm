'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Check, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * Modal de fusion d'un mandat existant avec les nouvelles données extraites par l'IA.
 *
 * Props :
 *  - existingMandatId : UUID du mandat existant à mettre à jour
 *  - newData          : objet avec les champs proposés par l'IA (result.mandat)
 *  - onClose          : fermer la modale
 *  - onMerged         : callback après fusion réussie (mandatId mis à jour)
 *
 * Comportement :
 *  - Charge la fiche existante depuis la BDD
 *  - Pour chaque champ qui DIFFÈRE entre existant et nouveau, affiche les 2 valeurs côte à côte
 *  - Par défaut : pour les champs vides côté existant, le nouveau est sélectionné
 *  - Pour les champs déjà remplis : l'existant reste sélectionné (sécurité)
 *  - Bouton "Fusionner" → UPDATE le mandat existant avec les valeurs choisies
 */

const FIELD_LABELS = {
  nom: 'Nom du bien', adresse: 'Adresse', ville: 'Ville', type: 'Type', sous_type: 'Sous-type',
  surface: 'Surface (m²)', nb_pieces: 'Pièces', nb_chambres: 'Chambres', etage: 'Étage',
  annee_construction: 'Année construction', prix: 'Prix', prix_net_vendeur: 'Prix net vendeur',
  prix_m2: 'Prix au m²', honoraires_charge: 'Honoraires à charge', honoraires_taux: 'Honoraires (%)',
  honoraires_montant: 'Honoraires (€)', loyers_annuels: 'Loyers annuels', rendement: 'Rendement (%)',
  charges_annuelles: 'Charges annuelles', taxe_fonciere: 'Taxe foncière',
  dpe_consommation: 'DPE conso', dpe_emissions: 'DPE émissions', dpe_date: 'DPE (date)',
  mandat_numero: 'N° mandat', mandat_type: 'Type mandat', mandat_date_echeance: 'Échéance mandat',
  nb_lots: 'Nb lots', description: 'Description', commercialisation: 'Commercialisation',
};

const MERGEABLE_FIELDS = Object.keys(FIELD_LABELS);

function isEmpty(v) {
  return v === null || v === undefined || v === '' || (typeof v === 'number' && v === 0);
}

function valuesEqual(a, b) {
  if (a === b) return true;
  if (isEmpty(a) && isEmpty(b)) return true;
  // Comparaison numérique tolérante
  const na = parseFloat(a);
  const nb = parseFloat(b);
  if (!isNaN(na) && !isNaN(nb)) return Math.abs(na - nb) < 0.001;
  return String(a).trim() === String(b).trim();
}

function formatValue(v) {
  if (isEmpty(v)) return <span className="text-stone-400 italic">vide</span>;
  if (typeof v === 'number') return v.toLocaleString('fr-FR');
  if (typeof v === 'string' && v.length > 80) return v.slice(0, 80) + '…';
  return String(v);
}

export default function MergeMandatsModal({ existingMandatId, newData, onClose, onMerged }) {
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState(null);
  // selections : { fieldKey: 'existing' | 'new' }
  const [selections, setSelections] = useState({});

  // Charger la fiche existante
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('mandats')
        .select('*')
        .eq('id', existingMandatId)
        .single();
      if (cancel) return;
      if (error) {
        setError('Impossible de charger le mandat existant : ' + error.message);
        setLoading(false);
        return;
      }
      setExisting(data);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [existingMandatId]);

  // Calcul des champs qui diffèrent + sélection par défaut
  const diffs = useMemo(() => {
    if (!existing || !newData) return [];
    const list = [];
    for (const key of MERGEABLE_FIELDS) {
      const exVal = existing[key];
      const newVal = newData[key];
      // On affiche le champ uniquement si le nouveau apporte qqchose ET diffère de l'existant
      if (isEmpty(newVal)) continue;
      if (valuesEqual(exVal, newVal)) continue;
      list.push({ key, exVal, newVal });
    }
    return list;
  }, [existing, newData]);

  // Initialiser les sélections par défaut
  useEffect(() => {
    if (diffs.length === 0) return;
    setSelections(prev => {
      // Ne pas écraser si déjà rempli (ex: l'utilisateur a déjà cliqué)
      if (Object.keys(prev).length > 0) return prev;
      const init = {};
      for (const d of diffs) {
        // Si l'existant est vide → on choisit le nouveau par défaut
        // Sinon → on garde l'existant (sécurité)
        init[d.key] = isEmpty(d.exVal) ? 'new' : 'existing';
      }
      return init;
    });
  }, [diffs]);

  const selectAll = (which) => {
    const next = {};
    for (const d of diffs) next[d.key] = which;
    setSelections(next);
  };

  const handleMerge = async () => {
    setMerging(true);
    setError(null);
    try {
      // Construire l'objet d'update : uniquement les champs où on a choisi 'new'
      const updates = {};
      for (const d of diffs) {
        if (selections[d.key] === 'new') {
          updates[d.key] = d.newVal;
        }
      }

      if (Object.keys(updates).length === 0) {
        setError('Aucune modification sélectionnée. Coche au moins un champ.');
        setMerging(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('mandats')
        .update(updates)
        .eq('id', existingMandatId);

      if (updateError) throw updateError;

      onMerged?.(existingMandatId, updates);
    } catch (err) {
      setError(err.message || 'Erreur lors de la fusion');
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-luxe-hover max-w-4xl w-full max-h-[92vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-stone-900">Fusionner avec un mandat existant</h2>
              <p className="text-xs text-stone-500">Choisis pour chaque champ la valeur à conserver</p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900"><X className="w-5 h-5" /></button>
        </div>

        {loading && (
          <div className="p-12 flex flex-col items-center text-stone-500">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <div className="text-sm">Chargement du mandat existant…</div>
          </div>
        )}

        {!loading && error && !existing && (
          <div className="p-8">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          </div>
        )}

        {!loading && existing && (
          <div className="p-5">
            {/* Bandeau info mandat existant */}
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <div className="font-medium text-amber-900">Mandat existant : {existing.nom || existing.adresse || 'Sans nom'}</div>
              <div className="text-xs text-amber-700 mt-0.5">
                {existing.adresse}{existing.ville ? ` · ${existing.ville}` : ''}
                {existing.prix ? ` · ${existing.prix.toLocaleString('fr-FR')} €` : ''}
              </div>
            </div>

            {/* Cas : aucune différence */}
            {diffs.length === 0 && (
              <div className="text-center py-8">
                <Check className="w-10 h-10 text-sage-dark mx-auto mb-3" />
                <h3 className="font-display text-lg font-semibold text-stone-900 mb-1">Aucune différence détectée</h3>
                <p className="text-sm text-stone-600 mb-4">Le mandat existant contient déjà toutes les informations apportées par l'IA.</p>
                <button onClick={onClose} className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm">Fermer</button>
              </div>
            )}

            {/* Tableau de fusion */}
            {diffs.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-stone-700">
                    <span className="font-medium">{diffs.length}</span> champ(s) diffèrent
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => selectAll('existing')}
                      className="text-xs px-2.5 py-1 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-700">
                      Tout garder (existant)
                    </button>
                    <button onClick={() => selectAll('new')}
                      className="text-xs px-2.5 py-1 bg-sage-50 hover:bg-sage-100 rounded-lg text-sage-darker font-medium">
                      Tout remplacer (nouveau)
                    </button>
                  </div>
                </div>

                <div className="border border-stone-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-[140px_1fr_1fr] bg-stone-50 border-b border-stone-200 text-xs font-semibold uppercase tracking-wide text-stone-700">
                    <div className="px-3 py-2">Champ</div>
                    <div className="px-3 py-2 border-l border-stone-200">Existant</div>
                    <div className="px-3 py-2 border-l border-stone-200 bg-sage-50/50">Nouveau (IA)</div>
                  </div>

                  {diffs.map((d, i) => {
                    const selected = selections[d.key];
                    return (
                      <div key={d.key} className={`grid grid-cols-[140px_1fr_1fr] text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'} border-b border-stone-100 last:border-b-0`}>
                        <div className="px-3 py-2.5 font-medium text-stone-700 text-xs flex items-center">
                          {FIELD_LABELS[d.key] || d.key}
                        </div>
                        <button
                          onClick={() => setSelections(prev => ({ ...prev, [d.key]: 'existing' }))}
                          className={`px-3 py-2.5 border-l text-left text-xs transition-colors ${
                            selected === 'existing'
                              ? 'border-stone-300 bg-stone-100 ring-1 ring-stone-400 ring-inset'
                              : 'border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          <div className="flex items-start gap-1.5">
                            {selected === 'existing' && <Check className="w-3 h-3 text-stone-700 flex-shrink-0 mt-0.5" />}
                            <span className="break-words">{formatValue(d.exVal)}</span>
                          </div>
                        </button>
                        <button
                          onClick={() => setSelections(prev => ({ ...prev, [d.key]: 'new' }))}
                          className={`px-3 py-2.5 border-l text-left text-xs transition-colors ${
                            selected === 'new'
                              ? 'border-sage-light bg-sage-50 ring-1 ring-sage-dark ring-inset'
                              : 'border-stone-200 hover:bg-sage-50/40'
                          }`}
                        >
                          <div className="flex items-start gap-1.5">
                            {selected === 'new' && <Check className="w-3 h-3 text-sage-darker flex-shrink-0 mt-0.5" />}
                            <span className="break-words">{formatValue(d.newVal)}</span>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {error && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>{error}</div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-stone-200 flex items-center justify-between gap-3">
                  <div className="text-xs text-stone-500">
                    {Object.values(selections).filter(v => v === 'new').length} valeur(s) à remplacer
                  </div>
                  <div className="flex gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">Annuler</button>
                    <button onClick={handleMerge} disabled={merging}
                      className="flex items-center gap-2 px-4 py-2 bg-sage-dark text-white rounded-lg hover:bg-sage-darker disabled:opacity-50 text-sm">
                      {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      {merging ? 'Fusion…' : 'Fusionner'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
