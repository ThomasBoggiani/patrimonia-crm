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
  // Maptiler satellite tiles (gratuit jusqu'\u00e0 100k tiles/mois)
  // Convertit lat/lng/zoom en coordonn\u00e9es de tuile XYZ
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
// ─────────────────────────────────────────────────────────
export function cadastreUrl({ lat, lng, width = 600, height = 400, zoom = 18 }) {
  // Calcul de la bbox autour du point (en degrés)
  // À zoom 18 : ~0.0008 degrés de marge fait une bbox de ~80m
  const span = 0.0008;
  const minLat = lat - span;
  const maxLat = lat + span;
  const minLng = lng - span;
  const maxLng = lng + span;

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
// Renvoie { commune, section, numero, prefixe, contenance } ou null
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
    return {
      commune: p.nom_com || p.commune || null,
      codeCommune: p.code_com || p.code_insee || null,
      codeDepartement: p.code_dep || null,
      prefixe: p.com_abs || p.prefixe || null,
      section: p.section || null,
      numero: p.numero || null,
      contenance: p.contenance || null, // surface en m²
      idu: p.idu || null, // identifiant unique
    };
  } catch (e) {
    console.warn('[getCadastreParcelle]', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// 6. R\u00e9cup\u00e8re les transports en commun \u00e0 proximit\u00e9 via OSM Overpass API
// Renvoie un tableau group\u00e9 par mode (m\u00e9tro, bus, RER, tram)
// ─────────────────────────────────────────────────────────
export async function getNearbyTransports({ lat, lng, radius = 500 }) {
  if (!lat || !lng) return { metro: [], bus: [], rer: [], tram: [] };
  
  // Calcul de distance Haversine (m\u00e8tres)
  function distance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  }
  
  // Requ\u00eate Overpass : on cherche tous les nodes public_transport=station ou highway=bus_stop
  // dans un rayon autour du point
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
    const res = await fetch('https://overpass.kumi.systems/api/interpreter', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'PatrimoniaCRM/1.0'
      },
      body: `data=${encodeURIComponent(query)}`
    });
    if (!res.ok) {
      console.warn('[getNearbyTransports] HTTP', res.status);
      return { metro: [], bus: [], rer: [], tram: [] };
    }
    const data = await res.json();
    const elements = data.elements || [];
    
    const result = { metro: {}, bus: {}, rer: {}, tram: {} };
    
    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name || tags['name:fr'] || null;
      if (!name) continue;
      
      const dist = distance(lat, lng, el.lat, el.lon);
      if (dist > radius) continue;
      
      const lines = tags.route_ref || tags.line || tags.ref || null;
      
      // D\u00e9terminer le mode
      let mode = null;
      if (tags.subway === 'yes' || tags.station === 'subway' || tags.network === 'M\u00e9tro de Paris' || tags['railway:position']) {
        mode = 'metro';
      } else if (tags.station === 'light_rail' || tags.train === 'yes' || tags.network?.includes('RER') || name.match(/RER/i)) {
        mode = 'rer';
      } else if (tags.tram === 'yes' || tags.station === 'tram' || tags.network?.includes('Tram')) {
        mode = 'tram';
      } else if (tags.highway === 'bus_stop' || tags.bus === 'yes') {
        mode = 'bus';
      } else if (tags.railway === 'station' || tags.railway === 'subway_entrance') {
        mode = 'metro';
      } else {
        continue;
      }
      
      // D\u00e9dupliquer par nom (garder le plus proche)
      if (!result[mode][name] || result[mode][name].distance > dist) {
        result[mode][name] = { name, distance: dist, lines };
      }
    }
    
    // Convertir maps en arrays tri\u00e9s par distance
    return {
      metro: Object.values(result.metro).sort((a, b) => a.distance - b.distance).slice(0, 5),
      rer: Object.values(result.rer).sort((a, b) => a.distance - b.distance).slice(0, 3),
      tram: Object.values(result.tram).sort((a, b) => a.distance - b.distance).slice(0, 3),
      bus: Object.values(result.bus).sort((a, b) => a.distance - b.distance).slice(0, 5),
    };
  } catch (e) {
    console.warn('[getNearbyTransports]', e.message);
    return { metro: [], bus: [], rer: [], tram: [] };
  }
}

// ─────────────────────────────────────────────────────────
// 7. Helper "tout en un" : \u00e0 partir d'une adresse, renvoie les images + la parcelle
// ─────────────────────────────────────────────────────────
export async function getLocationImages(address) {
  const geo = await geocodeAddress(address);
  if (!geo) return { satellite: null, cadastre: null, parcelle: null, geocode: null };

  const satelliteImageUrl = googleSatelliteUrl({ lat: geo.lat, lng: geo.lng });
  const cadastreImageUrl = cadastreUrl({ lat: geo.lat, lng: geo.lng });

  // Fetch en parall\u00e8le
  const [satellite, cadastre, parcelle, transports] = await Promise.all([
    satelliteImageUrl ? fetchImageAsBase64(satelliteImageUrl) : Promise.resolve(null),
    fetchImageAsBase64(cadastreImageUrl),
    getCadastreParcelle({ lat: geo.lat, lng: geo.lng }),
    getNearbyTransports({ lat: geo.lat, lng: geo.lng, radius: 500 }),
  ]);

  return { satellite, cadastre, parcelle, transports, geocode: geo };
}
