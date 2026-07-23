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
    numero: parseInt(f.properties.housenumber) || 0,
    voie: normVoie(f.properties.street || f.properties.name || ''),
    departement: f.properties.context?.split(',')[0]?.trim() || f.properties.citycode?.slice(0, 2),
    label: f.properties.label,
  };
}

// Normalise un nom de voie pour comparaison. DVF abrège (BD DU PORT) alors que
// la BAN renvoie « Boulevard du Port » : on retire l'accent, on met en majuscules,
// et on SUPPRIME le mot-type de voie en tête (BD/BOULEVARD, AV/AVENUE, RUE…) pour
// ne comparer que le nom propre (« DU PORT »).
const TYPES_VOIE = new Set(['RUE', 'R', 'BD', 'BLD', 'BOULEVARD', 'AV', 'AVE', 'AVENUE', 'ALL', 'ALLEE', 'ALLEES', 'PL', 'PLACE', 'IMP', 'IMPASSE', 'CHE', 'CHEM', 'CHEMIN', 'RTE', 'ROUTE', 'QUAI', 'QU', 'COURS', 'CRS', 'PASSAGE', 'PASS', 'PAS', 'SQUARE', 'SQ', 'VILLA', 'CITE', 'SENTE', 'SENTIER', 'RES', 'RESIDENCE', 'LOT', 'LOTISSEMENT', 'PROMENADE', 'ESPLANADE', 'FG', 'FAUBOURG']);
function normVoie(s) {
  const base = String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const toks = base.split(' ');
  if (toks.length > 1 && TYPES_VOIE.has(toks[0])) toks.shift();
  return toks.join(' ');
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
  const iLots = col('nombre_lots');
  const iLon = col('longitude'), iLat = col('latitude'), iId = col('id_mutation');

  // Agrégation par mutation (une vente peut couvrir plusieurs lignes bâti / lots)
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
      prev.nbLignes += 1;
      prev.lots = Math.max(prev.lots, parseInt(c[iLots]) || 0);
    } else {
      mut.set(id, {
        id, date: c[iDate], valeur: val, surface: surf, types: new Set([type]),
        nbLignes: 1, lots: parseInt(c[iLots]) || 0,
        numero: parseInt(c[iNum]) || 0, voie: normVoie(c[iVoie]),
        adresse: `${c[iNum] || ''} ${c[iVoie] || ''}`.trim(),
        pieces: parseInt(c[iPieces]) || 0, lat, lon,
      });
    }
  }

  const out = [];
  for (const m of mut.values()) {
    const prixM2 = Math.round(m.valeur / m.surface);
    if (prixM2 < 300 || prixM2 > 60000) continue; // garde-fou anti-aberrations
    const typesArr = [...m.types];
    // Nb de lots = le plus fiable entre le champ nombre_lots et le nb de lignes bâti
    const lots = Math.max(m.lots, m.nbLignes);
    out.push({
      id: `${annee}-${idx}-${out.length}`,
      date: m.date,
      type: typesArr.length > 1 ? 'Immeuble / mixte' : typesArr[0],
      monoType: typesArr.length === 1,
      lots,
      adresse: m.adresse,
      numero: m.numero, voie: m.voie,
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

    // Périmètre : 'immeuble' (même n° + voie), 'voisins' (rayon serré), ou rayon libre.
    const perimetre = body.perimetre || 'auto';
    const annees = Math.min(Math.max(parseInt(body.annees) || 3, 1), 6);           // nb d'années
    const typeFiltre = body.type || 'auto';    // 'auto' | 'Appartement' | 'Maison' | 'tous'
    const surfaceMin = parseFloat(body.surfaceMin) || 0;
    const surfaceMax = parseFloat(body.surfaceMax) || 0;

    let adresse = body.adresse;
    let mandatSurface = 0, mandatType = '', estB2C = false;
    if (mandatId) {
      const { data: m } = await supabaseAdmin.from('mandats').select('adresse, ville, code_postal, surface, type, marche').eq('id', mandatId).single();
      if (m) {
        adresse = adresse || [m.adresse, m.code_postal, m.ville].filter(Boolean).join(' ');
        mandatSurface = parseFloat(m.surface) || 0;
        estB2C = m.marche === 'b2c';
        mandatType = estB2C ? (/[Mm]aison/.test(m.type || '') ? 'Maison' : 'Appartement') : '';
      }
    }
    if (!adresse) return Response.json({ ok: false, error: 'Adresse manquante sur le mandat.' }, { status: 400 });

    const geo = await geocode(adresse);
    if (!geo) return Response.json({ ok: false, error: `Adresse introuvable : « ${adresse} »` }, { status: 404 });

    // Rayon effectif selon le périmètre (BtoC = serré, BtoB = large par défaut)
    const perimetreEff = perimetre === 'auto' ? (estB2C ? 'voisins' : '2000') : perimetre;
    const onlyImmeuble = perimetreEff === 'immeuble';
    const rayon = onlyImmeuble ? 30      // même immeuble = même parcelle (coords ~identiques)
      : perimetreEff === 'voisins' ? 80
      : Math.min(Math.max(parseInt(perimetreEff) || 500, 50), 5000);

    // Type retenu : 'auto' = déduit du mandat (sinon tous)
    const typeVoulu = typeFiltre === 'auto' ? mandatType : (typeFiltre === 'tous' ? '' : typeFiltre);

    // Années à interroger : on part de l'ANNÉE EN COURS (si son fichier DVF n'est
    // pas encore publié, il renvoie 404 et est ignoré proprement) et on descend.
    // On interroge une année de plus que demandé, pour toujours obtenir la
    // profondeur voulue même quand l'année la plus récente n'existe pas encore.
    const anneeMax = new Date().getFullYear();
    const anneesList = [];
    for (let y = anneeMax; y > anneeMax - (annees + 1); y--) anneesList.push(y);

    const dep = geo.citycode.slice(0, 2) === '97' ? geo.citycode.slice(0, 3) : geo.citycode.slice(0, 2);
    const batches = await Promise.all(anneesList.map((y, i) => ventesCommuneAnnee(dep, geo.citycode, y, i)));
    let ventes = batches.flat();

    // Tag « même immeuble » / « même rue ». Le signal fiable est la DISTANCE
    // (coords DVF au niveau de la parcelle) ; le n°/voie normalisés confirment.
    ventes = ventes.map(v => {
      const distance = distanceM(geo.lat, geo.lon, v.lat, v.lon);
      const memeRue = !!geo.voie && v.voie === geo.voie;
      const memeImmeuble = distance <= 25 || (memeRue && geo.numero > 0 && v.numero === geo.numero);
      return { ...v, distance, memeRue, memeImmeuble };
    });

    // Filtres
    ventes = ventes
      .filter(v => onlyImmeuble ? v.memeImmeuble : v.distance <= rayon)
      .filter(v => !typeVoulu || v.type === typeVoulu)
      .filter(v => !surfaceMin || v.surface >= surfaceMin)
      .filter(v => !surfaceMax || v.surface <= surfaceMax)
      .sort((a, b) => a.distance - b.distance || a.date.localeCompare(b.date))
      .slice(0, 120);

    return Response.json({
      ok: true,
      geo: { lat: geo.lat, lon: geo.lon, label: geo.label, numero: geo.numero, voie: geo.voie },
      params: { perimetre: perimetreEff, rayon, annees, type: typeVoulu || 'tous', surfaceMin, surfaceMax, anneesInterrogees: anneesList },
      mandat: { surface: mandatSurface, typeDeduit: mandatType, estB2C },
      ventes,
    });
  } catch (e) {
    console.error('[avis-valeur/comparables]', e);
    return Response.json({ ok: false, error: e.message || 'Erreur serveur' }, { status: 500 });
  }
}
