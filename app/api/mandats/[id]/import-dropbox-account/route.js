// ===================================================================
// app/api/mandats/[id]/import-dropbox-account/route.js
// Import d'un dossier Dropbox via le COMPTE CONNECTE (provider='dropbox').
// Lit le dossier partage fichier par fichier (API Dropbox) -> aucune limite de
// taille. Depose chaque fichier dans mandat-docs et renvoie la liste ; le front
// enchaine l'analyse IA via /import-folder (meme pipeline que l'import local).
// ===================================================================

import { createClient } from '@supabase/supabase-js';
import { refreshAccessToken, listSharedLinkFiles, downloadSharedLinkFile, getSharedLinkPath, listFolderByPath, downloadFileByPath } from '@/lib/dropbox';

export const runtime = 'nodejs';
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const BUCKET = 'mandat-docs';
const MAX_FILES = 60;

async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
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
  return (name.split('/').pop() || 'fichier').replace(/[^a-zA-Z0-9._-]/g, '_');
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

    // 1) Récupérer l'intégration Dropbox de l'utilisateur
    const { data: integ } = await supabaseAdmin
      .from('user_integrations')
      .select('access_token, refresh_token, token_expires_at')
      .eq('user_id', user.id)
      .eq('provider', 'dropbox')
      .maybeSingle();

    if (!integ) {
      return new Response(JSON.stringify({ ok: false, needsConnect: true, error: 'Compte Dropbox non connecté. Va dans Intégrations pour le connecter.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 2) Rafraîchir le token si expiré
    let accessToken = integ.access_token;
    const expired = integ.token_expires_at && new Date(integ.token_expires_at).getTime() < (Date.now() + 60000);
    if (expired && integ.refresh_token) {
      try {
        const refreshed = await refreshAccessToken({
          clientId: process.env.DROPBOX_APP_KEY || process.env.NEXT_PUBLIC_DROPBOX_APP_KEY,
          clientSecret: process.env.DROPBOX_APP_SECRET,
          refreshToken: integ.refresh_token,
        });
        accessToken = refreshed.access_token;
        const newExp = refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString() : null;
        await supabaseAdmin.from('user_integrations')
          .update({ access_token: accessToken, token_expires_at: newExp, updated_at: new Date().toISOString() })
          .eq('user_id', user.id).eq('provider', 'dropbox');
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: 'Session Dropbox expirée. Reconnecte ton compte dans Intégrations.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 3) Lister les fichiers du dossier.
    // Priorité : si le compte possède le dossier → liste récursive par chemin (fiable).
    // Sinon → parcours du lien partagé (moins fiable sur les sous-dossiers).
    let listed;
    let ownerPath = null;
    try {
      ownerPath = await getSharedLinkPath({ accessToken, url: dropbox_url });
      if (ownerPath) {
        listed = await listFolderByPath({ accessToken, path: ownerPath, maxFiles: MAX_FILES });
      } else {
        listed = await listSharedLinkFiles({ accessToken, url: dropbox_url, maxFiles: MAX_FILES });
      }
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: 'Lecture du dossier Dropbox échouée : ' + (e.message || '') }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
    if (!listed.length) {
      return new Response(JSON.stringify({ ok: true, files: [], count: 0, errors: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 4) Télécharger + déposer chaque fichier (par lots)
    const stamp = Math.random().toString(36).slice(2, 8);
    const uploaded = [];
    const errors = [];
    const BATCH = 4;
    let idx = 0;
    for (let i = 0; i < listed.length; i += BATCH) {
      const batch = listed.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(async (f) => {
        try {
          const buf = ownerPath
            ? await downloadFileByPath({ accessToken, path: f.path })
            : await downloadSharedLinkFile({ accessToken, url: dropbox_url, path: f.path });
          if (!buf || buf.length === 0) return null;
          const mime = mimeFromName(f.name);
          const storagePath = `${mandatId}/dropbox/${Date.now()}_${stamp}_${idx++}_${cleanName(f.name)}`;
          const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, buf, { contentType: mime, upsert: false });
          if (upErr) return { error: upErr.message, nom: f.name };
          return { ok: true, storage_path: storagePath, nom: f.name, mime_type: mime, taille: buf.length };
        } catch (e) {
          return { error: e.message, nom: f.name };
        }
      }));
      for (const r of results) {
        if (!r) continue;
        if (r.ok) uploaded.push({ storage_path: r.storage_path, nom: r.nom, mime_type: r.mime_type, taille: r.taille });
        else errors.push({ nom: r.nom, error: r.error });
      }
    }

    return new Response(JSON.stringify({ ok: true, files: uploaded, count: uploaded.length, errors, truncated: listed.length >= MAX_FILES }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[import-dropbox-account] error:', e);
    return new Response(JSON.stringify({ ok: false, error: e.message || 'Erreur serveur' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
