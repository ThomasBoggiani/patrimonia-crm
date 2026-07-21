// ═══════════════════════════════════════════════════════════════════
// app/api/avis-valeur/comparables/route.js
// Comparables RÉELS depuis DVF (Demandes de Valeurs Foncières — données
// officielles de l'État, open data). On géolocalise l'adresse du mandat (BAN),
// on télécharge les ventes de la commune (geo-dvf) sur N années, on filtre par
// rayon / type / surface, et on renvoie une liste triable + des stats €/m².
// Aucune écriture : Thomas trie, coche, puis applique à la section « Comparables ».
// ═══════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// Distance en mètres entre deux points (haversine)
function distanceM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

// Parse une ligne CSV DVF (pas de guillemets complexes dans ce dataset)
function splitCsv(line) { return line.split(','); }

// Médiane d'un tableau de nombres
function mediane(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

async function geocode(adresse) {
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&limit=1`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const j = await r.json();
  const f = j.features?.[0];
  if (!f) return null;
  return {
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    citycode: f.properties.citycode,
    departement: f.properties.context?.split(',')[0]?.trim() || f.properties.citycode?.slice(0, 2),
    label: f.properties.label,
  };
}

// Télécharge + parse les ventes d'une commune pour une année. Agrège par mutation.
async function ventesCommuneAnnee(dep, citycode, annee, idx) {
  const url = `https://files.data.gouv.fr/geo-dvf/latest/csv/${annee}/communes/${dep}/${citycode}.csv`;
  let txt;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    txt = await r.text();
  } catch { return []; }

  const lines = txt.split('\n');
  const header = splitCsv(lines[0]);
  const col = (name) => header.indexOf(name);
  const iDate = col('date_mutation'), iNature = col('nature_mutation'), iVal = col('valeur_fonciere');
  const iNum = col('adresse_numero'), iVoie = col('adresse_nom_voie'), iType = col('type_local');
  const iSurf = col('surface_reelle_bati'), iPieces = col('nombre_pieces_principales');
  const iLon = col('longitude'), iLat = col('latitude'), iId = col('id_mutation');

  // Agrégation par mutation (une vente peut couvrir plusieurs lignes bâti)
  const mut = new Map();
  for (let k = 1; k < lines.length; k++) {
    const c = splitCsv(lines[k]);
    if (c.length < header.length) continue;
    if (c[iNature] !== 'Vente') continue;
    const surf = parseFloat(c[iSurf]) || 0;
    const val = parseFloat(c[iVal]) || 0;
    const type = c[iType] || '';
    if (!type || surf <= 0 || val <= 0) continue;
    const lat = parseFloat(c[iLat]), lon = parseFloat(c[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const id = c[iId];
    const prev = mut.get(id);
    if (prev) {
      prev.surface += surf;
      prev.types.add(type);
    } else {
      mut.set(id, {
        id, date: c[iDate], valeur: val, surface: surf, types: new Set([type]),
        adresse: `${c[iNum] || ''} ${c[iVoie] || ''}`.trim(),
        pieces: parseInt(c[iPieces]) || 0, lat, lon,
      });
    }
  }

  const out = [];
  for (const m of mut.values()) {
    // On ne garde que les mutations mono-type (comparables propres)
    if (m.types.size !== 1) continue;
    const prixM2 = Math.round(m.valeur / m.surface);
    if (prixM2 < 300 || prixM2 > 60000) continue; // garde-fou anti-aberrations
    out.push({
      id: `${annee}-${idx}-${out.length}`,
      date: m.date,
      type: [...m.types][0],
      adresse: m.adresse,
      surface: Math.round(m.surface),
      pieces: m.pieces,
      prix: Math.round(m.valeur),
      prixM2,
      lat: m.lat, lon: m.lon,
    });
  }
  return out;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, mandatId } = body;
    const user = await verifyToken(token);
    if (!user) return Response.json({ ok: false, error: 'Authentification requise' }, { status: 401 });

    // Paramètres ajustables (avec valeurs par défaut)
    const rayon = Math.min(Math.max(parseInt(body.rayon) || 500, 50), 3000);      // m
    const annees = Math.min(Math.max(parseInt(body.annees) || 3, 1), 6);           // nb d'années
    const typeFiltre = body.type || 'auto';    // 'auto' | 'Appartement' | 'Maison' | 'tous'
    const surfaceMin = parseFloat(body.surfaceMin) || 0;
    const surfaceMax = parseFloat(body.surfaceMax) || 0;

    let adresse = body.adresse;
    let mandatSurface = 0, mandatType = '';
    if (mandatId) {
      const { data: m } = await supabaseAdmin.from('mandats').select('adresse, ville, code_postal, surface, type, marche').eq('id', mandatId).single();
      if (m) {
        adresse = adresse || [m.adresse, m.code_postal, m.ville].filter(Boolean).join(' ');
        mandatSurface = parseFloat(m.surface) || 0;
        mandatType = m.marche === 'b2c' ? (/[Mm]aison/.test(m.type || '') ? 'Maison' : 'Appartement') : '';
      }
    }
    if (!adresse) return Response.json({ ok: false, error: 'Adresse manquante sur le mandat.' }, { status: 400 });

    const geo = await geocode(adresse);
    if (!geo) return Response.json({ ok: false, error: `Adresse introuvable : « ${adresse} »` }, { status: 404 });

    // Type retenu : 'auto' = déduit du mandat (sinon tous)
    const typeVoulu = typeFiltre === 'auto' ? mandatType : (typeFiltre === 'tous' ? '' : typeFiltre);

    // Années à interroger : on part de l'an dernier (DVF a ~6 mois de retard)
    const anneeMax = new Date().getFullYear() - 1;
    const anneesList = [];
    for (let y = anneeMax; y > anneeMax - annees; y--) anneesList.push(y);

    const dep = geo.citycode.slice(0, 2) === '97' ? geo.citycode.slice(0, 3) : geo.citycode.slice(0, 2);
    const batches = await Promise.all(anneesList.map((y, i) => ventesCommuneAnnee(dep, geo.citycode, y, i)));
    let ventes = batches.flat();

    // Filtres
    ventes = ventes
      .map(v => ({ ...v, distance: distanceM(geo.lat, geo.lon, v.lat, v.lon) }))
      .filter(v => v.distance <= rayon)
      .filter(v => !typeVoulu || v.type === typeVoulu)
      .filter(v => !surfaceMin || v.surface >= surfaceMin)
      .filter(v => !surfaceMax || v.surface <= surfaceMax)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 60);

    const prixM2s = ventes.map(v => v.prixM2);
    const stats = prixM2s.length ? {
      count: prixM2s.length,
      prixM2Min: Math.min(...prixM2s),
      prixM2Max: Math.max(...prixM2s),
      prixM2Median: mediane(prixM2s),
    } : { count: 0 };

    return Response.json({
      ok: true,
      geo: { lat: geo.lat, lon: geo.lon, label: geo.label },
      params: { rayon, annees, type: typeVoulu || 'tous', surfaceMin, surfaceMax, anneesInterrogees: anneesList },
      mandat: { surface: mandatSurface, typeDeduit: mandatType },
      ventes,
      stats,
    });
  } catch (e) {
    console.error('[avis-valeur/comparables]', e);
    return Response.json({ ok: false, error: e.message || 'Erreur serveur' }, { status: 500 });
  }
}
