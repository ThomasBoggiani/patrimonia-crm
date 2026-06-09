'use client';
import { Check } from 'lucide-react';
import { ZONES_SECTEURS } from '@/lib/crm-constants';

/**
 * ZonesSelectMulti — Sélecteur multi-zones géographiques.
 *
 * Stockage à plat dans un tableau (text[]) :
 *   ['Paris intra-muros', 'Hauts-de-Seine (92)']
 *
 * Calqué sur CascadeSelectMulti pour cohérence d'UI.
 * Utilise le référentiel ZONES_SECTEURS (dérivé de ZONES_TREE).
 */
export default function ZonesSelectMulti({ value = [], onChange, secteurs = ZONES_SECTEURS }) {
  const items = Array.isArray(value) ? value : [];

  const isSelected = (z) => items.includes(z);

  const toggle = (z) => {
    if (isSelected(z)) {
      onChange(items.filter(i => i !== z));
    } else {
      onChange([...items, z]);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {secteurs.map(z => {
        const selected = isSelected(z);
        return (
          <button
            key={z}
            type="button"
            onClick={() => toggle(z)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-colors ${
              selected
                ? 'bg-sage-dark text-white border-sage-dark'
                : 'bg-white text-stone-700 border-stone-200 hover:border-sage-dark'
            }`}
          >
            {selected && <Check className="w-3 h-3" />}
            {z}
          </button>
        );
      })}
    </div>
  );
}
