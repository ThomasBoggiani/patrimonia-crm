'use client';
import { getCurrentUserInitials, getCurrentUserName } from '@/lib/auth';

/**
 * OwnerSelect — Sélecteur de titulaire (owner), partagé mandat ↔ client.
 *
 * Affiche le nom complet de chaque membre de l'équipe, stocke ses INITIALES (TB, TE, PK).
 * Le créateur est titulaire par défaut (géré en amont via owner: userInitials),
 * mais ce sélecteur permet de le modifier.
 *
 * Props :
 * - value    : initiales actuelles (string, ex: 'TB')
 * - onChange : (initiales) => void
 * - profiles : tableau des membres de l'équipe [{ id, prenom, nom, role, actif }]
 * - label    : libellé du champ (défaut: 'Titulaire')
 */
export default function OwnerSelect({ value = '', onChange, profiles = [], label = 'Titulaire' }) {
  // Construit la liste { initiales, nom } à partir des profils actifs
  const membres = (profiles || [])
    .filter(p => p.actif !== false)
    .map(p => ({
      initiales: getCurrentUserInitials(p),
      nom: getCurrentUserName(p),
    }))
    // dédoublonne par initiales (au cas où deux profils donneraient les mêmes)
    .filter((m, i, arr) => arr.findIndex(x => x.initiales === m.initiales) === i)
    .sort((a, b) => a.nom.localeCompare(b.nom));

  // Si la valeur actuelle n'est pas dans la liste (ex: legacy), on l'ajoute pour ne pas la perdre
  const valuePresente = membres.some(m => m.initiales === value);

  return (
    <div>
      <label className="block text-xs text-stone-600 mb-1">{label}</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:border-stone-900"
      >
        <option value="">— Non assigné —</option>
        {!valuePresente && value && (
          <option value={value}>{value} (actuel)</option>
        )}
        {membres.map(m => (
          <option key={m.initiales} value={m.initiales}>
            {m.nom} ({m.initiales})
          </option>
        ))}
      </select>
    </div>
  );
}
