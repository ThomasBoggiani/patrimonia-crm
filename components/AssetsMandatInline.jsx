// ═══════════════════════════════════════════════════════════════════
// components/AssetsMandatInline.jsx — v2
// Section "Vues du bien (cache)" sur la fiche mandat :
// - 6 vues : Street View, Plan situation, Satellite (+marker), Cadastre, Parcelle, Transports
// - Section quartier : commerces, écoles, parcs, santé, culture
// - Section risques : risques naturels Géorisques
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useRef } from 'react';
import { getLineBadge } from '@/lib/transit-colors';

function parseLines(linesStr) {
  if (!linesStr) return [];
  return String(linesStr).split(/[,;\s|]/).map(s => s.trim()).filter(Boolean);
}

function walkingTime(meters) {
  const min = Math.round(meters / 80);
  if (min < 1) return '< 1 min';
  return `${min} min`;
}

// Icônes pour les catégories de commodités
const AMENITY_LABELS = {
  commerces: { label: 'Commerces', icon: '🛍️' },
  restaurants: { label: 'Restaurants & cafés', icon: '🍽️' },
  ecoles: { label: 'Écoles', icon: '🎓' },
  sante: { label: 'Santé', icon: '⚕️' },
  culture: { label: 'Culture', icon: '🎭' },
  parcs: { label: 'Espaces verts', icon: '🌳' },
};

// Traductions des types OSM en FR
const TYPE_FR = {
  // Shops
  supermarket: 'Supermarché',
  convenience: 'Épicerie',
  bakery: 'Boulangerie',
  butcher: 'Boucherie',
  greengrocer: 'Primeur',
  clothes: 'Vêtements',
  hairdresser: 'Coiffeur',
  florist: 'Fleuriste',
  optician: 'Opticien',
  jewelry: 'Bijouterie',
  shoes: 'Chaussures',
  books: 'Librairie',
  bicycle: 'Vélo',
  // Amenity
  restaurant: 'Restaurant',
  cafe: 'Café',
  bar: 'Bar',
  fast_food: 'Restauration rapide',
  school: 'École',
  kindergarten: 'Crèche',
  college: 'Collège',
  university: 'Université',
  pharmacy: 'Pharmacie',
  hospital: 'Hôpital',
  clinic: 'Clinique',
  doctors: 'Médecin',
  dentist: 'Dentiste',
  cinema: 'Cinéma',
  theatre: 'Théâtre',
  library: 'Bibliothèque',
  arts_centre: 'Centre culturel',
  museum: 'Musée',
  park: 'Parc',
  garden: 'Jardin',
  playground: 'Aire de jeux',
};

export default function AssetsMandatInline({ mandat, reload }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Sprint 4 — C2 : génération AUTO des vues/risques au 1er affichage si adresse présente
  const autoTriedRef = useRef(null);

  const generatedAt = mandat?.assetsGeneratedAt || mandat?.assets_generated_at;
  const cacheBuster = generatedAt ? `?v=${new Date(generatedAt).getTime()}` : '';

  const satRaw = mandat?.satelliteImageUrl || mandat?.satellite_image_url;
  const cadRaw = mandat?.cadastreImageUrl || mandat?.cadastre_image_url;
  const svRaw = mandat?.streetViewImageUrl || mandat?.street_view_image_url;
  const mapRaw = mandat?.mapStaticImageUrl || mandat?.map_static_image_url;

  const satellite = satRaw ? satRaw + cacheBuster : null;
  const cadastre = cadRaw ? cadRaw + cacheBuster : null;
  const streetView = svRaw ? svRaw + cacheBuster : null;
  const mapStatic = mapRaw ? mapRaw + cacheBuster : null;
  const parcelle = mandat?.parcelleData || mandat?.parcelle_data;
  const transports = mandat?.transportsData || mandat?.transports_data;
  const quartier = mandat?.quartierData || mandat?.quartier_data;
  const risques = mandat?.risquesData || mandat?.risques_data;

  const hasAnyAsset = !!(satellite || cadastre || parcelle || transports);
  const transportsCount = transports ?
    (transports.metro?.length || 0) + (transports.rer?.length || 0) +
    (transports.tram?.length || 0) + (transports.bus?.length || 0)
    : 0;

  const quartierTotalCount = quartier ?
    Object.values(quartier).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0)
    : 0;

  async function regenerate() {
    setLoading(true);
    setError(null);
    try {
      const { supabase } = await import('@/lib/supabase');
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

  // Génère les assets automatiquement la 1re fois : mandat avec adresse mais jamais généré.
  // Garde-fou autoTriedRef (1 essai par mandat) pour éviter toute boucle.
  useEffect(() => {
    if (mandat?.id && mandat?.adresse && !generatedAt && !loading && autoTriedRef.current !== mandat.id) {
      autoTriedRef.current = mandat.id;
      regenerate();
    }
  }, [mandat?.id, mandat?.adresse, generatedAt]);

  return (
    <div id="assets" className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark scroll-mt-32">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
          📍 Vues du bien (cache)
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white hover:bg-stone-50 disabled:opacity-40 transition"
            style={{ borderColor: '#A0B0A0', color: '#3d4d3d' }}
          >
            {loading ? '⏳ Génération…' : (hasAnyAsset ? '🔄 Régénérer' : '✨ Générer')}
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

      {/* ─── BLOC 1 : Vues photo + cadastre + parcelle + transports ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {/* Street View */}
        <AssetCard
          title="Façade (Street View)"
          icon="📷"
          imageUrl={streetView}
        />

        {/* Plan situation */}
        <AssetCard
          title="Plan de situation"
          icon="📍"
          imageUrl={mapStatic}
        />

        {/* Vue satellite avec marker overlay */}
        <div className="border border-cream-dark rounded-lg overflow-hidden bg-cream-50">
          <div className="flex items-center gap-1.5 text-stone-500 text-[10px] uppercase tracking-wide font-semibold p-2 border-b border-cream-dark">
            🛰️ Vue satellite {satellite ? '✓' : ''}
          </div>
          <div className="relative aspect-square bg-stone-100 flex items-center justify-center">
            {satellite ? (
              <>
                <img src={satellite} alt="Vue satellite" className="w-full h-full object-cover" />
                <div className="absolute top-1/2 left-1/2 pointer-events-none" style={{ transform: 'translate(-50%, -100%)' }}>
                  <div style={{ width: 24, height: 24, background: '#dc2626', border: '2px solid white', borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
                    <div style={{ width: 8, height: 8, background: 'white', borderRadius: '50%', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%) rotate(45deg)' }}></div>
                  </div>
                </div>
              </>
            ) : (
              <span className="text-[11px] text-stone-400 italic">Non générée</span>
            )}
          </div>
        </div>

        {/* Cadastre */}
        <AssetCard
          title="Cadastre"
          icon="🗺️"
          imageUrl={cadastre}
        />

        {/* Parcelle */}
        <div className="border border-cream-dark rounded-lg overflow-hidden bg-cream-50 p-3">
          <div className="flex items-center gap-1.5 text-stone-500 text-[10px] uppercase tracking-wide font-semibold mb-2">
            📐 Parcelle {parcelle ? '✓' : ''}
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
            🚇 Transports {transportsCount > 0 ? '✓' : ''}
          </div>
          {transports && transportsCount > 0 ? (
            <>
              <div className="text-[11px] space-y-1 mb-3">
                {transports.metro?.length > 0 && <div><span className="text-stone-500">Métro :</span> <span className="font-medium">{transports.metro.length}</span></div>}
                {transports.rer?.length > 0 && <div><span className="text-stone-500">RER :</span> <span className="font-medium">{transports.rer.length}</span></div>}
                {transports.tram?.length > 0 && <div><span className="text-stone-500">Tram :</span> <span className="font-medium">{transports.tram.length}</span></div>}
                {transports.bus?.length > 0 && <div><span className="text-stone-500">Bus :</span> <span className="font-medium">{transports.bus.length}</span></div>}
              </div>
              <div className="border-t border-cream pt-2 space-y-1.5 max-h-[260px] overflow-y-auto">
                {(() => {
                  const stations = [];
                  (transports.metro || []).forEach(s => stations.push({ ...s, mode: 'metro' }));
                  (transports.rer || []).forEach(s => stations.push({ ...s, mode: 'rer' }));
                  (transports.tram || []).forEach(s => stations.push({ ...s, mode: 'tram' }));
                  stations.sort((a, b) => a.distance - b.distance);
                  return stations.slice(0, 8).map((s, i) => {
                    const lines = parseLines(s.lines);
                    return (
                      <div key={i} className="flex items-center gap-1.5 text-[10px]">
                        <div className="flex gap-0.5 flex-shrink-0">
                          {lines.length > 0 ? lines.slice(0, 4).map((l, j) => {
                            const c = getLineBadge(l, s.mode);
                            return (
                              <span key={j} style={{ backgroundColor: c.bg, color: c.fg }} className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded font-bold text-[9px]">
                                {l}
                              </span>
                            );
                          }) : (
                            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded font-bold text-[9px] bg-stone-300 text-stone-700">
                              {s.mode === 'metro' ? 'M' : s.mode === 'rer' ? 'R' : 'T'}
                            </span>
                          )}
                        </div>
                        <span className="font-medium text-stone-700 truncate flex-1">{s.name}</span>
                        <span className="text-stone-500 flex-shrink-0">{walkingTime(s.distance)}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </>
          ) : (
            <div className="text-[11px] text-stone-400 italic">Non générés</div>
          )}
        </div>
      </div>

      {/* ─── BLOC 2 : Diagnostic quartier ─── */}
      {quartier && quartierTotalCount > 0 && (
        <div className="border border-cream-dark rounded-lg p-3 mb-4">
          <div className="flex items-center gap-1.5 text-stone-500 text-[10px] uppercase tracking-wide font-semibold mb-3">
            🏘️ Diagnostic du quartier (rayon 500 m) — {quartierTotalCount} équipements
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(AMENITY_LABELS).map(([k, meta]) => {
              const items = quartier[k] || [];
              if (items.length === 0) return null;
              return (
                <div key={k} className="bg-cream-50 rounded p-2.5">
                  <div className="text-[10px] font-semibold text-stone-700 mb-1.5 flex items-center gap-1">
                    {meta.icon} {meta.label}
                    <span className="ml-auto text-stone-500 font-normal">{items.length}</span>
                  </div>
                  <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
                    {items.slice(0, 5).map((item, i) => (
                      <div key={i} className="text-[10px] text-stone-600 flex items-center justify-between gap-1">
                        <span className="truncate flex-1" title={TYPE_FR[item.type] || item.type}>
                          {item.name}
                        </span>
                        <span className="text-stone-400 flex-shrink-0">{item.distance}m</span>
                      </div>
                    ))}
                    {items.length > 5 && (
                      <div className="text-[9px] text-stone-400 italic">+{items.length - 5} autres</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── BLOC 3 : Risques naturels ─── */}
      {risques && (
        <div className="border border-cream-dark rounded-lg p-3 mb-4">
          <div className="flex items-center gap-1.5 text-stone-500 text-[10px] uppercase tracking-wide font-semibold mb-3">
            ⚠️ Risques naturels (Géorisques)
          </div>
          <RisquesPanel risques={risques} />
        </div>
      )}

      <div className="pt-3 border-t border-cream text-[11px] text-stone-500 leading-snug">
        ⓘ Ces vues sont utilisées dans la plaquette commerciale et l'avis de valeur. Une fois générées, elles sont stockées pour éviter de relancer les appels externes à chaque document.
      </div>
    </div>
  );
}

function AssetCard({ title, icon, imageUrl }) {
  return (
    <div className="border border-cream-dark rounded-lg overflow-hidden bg-cream-50">
      <div className="flex items-center gap-1.5 text-stone-500 text-[10px] uppercase tracking-wide font-semibold p-2 border-b border-cream-dark">
        {icon} {title} {imageUrl ? '✓' : ''}
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

// ─── Panel d'affichage des risques ───
function RisquesPanel({ risques }) {
  // L'API Géorisques retourne un objet avec différentes propriétés selon les risques détectés
  // On affiche ce qu'on trouve dans l'objet
  if (!risques || typeof risques !== 'object') {
    return <div className="text-[11px] text-stone-400 italic">Aucune donnée</div>;
  }

  const items = [];

  // Risques inondations
  if (Array.isArray(risques.inondations) && risques.inondations.length > 0) {
    items.push({ label: 'Inondations', value: `${risques.inondations.length} zone(s) référencée(s)`, severity: 'warn' });
  }
  if (risques.risquesNaturels?.inondation || risques.inondation) {
    items.push({ label: 'Inondation', value: 'Risque référencé', severity: 'warn' });
  }

  // Sismicité
  if (risques.sismicite || risques.zonage_sismique) {
    const zone = risques.sismicite?.zone || risques.zonage_sismique?.zone;
    items.push({ label: 'Sismicité', value: zone ? `Zone ${zone}` : 'Référencée', severity: 'info' });
  }

  // Retrait-gonflement argiles
  if (risques.argiles || risques.retrait_gonflement_argile || risques.retraitGonflementArgile) {
    const niv = risques.argiles?.niveau || risques.retrait_gonflement_argile?.niveau || risques.retraitGonflementArgile?.niveau;
    items.push({ label: 'Retrait-gonflement argiles', value: niv || 'Référencé', severity: 'warn' });
  }

  // Radon
  if (risques.radon || risques.potentielRadon) {
    const cat = risques.radon?.categorie || risques.potentielRadon?.categorie;
    items.push({ label: 'Radon', value: cat ? `Catégorie ${cat}` : 'Référencé', severity: 'info' });
  }

  // ICPE
  if (Array.isArray(risques.icpe) && risques.icpe.length > 0) {
    items.push({ label: 'ICPE', value: `${risques.icpe.length} installation(s)`, severity: 'warn' });
  }

  // Si rien de connu, on affiche les clés brutes
  if (items.length === 0) {
    const keys = Object.keys(risques).filter(k => risques[k]);
    if (keys.length === 0) {
      return <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">✓ Aucun risque majeur référencé à cette adresse</div>;
    }
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {keys.slice(0, 6).map((k, i) => (
          <div key={i} className="bg-cream-50 rounded p-2">
            <div className="text-[10px] font-semibold text-stone-700 capitalize">{k.replace(/_/g, ' ')}</div>
            <div className="text-[10px] text-stone-500 mt-0.5">Référencé</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {items.map((item, i) => (
        <div
          key={i}
          className={`rounded p-2 ${
            item.severity === 'warn'
              ? 'bg-amber-50 border border-amber-200'
              : 'bg-blue-50 border border-blue-200'
          }`}
        >
          <div className={`text-[10px] font-semibold ${item.severity === 'warn' ? 'text-amber-800' : 'text-blue-800'}`}>
            {item.label}
          </div>
          <div className={`text-[10px] mt-0.5 ${item.severity === 'warn' ? 'text-amber-700' : 'text-blue-700'}`}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
