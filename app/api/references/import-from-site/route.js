// ═══════════════════════════════════════════════════════════════════
// app/api/references/import-from-site/route.js (v3 - timeout fix)
// PREVIEW : extrait tout depuis la page liste (1 fetch, ~3s)
// IMPORT : fetch détaillé + photos uniquement pour les URLs sélectionnées
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = 'nodejs';

const SITE_BASE = 'https://www.immeubles-patrimoine.fr';
const LIST_URL = `${SITE_BASE}/dernieres-ventes/`;

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

// ─── PREVIEW : extraction depuis la page liste UNIQUEMENT ───
// La page liste contient pour chaque vente :
// - un lien vers la fiche détaillée
// - un titre type "Vendu Immeubles" + "Immeuble mixte de 1552 m2 – Aubervilliers"
// - une image (la 1re photo)
// - la ville en majuscules
async function fetchFichesFromList() {
  const res = await fetchWithTimeout(LIST_URL, { cache: 'no-store' }, 12000);
  if (!res.ok) throw new Error(`Liste KO: HTTP ${res.status}`);
  const html = await res.text();

  // On split par sections h2 (Appartements, Hôtels, Immeubles, Locaux commerciaux, Promotion)
  const sections = html.split(/<h2[^>]*>/i);
  
  const fiches = [];
  const seen = new Set();

  for (const section of sections) {
    // Extraire le titre de la section (premier h2 du chunk)
    const titreSectionMatch = section.match(/^([^<]+)<\/h2>/i);
    const categorieListe = titreSectionMatch ? titreSectionMatch[1].trim() : '';

    // Extraire tous les liens <a href="...biens_vendus/..."> dans cette section
    const linkRegex = /<a[^>]+href="(https:\/\/www\.immeubles-patrimoine\.fr\/biens_vendus\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(section)) !== null) {
      const url = linkMatch[1];
      const innerContent = linkMatch[2];
      
      if (seen.has(url)) continue;
      seen.add(url);

      // Extraire le titre depuis le contenu : c'est généralement à la fin avant la ville
      // Pattern : "Vendu CategorieXXXXXXXXX VILLE"
      // ou : "...Title... CategorieXXX TitreLong VILLE"
      
      // Stratégie : on extrait tout le texte (sans HTML) et on cherche le pattern
      const textOnly = innerContent
        .replace(/<img[^>]+alt="([^"]*)"[^>]*>/g, ' ') // images : ignorer
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#\d+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Le pattern est : "Vendu <Categorie><Titre du bien> <VILLE>"
      // Ex: "Vendu ImmeublesImmeuble mixte de 1552 m2 – Aubervilliers AUBERVILLIERS"
      // On cherche "Vendu" puis on prend tout jusqu'à la ville en majuscules à la fin
      
      let nom = null;
      let villeMajMatch = textOnly.match(/\s([A-ZÉÈÊÀÂÔÇ][A-ZÉÈÊÀÂÔÇ\s\d°ÈÉ\-\/]+)\s*$/);
      const ville = villeMajMatch ? villeMajMatch[1].trim() : null;
      
      // Le titre est juste avant la ville
      const venduMatch = textOnly.match(/Vendu\s+\S+?([A-Z][^A-Z]+(?:\s[^A-Z]+)*?)\s+[A-ZÉÈÊÀÂÔÇ]+/);
      if (venduMatch) {
        nom = venduMatch[1].trim();
      } else {
        // Fallback : prendre tout après "Vendu " et avant la dernière partie en majuscules
        const fallback = textOnly.replace(/^.*?Vendu\s+\S+?/, '').replace(/\s+[A-ZÉÈÊÀÂÔÇ\s\d°ÈÉ\-\/]+$/, '').trim();
        if (fallback.length > 10) nom = fallback;
      }
      
      // Re-fallback : utiliser le slug de l'URL
      if (!nom || nom.length < 10) {
        const slugPart = url.split('/biens_vendus/')[1] || '';
        nom = slugPart.replace(/-/g, ' ').replace(/%c2%b2/gi, 'm²').replace(/^\w/, c => c.toUpperCase());
      }

      // Extraire la 1re image (cover) de ce lien
      const imgMatch = innerContent.match(/<img[^>]+src="(https:\/\/www\.immeubles-patrimoine\.fr\/wp-content\/uploads\/[^"]+)"/);
      const coverPhoto = imgMatch && !imgMatch[1].includes('logo') && !imgMatch[1].includes('cropped-')
        ? imgMatch[1] 
        : null;

      // Skipper si pas dans une catégorie connue (= les liens en pied de page, sidebar, etc.)
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

// ─── IMPORT : fetch détaillé d'une seule fiche (avec photos) ───
async function fetchFicheDetailed(url) {
  try {
    const res = await fetchWithTimeout(url, { cache: 'no-store' }, 6000);
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

    let ext = 'jpg';
    let mime = 'image/jpeg';
    if (photoUrl.endsWith('.webp')) { ext = 'webp'; mime = 'image/webp'; }
    else if (photoUrl.endsWith('.png')) { ext = 'png'; mime = 'image/png'; }

    const path = `references/${refSlug}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
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

    // ═══ PREVIEW : ULTRA-RAPIDE, depuis la page liste seule ═══
    if (mode === 'preview') {
      try {
        const fiches = await fetchFichesFromList();
        if (fiches.length === 0) {
          return NextResponse.json({ error: 'Aucune fiche trouvée sur le site (regex obsolète ?)' }, { status: 500 });
        }
        return NextResponse.json({ ok: true, count: fiches.length, fiches });
      } catch (e) {
        return NextResponse.json({ error: `Erreur scraping liste: ${e.message}` }, { status: 500 });
      }
    }

    // ═══ IMPORT : fetch détaillé en parallèle ═══
    if (mode === 'import') {
      if (!Array.isArray(selectedUrls) || selectedUrls.length === 0) {
        return NextResponse.json({ error: 'Aucune URL sélectionnée' }, { status: 400 });
      }

      // Limiter à 15 références par batch pour éviter le timeout
      const MAX_IMPORT = 15;
      const toImport = selectedUrls.slice(0, MAX_IMPORT);
      const skipped = selectedUrls.length - toImport.length;

      let created = 0;
      const errors = [];

      // Process en parallèle par lots de 4
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
          // Maximum 3 photos par référence pour rester rapide
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

    return NextResponse.json({ error: 'Mode invalide (preview ou import)' }, { status: 400 });

  } catch (e) {
    console.error('[import-from-site] EXCEPTION GLOBALE:', e);
    return NextResponse.json({
      error: `Exception serveur: ${e.message || 'inconnue'}`,
    }, { status: 500 });
  }
}
