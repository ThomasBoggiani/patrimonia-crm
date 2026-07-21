'use client';

// components/DvfComparables.jsx
// Recherche de comparables RÉELS (DVF officiel) avec paramètres ajustables,
// tableau triable, et sélection ligne par ligne. « Appliquer » remplit la
// section Comparables de l'avis de valeur à partir des ventes cochées.

import { useState } from 'react';
import { Loader2, Search, Check, ArrowUpDown, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const fmt = (n) => (n ? Number(n).toLocaleString('fr-FR') : '—');
const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m] = iso.split('-');
  return `${m}/${y}`;
};

export default function DvfComparables({ mandat, onApply }) {
  const [params, setParams] = useState({ rayon: 500, annees: 3, type: 'auto', surfaceMin: '', surfaceMax: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { geo, params, ventes, stats }
  const [selected, setSelected] = useState(new Set());
  const [sort, setSort] = useState({ key: 'distance', dir: 'asc' });

  const setP = (k, v) => setParams(p => ({ ...p, [k]: v }));

  async function rechercher() {
    if (!mandat?.id) { setError('Enregistre d\'abord le mandat.'); return; }
    setBusy(true); setError(''); setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/avis-valeur/comparables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session?.access_token || '', mandatId: mandat.id, ...params }),
      });
      const j = await res.json();
      if (!j.ok) { setError(j.error || 'Recherche impossible.'); setBusy(false); return; }
      setResult(j);
      setSelected(new Set((j.ventes || []).map(v => v.id))); // tout coché par défaut
    } catch (e) {
      setError('Erreur : ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => {
    if (!result) return;
    setSelected(s => s.size === result.ventes.length ? new Set() : new Set(result.ventes.map(v => v.id)));
  };

  const sortBy = (key) => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  const ventesTriees = result ? [...result.ventes].sort((a, b) => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    const av = a[sort.key], bv = b[sort.key];
    if (typeof av === 'string') return av.localeCompare(bv) * dir;
    return (av - bv) * dir;
  }) : [];

  const selVentes = ventesTriees.filter(v => selected.has(v.id));
  const selM2 = selVentes.map(v => v.prixM2);
  const stats = selM2.length ? {
    count: selM2.length,
    min: Math.min(...selM2),
    max: Math.max(...selM2),
    median: [...selM2].sort((a, b) => a - b)[Math.floor(selM2.length / 2)],
  } : null;

  function appliquer() {
    if (!stats) return;
    const lignes = selVentes.map(v =>
      `${v.adresse || 'Adresse n.c.'} · ${v.type} · ${v.surface} m² · ${fmt(v.prix)} € · ${fmt(v.prixM2)} €/m² · ${fmtDate(v.date)}`
    ).join('\n');
    onApply?.({
      prix_zone_min: stats.min,
      prix_zone_max: stats.max,
      transactions_recentes: lignes,
      mediane: stats.median,
      count: stats.count,
    });
  }

  const selClass = "px-2 py-1.5 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-900 bg-white";
  const Th = ({ k, children, right }) => (
    <th className={`px-2 py-1.5 text-stone-600 font-medium cursor-pointer hover:text-stone-900 ${right ? 'text-right' : 'text-left'}`} onClick={() => sortBy(k)}>
      <span className="inline-flex items-center gap-1">{children}<ArrowUpDown className="w-3 h-3 opacity-40" /></span>
    </th>
  );

  return (
    <div className="rounded-lg border border-sage-light bg-sage-50/40 p-3 space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-sage-darker">
        <MapPin className="w-3.5 h-3.5" /> Comparables réels — DVF (ventes officielles de l'État)
      </div>

      {/* Paramètres */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 text-[10px] text-stone-500">Rayon
          <select value={params.rayon} onChange={e => setP('rayon', +e.target.value)} className={selClass}>
            <option value={300}>300 m</option><option value={500}>500 m</option>
            <option value={1000}>1 km</option><option value={2000}>2 km</option><option value={3000}>3 km</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] text-stone-500">Période
          <select value={params.annees} onChange={e => setP('annees', +e.target.value)} className={selClass}>
            <option value={1}>1 an</option><option value={2}>2 ans</option><option value={3}>3 ans</option>
            <option value={4}>4 ans</option><option value={5}>5 ans</option><option value={6}>6 ans</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] text-stone-500">Type
          <select value={params.type} onChange={e => setP('type', e.target.value)} className={selClass}>
            <option value="auto">Auto (selon mandat)</option>
            <option value="Appartement">Appartement</option>
            <option value="Maison">Maison</option>
            <option value="tous">Tous</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] text-stone-500">Surface min
          <input type="number" value={params.surfaceMin} onChange={e => setP('surfaceMin', e.target.value)} placeholder="m²" className={`${selClass} w-20`} />
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] text-stone-500">Surface max
          <input type="number" value={params.surfaceMax} onChange={e => setP('surfaceMax', e.target.value)} placeholder="m²" className={`${selClass} w-20`} />
        </label>
        <button type="button" onClick={rechercher} disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-ink-deep text-white hover:bg-ink disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Rechercher
        </button>
      </div>

      {error && <div className="text-xs text-red-600">{error}</div>}

      {result && (
        <>
          <div className="text-[11px] text-stone-500">
            {result.geo?.label} · {result.ventes.length} vente(s) trouvée(s) dans un rayon de {result.params.rayon} m ({result.params.anneesInterrogees?.join(', ')})
          </div>

          {result.ventes.length === 0 ? (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              Aucune vente sur ces critères. Élargis le rayon, la période, ou passe le type sur « Tous ».
            </div>
          ) : (
            <>
              {/* Sélection courante */}
              {stats && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs bg-white rounded-lg border border-stone-200 p-2">
                  <span><b>{stats.count}</b> sélectionnée(s)</span>
                  <span>Médiane <b className="text-emerald-700">{fmt(stats.median)} €/m²</b></span>
                  <span>Min {fmt(stats.min)} €/m²</span>
                  <span>Max {fmt(stats.max)} €/m²</span>
                </div>
              )}

              {/* Tableau triable / sélectionnable */}
              <div className="max-h-72 overflow-y-auto rounded-lg border border-stone-200 bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50 border-b sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 w-8">
                        <input type="checkbox" checked={selected.size === result.ventes.length && result.ventes.length > 0} onChange={toggleAll} />
                      </th>
                      <Th k="date">Date</Th>
                      <Th k="adresse">Adresse</Th>
                      <Th k="type">Type</Th>
                      <Th k="surface" right>Surf.</Th>
                      <Th k="prix" right>Prix</Th>
                      <Th k="prixM2" right>€/m²</Th>
                      <Th k="distance" right>Dist.</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventesTriees.map(v => {
                      const on = selected.has(v.id);
                      return (
                        <tr key={v.id} className={`border-b border-stone-100 last:border-0 ${on ? '' : 'opacity-40'}`}>
                          <td className="px-2 py-1.5"><input type="checkbox" checked={on} onChange={() => toggle(v.id)} /></td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{fmtDate(v.date)}</td>
                          <td className="px-2 py-1.5 max-w-[160px] truncate" title={v.adresse}>{v.adresse || '—'}</td>
                          <td className="px-2 py-1.5">{v.type}</td>
                          <td className="px-2 py-1.5 text-right whitespace-nowrap">{v.surface} m²</td>
                          <td className="px-2 py-1.5 text-right whitespace-nowrap">{fmt(v.prix)} €</td>
                          <td className="px-2 py-1.5 text-right whitespace-nowrap font-medium">{fmt(v.prixM2)}</td>
                          <td className="px-2 py-1.5 text-right whitespace-nowrap text-stone-500">{v.distance} m</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[10px] text-stone-400 italic">Décoche les ventes non pertinentes. Clique une colonne pour trier.</p>
                <button type="button" onClick={appliquer} disabled={!stats}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-sage-dark text-white hover:bg-sage-darker disabled:opacity-50">
                  <Check className="w-3.5 h-3.5" /> Appliquer aux comparables ({stats?.count || 0})
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
