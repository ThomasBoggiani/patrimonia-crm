// ═══════════════════════════════════════════════════════════════════
// app/api/references/import-from-site/route.js
// Scrape le site immeubles-patrimoine.fr/dernieres-ventes/
// + chaque fiche individuelle pour extraire les références
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60s max pour ce job

const SITE_BASE = 'https://www.immeubles-patrimoine.fr';
const LIST_URL = `${SITE_BASE}/dernieres-ventes/`;

// ─── Mapping nom -> typologies CRM ───
function deduireTypologies(nom, categorie) {
  const n = (nom || '').toLowerCase();
  const c = (categorie || '').toLowerCase();
  const typos = new Set();

  // Catégorie I&P → typologie de base
  if (c.includes('appartement')) typos.add('appartement');
  if (c.includes('hôtel') || c.includes('hotel') || c.includes('hébergement')) typos.add('hotel');
  if (c.includes('immeuble')) {
    // À affiner par le nom
    if (n.includes('mixte')) typos.add('mixte');
    else if (n.includes('tertiaire') || n.includes('bureaux')) typos.add('tertiaire');
    else if (n.includes('habitation') || n.includes('haussmannien') || n.includes('résidentiel')) typos.add('habitation');
    else typos.add('habitation');
  }
  if (c.includes('locaux') || c.includes('commerc')) typos.add('commercial');
  if (c.includes('promotion')) {
    // Promotion = projet construction. On laisse en "habitation" par défaut.
    typos.add('habitation');
  }

  // Mots-clés du nom (peuvent ajouter des typologies)
  if (n.includes('hôtel particulier') || n.includes('hotel particulier')) {
    typos.delete('hotel'); typos.add('hotel_particulier');
  }
  if (n.includes('mixte')) typos.add('mixte');
  if (n.includes('bureaux') || n.includes('tertiaire')) typos.add('tertiaire');
  if (n.includes('commercial') || n.includes('boutique')) typos.add('commercial');
  if (n.includes('studio') || n.includes('loft') || /\bT[1-9]\b/i.test(n)) typos.add('appartement');
  if (n.includes('maison') || n.includes('villa')) typos.add('maison');
  if (n.includes('résidence') && c.includes('promotion')) typos.add('habitation');

  if (typos.size === 0) typos.add('habitation'); // fallback
  return Array.from(typos);
}

// ─── Helpers d'extraction ───
function extractSurface(text) {
  const m = String(text || '').match(/(\d+[\s.,]?\d*)\s*(?:m²|m2)/i);
  if (!m) return null;
  return parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
}

function extractVille(text) {
  // Cherche en MAJUSCULES (ex: "PARIS 18E", "AUBERVILLIERS", "GENÈVE")
  const m = String(text || '').match(/([A-ZÉÈÊÀÂÔ][A-ZÉÈÊÀÂÔ\s-]+?(?:\s\d{1,2}[EÈ]|[A-ZÉÈÊÀÂÔ])+)/);
  return m ? m[1].trim() : null;
}

function extractCodePostal(text) {
  const m = String(text || '').match(/\b(75\d{3}|9[0-9]{4}|7[5-8]\d{3}|\d{5})\b/);
  if (m) return m[1];
  // Arrondissement Paris
  const m2 = String(text || '').match(/Paris\s*(\d{1,2})[eEèÈ]?/i);
  if (m2) return '750' + String(m2[1]).padStart(2, '0');
  return null;
}

// ─── Scrape page liste : extrait toutes les URLs de fiches ───
async function fetchListUrls() {
  const res = await fetch(LIST_URL, { 
    headers: { 'User-Agent': 'PatrimoniaCRM/1.0' },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`Liste KO : ${res.status}`);
  const html = await res.text();

  // Extraction simple par regex (pas de DOM côté serveur)
  // Cherche tous les liens vers /biens_vendus/...
  const regex = /href="(https:\/\/www\.immeubles-patrimoine\.fr\/biens_vendus\/[^"]+)"/g;
  const urls = new Set();
  let m;
  while ((m = regex.exec(html)) !== null) {
    urls.add(m[1]);
  }
  return Array.from(urls);
}

// ─── Scrape une fiche individuelle ───
async function fetchFiche(url) {
  try {
    const res = await fetch(url, { 
      headers: { 'User-Agent': 'PatrimoniaCRM/1.0' },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Titre H1
    const titreMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const nom = titreMatch ? titreMatch[1].trim() : null;
    if (!nom) return null;

    // Catégorie : recherche "Catégorie :" suivi du texte
    const catMatch = html.match(/Cat[ée]gorie\s*:\s*<\/strong>\s*([^<\n]+)/i)
                  || html.match(/<strong>Cat[ée]gorie\s*:<\/strong>\s*([^<\n]+)/i)
                  || html.match(/\*\*Cat[ée]gorie\s*:\*\*\s*([^\n<]+)/i);
    const categorie = catMatch ? catMatch[1].trim() : null;

    // Localisation
    const locMatch = html.match(/Localisation\s*:\s*<\/strong>\s*([^<\n]+)/i)
                  || html.match(/<strong>Localisation\s*:<\/strong>\s*([^<\n]+)/i)
                  || html.match(/\*\*Localisation\s*:\*\*\s*([^\n<]+)/i);
    const localisation = locMatch ? locMatch[1].trim() : null;

    // Description : paragraphe juste après les méta-infos
    // Cherche le premier <p>...</p> contenant une description (>50 chars)
    const descRegex = /<p[^>]*>([^<]{60,800})<\/p>/g;
    let descMatch;
    let description = null;
    while ((descMatch = descRegex.exec(html)) !== null) {
      const txt = descMatch[1].replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ').trim();
      // Skip si c'est juste du contenu de cookies/menus
      if (txt.length > 60 && !txt.toLowerCase().includes('cookie') && !txt.toLowerCase().includes('navigation')) {
        description = txt;
        break;
      }
    }

    // Photo principale : 1re image après le h1, qui pointe vers /uploads/
    const photoRegex = /<img[^>]+src="(https:\/\/www\.immeubles-patrimoine\.fr\/wp-content\/uploads\/[^"]+)"/g;
    const photos = [];
    let photoMatch;
    while ((photoMatch = photoRegex.exec(html)) !== null) {
      const url = photoMatch[1];
      // Skip logos, icônes
      if (url.includes('logo') || url.includes('cropped-')) continue;
      photos.push(url);
      if (photos.length >= 5) break; // 5 photos max
    }

    return {
      nom,
      categorie,
      localisation,
      description,
      photos,
      url,
      surface: extractSurface(nom),
      arrondissement: extractCodePostal(localisation || nom),
      ville: localisation,
      typologies: deduireTypologies(nom, categorie),
    };
  } catch (e) {
    console.error('[fetchFiche] erreur:', url, e.message);
    return null;
  }
}

// ─── Télécharger une photo et l'uploader sur Supabase Storage ───
async function uploadPhotoToSupabase(supabase, photoUrl, refSlug) {
  try {
    const res = await fetch(photoUrl, { cache: 'no-store' });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const blob = new Uint8Array(buf);
    
    // Détection MIME
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
      console.warn('[uploadPhoto] erreur:', error.message);
      return null;
    }
    const { data: { publicUrl } } = supabase.storage.from('mandat-docs').getPublicUrl(path);
    return { url: publicUrl, storage_path: path };
  } catch (e) {
    console.warn('[uploadPhoto] exception:', e.message);
    return null;
  }
}

// ─── ROUTE POST : 2 modes : 'preview' ou 'import' ───
export async function POST(req) {
  try {
    const body = await req.json();
    const { token, mode, selectedUrls } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    // Vérifier l'utilisateur
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const userId = userData.user.id;

    // ═══ MODE 1 : PREVIEW ═══
    // Scrape la liste + chaque fiche, renvoie l'aperçu pour validation
    if (mode === 'preview') {
      const urls = await fetchListUrls();
      if (urls.length === 0) {
        return NextResponse.json({ error: 'Aucune fiche trouvée sur le site' }, { status: 500 });
      }

      // Scrape toutes les fiches en parallèle (par lots de 5)
      const fiches = [];
      const BATCH = 5;
      for (let i = 0; i < urls.length; i += BATCH) {
        const batch = urls.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(u => fetchFiche(u)));
        for (const r of results) {
          if (r) fiches.push(r);
        }
      }

      return NextResponse.json({ ok: true, count: fiches.length, fiches });
    }

    // ═══ MODE 2 : IMPORT ═══
    // Reçoit la liste des URLs validées, scrape + upload photos + insère en BDD
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

          // Slug pour les noms de fichiers
          const slug = fiche.nom.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

          // Télécharger jusqu'à 5 photos vers Supabase Storage
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

          // Insert la référence
          const { error: insErr } = await supabase.from('references_ventes').insert({
            nom: fiche.nom,
            adresse: null, // pas dispo
            ville: fiche.ville,
            arrondissement: fiche.arrondissement,
            typologies: fiche.typologies,
            surface: fiche.surface || null,
            prix_vente: 0, // À compléter manuellement
            tranche_prix: '<1M', // placeholder, à corriger après saisie du prix
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
    console.error('[import-from-site] erreur globale:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
