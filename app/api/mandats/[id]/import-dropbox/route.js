// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/[id]/import-dropbox/route.js
// Sprint 4 — Import d'un dossier Dropbox par lien public.
// Télécharge le dossier partagé (ZIP via ?dl=1), le décompresse (pizzip) et
// dépose chaque fichier dans le bucket mandat-docs. Ne fait PAS l'analyse IA :
// renvoie la liste { storage_path, nom, mime_type, taille } ; le front enchaîne
// ensuite l'extraction via /import-folder (même pipeline que l'import local).
// Pas besoin de compte Dropbox : le lien doit être « Tout le monde avec le lien ».
// ═══════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import PizZip from 'pizzip';

export const runtime = 'nodejs';
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const BUCKET = 'mandat-docs';

async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// Force le téléchargement direct du dossier en ZIP sur un lien de partage Dropbox.
function toDropboxZipUrl(url) {
  let u = url.trim();
  // Normalise l'hôte de partage
  u = u.replace('://dl.dropboxusercontent.com', '://www.dropbox.com');
  if (/[?&]dl=0/.test(u)) {
    u = u.replace(/([?&])dl=0/, '$1dl=1');
  } else if (/[?&]dl=1/.test(u)) {
    // déjà bon
  } else {
    u += (u.includes('?') ? '&' : '?') + 'dl=1';
  }
  return u;
}

const MIME_BY_EXT = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv', txt: 'text/plain',
};
function mimeFromName(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

function cleanName(name) {
  const base = name.split('/').pop() || 'fichier';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(request, { params }) {
  try {
    const { token, dropbox_url } = await request.json();

    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const { id: mandatId } = params;
    if (!mandatId || !dropbox_url) {
      return new Response(JSON.stringify({ ok: false, error: 'mandatId et dropbox_url requis' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (!/dropbox\.com|dropboxusercontent\.com/.test(dropbox_url)) {
      return new Response(JSON.stringify({ ok: false, error: 'Lien Dropbox invalide' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 1) Télécharger le dossier en ZIP
    const zipUrl = toDropboxZipUrl(dropbox_url);
    const res = await fetch(zipUrl, { redirect: 'follow' });
    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, error: `Téléchargement Dropbox échoué (HTTP ${res.status}). Vérifie que le lien est public (« Tout le monde avec le lien »).` }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('text/html')) {
      return new Response(JSON.stringify({ ok: false, error: 'Dropbox a renvoyé une page web, pas le dossier. Le lien doit être un lien de DOSSIER partagé en accès public.' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
    const zipBuffer = Buffer.from(await res.arrayBuffer());

    // 2) Décompresser
    let zip;
    try {
      zip = new PizZip(zipBuffer);
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: 'Impossible de décompresser le dossier Dropbox (format inattendu).' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }

    // 3) Déposer chaque fichier dans le storage
    const uploaded = [];
    const errors = [];
    const stamp = Math.random().toString(36).slice(2, 8);
    let idx = 0;
    for (const name in zip.files) {
      const entry = zip.files[name];
      if (entry.dir) continue;
      const base = name.split('/').pop();
      if (!base || base.startsWith('.') || name.includes('__MACOSX')) continue;

      let bytes;
      try {
        bytes = Buffer.from(entry.asUint8Array());
      } catch (e) {
        errors.push({ nom: base, error: 'lecture impossible' });
        continue;
      }
      if (!bytes || bytes.length === 0) continue;

      const mime = mimeFromName(base);
      const storagePath = `${mandatId}/dropbox/${Date.now()}_${stamp}_${idx}_${cleanName(base)}`;
      idx++;

      const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, bytes, { contentType: mime, upsert: false });
      if (upErr) {
        errors.push({ nom: base, error: upErr.message });
        continue;
      }
      uploaded.push({ storage_path: storagePath, nom: base, mime_type: mime, taille: bytes.length });
    }

    return new Response(JSON.stringify({ ok: true, files: uploaded, count: uploaded.length, errors }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[import-dropbox] error:', e);
    return new Response(JSON.stringify({ ok: false, error: e.message || 'Erreur serveur' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
