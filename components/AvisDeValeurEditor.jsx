// ═══════════════════════════════════════════════════════════════════
// components/AvisDeValeurEditor.jsx (v2 - structure générique avis de valeur)
// 8 sections : 4 dépliées (SWOT, méthodes, reconversion, préconisation)
//              4 repliées (localisation, locatif, caractéristiques, comparables)
// ═══════════════════════════════════════════════════════════════════

'use client';
import React, { useState } from 'react';
import {
  X, Save, ChevronDown, ChevronRight, Plus, Trash2, Loader2,
  TrendingUp, Sparkles, AlertTriangle, Cloud,
  Building2, BarChart3, Target, Lightbulb, Tag, MessageCircle,
  MapPin, Key, Repeat, Calculator
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Schéma vide par défaut
const EMPTY_AVIS = {
  // 1. Localisation
  localisation: {
    transports: '', // texte libre (en attendant intégration auto)
    commentaire: '', // commentaire stratégique sur l'emplacement
  },
  // 2. Situation locative (auto depuis etat_locatif, juste commentaire ici)
  situation_locative: {
    commentaire: '', // contexte locatif particulier
  },
  // 3. Caractéristiques
  caracteristiques: {
    annee_construction: '',
    architecte: '',
    distribution: '', // texte libre (R-1, RDC, R+1...)
    atouts_distinctifs: [], // bullets
    commentaire: '',
  },
  // 4. Comparables & marché
  comparables: {
    prix_zone_min: 0,
    prix_zone_max: 0,
    rendement_zone_min: 0,
    rendement_zone_max: 0,
    transactions_recentes: '', // texte libre tableau
    commentaire: '',
  },
  // 5. SWOT (déplié)
  swot: {
    forces: [],
    opportunites: [],
    facteurs_limitatifs: [],
    menaces: [],
  },
  // 6. Méthodes d'analyse de valeur (déplié)
  methode_m2: {
    valeur_basse: { prix_m2: 0, valeur_totale: 0, commentaire: '' },
    valeur_centrale: { prix_m2: 0, valeur_totale: 0, commentaire: '' },
    valeur_haute: { prix_m2: 0, valeur_totale: 0, commentaire: '' },
  },
  methode_capi: {
    ca_base: 0, // CA HT annuel base de calcul
    hypotheses: [], // [{rendement_pct, valeur_acte, valeur_m2, lecture}]
    zone_atterrissage: '', // texte libre
  },
  // 7. Potentiel de reconversion (déplié)
  reconversion: {
    usages: [], // [{titre, description}]
    bilan_financier: '', // texte libre (acquisition + travaux + CA cible)
    profils_acquereurs: [], // liste libre
  },
  // 8. Préconisation & 3 prix (déplié)
  preconisation: {
    recommandation: '',
    prix_coup_de_coeur: 0,
    prix_marche: 0,
    prix_plancher: 0,
    avis_client: '',
    consultant_nom: '',
    consultant_email: '',
    consultant_tel: '',
    honoraires_pct: 5,
  },
  // Méta
  date_estimation: new Date().toISOString().split('T')[0],
  validite_mois: 1,
};

// Helper : merge profond avec EMPTY_AVIS
function ensureSchema(data) {
  if (!data) return JSON.parse(JSON.stringify(EMPTY_AVIS));
  const safe = {
    ...EMPTY_AVIS,
    ...data,
    localisation: { ...EMPTY_AVIS.localisation, ...(data.localisation || {}) },
    situation_locative: { ...EMPTY_AVIS.situation_locative, ...(data.situation_locative || {}) },
    caracteristiques: {
      ...EMPTY_AVIS.caracteristiques,
      ...(data.caracteristiques || {}),
      atouts_distinctifs: Array.isArray(data.caracteristiques?.atouts_distinctifs)
        ? data.caracteristiques.atouts_distinctifs : [],
    },
    comparables: { ...EMPTY_AVIS.comparables, ...(data.comparables || {}) },
    swot: { ...EMPTY_AVIS.swot, ...(data.swot || {}) },
    methode_m2: {
      valeur_basse: { ...EMPTY_AVIS.methode_m2.valeur_basse, ...(data.methode_m2?.valeur_basse || {}) },
      valeur_centrale: { ...EMPTY_AVIS.methode_m2.valeur_centrale, ...(data.methode_m2?.valeur_centrale || {}) },
      valeur_haute: { ...EMPTY_AVIS.methode_m2.valeur_haute, ...(data.methode_m2?.valeur_haute || {}) },
    },
    methode_capi: {
      ...EMPTY_AVIS.methode_capi,
      ...(data.methode_capi || {}),
      hypotheses: Array.isArray(data.methode_capi?.hypotheses) ? data.methode_capi.hypotheses : [],
    },
    reconversion: {
      ...EMPTY_AVIS.reconversion,
      ...(data.reconversion || {}),
      usages: Array.isArray(data.reconversion?.usages) ? data.reconversion.usages : [],
      profils_acquereurs: Array.isArray(data.reconversion?.profils_acquereurs) ? data.reconversion.profils_acquereurs : [],
    },
    preconisation: { ...EMPTY_AVIS.preconisation, ...(data.preconisation || {}) },
  };
  // Migration : si on a l'ancien schéma (avec swot.forces[]…) on les garde
  return safe;
}

export default function AvisDeValeurEditor({ mandat, onClose, onSaved }) {
  const [data, setData] = useState(ensureSchema(mandat?.avisValeur || mandat?.avis_valeur));
  const [saving, setSaving] = useState(false);

  // 4 dépliées par défaut : SWOT, méthodes, reconversion, préconisation
  // 4 repliées : localisation, locatif, caractéristiques, comparables
  const [openSections, setOpenSections] = useState({
    localisation: false,
    locatif: false,
    caracteristiques: false,
    comparables: false,
    swot: true,
    methodes: true,
    reconversion: true,
    preconisation: true,
  });

  const toggle = (k) => setOpenSections(s => ({ ...s, [k]: !s[k] }));
  const update = (path, value) => {
    setData(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let cur = copy;
      for (let i = 0; i < keys.length - 1; i++) {
        if (cur[keys[i]] === undefined || cur[keys[i]] === null) cur[keys[i]] = {};
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = value;
      return copy;
    });
  };

  // Récupération auto de la situation locative depuis le mandat
  const lotsFromMandat = mandat?.etatLocatif || mandat?.etat_locatif || [];
  const sumLoyer = Array.isArray(lotsFromMandat)
    ? lotsFromMandat.reduce((s, l) => s + (parseFloat(l.loyer) || 0), 0)
    : 0;
  const sumPotentiel = Array.isArray(lotsFromMandat)
    ? lotsFromMandat.reduce((s, l) => {
        const p = parseFloat(l.loyer_potentiel) || 0;
        return s + (p > 0 ? p : (parseFloat(l.loyer) || 0));
      }, 0)
    : 0;
  const caActuelHTAnnuel = sumLoyer * 12;
  const caPotentielHTAnnuel = sumPotentiel * 12;

  // Highlights IA et description du mandat
  const mandatHighlights = mandat?.highlights || [];

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('mandats')
        .update({ avis_valeur: data })
        .eq('id', mandat.id);
      if (error) {
        alert('Erreur sauvegarde : ' + error.message);
      } else {
        onSaved?.(data);
        onClose();
      }
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
    setSaving(false);
  }

  const fieldClass = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900";
  const labelClass = "block text-xs font-medium text-stone-600 mb-1";

  return (
    <div className="fixed inset-0 bg-stone-900/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-luxe-hover w-full max-w-4xl max-h-[94vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >

        {/* HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-stone-200">
          <div>
            <h2 className="font-display text-2xl font-semibold text-stone-900 flex items-center gap-2">
              📊 Avis de valeur
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {mandat?.adresse || mandat?.nom || 'Mandat'} · {mandat?.surface ? `${mandat.surface} m²` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-3 bg-cream-50/30">

          {/* ─── 1. LOCALISATION (repliée) ─── */}
          <Section
            open={openSections.localisation} onToggle={() => toggle('localisation')}
            title="Localisation & transports" icon={<MapPin className="w-4 h-4" />}
            subtitle="Auto-récupéré depuis la fiche · enrichis le commentaire"
            count={data.localisation.commentaire || data.localisation.transports ? 1 : 0}
          >
            <div className="space-y-3">
              <div className="bg-cream-100/50 rounded-lg p-3 text-xs text-stone-600">
                <strong>Adresse :</strong> {mandat?.adresse || '—'}
              </div>
              <div>
                <label className={labelClass}>Transports & accessibilité (libre)</label>
                <textarea
                  value={data.localisation.transports}
                  onChange={e => update('localisation.transports', e.target.value)}
                  rows={3} className={fieldClass}
                  placeholder="Ex: Métro Bastille (L1, L5, L8) à 5 min · Bus 20, 29, 65 · A4 / Périphérique"
                />
                <p className="text-[10px] text-stone-400 mt-1 italic">Plus tard : récupération auto via API transports.</p>
              </div>
              <div>
                <label className={labelClass}>Commentaire stratégique sur l'emplacement</label>
                <textarea
                  value={data.localisation.commentaire}
                  onChange={e => update('localisation.commentaire', e.target.value)}
                  rows={3} className={fieldClass}
                  placeholder="Ex: Emplacement stratégique au cœur du quartier Bastille, l'un des secteurs tertiaires les plus dynamiques..."
                />
              </div>
            </div>
          </Section>

          {/* ─── 2. SITUATION LOCATIVE (repliée, lecture auto) ─── */}
          <Section
            open={openSections.locatif} onToggle={() => toggle('locatif')}
            title="Situation locative" icon={<Key className="w-4 h-4" />}
            subtitle={`Auto-affiché depuis l'état locatif · ${lotsFromMandat.length} lot${lotsFromMandat.length > 1 ? 's' : ''}`}
            count={lotsFromMandat.length > 0 ? 1 : 0}
          >
            {lotsFromMandat.length === 0 ? (
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-xs text-amber-900">
                ⚠️ Aucun lot saisi dans l'état locatif du mandat. Saisir d'abord les lots dans le formulaire "Modifier mandat".
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-sage-50 rounded-lg p-3 border border-sage-light">
                    <p className="text-[10px] uppercase text-sage-darker">CA actuel HT/an</p>
                    <p className="text-lg font-semibold text-sage-darker">
                      {caActuelHTAnnuel > 0 ? `${caActuelHTAnnuel.toLocaleString('fr-FR')} €` : '—'}
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <p className="text-[10px] uppercase text-amber-800">CA potentiel HT/an</p>
                    <p className="text-lg font-semibold text-amber-800">
                      {caPotentielHTAnnuel > 0 ? `${caPotentielHTAnnuel.toLocaleString('fr-FR')} €` : '—'}
                    </p>
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-stone-200 max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-stone-50 border-b">
                      <tr>
                        <th className="text-left px-2 py-1.5 text-stone-600">Lot</th>
                        <th className="text-left px-2 py-1.5 text-stone-600">Surface</th>
                        <th className="text-right px-2 py-1.5 text-stone-600">Loyer/mois</th>
                        <th className="text-right px-2 py-1.5 text-stone-600">Potentiel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lotsFromMandat.map((l, i) => (
                        <tr key={i} className="border-b border-stone-100 last:border-0">
                          <td className="px-2 py-1.5">{l.numero || (i + 1)} · {l.type || l.nature || '—'}</td>
                          <td className="px-2 py-1.5">{l.surface ? `${l.surface} m²` : '—'}</td>
                          <td className="px-2 py-1.5 text-right">{l.loyer ? `${parseFloat(l.loyer).toLocaleString('fr-FR')} €` : '—'}</td>
                          <td className="px-2 py-1.5 text-right text-amber-700">{l.loyer_potentiel ? `${parseFloat(l.loyer_potentiel).toLocaleString('fr-FR')} €` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <label className={labelClass}>Commentaire sur la situation locative</label>
                  <textarea
                    value={data.situation_locative.commentaire}
                    onChange={e => update('situation_locative.commentaire', e.target.value)}
                    rows={2} className={fieldClass}
                    placeholder="Ex: Immeuble livré libre à la vente, les deux occupants libèrent l'ensemble..."
                  />
                </div>
              </div>
            )}
          </Section>

          {/* ─── 3. CARACTÉRISTIQUES (repliée) ─── */}
          <Section
            open={openSections.caracteristiques} onToggle={() => toggle('caracteristiques')}
            title="Caractéristiques & atouts" icon={<Building2 className="w-4 h-4" />}
            subtitle="Highlights IA + détails complémentaires"
            count={data.caracteristiques.atouts_distinctifs.length}
          >
            <div className="space-y-3">
              {/* Highlights IA en lecture seule */}
              {mandatHighlights.length > 0 && (
                <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-200">
                  <p className="text-[10px] uppercase text-amber-800 mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Points forts détectés par l'IA
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {mandatHighlights.map((h, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 bg-white border border-amber-200 text-amber-900 rounded-full">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Année de construction</label>
                  <input
                    type="text"
                    value={data.caracteristiques.annee_construction}
                    onChange={e => update('caracteristiques.annee_construction', e.target.value)}
                    placeholder="ex: 1871" className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Architecte (si connu)</label>
                  <input
                    type="text"
                    value={data.caracteristiques.architecte}
                    onChange={e => update('caracteristiques.architecte', e.target.value)}
                    placeholder="ex: E. Gutelle" className={fieldClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Distribution par niveau (libre)</label>
                <textarea
                  value={data.caracteristiques.distribution}
                  onChange={e => update('caracteristiques.distribution', e.target.value)}
                  rows={3} className={fieldClass}
                  placeholder="R-1: 415 m² · RDC: 850 m² · R+1: 510 m² · R+2: 335 m²..."
                />
              </div>

              <ArrayEditor
                label="Atouts distinctifs (bullets)"
                items={data.caracteristiques.atouts_distinctifs}
                onChange={items => update('caracteristiques.atouts_distinctifs', items)}
                placeholder="Ex: Immeuble indépendant — totale liberté d'usage"
              />

              <div>
                <label className={labelClass}>Commentaire général</label>
                <textarea
                  value={data.caracteristiques.commentaire}
                  onChange={e => update('caracteristiques.commentaire', e.target.value)}
                  rows={2} className={fieldClass}
                />
              </div>
            </div>
          </Section>

          {/* ─── 4. COMPARABLES (repliée) ─── */}
          <Section
            open={openSections.comparables} onToggle={() => toggle('comparables')}
            title="Comparables & données marché" icon={<BarChart3 className="w-4 h-4" />}
            subtitle="Saisie libre (en attendant la BDD marché)"
            count={data.comparables.transactions_recentes ? 1 : 0}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Prix zone MIN (€/m²)</label>
                  <input type="number" value={data.comparables.prix_zone_min || ''}
                    onChange={e => update('comparables.prix_zone_min', +e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Prix zone MAX (€/m²)</label>
                  <input type="number" value={data.comparables.prix_zone_max || ''}
                    onChange={e => update('comparables.prix_zone_max', +e.target.value)} className={fieldClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Rendement zone MIN (%)</label>
                  <input type="number" step="0.1" value={data.comparables.rendement_zone_min || ''}
                    onChange={e => update('comparables.rendement_zone_min', +e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Rendement zone MAX (%)</label>
                  <input type="number" step="0.1" value={data.comparables.rendement_zone_max || ''}
                    onChange={e => update('comparables.rendement_zone_max', +e.target.value)} className={fieldClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Transactions récentes (texte libre — tu peux coller un tableau)</label>
                <textarea value={data.comparables.transactions_recentes}
                  onChange={e => update('comparables.transactions_recentes', e.target.value)}
                  rows={5} className={fieldClass}
                  placeholder="Ex:&#10;37 Saint-Sébastien · Paris 11 · 2 500 m² · 12,25 M€ · 4 900 €/m² · value-add · T2 2024&#10;15 Nation · Paris 11 · 7 750 m² · 89 M€ · 11 500 €/m² · core · T4 2024..."
                />
                <p className="text-[10px] text-stone-400 mt-1 italic">Plus tard : auto-rempli depuis BDD marché & nos signatures.</p>
              </div>
              <div>
                <label className={labelClass}>Commentaire sur le marché local</label>
                <textarea value={data.comparables.commentaire}
                  onChange={e => update('comparables.commentaire', e.target.value)}
                  rows={2} className={fieldClass} />
              </div>
            </div>
          </Section>

          {/* ─── 5. SWOT (dépliée) ─── */}
          <Section
            open={openSections.swot} onToggle={() => toggle('swot')}
            title="Analyse SWOT" icon={<Sparkles className="w-4 h-4" />}
            subtitle="Forces / Opportunités / Limites / Menaces"
            count={data.swot.forces.length + data.swot.opportunites.length + data.swot.facteurs_limitatifs.length + data.swot.menaces.length}
          >
            <div className="grid grid-cols-2 gap-3">
              <SwotQuadrant
                label="Forces" color="emerald" icon={<TrendingUp className="w-4 h-4" />}
                items={data.swot.forces}
                onChange={items => update('swot.forces', items)}
              />
              <SwotQuadrant
                label="Opportunités" color="blue" icon={<Sparkles className="w-4 h-4" />}
                items={data.swot.opportunites}
                onChange={items => update('swot.opportunites', items)}
              />
              <SwotQuadrant
                label="Facteurs limitatifs" color="amber" icon={<AlertTriangle className="w-4 h-4" />}
                items={data.swot.facteurs_limitatifs}
                onChange={items => update('swot.facteurs_limitatifs', items)}
              />
              <SwotQuadrant
                label="Menaces" color="red" icon={<Cloud className="w-4 h-4" />}
                items={data.swot.menaces}
                onChange={items => update('swot.menaces', items)}
              />
            </div>
          </Section>

          {/* ─── 6. MÉTHODES D'ANALYSE DE VALEUR (dépliée) ─── */}
          <Section
            open={openSections.methodes} onToggle={() => toggle('methodes')}
            title="Méthodes d'analyse de valeur" icon={<Calculator className="w-4 h-4" />}
            subtitle="Par comparaison m² + par capitalisation"
            count={(data.methode_m2.valeur_centrale.prix_m2 > 0 ? 1 : 0) + (data.methode_capi.hypotheses.length > 0 ? 1 : 0)}
          >
            <div className="space-y-4">

              {/* Méthode par m² */}
              <div className="bg-white rounded-lg border border-stone-200 p-3">
                <p className="text-xs font-medium text-stone-700 mb-2">📐 Par comparaison au m²</p>
                <div className="grid grid-cols-3 gap-3">
                  <ValeurM2Card label="Valeur basse" color="blue" data={data.methode_m2.valeur_basse}
                    onChange={v => update('methode_m2.valeur_basse', v)} />
                  <ValeurM2Card label="Valeur centrale" color="emerald" data={data.methode_m2.valeur_centrale}
                    onChange={v => update('methode_m2.valeur_centrale', v)} />
                  <ValeurM2Card label="Valeur haute" color="amber" data={data.methode_m2.valeur_haute}
                    onChange={v => update('methode_m2.valeur_haute', v)} />
                </div>
              </div>

              {/* Méthode par capitalisation */}
              <div className="bg-white rounded-lg border border-stone-200 p-3">
                <p className="text-xs font-medium text-stone-700 mb-2">💰 Par capitalisation des revenus</p>
                <div>
                  <label className={labelClass}>CA HT annuel (base de calcul)</label>
                  <input type="number" value={data.methode_capi.ca_base || ''}
                    onChange={e => update('methode_capi.ca_base', +e.target.value)} className={fieldClass}
                    placeholder="Ex: 763 600" />
                </div>
                <div className="mt-2">
                  <label className={labelClass}>Hypothèses de rendement → valeur</label>
                  <div className="space-y-1.5">
                    {data.methode_capi.hypotheses.map((h, i) => (
                      <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                        <input type="number" step="0.05" value={h.rendement_pct || ''}
                          onChange={e => {
                            const arr = [...data.methode_capi.hypotheses];
                            arr[i] = { ...h, rendement_pct: +e.target.value };
                            update('methode_capi.hypotheses', arr);
                          }}
                          placeholder="6,5"
                          className="col-span-2 px-2 py-1 text-xs border border-stone-200 rounded" />
                        <span className="col-span-1 text-xs text-stone-500">%</span>
                        <input type="number" value={h.valeur_acte || ''}
                          onChange={e => {
                            const arr = [...data.methode_capi.hypotheses];
                            arr[i] = { ...h, valeur_acte: +e.target.value };
                            update('methode_capi.hypotheses', arr);
                          }}
                          placeholder="Valeur acte (€)"
                          className="col-span-3 px-2 py-1 text-xs border border-stone-200 rounded" />
                        <input type="text" value={h.lecture || ''}
                          onChange={e => {
                            const arr = [...data.methode_capi.hypotheses];
                            arr[i] = { ...h, lecture: e.target.value };
                            update('methode_capi.hypotheses', arr);
                          }}
                          placeholder="Lecture marché"
                          className="col-span-5 px-2 py-1 text-xs border border-stone-200 rounded" />
                        <button
                          onClick={() => update('methode_capi.hypotheses', data.methode_capi.hypotheses.filter((_, x) => x !== i))}
                          className="col-span-1 text-stone-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => update('methode_capi.hypotheses', [...data.methode_capi.hypotheses, { rendement_pct: 0, valeur_acte: 0, lecture: '' }])}
                      className="w-full py-1.5 border border-dashed border-stone-300 rounded text-xs text-stone-500 hover:bg-stone-50 flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Ajouter une hypothèse
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <label className={labelClass}>Zone d'atterrissage (texte libre)</label>
                  <textarea value={data.methode_capi.zone_atterrissage}
                    onChange={e => update('methode_capi.zone_atterrissage', e.target.value)}
                    rows={2} className={fieldClass}
                    placeholder="Ex: Zone d'atterrissage commercialisation : 27 M€ à 29 M€ — Atterrissage probable : 24,5 M€ à 27 M€..." />
                </div>
              </div>
            </div>
          </Section>

          {/* ─── 7. POTENTIEL DE RECONVERSION (dépliée) ─── */}
          <Section
            open={openSections.reconversion} onToggle={() => toggle('reconversion')}
            title="Potentiel de reconversion" icon={<Repeat className="w-4 h-4" />}
            subtitle="Usages alternatifs + bilan financier indicatif"
            count={data.reconversion.usages.length}
          >
            <div className="space-y-3">
              {/* Usages alternatifs */}
              <div className="space-y-2">
                {data.reconversion.usages.map((u, i) => (
                  <div key={i} className="bg-white rounded-lg border border-stone-200 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-stone-700">Usage #{i + 1}</p>
                      <button
                        onClick={() => update('reconversion.usages', data.reconversion.usages.filter((_, x) => x !== i))}
                        className="text-stone-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input type="text" placeholder="Titre (ex: Reconversion hôtelière 49 chambres)"
                      value={u.titre || ''}
                      onChange={e => {
                        const arr = [...data.reconversion.usages];
                        arr[i] = { ...u, titre: e.target.value };
                        update('reconversion.usages', arr);
                      }} className={fieldClass} />
                    <textarea placeholder="Description / arguments / atouts" rows={3}
                      value={u.description || ''}
                      onChange={e => {
                        const arr = [...data.reconversion.usages];
                        arr[i] = { ...u, description: e.target.value };
                        update('reconversion.usages', arr);
                      }} className={fieldClass} />
                  </div>
                ))}
                <button
                  onClick={() => update('reconversion.usages', [...data.reconversion.usages, { titre: '', description: '' }])}
                  className="w-full py-2 border border-dashed border-stone-300 rounded-lg text-sm text-stone-500 hover:bg-white"
                >
                  <Plus className="w-3.5 h-3.5 inline mr-1" /> Ajouter un usage alternatif
                </button>
              </div>

              {/* Bilan financier */}
              <div>
                <label className={labelClass}>Bilan financier indicatif (libre)</label>
                <textarea value={data.reconversion.bilan_financier}
                  onChange={e => update('reconversion.bilan_financier', e.target.value)}
                  rows={4} className={fieldClass}
                  placeholder="Ex:&#10;Prix acquisition : 17-19 M€&#10;Travaux conversion : ~10 M€&#10;FF&E : ~2,5 M€&#10;Coût total : ~30-32 M€&#10;CA hôtelier cible (RevPAR 220€) : ~3,9 M€/an&#10;Valeur hôtel livré (yield 6,5%) : ~60 M€" />
              </div>

              {/* Profils acquéreurs */}
              <ArrayEditor
                label="Profils d'acquéreurs ciblés"
                items={data.reconversion.profils_acquereurs}
                onChange={items => update('reconversion.profils_acquereurs', items)}
                placeholder="Ex: Groupes hôteliers indépendants (boutique 4-5*)"
              />
            </div>
          </Section>

          {/* ─── 8. PRÉCONISATION & 3 PRIX (dépliée) ─── */}
          <Section
            open={openSections.preconisation} onToggle={() => toggle('preconisation')}
            title="Préconisation & 3 prix" icon={<Tag className="w-4 h-4" />}
            subtitle="Recommandation finale + prix + consultant"
            count={[data.preconisation.prix_coup_de_coeur, data.preconisation.prix_marche, data.preconisation.prix_plancher].filter(p => p > 0).length}
          >
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Recommandation stratégique</label>
                <textarea value={data.preconisation.recommandation}
                  onChange={e => update('preconisation.recommandation', e.target.value)}
                  rows={4} className={fieldClass}
                  placeholder="Notre recommandation : positionner le bien à... compte tenu de... avec un objectif de signature sous X mois..." />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <PrixCard
                  label="Prix coup de cœur" subtitle="Acquéreur convaincu"
                  value={data.preconisation.prix_coup_de_coeur}
                  onChange={v => update('preconisation.prix_coup_de_coeur', v)}
                  color="amber"
                />
                <PrixCard
                  label="Prix de marché" subtitle="Recommandé"
                  value={data.preconisation.prix_marche}
                  onChange={v => update('preconisation.prix_marche', v)}
                  color="emerald"
                />
                <PrixCard
                  label="Prix plancher" subtitle="Base négociation"
                  value={data.preconisation.prix_plancher}
                  onChange={v => update('preconisation.prix_plancher', v)}
                  color="blue"
                />
              </div>

              <div>
                <label className={labelClass}>Avis client (témoignage à inclure)</label>
                <textarea value={data.preconisation.avis_client}
                  onChange={e => update('preconisation.avis_client', e.target.value)}
                  rows={3} className={fieldClass}
                  placeholder="Témoignage d'un client précédent à insérer..." />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Consultant nom</label>
                  <input type="text" value={data.preconisation.consultant_nom}
                    onChange={e => update('preconisation.consultant_nom', e.target.value)}
                    placeholder="ex: Thomas Boggiani" className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input type="email" value={data.preconisation.consultant_email}
                    onChange={e => update('preconisation.consultant_email', e.target.value)}
                    className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Téléphone</label>
                  <input type="text" value={data.preconisation.consultant_tel}
                    onChange={e => update('preconisation.consultant_tel', e.target.value)}
                    className={fieldClass} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Honoraires (%)</label>
                  <input type="number" step="0.1" value={data.preconisation.honoraires_pct || ''}
                    onChange={e => update('preconisation.honoraires_pct', +e.target.value)}
                    className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Date estimation</label>
                  <input type="date" value={data.date_estimation || ''}
                    onChange={e => update('date_estimation', e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Validité (mois)</label>
                  <input type="number" value={data.validite_mois || ''}
                    onChange={e => update('validite_mois', +e.target.value)} className={fieldClass} />
                </div>
              </div>
            </div>
          </Section>

        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between p-4 border-t border-stone-200 bg-white">
          <div className="text-xs text-stone-500">
            Document servant à <strong>convaincre le mandant</strong> de confier son bien.
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-stone-700 hover:bg-cream-100 rounded-lg"
            >
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Sauvegarde...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════

function Section({ title, icon, subtitle, open, onToggle, count, children }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-cream-50 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-stone-400 flex-shrink-0" />}
          <span className="text-stone-600 flex-shrink-0">{icon}</span>
          <h3 className="font-medium text-sm text-stone-900">{title}</h3>
          {count > 0 && (
            <span className="text-[10px] bg-sage-100 text-sage-darker px-1.5 py-0.5 rounded-full flex-shrink-0">
              {count}
            </span>
          )}
          {subtitle && <span className="text-xs text-stone-400 italic truncate">· {subtitle}</span>}
        </div>
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

function SwotQuadrant({ label, color, icon, items, onChange }) {
  const [draft, setDraft] = useState('');
  const colorClasses = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  };
  const pillClasses = {
    emerald: 'bg-emerald-100 text-emerald-900',
    blue: 'bg-blue-100 text-blue-900',
    amber: 'bg-amber-100 text-amber-900',
    red: 'bg-red-100 text-red-900',
  };

  const addItem = () => {
    if (draft.trim()) {
      onChange([...items, draft.trim()]);
      setDraft('');
    }
  };

  return (
    <div className={`rounded-lg border p-3 ${colorClasses[color]}`}>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-medium">
        {icon} {label}
        <span className="text-[10px] opacity-60">({items.length})</span>
      </div>
      <div className="space-y-1 mb-2">
        {items.map((item, idx) => (
          <div key={idx} className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${pillClasses[color]}`}>
            <span className="flex-1 break-words">{item}</span>
            <button
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className="opacity-50 hover:opacity-100"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          type="text" value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          placeholder="Ajouter..."
          className="flex-1 px-2 py-1 bg-white border border-stone-200 rounded text-xs focus:outline-none focus:border-stone-900"
        />
        <button
          onClick={addItem}
          disabled={!draft.trim()}
          className="px-2 py-1 bg-white border border-stone-200 rounded text-xs hover:bg-cream-50 disabled:opacity-30"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function PrixCard({ label, subtitle, value, onChange, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    amber: 'bg-amber-50 border-amber-200',
  };
  const labelColors = {
    blue: 'text-blue-900',
    emerald: 'text-emerald-900',
    amber: 'text-amber-900',
  };
  return (
    <div className={`rounded-lg border p-3 ${colorClasses[color]}`}>
      <p className={`text-xs font-medium ${labelColors[color]}`}>{label}</p>
      <p className="text-[10px] text-stone-500 mb-2">{subtitle}</p>
      <div className="relative">
        <input
          type="number"
          value={value || ''}
          onChange={e => onChange(+e.target.value)}
          placeholder="0"
          className="w-full px-2 py-1.5 bg-white border border-stone-200 rounded text-sm font-medium focus:outline-none focus:border-stone-900"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-400">€</span>
      </div>
      {value > 0 && (
        <p className="text-[10px] text-stone-500 mt-1">
          {value.toLocaleString('fr-FR')} €
        </p>
      )}
    </div>
  );
}

function ValeurM2Card({ label, color, data, onChange }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    amber: 'bg-amber-50 border-amber-200',
  };
  const labelColors = {
    blue: 'text-blue-900',
    emerald: 'text-emerald-900',
    amber: 'text-amber-900',
  };
  return (
    <div className={`rounded-lg border p-2 ${colorClasses[color]} space-y-1.5`}>
      <p className={`text-xs font-medium ${labelColors[color]}`}>{label}</p>
      <input type="number" value={data.prix_m2 || ''}
        onChange={e => onChange({ ...data, prix_m2: +e.target.value })}
        placeholder="Prix /m²"
        className="w-full px-2 py-1 text-xs bg-white border border-stone-200 rounded" />
      <input type="number" value={data.valeur_totale || ''}
        onChange={e => onChange({ ...data, valeur_totale: +e.target.value })}
        placeholder="Valeur totale"
        className="w-full px-2 py-1 text-xs bg-white border border-stone-200 rounded" />
      <textarea value={data.commentaire || ''}
        onChange={e => onChange({ ...data, commentaire: e.target.value })}
        placeholder="Commentaire"
        rows={2}
        className="w-full px-2 py-1 text-xs bg-white border border-stone-200 rounded" />
    </div>
  );
}

function ArrayEditor({ label, items, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const addItem = () => {
    if (draft.trim()) {
      onChange([...items, draft.trim()]);
      setDraft('');
    }
  };
  return (
    <div>
      <label className="block text-xs font-medium text-stone-600 mb-1">{label}</label>
      <div className="space-y-1 mb-1.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-stone-50 rounded text-xs">
            <span className="flex-1 break-words">• {item}</span>
            <button
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className="text-stone-400 hover:text-red-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          type="text" value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          placeholder={placeholder}
          className="flex-1 px-2 py-1.5 bg-white border border-stone-200 rounded text-xs focus:outline-none focus:border-stone-900"
        />
        <button
          onClick={addItem}
          disabled={!draft.trim()}
          className="px-2 py-1.5 bg-white border border-stone-200 rounded text-xs hover:bg-cream-50 disabled:opacity-30"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
