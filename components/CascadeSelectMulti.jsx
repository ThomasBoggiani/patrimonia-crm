'use client';
import { Check } from 'lucide-react';
import { TYPES_ACTIF_B2B_TREE, getSousTypesForFamille, familleHasSousTypes } from '@/lib/crm-constants';

/**
 * CascadeSelectMulti — Sélecteur multi-familles + multi-sous-types pour B2B.
 *
 * Stockage à plat dans un tableau (text[]) :
 *   ['Immeubles', "Immeuble d'habitation", 'Mixte', 'Hôtels', 'Hôtels classiques']
 *
 * Logique :
 * - Cocher une famille → on ajoute la famille dans le tableau
 * - Décocher une famille → on retire la famille ET tous ses sous-types
 * - Cocher un sous-type → on ajoute le sous-type (et la famille si pas déjà cochée)
 * - Décocher un sous-type → on retire juste le sous-type
 *
 * @param {string[]} value - Tableau à plat (familles + sous-types mélangés)
 * @param {Function} onChange - (newArray) => void
 */
export default function CascadeSelectMulti({ value = [], onChange }) {
  const items = Array.isArray(value) ? value : [];
  const familles = Object.keys(TYPES_ACTIF_B2B_TREE);

  const isFamilleSelected = (fam) => items.includes(fam);
  const isSousTypeSelected = (st) => items.includes(st);

  const toggleFamille = (fam) => {
    if (isFamilleSelected(fam)) {
      // Retire la famille + tous ses sous-types
      const sousTypes = getSousTypesForFamille(fam);
      const newItems = items.filter(i => i !== fam && !sousTypes.includes(i));
      onChange(newItems);
    } else {
      onChange([...items, fam]);
    }
  };

  const toggleSousType = (fam, st) => {
    if (isSousTypeSelected(st)) {
      onChange(items.filter(i => i !== st));
    } else {
      // Ajoute le sous-type + la famille si pas déjà cochée
      const additions = [st];
      if (!isFamilleSelected(fam)) additions.unshift(fam);
      onChange([...items, ...additions]);
    }
  };

  return (
    <div className="space-y-2.5">
      {familles.map(fam => {
        const selected = isFamilleSelected(fam);
        const hasChildren = familleHasSousTypes(fam);
        const sousTypes = getSousTypesForFamille(fam);

        return (
          <div key={fam} className={`border rounded-lg p-2.5 transition-colors ${selected ? 'border-sage-dark bg-sage-50/40' : 'border-stone-200 bg-white'}`}>
            <button
              type="button"
              onClick={() => toggleFamille(fam)}
              className="flex items-center gap-2 text-sm font-medium text-stone-900 w-full text-left"
            >
              <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected ? 'bg-sage-dark border-sage-dark' : 'bg-white border-stone-300'}`}>
                {selected && <Check className="w-3 h-3 text-white" />}
              </span>
              <span>{fam}</span>
              {hasChildren && <span className="text-[10px] text-stone-400 ml-auto">{sousTypes.length} sous-types</span>}
            </button>

            {selected && hasChildren && (
              <div className="mt-2 ml-6 flex flex-wrap gap-1.5">
                {sousTypes.map(st => {
                  const stSelected = isSousTypeSelected(st);
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => toggleSousType(fam, st)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${stSelected ? 'bg-sage-dark text-white border-sage-dark' : 'bg-white text-stone-700 border-stone-200 hover:border-sage-dark'}`}
                    >
                      {st}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
