// components/CascadeSelect.jsx
'use client';

import React from 'react';
import { getSousTypesForFamille, familleHasSousTypes } from '@/lib/crm-constants';

/**
 * Select en cascade (Famille -> Sous-type)
 *
 * Props :
 * - tree           : objet { Famille: [sous-types] }
 * - familleValue   : valeur famille actuelle (string)
 * - sousTypeValue  : valeur sous-type actuelle (string ou null)
 * - onChange       : ({ famille, sousType }) => void
 * - labelFamille   : string (default: "Famille")
 * - labelSousType  : string (default: "Sous-type")
 * - required       : boolean
 * - disabled       : boolean
 * - className      : string supplémentaire
 */
export default function CascadeSelect({
  tree,
  familleValue = '',
  sousTypeValue = '',
  onChange,
  labelFamille = 'Famille',
  labelSousType = 'Sous-type',
  required = false,
  disabled = false,
  className = ''
}) {
  const familles = Object.keys(tree);
  const sousTypes = getSousTypesForFamille(tree, familleValue);
  const hasSousTypes = familleHasSousTypes(tree, familleValue);

  const handleFamilleChange = (newFamille) => {
    // Quand on change la famille, on reset le sous-type
    onChange({ famille: newFamille, sousType: '' });
  };

  const handleSousTypeChange = (newSousType) => {
    onChange({ famille: familleValue, sousType: newSousType });
  };

  const baseInput = 'w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 disabled:opacity-50 disabled:bg-stone-50';

  return (
    <div className={`grid grid-cols-1 ${hasSousTypes ? 'sm:grid-cols-2' : ''} gap-3 ${className}`}>
      <div>
        <label className="block text-xs text-stone-600 mb-1">
          {labelFamille} {required && <span className="text-red-500">*</span>}
        </label>
        <select
          value={familleValue || ''}
          onChange={(e) => handleFamilleChange(e.target.value)}
          required={required}
          disabled={disabled}
          className={baseInput}
        >
          <option value="">— Choisir —</option>
          {familles.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {hasSousTypes && (
        <div>
          <label className="block text-xs text-stone-600 mb-1">
            {labelSousType}
          </label>
          <select
            value={sousTypeValue || ''}
            onChange={(e) => handleSousTypeChange(e.target.value)}
            disabled={disabled}
            className={baseInput}
          >
            <option value="">— Choisir —</option>
            {sousTypes.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
