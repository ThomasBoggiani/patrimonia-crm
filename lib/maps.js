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
// 2. URL Google Maps Static (vue satellite)
// ─────────────────────────────────────────────────────────
export function googleSatelliteUrl({ lat, lng, zoom = 18, width = 600, height = 400 }) {
  // Maptiler satellite tiles (gratuit jusqu'à 100k tiles/mois)
  // Convertit lat/lng/zoom en coordonnées de tuile XYZ
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
// 3. URL Cadastre IGN (WMS) - vue cadastrale
// On utilise le service WMS de l'IGN qui est public et gratuit.
// Si bbox passé (depuis géométrie parcelle), on cadre dessus avec padding 40%.
// Sinon fallback : carré ±0.0008° centré sur le point.
// ─────────────────────────────────────────────────────────
export function cadastreUrl({ lat, lng, width = 600, height = 400, zoom = 18, bbox = null }) {
  let minLat, maxLat, minLng, maxLng;
  if (bbox) {
    // Padding plus important pour voir la parcelle dans son contexte
    const padLat = (bbox.maxLat - bbox.minLat) * 2.5;
    const padLng = (bbox.maxLng - bbox.minLng) * 2.5;
    minLat = bbox.minLat - padLat;
    maxLat = bbox.maxLat + padLat;
    minLng = bbox.minLng - padLng;
    maxLng = bbox.maxLng + padLng;
  } else {
    // Fallback : carré plus serré (~40m × 40m) centré sur le point
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
// 4. Fetch image as base64 (pour insertion dans PDF)
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
// 5. Récupère les infos de la parcelle cadastrale via IGN apicarto
// Renvoie { commune, section, numero, prefixe, contenance, bbox } ou null
// ─────────────────────────────────────────────────────────
export async function getCadastreParcelle({ lat, lng }) {
  if (!lat || !lng) return null;
  try {
    // L'API IGN attend un GeoJSON Point
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

    // Calculer la bbox de la parcelle (min/max lat/lng) à partir de sa géométrie
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
      bbox, // { minLng, maxLng, minLat, maxLat }
    };
  } catch (e) {
    console.warn('[getCadastreParcelle]', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// 6. Récupère les transports en commun à proximité via OSM Overpass API
// Renvoie un tableau groupé par mode (métro, bus, RER, tram)
// ─────────────────────────────────────────────────────────
export async function getNearbyTransports({ lat, lng, radius = 500 }) {
  if (!lat || !lng) return { metro: [], bus: [], rer: [], tram: [] };

  // Calcul de distance Haversine (mètres)
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

      // Plusieurs tags peuvent contenir les lignes       
      const lines = tags.route_ref || tags.line || tags['route_master:ref'] || tags.ref || null;

      // Déterminer le mode
      let mode = null;
      const net = (tags.network || '').toLowerCase();
      const operator = (tags.operator || '').toLowerCase();
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

      // Dédupliquer par nom (garder le plus proche)
      if (!result[mode][name] || result[mode][name].distance > dist) {
        result[mode][name] = { name, distance: dist, lines };
      }
    }

    // Convertir maps en arrays triés par distance
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
// 7. Helper "tout en un" : à partir d'une adresse, renvoie les images + la parcelle
// ─────────────────────────────────────────────────────────
export async function getLocationImages(address) {
  const geo = await geocodeAddress(address);
  if (!geo) return { satellite: null, cadastre: null, parcelle: null, geocode: null };

  // On récupère d'abord la parcelle pour avoir la bbox, puis on cadre le cadastre dessus
  const parcelle = await getCadastreParcelle({ lat: geo.lat, lng: geo.lng });

  const satelliteImageUrl = googleSatelliteUrl({ lat: geo.lat, lng: geo.lng });
  const cadastreImageUrl = cadastreUrl({
    lat: geo.lat,
    lng: geo.lng,
    bbox: parcelle?.bbox || null,
  });

  // Fetch en parallèle
  const [satellite, cadastre, transports] = await Promise.all([
    satelliteImageUrl ? fetchImageAsBase64(satelliteImageUrl) : Promise.resolve(null),
    fetchImageAsBase64(cadastreImageUrl),
    getNearbyTransports({ lat: geo.lat, lng: geo.lng, radius: 500 }),
  ]);

  return { satellite, cadastre, parcelle, transports, geocode: geo };
}
