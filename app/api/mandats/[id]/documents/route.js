// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/[id]/documents/route.js — v2
// CRUD documents : upload direct côté frontend, l'API gère juste les métadonnées
// ═══════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

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

// GET → liste
export async function GET(request, { params }) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const { id: mandatId } = params;
    if (!mandatId) {
      return new Response(JSON.stringify({ ok: false, error: 'ID mandat manquant' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { data: docs, error } = await supabaseAdmin
      .from('mandat_documents')
      .select('*')
      .eq('mandat_id', mandatId)
      .order('created_at', { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const enrichedDocs = await Promise.all((docs || []).map(async (doc) => {
      if (doc.type === 'file' && doc.storage_path) {
        const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(doc.storage_path, 3600);
        return { ...doc, signedUrl: signed?.signedUrl || null };
      }
      return doc;
    }));

    return new Response(JSON.stringify({ ok: true, documents: enrichedDocs }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[/api/mandats/[id]/documents GET] Erreur:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// POST → ajout (lien OU métadonnées de fichier déjà uploadé)
export async function POST(request, { params }) {
  try {
    const { id: mandatId } = params;
    if (!mandatId) {
      return new Response(JSON.stringify({ ok: false, error: 'ID mandat manquant' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await request.json();
    const { token, type, category = 'autre', nom, url: linkUrl, description = null, storage_path, taille_bytes, mime_type } = body;

    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    if (type !== 'link' && type !== 'file_meta') {
      return new Response(JSON.stringify({ ok: false, error: 'Type non supporté' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (type === 'link' && (!nom || !linkUrl)) {
      return new Response(JSON.stringify({ ok: false, error: 'nom et url requis' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (type === 'file_meta' && (!nom || !storage_path)) {
      return new Response(JSON.stringify({ ok: false, error: 'nom et storage_path requis' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const insertData = type === 'link'
      ? {
          mandat_id: mandatId,
          type: 'link',
          category,
          nom,
          url: linkUrl,
          description,
          created_by: user.id,
        }
      : {
          mandat_id: mandatId,
          type: 'file',
          category,
          nom,
          storage_path,
          taille_bytes: taille_bytes || null,
          mime_type: mime_type || null,
          description,
          created_by: user.id,
        };

    const { data: doc, error: insErr } = await supabaseAdmin
      .from('mandat_documents')
      .insert(insertData)
      .select()
      .single();

    if (insErr) {
      return new Response(JSON.stringify({ ok: false, error: 'Insert échoué', details: insErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true, document: doc }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[/api/mandats/[id]/documents POST] Erreur:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// DELETE → suppression (BDD + Storage si fichier)
export async function DELETE(request, { params }) {
  try {
    const body = await request.json();
    const { token, document_id } = body;

    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    if (!document_id) {
      return new Response(JSON.stringify({ ok: false, error: 'document_id requis' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { data: doc, error: getErr } = await supabaseAdmin
      .from('mandat_documents')
      .select('*')
      .eq('id', document_id)
      .maybeSingle();

    if (getErr || !doc) {
      return new Response(JSON.stringify({ ok: false, error: 'Document introuvable' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    if (doc.type === 'file' && doc.storage_path) {
      const { error: storageErr } = await supabaseAdmin.storage.from(BUCKET).remove([doc.storage_path]);
      if (storageErr) console.warn('[DELETE] Storage warning:', storageErr.message);
    }

    const { error: delErr } = await supabaseAdmin
      .from('mandat_documents')
      .delete()
      .eq('id', document_id);

    if (delErr) {
      return new Response(JSON.stringify({ ok: false, error: 'Delete échoué', details: delErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[/api/mandats/[id]/documents DELETE] Erreur:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}