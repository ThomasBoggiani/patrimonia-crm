// ═══════════════════════════════════════════════════════════════════
// app/api/references/import-from-site/route.js (v2 - robuste)
// Scrape immeubles-patrimoine.fr/dernieres-ventes/
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = 'nodejs';

const SITE_BASE = 'https://www.immeubles-patrimoine.fr';
const LIST_URL = `${SITE_BASE}/dernieres-ventes/`;

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { 
      ...options, 
      signal: controller.signal,
      headers: { 'User-Agent': 'PatrimoniaCRM/1.0', ...(options.headers || {}) },
    });
    clearTimeout(timeoutId);
    return res;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

function deduireTypologies(nom, categorie) {
  const n = (nom || '').toLowerCase();
  const c = (categorie || '').toLowerCase();
  const typos = new Set();

  if (c.includes('appartement')) typos.add('appartement');
  if (c.includes('hotel') || c.includes('hébergement') || c.includes('hebergement')) typos.add('hotel');
  if (c.includes('immeuble')) {
    if (n.includes('mixte')) typos.add('mixte');
    else if (n.includes('tertiaire') || n.includes('bureaux')) typos.add('tertiaire');
    else if (n.includes('habitation') || n.includes('haussmannien') || n.includes('résidentiel') || n.includes('residentiel')) typos.add('habitation');
    else typos.add('habitation');
  }
  if (c.includes('locaux') || c.includes('commerc')) typos.add('commercial');
  if (c.includes('promotion')) typos.add('habitation');

  if (n.includes('hôtel particulier') || n.includes('hotel particulier')) {
    typos.delete('hotel');
    typos.add('hotel_particulier');
  }
  if (n.includes('mixte')) typos.add('mixte');
  if (n.includes('bureaux') || n.includes('tertiaire')) typos.add('tertiaire');
  if (n.includes('commercial') || n.includes('boutique')) typos.add('commercial');
  if (n.includes('studio') || n.includes('loft') || /\bT[1-9]\b/i.test(n)) typos.add('appartement');
  if (n.includes('maison') || n.includes('villa')) typos.add('maison');

  if (typos.size === 0) typos.add('habitation');
  return Array.from(typos);
}

function extractSurface(text) {
  if (!text) return null;
  const m = String(text).match(/(\d+[\s.,]?\d*)\s*(?:m²|m2)/i);
  if (!m) return null;
  const v = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
  return isFinite(v) ? v : null;
}

function extractCodePostal(text) {
  if (!text) return null;
  const m = String(text).match(/\b(7[5-8]\d{3}|9[0-9]{4}|\d{5})\b/);
  if (m) return m[1];
  const m2 = String(text).match(/Paris\s*(\d{1,2})[eEèÈ]?/i);
  if (m2) return '750' + String(m2[1]).padStart(2, '0');
  return null;
}

async function fetchListUrls() {
  const res = await fetchWithTimeout(LIST_URL, { cache: 'no-store' }, 15000);
  if (!res.ok) throw new Error(`Liste KO: HTTP ${res.status}`);
  const html = await res.text();
  
  const regex = /href="(https:\/\/www\.immeubles-patrimoine\.fr\/biens_vendus\/[^"]+)"/g;
  const urls = new Set();
  let m;
  while ((m = regex.exec(html)) !== null) urls.add(m[1]);
  return Array.from(urls);
}

async function fetchFiche(url) {
  try {
    const res = await fetchWithTimeout(url, { cache: 'no-store' }, 8000);
    if (!res.ok) return null;
    const html = await res.text();

    const titreMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const nom = titreMatch ? titreMatch[1].trim() : null;
    if (!nom) return null;

    const catMatch = html.match(/Cat[ée]gorie\s*[:\.]\s*<\/strong>\s*([^<\n]+)/i)
                  || html.match(/<strong>\s*Cat[ée]gorie\s*[:\.]?\s*<\/strong>\s*([^<\n]+)/i);
    const categorie = catMatch ? catMatch[1].replace(/^[\s:.]+/, '').trim() : null;

    const locMatch = html.match(/Localisation\s*[:\.]\s*<\/strong>\s*([^<\n]+)/i)
                  || html.match(/<strong>\s*Localisation\s*[:\.]?\s*<\/strong>\s*([^<\n]+)/i);
    const localisation = locMatch ? locMatch[1].replace(/^[\s:.]+/, '').trim() : null;

    let description = null;
    const descRegex = /<p[^>]*>([^<]+(?:<(?!\/p)[^>]+>[^<]*)*)<\/p>/g;
    let descMatch;
    while ((descMatch = descRegex.exec(html)) !== null) {
      const txt = descMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
      if (txt.length > 60 && txt.length < 1000 
          && !txt.toLowerCase().includes('cookie') 
          && !txt.toLowerCase().includes('navigation')
          && !txt.toLowerCase().includes('voir les détails')
          && !txt.toLowerCase().includes('mentions légales')) {
        description = txt;
        break;
      }
    }

    const photoRegex = /<img[^>]+src="(https:\/\/www\.immeubles-patrimoine\.fr\/wp-content\/uploads\/[^"]+)"/g;
    const photos = [];
    let photoMatch;
    while ((photoMatch = photoRegex.exec(html)) !== null) {
      const u = photoMatch[1];
      if (u.includes('logo') || u.includes('cropped-')) continue;
      if (!photos.includes(u)) photos.push(u);
      if (photos.length >= 5) break;
    }

    return {
      nom,
      categorie,
      localisation,
      description,
      photos,
      url,
      surface: extractSurface(nom) || extractSurface(localisation),
      arrondissement: extractCodePostal(localisation) || extractCodePostal(nom),
      ville: localisation,
      typologies: deduireTypologies(nom, categorie),
    };
  } catch (e) {
    console.error('[fetchFiche]', url, e.message);
    return null;
  }
}

async function uploadPhotoToSupabase(supabase, photoUrl, refSlug) {
  try {
    const res = await fetchWithTimeout(photoUrl, { cache: 'no-store' }, 8000);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const blob = new Uint8Array(buf);
    
    let ext = 'jpg';
    let mime = 'image/jpeg';
    if (photoUrl.endsWith('.webp')) { ext = 'webp'; mime = 'image/webp'; }
    else if (photoUrl.endsWith('.png')) { ext = 'png'; mime = 'image/png'; }
    
    const path = `references/${refSlug}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
    const { error } = await supabase.storage.from('mandat-docs').upload(path, blob, {
      contentType: mime,
      upsert: false
    });
    if (error) {
      console.warn('[upload]', error.message);
      return null;
    }
    const { data: { publicUrl } } = supabase.storage.from('mandat-docs').getPublicUrl(path);
    return { url: publicUrl, storage_path: path };
  } catch (e) {
    console.warn('[upload exception]', e.message);
    return null;
  }
}

export async function POST(req) {
  try {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 });
    }

    const { token, mode, selectedUrls } = body || {};

    if (!token) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 401 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: 'Config Supabase manquante côté serveur' }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const userId = userData.user.id;

    if (mode === 'preview') {
      console.log('[import-from-site] PREVIEW start');
      let urls;
      try {
        urls = await fetchListUrls();
      } catch (e) {
        return NextResponse.json({ error: `Erreur scraping liste: ${e.message}` }, { status: 500 });
      }
      
      if (urls.length === 0) {
        return NextResponse.json({ error: 'Aucune fiche trouvée sur le site (regex peut-être obsolète)' }, { status: 500 });
      }
      
      console.log(`[import-from-site] ${urls.length} URLs trouvées`);

      const fiches = [];
      const BATCH = 8;
      for (let i = 0; i < urls.length; i += BATCH) {
        const batch = urls.slice(i, i + BATCH);
        const results = await Promise.allSettled(batch.map(u => fetchFiche(u)));
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) fiches.push(r.value);
        }
      }

      console.log(`[import-from-site] ${fiches.length}/${urls.length} fiches scrappées`);
      return NextResponse.json({ ok: true, count: fiches.length, total: urls.length, fiches });
    }

    if (mode === 'import') {
      if (!Array.isArray(selectedUrls) || selectedUrls.length === 0) {
        return NextResponse.json({ error: 'Aucune URL sélectionnée' }, { status: 400 });
      }

      let created = 0;
      const errors = [];

      for (const url of selectedUrls) {
        try {
          const fiche = await fetchFiche(url);
          if (!fiche) {
            errors.push({ url, error: 'Fiche introuvable' });
            continue;
          }

          const slug = (fiche.nom || 'reference')
            .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

          const medias = [];
          for (let i = 0; i < Math.min(5, fiche.photos.length); i++) {
            const uploaded = await uploadPhotoToSupabase(supabase, fiche.photos[i], slug);
            if (uploaded) {
              medias.push({
                type: 'photo',
                url: uploaded.url,
                storage_path: uploaded.storage_path,
                isCover: i === 0,
              });
            }
          }

          const { error: insErr } = await supabase.from('references_ventes').insert({
            nom: fiche.nom,
            adresse: null,
            ville: fiche.ville,
            arrondissement: fiche.arrondissement,
            typologies: fiche.typologies,
            surface: fiche.surface || null,
            prix_vente: 0,
            tranche_prix: '<1M',
            date_vente: null,
            commentaire_commercial: fiche.description,
            medias,
            confidentiel: false,
            created_by: userId,
          });

          if (insErr) {
            errors.push({ url, error: insErr.message });
          } else {
            created++;
          }
        } catch (e) {
          errors.push({ url, error: e.message });
        }
      }

      return NextResponse.json({ ok: true, created, errors });
    }

    return NextResponse.json({ error: 'Mode invalide (preview ou import)' }, { status: 400 });

  } catch (e) {
    console.error('[import-from-site] EXCEPTION GLOBALE:', e);
    return NextResponse.json({ 
      error: `Exception serveur: ${e.message || 'inconnue'}`,
    }, { status: 500 });
  }
}
