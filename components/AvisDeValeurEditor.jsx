// ═══════════════════════════════════════════════════════════════════
// components/AvisDeValeurEditor.jsx
// Modal d'édition de l'avis de valeur d'un mandat
// 8 sections : SWOT + 3 prix dépliées par défaut, le reste replié
// ═══════════════════════════════════════════════════════════════════

'use client';
import React, { useState, useEffect } from 'react';
import { 
  X, Save, ChevronDown, ChevronRight, Plus, Trash2, Loader2,
  TrendingUp, Sparkles, AlertTriangle, Cloud,
  Building2, Eye, BarChart3, Target, Lightbulb, Tag, MessageCircle, Calendar
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Schéma vide par défaut (initialise tous les champs attendus)
const EMPTY_AVIS = {
  description_localisation: '',
  swot: {
    forces: [],
    opportunites: [],
    facteurs_limitatifs: [],
    menaces: [],
  },
  comparables: { prix_moyen_m2: 0, commentaire: '' },
  bien_vendu_proximite: {
    adresse: '', surface: 0, prix: 0,
    etage: '', date_vente: null,
    photos: [], commentaire: ''
  },
  donnees_marche: {
    prix_moyen_zone_min: 0, prix_moyen_zone_max: 0,
    rendement_residentiel_min: 0, rendement_residentiel_max: 0,
    rendement_bureaux: 0,
    cout_renovation_m2_min: 0, cout_renovation_m2_max: 0,
    cout_renovation_total_estime: 0,
    commentaire: ''
  },
  visites_cr: [],
  recommandation_strategique: '',
  options: [],
  prix_marche_bas: 0,
  prix_marche_haut: 0,
  prix_coup_de_coeur: 0,
  avis_client_inclus: '',
  date_estimation: new Date().toISOString().split('T')[0],
  validite_mois: 1,
  variante_template: 'mixte',
};

const VARIANTES = [
  { value: 'mixte', label: 'Immeuble mixte' },
  { value: 'hotel', label: 'Hôtel / hébergement' },
  { value: 'commerce', label: 'Locaux commerciaux' },
  { value: 'residentiel', label: 'Résidentiel pur' },
];

// Helper : merge profond avec EMPTY_AVIS pour garantir que tous les champs existent
function ensureSchema(data) {
  if (!data) return JSON.parse(JSON.stringify(EMPTY_AVIS));
  return {
    ...EMPTY_AVIS,
    ...data,
    swot: { ...EMPTY_AVIS.swot, ...(data.swot || {}) },
    comparables: { ...EMPTY_AVIS.comparables, ...(data.comparables || {}) },
    bien_vendu_proximite: { ...EMPTY_AVIS.bien_vendu_proximite, ...(data.bien_vendu_proximite || {}) },
    donnees_marche: { ...EMPTY_AVIS.donnees_marche, ...(data.donnees_marche || {}) },
    visites_cr: Array.isArray(data.visites_cr) ? data.visites_cr : [],
    options: Array.isArray(data.options) ? data.options : [],
  };
}

export default function AvisDeValeurEditor({ mandat, onClose, onSaved }) {
  const [data, setData] = useState(ensureSchema(mandat?.avisValeur || mandat?.avis_valeur));
  const [saving, setSaving] = useState(false);
  
  // Sections dépliées par défaut : SWOT + 3 prix (essentiel)
  // Sections repliées : comparables, visites, donnees_marche, options, recommandation, avis_client
  const [openSections, setOpenSections] = useState({
    swot: true,
    prix: true,
    comparables: false,
    visites: false,
    marche: false,
    options: false,
    recommandation: false,
    avis_client: false,
    meta: false,
  });

  const toggle = (k) => setOpenSections(s => ({ ...s, [k]: !s[k] }));
  const update = (path, value) => {
    setData(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let cur = copy;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
      cur[keys[keys.length - 1]] = value;
      return copy;
    });
  };

  // Compteur de complétion pour le warning
  const completion = (() => {
    let filled = 0, total = 0;
    const check = (v) => { total++; if (v !== '' && v !== 0 && v !== null && !(Array.isArray(v) && v.length === 0)) filled++; };
    check(data.description_localisation);
    check(data.swot.forces.length);
    check(data.swot.opportunites.length);
    check(data.swot.facteurs_limitatifs.length);
    check(data.swot.menaces.length);
    check(data.recommandation_strategique);
    check(data.prix_marche_bas);
    check(data.prix_marche_haut);
    check(data.prix_coup_de_coeur);
    return { filled, total, pct: Math.round((filled / total) * 100) };
  })();

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
              {mandat?.adresse || mandat?.nom || 'Mandat'}
              {completion.pct < 70 && (
                <span className="ml-3 inline-flex items-center gap-1 text-amber-600">
                  <AlertTriangle className="w-3 h-3" />
                  Complétion {completion.pct}% — les sections vides ne seront pas générées
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY (scroll) */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-3 bg-cream-50/30">

          {/* SECTION SWOT (dépliée par défaut) */}
          <Section
            open={openSections.swot} onToggle={() => toggle('swot')}
            title="Analyse SWOT" icon={<Sparkles className="w-4 h-4" />} 
            count={data.swot.forces.length + data.swot.opportunites.length + data.swot.facteurs_limitatifs.length + data.swot.menaces.length}
          >
            <div className="grid grid-cols-2 gap-3">
              <SwotQuadrant 
                label="Forces" color="emerald" icon={<TrendingUp className="w-4 h-4" />}
                items={data.swot.forces}
                onChange={(items) => update('swot.forces', items)}
              />
              <SwotQuadrant 
                label="Opportunités" color="blue" icon={<Sparkles className="w-4 h-4" />}
                items={data.swot.opportunites}
                onChange={(items) => update('swot.opportunites', items)}
              />
              <SwotQuadrant 
                label="Facteurs limitatifs" color="amber" icon={<AlertTriangle className="w-4 h-4" />}
                items={data.swot.facteurs_limitatifs}
                onChange={(items) => update('swot.facteurs_limitatifs', items)}
              />
              <SwotQuadrant 
                label="Menaces" color="red" icon={<Cloud className="w-4 h-4" />}
                items={data.swot.menaces}
                onChange={(items) => update('swot.menaces', items)}
              />
            </div>
          </Section>

          {/* SECTION 3 PRIX (dépliée par défaut) */}
          <Section
            open={openSections.prix} onToggle={() => toggle('prix')}
            title="Les 3 prix" icon={<Tag className="w-4 h-4" />}
            count={[data.prix_marche_bas, data.prix_marche_haut, data.prix_coup_de_coeur].filter(p => p > 0).length}
          >
            <div className="grid grid-cols-3 gap-3">
              <PrixCard 
                label="Prix marché bas" subtitle="Vente rapide"
                value={data.prix_marche_bas} onChange={v => update('prix_marche_bas', v)}
                color="blue"
              />
              <PrixCard 
                label="Prix marché haut" subtitle="Cible négociation"
                value={data.prix_marche_haut} onChange={v => update('prix_marche_haut', v)}
                color="emerald"
              />
              <PrixCard 
                label="Prix coup de cœur" subtitle="Acquéreur convaincu"
                value={data.prix_coup_de_coeur} onChange={v => update('prix_coup_de_coeur', v)}
                color="amber"
              />
            </div>
          </Section>

          {/* SECTION COMPARABLES (repliée par défaut) */}
          <Section
            open={openSections.comparables} onToggle={() => toggle('comparables')}
            title="Comparables marché" icon={<BarChart3 className="w-4 h-4" />}
            count={data.comparables.prix_moyen_m2 > 0 ? 1 : 0}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Prix moyen au m² (€)</label>
                  <input 
                    type="number" 
                    value={data.comparables.prix_moyen_m2 || ''} 
                    onChange={e => update('comparables.prix_moyen_m2', +e.target.value)}
                    className={fieldClass}
                    placeholder="11 000"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Commentaire sur le marché local</label>
                <textarea 
                  value={data.comparables.commentaire} 
                  onChange={e => update('comparables.commentaire', e.target.value)}
                  rows={2} className={fieldClass}
                  placeholder="Ex: Le marché du 18e arrondissement a vu une hausse de 4%..."
                />
              </div>
              
              {/* Bien vendu à proximité */}
              <div className="bg-white rounded-lg border border-stone-200 p-3 space-y-2">
                <p className="text-xs font-medium text-stone-700">Bien vendu à proximité (référence directe)</p>
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="text" placeholder="Adresse"
                    value={data.bien_vendu_proximite.adresse}
                    onChange={e => update('bien_vendu_proximite.adresse', e.target.value)}
                    className={fieldClass}
                  />
                  <input 
                    type="text" placeholder="Étage (ex: 6e/6)"
                    value={data.bien_vendu_proximite.etage}
                    onChange={e => update('bien_vendu_proximite.etage', e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input 
                    type="number" placeholder="Surface (m²)"
                    value={data.bien_vendu_proximite.surface || ''}
                    onChange={e => update('bien_vendu_proximite.surface', +e.target.value)}
                    className={fieldClass}
                  />
                  <input 
                    type="number" placeholder="Prix (€)"
                    value={data.bien_vendu_proximite.prix || ''}
                    onChange={e => update('bien_vendu_proximite.prix', +e.target.value)}
                    className={fieldClass}
                  />
                  <input 
                    type="date" 
                    value={data.bien_vendu_proximite.date_vente || ''}
                    onChange={e => update('bien_vendu_proximite.date_vente', e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <textarea 
                  value={data.bien_vendu_proximite.commentaire}
                  onChange={e => update('bien_vendu_proximite.commentaire', e.target.value)}
                  rows={2} className={fieldClass}
                  placeholder="Commentaire sur ce bien vendu..."
                />
              </div>
            </div>
          </Section>

          {/* SECTION DONNÉES MARCHÉ */}
          <Section
            open={openSections.marche} onToggle={() => toggle('marche')}
            title="Données marché chiffrées" icon={<BarChart3 className="w-4 h-4" />}
            count={data.donnees_marche.prix_moyen_zone_min > 0 ? 1 : 0}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Prix moyen zone (€/m²) MIN</label>
                  <input type="number" value={data.donnees_marche.prix_moyen_zone_min || ''} 
                    onChange={e => update('donnees_marche.prix_moyen_zone_min', +e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Prix moyen zone (€/m²) MAX</label>
                  <input type="number" value={data.donnees_marche.prix_moyen_zone_max || ''} 
                    onChange={e => update('donnees_marche.prix_moyen_zone_max', +e.target.value)} className={fieldClass} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Rendement résidentiel MIN (%)</label>
                  <input type="number" step="0.1" value={data.donnees_marche.rendement_residentiel_min || ''} 
                    onChange={e => update('donnees_marche.rendement_residentiel_min', +e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Rendement résidentiel MAX (%)</label>
                  <input type="number" step="0.1" value={data.donnees_marche.rendement_residentiel_max || ''} 
                    onChange={e => update('donnees_marche.rendement_residentiel_max', +e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Rendement bureaux (%)</label>
                  <input type="number" step="0.1" value={data.donnees_marche.rendement_bureaux || ''} 
                    onChange={e => update('donnees_marche.rendement_bureaux', +e.target.value)} className={fieldClass} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Coût rénovation (€/m²) MIN</label>
                  <input type="number" value={data.donnees_marche.cout_renovation_m2_min || ''} 
                    onChange={e => update('donnees_marche.cout_renovation_m2_min', +e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Coût rénovation (€/m²) MAX</label>
                  <input type="number" value={data.donnees_marche.cout_renovation_m2_max || ''} 
                    onChange={e => update('donnees_marche.cout_renovation_m2_max', +e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Coût rénov total estimé (€)</label>
                  <input type="number" value={data.donnees_marche.cout_renovation_total_estime || ''} 
                    onChange={e => update('donnees_marche.cout_renovation_total_estime', +e.target.value)} className={fieldClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Commentaire général</label>
                <textarea value={data.donnees_marche.commentaire} 
                  onChange={e => update('donnees_marche.commentaire', e.target.value)}
                  rows={2} className={fieldClass} placeholder="Tendances, perspectives..." />
              </div>
            </div>
          </Section>

          {/* SECTION VISITES */}
          <Section
            open={openSections.visites} onToggle={() => toggle('visites')}
            title="Comptes-rendus de visites" icon={<Eye className="w-4 h-4" />}
            count={data.visites_cr.length}
          >
            <div className="space-y-2">
              {data.visites_cr.map((v, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-stone-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-stone-700">Visite #{idx + 1}</p>
                    <button 
                      onClick={() => update('visites_cr', data.visites_cr.filter((_, i) => i !== idx))}
                      className="text-stone-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Client (ex: Immoniance)" value={v.client || ''}
                      onChange={e => {
                        const newVisites = [...data.visites_cr];
                        newVisites[idx] = { ...v, client: e.target.value };
                        update('visites_cr', newVisites);
                      }} className={fieldClass} />
                    <input type="date" value={v.date || ''}
                      onChange={e => {
                        const newVisites = [...data.visites_cr];
                        newVisites[idx] = { ...v, date: e.target.value };
                        update('visites_cr', newVisites);
                      }} className={fieldClass} />
                  </div>
                  <input type="text" placeholder="Typologie / Profil" value={v.typologie || ''}
                    onChange={e => {
                      const newVisites = [...data.visites_cr];
                      newVisites[idx] = { ...v, typologie: e.target.value };
                      update('visites_cr', newVisites);
                    }} className={fieldClass} />
                  <textarea placeholder="Projet du client / impression" rows={2} value={v.projet || ''}
                    onChange={e => {
                      const newVisites = [...data.visites_cr];
                      newVisites[idx] = { ...v, projet: e.target.value };
                      update('visites_cr', newVisites);
                    }} className={fieldClass} />
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" placeholder="Offre FAI (€)" value={v.offre_fai || ''}
                      onChange={e => {
                        const newVisites = [...data.visites_cr];
                        newVisites[idx] = { ...v, offre_fai: +e.target.value };
                        update('visites_cr', newVisites);
                      }} className={fieldClass} />
                    <input type="number" placeholder="Offre nette (€)" value={v.offre_net || ''}
                      onChange={e => {
                        const newVisites = [...data.visites_cr];
                        newVisites[idx] = { ...v, offre_net: +e.target.value };
                        update('visites_cr', newVisites);
                      }} className={fieldClass} />
                    <select value={v.statut || ''}
                      onChange={e => {
                        const newVisites = [...data.visites_cr];
                        newVisites[idx] = { ...v, statut: e.target.value };
                        update('visites_cr', newVisites);
                      }} className={fieldClass}>
                      <option value="">Statut</option>
                      <option>Offre reçue</option>
                      <option>Contre-visite</option>
                      <option>Non retenu</option>
                      <option>En attente</option>
                    </select>
                  </div>
                </div>
              ))}
              {data.visites_cr.length < 4 && (
                <button 
                  onClick={() => update('visites_cr', [...data.visites_cr, { client: '', date: '', typologie: '', projet: '', offre_fai: 0, offre_net: 0, statut: 'En attente' }])}
                  className="w-full py-2 border border-dashed border-stone-300 rounded-lg text-sm text-stone-500 hover:bg-white hover:text-stone-700 flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter une visite (max 4)
                </button>
              )}
            </div>
          </Section>

          {/* SECTION OPTIONS */}
          <Section
            open={openSections.options} onToggle={() => toggle('options')}
            title="Options de vente" icon={<Lightbulb className="w-4 h-4" />}
            count={data.options.length}
          >
            <div className="space-y-2">
              {data.options.map((opt, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-stone-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-stone-700">Option #{idx + 1}</p>
                    <button 
                      onClick={() => update('options', data.options.filter((_, i) => i !== idx))}
                      className="text-stone-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input type="text" placeholder="Titre (ex: Vente rapide en bloc)" value={opt.titre || ''}
                    onChange={e => {
                      const newOpts = [...data.options];
                      newOpts[idx] = { ...opt, titre: e.target.value };
                      update('options', newOpts);
                    }} className={fieldClass} />
                  <textarea placeholder="Description / avantages / risques" rows={3} value={opt.description || ''}
                    onChange={e => {
                      const newOpts = [...data.options];
                      newOpts[idx] = { ...opt, description: e.target.value };
                      update('options', newOpts);
                    }} className={fieldClass} />
                </div>
              ))}
              <button 
                onClick={() => update('options', [...data.options, { titre: '', description: '' }])}
                className="w-full py-2 border border-dashed border-stone-300 rounded-lg text-sm text-stone-500 hover:bg-white hover:text-stone-700 flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter une option
              </button>
            </div>
          </Section>

          {/* SECTION RECOMMANDATION */}
          <Section
            open={openSections.recommandation} onToggle={() => toggle('recommandation')}
            title="Recommandation stratégique" icon={<Target className="w-4 h-4" />}
            count={data.recommandation_strategique ? 1 : 0}
          >
            <textarea 
              value={data.recommandation_strategique}
              onChange={e => update('recommandation_strategique', e.target.value)}
              rows={6} className={fieldClass}
              placeholder="Notre recommandation : positionner le bien à... compte tenu de... avec un objectif de signature sous X mois..."
            />
          </Section>

          {/* SECTION AVIS CLIENT */}
          <Section
            open={openSections.avis_client} onToggle={() => toggle('avis_client')}
            title="Avis client à inclure" icon={<MessageCircle className="w-4 h-4" />}
            count={data.avis_client_inclus ? 1 : 0}
          >
            <textarea 
              value={data.avis_client_inclus}
              onChange={e => update('avis_client_inclus', e.target.value)}
              rows={4} className={fieldClass}
              placeholder="Témoignage d'un client précédent à insérer dans la présentation..."
            />
          </Section>

          {/* SECTION META (variante template + validité) */}
          <Section
            open={openSections.meta} onToggle={() => toggle('meta')}
            title="Paramètres de génération" icon={<Calendar className="w-4 h-4" />}
            count={0}
          >
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Variante template</label>
                <select value={data.variante_template} 
                  onChange={e => update('variante_template', e.target.value)} className={fieldClass}>
                  {VARIANTES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
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
            <div className="mt-3">
              <label className={labelClass}>Description localisation (pour slide d'intro)</label>
              <textarea value={data.description_localisation}
                onChange={e => update('description_localisation', e.target.value)}
                rows={3} className={fieldClass}
                placeholder="Ex: Le bien est idéalement situé dans le quartier Max Dormoy, à proximité..."
              />
            </div>
          </Section>

        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between p-4 border-t border-stone-200 bg-white">
          <div className="text-xs text-stone-500">
            {completion.filled}/{completion.total} champs essentiels remplis ({completion.pct}%)
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

function Section({ title, icon, open, onToggle, count, children }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <button 
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-cream-50 text-left"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-stone-400" /> : <ChevronRight className="w-4 h-4 text-stone-400" />}
          <span className="text-stone-600">{icon}</span>
          <h3 className="font-medium text-sm text-stone-900">{title}</h3>
          {count > 0 && (
            <span className="text-[10px] bg-sage-100 text-sage-darker px-1.5 py-0.5 rounded-full">
              {count}
            </span>
          )}
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
