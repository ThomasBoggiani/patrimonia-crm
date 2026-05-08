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
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn('[googleSatelliteUrl] GOOGLE_MAPS_API_KEY missing');
    return null;
  }
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: String(zoom),
    size: `${width}x${height}`,
    maptype: 'satellite',
    scale: '2', // Retina = images plus nettes
    key: apiKey,
    markers: `color:red|${lat},${lng}`
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
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
// 5. Helper "tout en un" : à partir d'une adresse, renvoie les 2 images
// ─────────────────────────────────────────────────────────
export async function getLocationImages(address) {
  const geo = await geocodeAddress(address);
  if (!geo) return { satellite: null, cadastre: null, geocode: null };

  const satelliteImageUrl = googleSatelliteUrl({ lat: geo.lat, lng: geo.lng });
  const cadastreImageUrl = cadastreUrl({ lat: geo.lat, lng: geo.lng });

  // Fetch en parallèle
  const [satellite, cadastre] = await Promise.all([
    satelliteImageUrl ? fetchImageAsBase64(satelliteImageUrl) : Promise.resolve(null),
    fetchImageAsBase64(cadastreImageUrl)
  ]);

  return { satellite, cadastre, geocode: geo };
}
