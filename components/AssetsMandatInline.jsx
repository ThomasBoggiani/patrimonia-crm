// ═══════════════════════════════════════════════════════════════════
// components/AssetsMandatInline.jsx — v1
// Section "Assets externes" sur la fiche mandat :
// - Vue satellite (Maptiler)
// - Vue cadastre (IGN)
// - Parcelle cadastrale
// - Transports à proximité
//
// Permet de régénérer en cliquant sur le bouton "Régénérer les assets".
// Les assets sont stockés sur le mandat pour être réutilisés sur tous les documents.
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
// Couleurs officielles des lignes RATP/SNCF
const RATP_COLORS = {
  // Métro
  'M1': { bg: '#FFCD00', fg: '#000' },
  'M2': { bg: '#0064B0', fg: '#fff' },
  'M3': { bg: '#9F9825', fg: '#fff' },
  'M3bis': { bg: '#98D4E2', fg: '#000' },
  'M4': { bg: '#C04191', fg: '#fff' },
  'M5': { bg: '#F28E42', fg: '#fff' },
  'M6': { bg: '#83C491', fg: '#000' },
  'M7': { bg: '#F3A4BA', fg: '#000' },
  'M7bis': { bg: '#83C491', fg: '#000' },
  'M8': { bg: '#CEADD2', fg: '#000' },
  'M9': { bg: '#D5C900', fg: '#000' },
  'M10': { bg: '#E3B32A', fg: '#000' },
  'M11': { bg: '#8D5E2A', fg: '#fff' },
  'M12': { bg: '#00814F', fg: '#fff' },
  'M13': { bg: '#98D4E2', fg: '#000' },
  'M14': { bg: '#662483', fg: '#fff' },
  'M15': { bg: '#B90845', fg: '#fff' },
  'M16': { bg: '#F3A4BA', fg: '#000' },
  'M17': { bg: '#D5C900', fg: '#000' },
  'M18': { bg: '#00A88F', fg: '#fff' },
  // RER
  'A': { bg: '#E2231A', fg: '#fff' },
  'B': { bg: '#427DBD', fg: '#fff' },
  'C': { bg: '#FCD946', fg: '#000' },
  'D': { bg: '#00643C', fg: '#fff' },
  'E': { bg: '#C9910D', fg: '#fff' },
  // Tram (sample)
  'T1': { bg: '#0064B0', fg: '#fff' },
  'T2': { bg: '#B90845', fg: '#fff' },
  'T3a': { bg: '#FF7E2E', fg: '#fff' },
  'T3b': { bg: '#FF7E2E', fg: '#fff' },
  'T4': { bg: '#E2231A', fg: '#fff' },
  'T5': { bg: '#662483', fg: '#fff' },
  'T6': { bg: '#9F9825', fg: '#fff' },
  'T7': { bg: '#9F9825', fg: '#fff' },
  'T8': { bg: '#0064B0', fg: '#fff' },
  'T9': { bg: '#B90845', fg: '#fff' },
  'T11': { bg: '#00814F', fg: '#fff' },
  'T13': { bg: '#FF7E2E', fg: '#fff' },
};

function parseLines(linesStr) {
  if (!linesStr) return [];
  return String(linesStr).split(/[,;\s|]/).map(s => s.trim()).filter(Boolean);
}

function getLineBadgeStyle(line, mode) {
  // Métro : on tente "M{numero}"
  if (mode === 'metro') {
    const key = `M${line}`;
    if (RATP_COLORS[key]) return RATP_COLORS[key];
  }
  if (mode === 'rer') {
    if (RATP_COLORS[line]) return RATP_COLORS[line];
  }
  if (mode === 'tram') {
    const key = line.startsWith('T') ? line : `T${line}`;
    if (RATP_COLORS[key]) return RATP_COLORS[key];
  }
  return { bg: '#888', fg: '#fff' };
}

function formatDistance(meters) {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function walkingTime(meters) {
  // ~80m/min en marche normale
  const min = Math.round(meters / 80);
  if (min < 1) return '< 1 min';
  return `${min} min`;
}
import { MapPin, RefreshCw, Image as ImageIcon, Layers, Train, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AssetsMandatInline({ mandat, reload }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const satellite = mandat?.satelliteImageUrl || mandat?.satellite_image_url;
  const cadastre = mandat?.cadastreImageUrl || mandat?.cadastre_image_url;
  const streetView = mandat?.streetViewImageUrl || mandat?.street_view_image_url;
  const mapStatic = mandat?.mapStaticImageUrl || mandat?.map_static_image_url;
  const parcelle = mandat?.parcelleData || mandat?.parcelle_data;
  const transports = mandat?.transportsData || mandat?.transports_data;
  const generatedAt = mandat?.assetsGeneratedAt || mandat?.assets_generated_at;

  const hasAnyAsset = !!(satellite || cadastre || parcelle || transports);
  const transportsCount = transports ?
    (transports.metro?.length || 0) + (transports.rer?.length || 0) +
    (transports.tram?.length || 0) + (transports.bus?.length || 0)
    : 0;

  async function regenerate() {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Session expirée');
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/mandats/${mandat.id}/refresh-assets`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Erreur génération');
        setLoading(false);
        return;
      }

      if (reload) await reload();
      setLoading(false);
    } catch (e) {
      console.error('[AssetsMandatInline] Erreur:', e);
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div id="assets" className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark scroll-mt-32">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-sage-dark" />
          Vues du bien (cache)
        </h2>
        <div className="flex items-center gap-3">
          {generatedAt && (
            <span className="text-xs text-stone-500">
              Généré le {new Date(generatedAt).toLocaleDateString('fr-FR')}
            </span>
          )}
          <button
            onClick={regenerate}
            disabled={loading || !mandat?.adresse}
            title={!mandat?.adresse ? 'Adresse requise' : 'Régénérer toutes les vues'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-sage-light bg-white text-sage-darker hover:bg-sage-50 disabled:opacity-40 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Génération…' : (hasAnyAsset ? 'Régénérer' : 'Générer')}
          </button>
        </div>
      </div>

      {!mandat?.adresse && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
          ⚠ Saisis d'abord l'adresse du bien pour pouvoir générer les vues.
        </div>
      )}

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          ⚠ {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Street View - façade depuis la rue */}
        <AssetCard
          title="Façade (Street View)"
          icon={<ImageIcon className="w-4 h-4" />}
          imageUrl={streetView}
        />

        {/* Plan de situation - carte du quartier */}
        <AssetCard
          title="Plan de situation"
          icon={<MapPin className="w-4 h-4" />}
          imageUrl={mapStatic}
        />

        {/* Vue satellite */}
        <AssetCard
          title="Vue satellite"
          icon={<ImageIcon className="w-4 h-4" />}
          imageUrl={satellite}
        />

        {/* Cadastre */}
        <AssetCard
          title="Cadastre"
          icon={<Layers className="w-4 h-4" />}
          imageUrl={cadastre}
        />

        {/* Parcelle */}
        <div className="border border-cream-dark rounded-lg overflow-hidden bg-cream-50 p-3">
          <div className="flex items-center gap-1.5 text-stone-500 text-[10px] uppercase tracking-wide font-semibold mb-2">
            <Layers className="w-4 h-4" />
            Parcelle
            {parcelle ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <AlertCircle className="w-3 h-3 text-stone-300" />}
          </div>
          {parcelle ? (
            <div className="text-[11px] space-y-1">
              {parcelle.commune && <div><span className="text-stone-500">Commune :</span> <span className="font-medium">{parcelle.commune}</span></div>}
              {parcelle.section && <div><span className="text-stone-500">Section :</span> <span className="font-medium">{parcelle.section}</span></div>}
              {parcelle.numero && <div><span className="text-stone-500">N° :</span> <span className="font-medium">{parcelle.numero}</span></div>}
              {parcelle.contenance && <div><span className="text-stone-500">Contenance :</span> <span className="font-medium">{parcelle.contenance.toLocaleString('fr-FR')} m²</span></div>}
            </div>
          ) : (
            <div className="text-[11px] text-stone-400 italic">Non générée</div>
          )}
        </div>

        {/* Transports */}
        <div className="border border-cream-dark rounded-lg overflow-hidden bg-cream-50 p-3">
          <div className="flex items-center gap-1.5 text-stone-500 text-[10px] uppercase tracking-wide font-semibold mb-2">
            <Train className="w-4 h-4" />
            Transports
            {transportsCount > 0 ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <AlertCircle className="w-3 h-3 text-stone-300" />}
          </div>
          {transports && transportsCount > 0 ? (
            <div className="text-[11px] space-y-1">
              {transports.metro?.length > 0 && <div><span className="text-stone-500">Métro :</span> <span className="font-medium">{transports.metro.length}</span></div>}
              {transports.rer?.length > 0 && <div><span className="text-stone-500">RER :</span> <span className="font-medium">{transports.rer.length}</span></div>}
              {transports.tram?.length > 0 && <div><span className="text-stone-500">Tram :</span> <span className="font-medium">{transports.tram.length}</span></div>}
              {transports.bus?.length > 0 && <div><span className="text-stone-500">Bus :</span> <span className="font-medium">{transports.bus.length}</span></div>}
            </div>
          ) : (
            <div className="text-[11px] text-stone-400 italic">Non générés</div>
          )}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-cream text-[11px] text-stone-500 leading-snug">
        ⓘ Ces vues sont utilisées dans la plaquette commerciale et l'avis de valeur. Une fois générées, elles sont stockées pour éviter de relancer les appels externes à chaque document.
      </div>
    </div>
  );
}

function AssetCard({ title, icon, imageUrl }) {
  return (
    <div className="border border-cream-dark rounded-lg overflow-hidden bg-cream-50">
      <div className="flex items-center gap-1.5 text-stone-500 text-[10px] uppercase tracking-wide font-semibold p-2 border-b border-cream-dark">
        {icon}
        {title}
        {imageUrl ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <AlertCircle className="w-3 h-3 text-stone-300" />}
      </div>
      <div className="relative aspect-square bg-stone-100 flex items-center justify-center">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[11px] text-stone-400 italic">Non générée</span>
        )}
      </div>
    </div>
  );
}
