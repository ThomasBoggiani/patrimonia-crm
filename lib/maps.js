// lib/maps.js
// Helpers pour vue satellite Google Maps + cadastre.gouv.fr

// ─────────────────────────────────────────────────────────
// 1. Géocodage via api-adresse.data.gouv.fr (gratuit, illimité)
// Renvoie { lat, lng } ou null si non trouvé
// ─────────────────────────────────────────────────────────
export async function geocodeAddress(address) {
  if (!address || !address.trim()) return null;
  try {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return null;
    const [lng, lat] = feature.geometry.coordinates;
    return { lat, lng, score: feature.properties.score, label: feature.properties.label };
  } catch (e) {
    console.warn('[geocodeAddress]', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// 2. URL Maptiler satellite tiles
// ─────────────────────────────────────────────────────────
export function googleSatelliteUrl({ lat, lng, zoom = 18, width = 600, height = 400 }) {
  const apiKey = '3sSbFtNdrbvQH1IqKh4h';
  const z = Math.min(zoom, 17);
  function lat2tile(lat, zoom) {
    return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  }
  function lng2tile(lng, zoom) {
    return Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
  }
  const x = lng2tile(lng, z);
  const y = lat2tile(lat, z);
  return `https://api.maptiler.com/tiles/satellite-v2/${z}/${x}/${y}.jpg?key=${apiKey}`;
}

// ─────────────────────────────────────────────────────────
// 3. URL Cadastre IGN (WMS)
// ─────────────────────────────────────────────────────────
export function cadastreUrl({ lat, lng, width = 600, height = 400, zoom = 18, bbox = null }) {
  let minLat, maxLat, minLng, maxLng;
  if (bbox) {
    const padLat = (bbox.maxLat - bbox.minLat) * 2.5;
    const padLng = (bbox.maxLng - bbox.minLng) * 2.5;
    minLat = bbox.minLat - padLat;
    maxLat = bbox.maxLat + padLat;
    minLng = bbox.minLng - padLng;
    maxLng = bbox.maxLng + padLng;
  } else {
    const span = 0.0004;
    minLat = lat - span;
    maxLat = lat + span;
    minLng = lng - span;
    maxLng = lng + span;
  }

  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    LAYERS: 'CADASTRALPARCELS.PARCELLAIRE_EXPRESS',
    STYLES: '',
    CRS: 'EPSG:4326',
    BBOX: `${minLat},${minLng},${maxLat},${maxLng}`,
    WIDTH: String(width),
    HEIGHT: String(height),
    FORMAT: 'image/png',
    TRANSPARENT: 'false'
  });

  return `https://data.geopf.fr/wms-r/wms?${params.toString()}`;
}

// ─────────────────────────────────────────────────────────
// 3bis. URL Google Street View Static (façade depuis la rue)
// ─────────────────────────────────────────────────────────
export function googleStreetViewUrl({ lat, lng, width = 640, height = 400, heading = null, fov = 80, pitch = 10 }) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  const params = new URLSearchParams({
    size: `${width}x${height}`,
    location: `${lat},${lng}`,
    fov: String(fov),
    pitch: String(pitch),
    key: apiKey,
  });
  if (heading !== null) params.set('heading', String(heading));
  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
}

// ─────────────────────────────────────────────────────────
// 3ter. URL Google Maps Static (plan de situation quartier)
// ─────────────────────────────────────────────────────────
export function googleMapStaticUrl({ lat, lng, width = 640, height = 400, zoom = 15, mapType = 'roadmap' }) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: String(zoom),
    size: `${width}x${height}`,
    scale: '2',
    maptype: mapType,
    markers: `color:red|${lat},${lng}`,
    key: apiKey,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

// ─────────────────────────────────────────────────────────
// 4. Fetch image as base64
// ─────────────────────────────────────────────────────────
export async function fetchImageAsBase64(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[fetchImageAsBase64] HTTP', res.status, 'for', url.slice(0, 80));
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (e) {
    console.warn('[fetchImageAsBase64]', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// 5. Parcelle cadastrale IGN apicarto + bbox
// ─────────────────────────────────────────────────────────
export async function getCadastreParcelle({ lat, lng }) {
  if (!lat || !lng) return null;
  try {
    const geom = encodeURIComponent(JSON.stringify({ type: 'Point', coordinates: [lng, lat] }));
    const url = `https://apicarto.ign.fr/api/cadastre/parcelle?geom=${geom}&_limit=1`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[getCadastreParcelle] HTTP', res.status);
      return null;
    }
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return null;
    const p = feature.properties;

    let bbox = null;
    if (feature.geometry && feature.geometry.coordinates) {
      const coords = [];
      function extractCoords(arr) {
        if (typeof arr[0] === 'number') {
          coords.push(arr);
        } else {
          arr.forEach(extractCoords);
        }
      }
      extractCoords(feature.geometry.coordinates);
      if (coords.length > 0) {
        const lngs = coords.map(c => c[0]);
        const lats = coords.map(c => c[1]);
        bbox = {
          minLng: Math.min(...lngs),
          maxLng: Math.max(...lngs),
          minLat: Math.min(...lats),
          maxLat: Math.max(...lats),
        };
      }
    }

    return {
      commune: p.nom_com || p.commune || null,
      codeCommune: p.code_com || p.code_insee || null,
      codeDepartement: p.code_dep || null,
      prefixe: p.com_abs || p.prefixe || null,
      section: p.section || null,
      numero: p.numero || null,
      contenance: p.contenance || null,
      idu: p.idu || null,
      bbox,
    };
  } catch (e) {
    console.warn('[getCadastreParcelle]', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// 6. Transports en commun via OSM Overpass
// ─────────────────────────────────────────────────────────
export async function getNearbyTransports({ lat, lng, radius = 500 }) {
  if (!lat || !lng) return { metro: [], bus: [], rer: [], tram: [] };

  function distance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  }

  const query = `
    [out:json][timeout:25];
    (
      node["railway"="station"](around:${radius},${lat},${lng});
      node["railway"="subway_entrance"](around:${radius},${lat},${lng});
      node["public_transport"="station"](around:${radius},${lat},${lng});
      node["public_transport"="stop_position"](around:${radius},${lat},${lng});
      node["highway"="bus_stop"](around:${radius},${lat},${lng});
    );
    out body;
  `.trim();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'PatrimoniaCRM/1.0 (contact@patrimonia.com)'
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn('[getNearbyTransports] HTTP', res.status);
      return { metro: [], bus: [], rer: [], tram: [] };
    }
    const data = await res.json();
    const elements = data.elements || [];
    console.log('[getNearbyTransports] Overpass returned', elements.length, 'elements');

    const result = { metro: {}, bus: {}, rer: {}, tram: {} };

    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name || tags['name:fr'] || null;
      if (!name) continue;

      const dist = distance(lat, lng, el.lat, el.lon);
      if (dist > radius) continue;

      const lines = tags.route_ref || tags.line || tags['route_master:ref'] || tags.ref || null;

      let mode = null;
      const net = (tags.network || '').toLowerCase();
      if (tags.subway === 'yes' || tags.station === 'subway' || net.includes('métro') || net.includes('metro')) {
        mode = 'metro';
      } else if (tags.station === 'light_rail' || tags.train === 'yes' || net.includes('rer') || name.match(/\bRER\b/i)) {
        mode = 'rer';
      } else if (tags.tram === 'yes' || tags.station === 'tram' || net.includes('tram')) {
        mode = 'tram';
      } else if (tags.highway === 'bus_stop' || tags.bus === 'yes' || tags.public_transport === 'platform') {
        mode = 'bus';
      } else if (tags.railway === 'station' || tags.railway === 'subway_entrance') {
        mode = 'metro';
      } else {
        continue;
      }

      if (!result[mode][name] || result[mode][name].distance > dist) {
        result[mode][name] = { name, distance: dist, lines };
      }
    }

    const finalResult = {
      metro: Object.values(result.metro).sort((a, b) => a.distance - b.distance).slice(0, 5),
      rer: Object.values(result.rer).sort((a, b) => a.distance - b.distance).slice(0, 3),
      tram: Object.values(result.tram).sort((a, b) => a.distance - b.distance).slice(0, 3),
      bus: Object.values(result.bus).sort((a, b) => a.distance - b.distance).slice(0, 5),
    };
    console.log('[getNearbyTransports] Result:', {
      metro: finalResult.metro.length,
      rer: finalResult.rer.length,
      tram: finalResult.tram.length,
      bus: finalResult.bus.length
    });
    return finalResult;
  } catch (e) {
    console.warn('[getNearbyTransports]', e.message);
    return { metro: [], bus: [], rer: [], tram: [] };
  }
}

// ─────────────────────────────────────────────────────────
// 6bis. Commodités du quartier (commerces, écoles, parcs, santé, culture)
// Renvoie { commerces, restaurants, ecoles, sante, culture, parcs }
// ─────────────────────────────────────────────────────────
export async function getNearbyAmenities({ lat, lng, radius = 500 }) {
  if (!lat || !lng) return null;

  function distance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  }

  const query = `
    [out:json][timeout:25];
    (
      node["shop"](around:${radius},${lat},${lng});
      node["amenity"~"^(restaurant|cafe|bar|fast_food|bakery)$"](around:${radius},${lat},${lng});
      node["amenity"~"^(school|kindergarten|college|university)$"](around:${radius},${lat},${lng});
      node["amenity"~"^(pharmacy|hospital|clinic|doctors|dentist)$"](around:${radius},${lat},${lng});
      node["amenity"~"^(cinema|theatre|library|arts_centre|museum)$"](around:${radius},${lat},${lng});
      way["leisure"~"^(park|garden|playground)$"](around:${radius},${lat},${lng});
    );
    out center;
  `.trim();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'PatrimoniaCRM/1.0 (contact@patrimonia.com)'
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn('[getNearbyAmenities] HTTP', res.status);
      return null;
    }
    const data = await res.json();
    const elements = data.elements || [];
    console.log('[getNearbyAmenities] Overpass returned', elements.length, 'elements');

    const result = {
      commerces: [],
      restaurants: [],
      ecoles: [],
      sante: [],
      culture: [],
      parcs: [],
    };

    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name || tags['name:fr'] || null;
      const elLat = el.lat || el.center?.lat;
      const elLng = el.lon || el.center?.lon;
      if (!elLat || !elLng) continue;
      const dist = distance(lat, lng, elLat, elLng);
      if (dist > radius) continue;

      let cat = null;
      let typeLabel = null;

      if (tags.shop) {
        cat = 'commerces';
        typeLabel = tags.shop;
      } else if (['restaurant','cafe','bar','fast_food','bakery'].includes(tags.amenity)) {
        cat = 'restaurants';
        typeLabel = tags.amenity;
      } else if (['school','kindergarten','college','university'].includes(tags.amenity)) {
        cat = 'ecoles';
        typeLabel = tags.amenity;
      } else if (['pharmacy','hospital','clinic','doctors','dentist'].includes(tags.amenity)) {
        cat = 'sante';
        typeLabel = tags.amenity;
      } else if (['cinema','theatre','library','arts_centre','museum'].includes(tags.amenity)) {
        cat = 'culture';
        typeLabel = tags.amenity;
      } else if (['park','garden','playground'].includes(tags.leisure)) {
        cat = 'parcs';
        typeLabel = tags.leisure;
      }

      if (!cat) continue;
      result[cat].push({
        name: name || typeLabel,
        type: typeLabel,
        distance: dist,
      });
    }

    for (const k of Object.keys(result)) {
      result[k] = result[k].sort((a,b) => a.distance - b.distance).slice(0, 10);
    }

    console.log('[getNearbyAmenities] Counts:', {
      commerces: result.commerces.length,
      restaurants: result.restaurants.length,
      ecoles: result.ecoles.length,
      sante: result.sante.length,
      culture: result.culture.length,
      parcs: result.parcs.length,
    });

    return result;
  } catch (e) {
    console.warn('[getNearbyAmenities]', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// 6ter. Risques naturels via Géorisques API
// Retrait-gonflement argiles, inondations, sismicité, radon, ICPE
// ─────────────────────────────────────────────────────────
export async function getRisquesNaturels({ lat, lng, codeCommune = null }) {
  if (!lat || !lng) return null;

  // Géorisques expose : /api/v1/resultats_rapport_risque?latlon=lng,lat
  // ⚠️ Note : lng,lat (PAS lat,lng comme d'habitude)
  try {
    const url = `https://www.georisques.gouv.fr/api/v1/resultats_rapport_risque?latlon=${lng},${lat}&rayon=1000`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'PatrimoniaCRM/1.0' }
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn('[getRisquesNaturels] HTTP', res.status);
      return null;
    }

    const data = await res.json();
    console.log('[getRisquesNaturels] OK for', lat, lng);
    // On retourne tel quel, on parsera côté UI
    return data;
  } catch (e) {
    console.warn('[getRisquesNaturels]', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// 7. Helper "tout en un"
// ─────────────────────────────────────────────────────────
export async function getLocationImages(address) {
  const geo = await geocodeAddress(address);
  if (!geo) return { satellite: null, cadastre: null, parcelle: null, geocode: null };

  const parcelle = await getCadastreParcelle({ lat: geo.lat, lng: geo.lng });

  const satelliteImageUrl = googleSatelliteUrl({ lat: geo.lat, lng: geo.lng });
  const cadastreImageUrl = cadastreUrl({
    lat: geo.lat,
    lng: geo.lng,
    bbox: parcelle?.bbox || null,
  });

  const [satellite, cadastre, transports] = await Promise.all([
    satelliteImageUrl ? fetchImageAsBase64(satelliteImageUrl) : Promise.resolve(null),
    fetchImageAsBase64(cadastreImageUrl),
    getNearbyTransports({ lat: geo.lat, lng: geo.lng, radius: 500 }),
  ]);

  return { satellite, cadastre, parcelle, transports, geocode: geo };
}
