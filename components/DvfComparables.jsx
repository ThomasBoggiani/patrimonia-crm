'use client';

// components/DvfComparables.jsx
// Comparables RÉELS (DVF officiel), adaptés au marché :
//  • BtoC (habitation) : prix/m² par immeuble, périmètre serré (immeuble + voisins),
//    objectif = évolution du prix/m² PAR ANNÉE.
//  • BtoB (investissement) : périmètre large, €/m² ET €/lot, plusieurs années.
// Paramètres ajustables + tableau triable + sélection ligne par ligne.

import { useState } from 'react';
import { Loader2, Search, Check, ArrowUpDown, MapPin, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const fmt = (n) => (n || n === 0 ? Number(n).toLocaleString('fr-FR') : '—');
const fmtDate = (iso) => { if (!iso) return '—'; const [y, m] = iso.split('-'); return `${m}/${y}`; };
const mediane = (arr) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };

export default function DvfComparables({ mandat, onApply }) {
  const estB2C = (mandat?.marche) === 'b2c';

  const [params, setParams] = useState({
    perimetre: estB2C ? 'voisins' : '2000',
    annees: 5,
    type: estB2C ? 'auto' : 'tous',
    surfaceMin: '', surfaceMax: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [sort, setSort] = useState({ key: estB2C ? 'date' : 'distance', dir: estB2C ? 'desc' : 'asc' });

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
      setSelected(new Set((j.ventes || []).map(v => v.id)));
    } catch (e) { setError('Erreur : ' + e.message); }
    finally { setBusy(false); }
  }

  const toggle = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => { if (!result) return; setSelected(s => s.size === result.ventes.length ? new Set() : new Set(result.ventes.map(v => v.id))); };
  const sortBy = (key) => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  const ventesTriees = result ? [...result.ventes].sort((a, b) => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    const av = a[sort.key], bv = b[sort.key];
    if (typeof av === 'string') return String(av).localeCompare(String(bv)) * dir;
    return ((av || 0) - (bv || 0)) * dir;
  }) : [];

  const selVentes = ventesTriees.filter(v => selected.has(v.id));

  // Objectif : prix au m² PAR ANNÉE (sur la sélection)
  const parAnnee = (() => {
    const byY = {};
    for (const v of selVentes) {
      const y = (v.date || '').slice(0, 4);
      if (!y) continue;
      (byY[y] = byY[y] || []).push(v);
    }
    return Object.keys(byY).sort((a, b) => b.localeCompare(a)).map(y => {
      const vs = byY[y];
      const m2 = vs.map(v => v.prixM2);
      const parLot = vs.filter(v => v.lots > 0).map(v => Math.round(v.prix / v.lots));
      return {
        annee: y, count: vs.length,
        m2Median: mediane(m2), m2Min: Math.min(...m2), m2Max: Math.max(...m2),
        lotMedian: parLot.length ? mediane(parLot) : 0,
      };
    });
  })();

  const selM2 = selVentes.map(v => v.prixM2);
  const globalMedian = mediane(selM2);

  function appliquer() {
    if (!selVentes.length) return;
    const evolution = parAnnee.map(a => `${a.annee} : ${a.count} vente(s) · médiane ${fmt(a.m2Median)} €/m²${estB2C ? '' : ` · ${fmt(a.lotMedian)} €/lot`}`).join('\n');
    const lignes = selVentes.map(v =>
      `${v.adresse || 'Adresse n.c.'}${v.memeImmeuble ? ' (cet immeuble)' : ''} · ${v.type}${!estB2C && v.lots > 1 ? ` · ${v.lots} lots` : ''} · ${v.surface} m² · ${fmt(v.prix)} € · ${fmt(v.prixM2)} €/m² · ${fmtDate(v.date)}`
    ).join('\n');
    onApply?.({
      prix_zone_min: Math.min(...selM2),
      prix_zone_max: Math.max(...selM2),
      transactions_recentes: `Prix au m² par année (DVF) :\n${evolution}\n\nVentes retenues :\n${lignes}`,
      mediane: globalMedian,
      count: selVentes.length,
      // Liste structurée pour l'avis (tableau) + évolution par année
      ventes: selVentes.map(v => ({ date: v.date, adresse: v.adresse, type: v.type, surface: v.surface, prix: v.prix, prixM2: v.prixM2, lots: v.lots, memeImmeuble: !!v.memeImmeuble })),
      parAnnee: parAnnee.map(a => ({ annee: a.annee, count: a.count, m2Median: a.m2Median })),
    });
  }

  const selClass = "px-2 py-1.5 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-900 bg-white";
  const perimetreOptions = estB2C
    ? [{ v: 'immeuble', l: 'Cet immeuble' }, { v: 'voisins', l: 'Immeuble + voisins (~80 m)' }, { v: '300', l: 'Élargi 300 m' }, { v: '500', l: 'Quartier 500 m' }]
    : [{ v: '1000', l: '1 km' }, { v: '2000', l: '2 km' }, { v: '3000', l: '3 km' }, { v: '5000', l: '5 km' }];

  const Th = ({ k, children, right }) => (
    <th className={`px-2 py-1.5 text-stone-600 font-medium cursor-pointer hover:text-stone-900 ${right ? 'text-right' : 'text-left'}`} onClick={() => sortBy(k)}>
      <span className="inline-flex items-center gap-1">{children}<ArrowUpDown className="w-3 h-3 opacity-40" /></span>
    </th>
  );

  return (
    <div className="rounded-lg border border-sage-light bg-sage-50/40 p-3 space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-sage-darker">
        <MapPin className="w-3.5 h-3.5" /> Comparables réels — DVF (ventes officielles de l'État)
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white border border-sage-light text-stone-600">{estB2C ? 'Mode habitation : prix/m² par immeuble' : 'Mode immeuble : périmètre large, €/m² & €/lot'}</span>
      </div>

      {/* Paramètres */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 text-[10px] text-stone-500">Périmètre
          <select value={params.perimetre} onChange={e => setP('perimetre', e.target.value)} className={selClass}>
            {perimetreOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] text-stone-500">Période
          <select value={params.annees} onChange={e => setP('annees', +e.target.value)} className={selClass}>
            {[1, 2, 3, 4, 5, 6].map(y => <option key={y} value={y}>{y} an{y > 1 ? 's' : ''}</option>)}
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
            {result.geo?.label} · {result.ventes.length} vente(s){result.params?.perimetre === 'immeuble' ? ' dans cet immeuble' : ` (${result.params.rayon} m)`} · {result.params.anneesInterrogees?.join(', ')}
          </div>

          {result.ventes.length === 0 ? (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              Aucune vente sur ces critères. Élargis le périmètre, la période, ou passe le type sur « Tous ».
            </div>
          ) : (
            <>
              {/* OBJECTIF : prix au m² par année (sur la sélection) */}
              {parAnnee.length > 0 && (
                <div className="bg-white rounded-lg border border-stone-200 p-2">
                  <div className="text-[11px] font-semibold text-stone-700 mb-1.5">📈 Prix au m² par année ({selVentes.length} vente(s) — médiane globale {fmt(globalMedian)} €/m²)</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-stone-500 border-b">
                        <tr>
                          <th className="text-left px-2 py-1">Année</th>
                          <th className="text-right px-2 py-1">Ventes</th>
                          <th className="text-right px-2 py-1">Médiane €/m²</th>
                          <th className="text-right px-2 py-1">Min–Max €/m²</th>
                          {!estB2C && <th className="text-right px-2 py-1">Médiane €/lot</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {parAnnee.map(a => (
                          <tr key={a.annee} className="border-b border-stone-50 last:border-0">
                            <td className="px-2 py-1 font-medium">{a.annee}</td>
                            <td className="px-2 py-1 text-right">{a.count}</td>
                            <td className="px-2 py-1 text-right font-semibold text-emerald-700">{fmt(a.m2Median)}</td>
                            <td className="px-2 py-1 text-right text-stone-500">{fmt(a.m2Min)}–{fmt(a.m2Max)}</td>
                            {!estB2C && <td className="px-2 py-1 text-right">{a.lotMedian ? fmt(a.lotMedian) : '—'}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Détail des ventes — triable / sélectionnable */}
              <div className="max-h-64 overflow-y-auto rounded-lg border border-stone-200 bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50 border-b sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 w-8"><input type="checkbox" checked={selected.size === result.ventes.length && result.ventes.length > 0} onChange={toggleAll} /></th>
                      <Th k="date">Date</Th>
                      <Th k="adresse">Adresse</Th>
                      <Th k="type">Type</Th>
                      {!estB2C && <Th k="lots" right>Lots</Th>}
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
                        <tr key={v.id} className={`border-b border-stone-100 last:border-0 ${on ? '' : 'opacity-40'} ${v.memeImmeuble ? 'bg-sage-50/60' : ''}`}>
                          <td className="px-2 py-1.5"><input type="checkbox" checked={on} onChange={() => toggle(v.id)} /></td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{fmtDate(v.date)}</td>
                          <td className="px-2 py-1.5 max-w-[150px] truncate" title={v.adresse}>
                            {v.memeImmeuble && <Building2 className="w-3 h-3 inline mr-1 text-sage-dark" title="Cet immeuble" />}{v.adresse || '—'}
                          </td>
                          <td className="px-2 py-1.5">{v.type}</td>
                          {!estB2C && <td className="px-2 py-1.5 text-right">{v.lots || '—'}</td>}
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
                <p className="text-[10px] text-stone-400 italic">Ligne surlignée = cet immeuble. Décoche les ventes non pertinentes, clique une colonne pour trier.</p>
                <button type="button" onClick={appliquer} disabled={!selVentes.length}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-sage-dark text-white hover:bg-sage-darker disabled:opacity-50">
                  <Check className="w-3.5 h-3.5" /> Appliquer aux comparables ({selVentes.length})
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
