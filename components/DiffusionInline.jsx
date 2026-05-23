// ═══════════════════════════════════════════════════════════════════
// components/DiffusionInline.jsx — v1
// Section "Diffusion" sur la fiche mandat : cases à cocher par plateforme
// Stockage : colonne mandats.diffusion_plateformes (jsonb)
// Format : [{ key, name, active, date_activation, date_retrait, raison_retrait }]
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';
import { Radio } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Liste des plateformes (système, évolutive)
const PLATEFORMES = [
  { key: 'site_ip', name: 'Notre site (Off-market)', subdomain: 'immeubles-patrimoine.fr', color: '#5d6e5d', initials: 'I&P' },
  { key: 'seloger', name: 'SeLoger', subdomain: 'seloger.com', color: '#e30613', initials: 'SL' },
  { key: 'leboncoin', name: 'LeBonCoin', subdomain: 'leboncoin.fr', color: '#ff6e14', initials: 'LBC' },
  { key: 'lefigaro', name: 'LeFigaro Immobilier', subdomain: 'immobilier.lefigaro.fr', color: '#0a0a0a', initials: 'LF' },
  { key: 'bellesdemeures', name: 'BellesDemeures', subdomain: 'bellesdemeures.com', color: '#8b6f47', initials: 'BD' },
  { key: 'jinka', name: 'Jinka', subdomain: 'jinka.fr', color: '#1eb6c9', initials: 'J' },
];

export default function DiffusionInline({ mandat, reload }) {
  // diffusion_plateformes peut être null, [], ou un array d'entrées
  // Index par key pour accès rapide
  const initialMap = {};
  const raw = mandat?.diffusionPlateformes || mandat?.diffusion_plateformes || [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (entry?.key) initialMap[entry.key] = entry;
    }
  }

  const [plateformes, setPlateformes] = useState(initialMap);
  const [saving, setSaving] = useState(null);

  // Re-sync si le mandat change (édit ailleurs, reload après save)
  useEffect(() => {
    const next = {};
    const r = mandat?.diffusionPlateformes || mandat?.diffusion_plateformes || [];
    if (Array.isArray(r)) {
      for (const entry of r) {
        if (entry?.key) next[entry.key] = entry;
      }
    }
    setPlateformes(next);
  }, [mandat?.id, mandat?.diffusionPlateformes, mandat?.diffusion_plateformes]);

  async function toggle(key) {
    setSaving(key);

    const current = plateformes[key];
    const isActive = !!current?.active;
    const now = new Date().toISOString();

    let updated;
    if (isActive) {
      // Désactivation : on garde la trace + on note la date de retrait
      updated = {
        ...current,
        active: false,
        date_retrait: now,
      };
    } else {
      // Activation : on crée ou réactive
      const platDef = PLATEFORMES.find(p => p.key === key);
      updated = {
        key,
        name: platDef?.name || key,
        active: true,
        date_activation: current?.date_activation || now,
        date_retrait: null,
        raison_retrait: null,
      };
    }

    const nextMap = { ...plateformes, [key]: updated };
    setPlateformes(nextMap);

    // Construire array pour BDD : on garde toutes les entrées (même inactives, pour historique)
    const allKnownKeys = new Set([...Object.keys(nextMap), ...PLATEFORMES.map(p => p.key)]);
    const arrayToSave = [];
    for (const k of allKnownKeys) {
      if (nextMap[k]) arrayToSave.push(nextMap[k]);
    }

    try {
      const { error } = await supabase
        .from('mandats')
        .update({ diffusion_plateformes: arrayToSave })
        .eq('id', mandat.id);
      if (error) throw error;
      // Reload pour propager
      if (reload) await reload();
    } catch (err) {
      console.error('[DiffusionInline] Erreur save:', err);
      // Rollback UI
      setPlateformes(plateformes);
    } finally {
      setSaving(null);
    }
  }

  const nbActives = Object.values(plateformes).filter(p => p?.active).length;
  const nbTotal = PLATEFORMES.length;

  return (
    <div id="diffusion" className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark scroll-mt-32">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
          <Radio className="w-5 h-5 text-sage-dark" />
          Diffusion
        </h2>
        <span className="text-sm text-stone-500">
          {nbActives}/{nbTotal} active{nbActives > 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {PLATEFORMES.map((plat) => {
          const entry = plateformes[plat.key];
          const isActive = !!entry?.active;
          const isSaving = saving === plat.key;

          return (
            <label
              key={plat.key}
              className={`flex items-center gap-3 px-3 py-2.5 border rounded-lg cursor-pointer transition-all ${
                isActive
                  ? 'border-sage-light bg-sage-50'
                  : 'border-cream-dark bg-white opacity-70 hover:opacity-100'
              } ${isSaving ? 'pointer-events-none opacity-50' : ''}`}
            >
              <input
                type="checkbox"
                checked={isActive}
                onChange={() => toggle(plat.key)}
                disabled={isSaving}
                className="w-4 h-4 cursor-pointer"
                style={{ accentColor: '#5d6e5d' }}
              />
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center text-white font-medium flex-shrink-0"
                style={{ backgroundColor: plat.color, fontSize: plat.initials.length > 2 ? '9px' : '11px' }}
              >
                {plat.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-stone-900 truncate">{plat.name}</div>
                <div className="text-[10px] text-stone-500 truncate">{plat.subdomain}</div>
              </div>
              {isActive && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                  Actif
                </span>
              )}
            </label>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-cream flex items-center gap-2 text-xs text-stone-500">
        <span>ⓘ Les détails (vues, contacts, statut, budget) seront gérés dans l'onglet</span>
        <a href="/?tab=annonces" className="text-sage-darker hover:underline font-medium">
          Annonces
        </a>
      </div>
    </div>
  );
}
