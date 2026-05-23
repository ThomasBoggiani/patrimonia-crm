// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/[id]/refresh-assets/route.js — v1
// Régénère et stocke les assets externes d'un mandat :
// - Vue satellite (Maptiler)
// - Vue cadastre (IGN)
// - Parcelle cadastrale (apicarto IGN)
// - Transports à proximité (OSM Overpass)
//
// Les images sont uploadées dans Supabase Storage (bucket mandat-assets),
// les URLs sont stockées dans les colonnes du mandat.
// ═══════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { geocodeAddress, googleSatelliteUrl, cadastreUrl, googleStreetViewUrl, googleMapStaticUrl, getCadastreParcelle, getNearbyTransports } from '@/lib/maps';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BUCKET = 'mandat-assets';

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

async function fetchAndUpload(imageUrl, storagePath, contentType = 'image/jpeg') {
  if (!imageUrl) return null;
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.warn(`[refresh-assets] HTTP ${res.status} for ${imageUrl.slice(0, 80)} - body:`, errBody.slice(0, 300));
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType,
        upsert: true,
        cacheControl: '86400',
      });

    if (uploadErr) {
      console.warn(`[refresh-assets] Upload failed for ${storagePath}:`, uploadErr.message);
      return null;
    }

    // URL publique
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
    return data?.publicUrl || null;
  } catch (e) {
    console.warn(`[refresh-assets] Fetch/upload error:`, e.message);
    return null;
  }
}

export async function POST(request, { params }) {
  try {
    const { id: mandatId } = params;
    if (!mandatId) {
      return new Response(JSON.stringify({ ok: false, error: 'id requis' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Auth
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Récupérer le mandat
    const { data: mandat, error: mErr } = await supabaseAdmin
      .from('mandats')
      .select('id, adresse, ville, code_postal')
      .eq('id', mandatId)
      .maybeSingle();

    if (mErr || !mandat) {
      return new Response(JSON.stringify({ ok: false, error: 'Mandat introuvable' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!mandat.adresse) {
      return new Response(JSON.stringify({ ok: false, error: 'Adresse manquante sur le mandat' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Construire l'adresse complète pour un géocodage précis
    const fullAddress = [mandat.adresse, mandat.code_postal, mandat.ville].filter(Boolean).join(', ');
    console.log(`[refresh-assets] Starting refresh for mandat ${mandatId} - "${fullAddress}"`);

    // 1. Géocodage
    const geo = await geocodeAddress(fullAddress);
    if (!geo) {
      return new Response(JSON.stringify({ ok: false, error: 'Adresse non géocodable' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. URLs externes (sauf cadastre qu'on construit après la parcelle)
    const satelliteExtUrl = googleSatelliteUrl({ lat: geo.lat, lng: geo.lng });
    const streetViewExtUrl = googleStreetViewUrl({ lat: geo.lat, lng: geo.lng, width: 640, height: 400 });
    const mapStaticExtUrl = googleMapStaticUrl({ lat: geo.lat, lng: geo.lng, width: 640, height: 400, zoom: 15, mapType: 'roadmap' });

    console.log('[refresh-assets] Street View URL:', streetViewExtUrl?.slice(0, 200));

    // 2bis. Récupérer la parcelle d'abord pour avoir sa bbox et cadrer le cadastre
    const parcelle = await getCadastreParcelle({ lat: geo.lat, lng: geo.lng });
    const cadastreExtUrl = cadastreUrl({
      lat: geo.lat,
      lng: geo.lng,
      bbox: parcelle?.bbox || null,
    });

    // 3. Télécharger + uploader en parallèle
    const [satelliteUrl, cadastreUrl_, streetViewUrl, mapStaticUrl, transports] = await Promise.all([
      fetchAndUpload(satelliteExtUrl, `${mandatId}/satellite.jpg`, 'image/jpeg'),
      fetchAndUpload(cadastreExtUrl, `${mandatId}/cadastre.png`, 'image/png'),
      fetchAndUpload(streetViewExtUrl, `${mandatId}/streetview.jpg`, 'image/jpeg'),
      fetchAndUpload(mapStaticExtUrl, `${mandatId}/map-static.png`, 'image/png'),
      getNearbyTransports({ lat: geo.lat, lng: geo.lng, radius: 800 }),
    ]);

    // 4. Update mandat avec les URLs et données
    const { error: updateErr } = await supabaseAdmin
      .from('mandats')
      .update({
        satellite_image_url: satelliteUrl,
        cadastre_image_url: cadastreUrl_,
        street_view_image_url: streetViewUrl,
        map_static_image_url: mapStaticUrl,
        parcelle_data: parcelle,
        transports_data: transports,
        assets_generated_at: new Date().toISOString(),
      })
      .eq('id', mandatId);

    if (updateErr) {
      console.error('[refresh-assets] Update error:', updateErr.message);
      return new Response(JSON.stringify({ ok: false, error: 'Erreur sauvegarde', detail: updateErr.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[refresh-assets] Done for mandat ${mandatId}: satellite=${!!satelliteUrl}, cadastre=${!!cadastreUrl_}, parcelle=${!!parcelle}, transports=${transports?.metro?.length || 0}m/${transports?.bus?.length || 0}b`);

    return new Response(JSON.stringify({
      ok: true,
      mandatId,
      geocode: geo,
      satellite_image_url: satelliteUrl,
      cadastre_image_url: cadastreUrl_,
      street_view_image_url: streetViewUrl,
      map_static_image_url: mapStaticUrl,
      parcelle_data: parcelle,
      transports_data: transports,
      assets_generated_at: new Date().toISOString(),
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('[refresh-assets] Erreur:', e);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', detail: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
