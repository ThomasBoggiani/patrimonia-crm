// ═══════════════════════════════════════════════════════════════════
// app/api/references/import-from-site/route.js (v4 - bucket + html entities)
// - Upload photos sur bucket mandat-photos (PUBLIC)
// - Décode les entités HTML dans titres/descriptions (&#8211; -> –)
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = 'nodejs';

const SITE_BASE = 'https://www.immeubles-patrimoine.fr';
const LIST_URL = `${SITE_BASE}/dernieres-ventes/`;
const BUCKET_PHOTOS = 'mandat-photos'; // bucket public, image/* only, 5 MB max

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
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

// ─── Décodage des entités HTML ───
// Convertit &#8211; → –, &amp; → &, &eacute; → é, etc.
function decodeHtmlEntities(text) {
  if (!text) return text;
  return String(text)
    // Entités numériques décimales : &#8211;
    .replace(/&#(\d+);/g, (m, code) => String.fromCharCode(parseInt(code, 10)))
    // Entités numériques hexadécimales : &#x2013;
    .replace(/&#x([0-9a-fA-F]+);/g, (m, code) => String.fromCharCode(parseInt(code, 16)))
    // Entités nommées les plus courantes
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&ecirc;/g, 'ê')
    .replace(/&euml;/g, 'ë')
    .replace(/&agrave;/g, 'à')
    .replace(/&acirc;/g, 'â')
    .replace(/&auml;/g, 'ä')
    .replace(/&iuml;/g, 'ï')
    .replace(/&icirc;/g, 'î')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&ouml;/g, 'ö')
    .replace(/&ugrave;/g, 'ù')
    .replace(/&ucirc;/g, 'û')
    .replace(/&uuml;/g, 'ü')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&hellip;/g, '…')
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rdquo;/g, '”')
    .replace(/&ldquo;/g, '“')
    .replace(/&euro;/g, '€')
    // Nettoyer les espaces multiples
    .replace(/\s+/g, ' ')
    .trim();
}

function deduireTypologies(nom, categorieListe) {
  const n = (nom || '').toLowerCase();
  const c = (categorieListe || '').toLowerCase();
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

async function fetchFichesFromList() {
  const res = await fetchWithTimeout(LIST_URL, { cache: 'no-store' }, 12000);
  if (!res.ok) throw new Error(`Liste KO: HTTP ${res.status}`);
  const html = await res.text();

  const sections = html.split(/<h2[^>]*>/i);
  const fiches = [];
  const seen = new Set();

  for (const section of sections) {
    const titreSectionMatch = section.match(/^([^<]+)<\/h2>/i);
    const categorieListe = titreSectionMatch ? decodeHtmlEntities(titreSectionMatch[1].trim()) : '';

    const linkRegex = /<a[^>]+href="(https:\/\/www\.immeubles-patrimoine\.fr\/biens_vendus\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(section)) !== null) {
      const url = linkMatch[1];
      const innerContent = linkMatch[2];

      if (seen.has(url)) continue;
      seen.add(url);

      const textOnly = innerContent
        .replace(/<img[^>]+alt="([^"]*)"[^>]*>/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const textDecoded = decodeHtmlEntities(textOnly);

      let nom = null;
      let villeMajMatch = textDecoded.match(/\s([A-ZÉÈÊÀÂÔÇ][A-ZÉÈÊÀÂÔÇ\s\d°ÈÉ\-\/]+)\s*$/);
      const ville = villeMajMatch ? villeMajMatch[1].trim() : null;

      const venduMatch = textDecoded.match(/Vendu\s+\S+?([A-Z][^A-Z]+(?:\s[^A-Z]+)*?)\s+[A-ZÉÈÊÀÂÔÇ]+/);
      if (venduMatch) {
        nom = venduMatch[1].trim();
      } else {
        const fallback = textDecoded.replace(/^.*?Vendu\s+\S+?/, '').replace(/\s+[A-ZÉÈÊÀÂÔÇ\s\d°ÈÉ\-\/]+$/, '').trim();
        if (fallback.length > 10) nom = fallback;
      }

      if (!nom || nom.length < 10) {
        const slugPart = url.split('/biens_vendus/')[1] || '';
        nom = decodeURIComponent(slugPart).replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());
      }

      // Décoder une dernière fois (au cas où il reste des entités)
      nom = decodeHtmlEntities(nom);

      const imgMatch = innerContent.match(/<img[^>]+src="(https:\/\/www\.immeubles-patrimoine\.fr\/wp-content\/uploads\/[^"]+)"/);
      const coverPhoto = imgMatch && !imgMatch[1].includes('logo') && !imgMatch[1].includes('cropped-')
        ? imgMatch[1]
        : null;

      if (!categorieListe || categorieListe.length > 60) continue;
      const cl = categorieListe.toLowerCase();
      if (!cl.includes('appartement') && !cl.includes('hotel')
          && !cl.includes('hôtel') && !cl.includes('hébergement')
          && !cl.includes('immeuble') && !cl.includes('locaux')
          && !cl.includes('commerc') && !cl.includes('promotion')) continue;

      fiches.push({
        nom: nom.trim(),
        categorieListe,
        ville,
        coverPhoto,
        url,
        surface: extractSurface(nom),
        arrondissement: extractCodePostal(ville) || extractCodePostal(nom),
        typologies: deduireTypologies(nom, categorieListe),
      });
    }
  }

  return fiches;
}

async function fetchFicheDetailed(url) {
  try {
    const res = await fetchWithTimeout(url, { cache: 'no-store' }, 6000);
    if (!res.ok) return null;
    const html = await res.text();

    const titreMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const nom = titreMatch ? decodeHtmlEntities(titreMatch[1].trim()) : null;
    if (!nom) return null;

    const catMatch = html.match(/Cat[ée]gorie\s*[:\.]\s*<\/strong>\s*([^<\n]+)/i)
                  || html.match(/<strong>\s*Cat[ée]gorie\s*[:\.]?\s*<\/strong>\s*([^<\n]+)/i);
    const categorie = catMatch ? decodeHtmlEntities(catMatch[1].replace(/^[\s:.]+/, '').trim()) : null;

    const locMatch = html.match(/Localisation\s*[:\.]\s*<\/strong>\s*([^<\n]+)/i)
                  || html.match(/<strong>\s*Localisation\s*[:\.]?\s*<\/strong>\s*([^<\n]+)/i);
    const localisation = locMatch ? decodeHtmlEntities(locMatch[1].replace(/^[\s:.]+/, '').trim()) : null;

    let description = null;
    const descRegex = /<p[^>]*>([^<]+(?:<(?!\/p)[^>]+>[^<]*)*)<\/p>/g;
    let descMatch;
    while ((descMatch = descRegex.exec(html)) !== null) {
      const rawTxt = descMatch[1].replace(/<[^>]+>/g, '');
      const txt = decodeHtmlEntities(rawTxt);
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
    console.error('[fetchFicheDetailed]', url, e.message);
    return null;
  }
}

async function uploadPhotoToSupabase(supabase, photoUrl, refSlug) {
  try {
    const res = await fetchWithTimeout(photoUrl, { cache: 'no-store' }, 6000);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const blob = new Uint8Array(buf);

    // Si > 5 MB, on skip (limite du bucket mandat-photos)
    if (blob.length > 5 * 1024 * 1024) {
      console.warn('[upload] photo trop grosse:', blob.length, 'bytes');
      return null;
    }

    // mandat-photos accepte uniquement jpeg/png/webp/heic
    let ext = 'jpg';
    let mime = 'image/jpeg';
    if (photoUrl.endsWith('.webp')) { ext = 'webp'; mime = 'image/webp'; }
    else if (photoUrl.endsWith('.png')) { ext = 'png'; mime = 'image/png'; }
    else if (photoUrl.endsWith('.heic')) { ext = 'heic'; mime = 'image/heic'; }

    const path = `references/${refSlug}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET_PHOTOS).upload(path, blob, {
      contentType: mime,
      upsert: false
    });
    if (error) {
      console.warn('[upload]', error.message);
      return null;
    }
    const { data: { publicUrl } } = supabase.storage.from(BUCKET_PHOTOS).getPublicUrl(path);
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
      try {
        const fiches = await fetchFichesFromList();
        if (fiches.length === 0) {
          return NextResponse.json({ error: 'Aucune fiche trouvée sur le site' }, { status: 500 });
        }
        return NextResponse.json({ ok: true, count: fiches.length, fiches });
      } catch (e) {
        return NextResponse.json({ error: `Erreur scraping liste: ${e.message}` }, { status: 500 });
      }
    }

    if (mode === 'import') {
      if (!Array.isArray(selectedUrls) || selectedUrls.length === 0) {
        return NextResponse.json({ error: 'Aucune URL sélectionnée' }, { status: 400 });
      }

      const MAX_IMPORT = 15;
      const toImport = selectedUrls.slice(0, MAX_IMPORT);
      const skipped = selectedUrls.length - toImport.length;

      let created = 0;
      const errors = [];

      const BATCH = 4;
      for (let i = 0; i < toImport.length; i += BATCH) {
        const batch = toImport.slice(i, i + BATCH);
        const results = await Promise.allSettled(batch.map(async (url) => {
          const fiche = await fetchFicheDetailed(url);
          if (!fiche) return { url, error: 'Fiche introuvable' };

          const slug = (fiche.nom || 'reference')
            .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

          const medias = [];
          for (let i = 0; i < Math.min(3, fiche.photos.length); i++) {
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

          if (insErr) return { url, error: insErr.message };
          return { ok: true };
        }));

        for (const r of results) {
          if (r.status === 'fulfilled') {
            if (r.value?.ok) created++;
            else if (r.value?.error) errors.push(r.value);
          } else {
            errors.push({ error: r.reason?.message || 'unknown' });
          }
        }
      }

      return NextResponse.json({
        ok: true,
        created,
        errors,
        skipped,
        skipMessage: skipped > 0 ? `${skipped} référence(s) non traitée(s) — relance l'import pour les ajouter` : null
      });
    }

    return NextResponse.json({ error: 'Mode invalide' }, { status: 400 });

  } catch (e) {
    console.error('[import-from-site] EXCEPTION:', e);
    return NextResponse.json({
      error: `Exception serveur: ${e.message || 'inconnue'}`,
    }, { status: 500 });
  }
}
