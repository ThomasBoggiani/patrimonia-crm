// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/[id]/documents/route.js
// CRUD documents : fichiers (Storage) + liens externes
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

// ═══════════════════════════════════════════════════════════════════
// GET → liste des documents d'un mandat (avec URLs signées pour fichiers)
// ═══════════════════════════════════════════════════════════════════
export async function GET(request, { params }) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    const user = await verifyToken(token);
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Authentification requise' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { id: mandatId } = params;
    if (!mandatId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'ID mandat manquant' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Charger les documents
    const { data: docs, error } = await supabaseAdmin
      .from('mandat_documents')
      .select('*')
      .eq('mandat_id', mandatId)
      .order('created_at', { ascending: false });

    if (error) {
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Pour chaque fichier, générer une URL signée valide 1h
    const enrichedDocs = await Promise.all((docs || []).map(async (doc) => {
      if (doc.type === 'file' && doc.storage_path) {
        const { data: signed } = await supabaseAdmin
          .storage
          .from(BUCKET)
          .createSignedUrl(doc.storage_path, 3600); // 1h
        return { ...doc, signedUrl: signed?.signedUrl || null };
      }
      return doc;
    }));

    return new Response(
      JSON.stringify({ ok: true, documents: enrichedDocs }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[/api/mandats/[id]/documents GET] Erreur:', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// POST → ajout d'un document
// 2 modes :
// 1. multipart/form-data avec un fichier  → upload + insert
// 2. application/json { type:'link', ... } → juste insert
// ═══════════════════════════════════════════════════════════════════
export async function POST(request, { params }) {
  try {
    const { id: mandatId } = params;
    if (!mandatId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'ID mandat manquant' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const contentType = request.headers.get('content-type') || '';

    // ─── Mode multipart : upload de fichier ───
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const token = formData.get('token');
      const file = formData.get('file');
      const category = formData.get('category') || 'autre';
      const nom = formData.get('nom') || file?.name || 'document';
      const description = formData.get('description') || null;

      const user = await verifyToken(token);
      if (!user) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Authentification requise' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!file || typeof file === 'string') {
        return new Response(
          JSON.stringify({ ok: false, error: 'Fichier manquant' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Sanitize nom de fichier
      const cleanName = (file.name || 'file')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${mandatId}/${Date.now()}_${cleanName}`;

      // Upload vers Supabase Storage
      const arrayBuffer = await file.arrayBuffer();
      const { error: uploadErr } = await supabaseAdmin
        .storage
        .from(BUCKET)
        .upload(storagePath, arrayBuffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });

      if (uploadErr) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Upload échoué', details: uploadErr.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Insert en BDD
      const { data: doc, error: insErr } = await supabaseAdmin
        .from('mandat_documents')
        .insert({
          mandat_id: mandatId,
          type: 'file',
          category,
          nom,
          storage_path: storagePath,
          taille_bytes: file.size,
          mime_type: file.type || 'application/octet-stream',
          description,
          created_by: user.id,
        })
        .select()
        .single();

      if (insErr) {
        // Rollback : supprimer le fichier uploadé
        await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
        return new Response(
          JSON.stringify({ ok: false, error: 'Insert échoué', details: insErr.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ ok: true, document: doc }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ─── Mode JSON : ajout de lien ───
    const body = await request.json();
    const { token, type, category = 'autre', nom, url: linkUrl, description = null } = body;

    const user = await verifyToken(token);
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Authentification requise' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (type !== 'link') {
      return new Response(
        JSON.stringify({ ok: false, error: 'Type non supporté en JSON' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!nom || !linkUrl) {
      return new Response(
        JSON.stringify({ ok: false, error: 'nom et url requis' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: doc, error: insErr } = await supabaseAdmin
      .from('mandat_documents')
      .insert({
        mandat_id: mandatId,
        type: 'link',
        category,
        nom,
        url: linkUrl,
        description,
        created_by: user.id,
      })
      .select()
      .single();

    if (insErr) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Insert échoué', details: insErr.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, document: doc }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[/api/mandats/[id]/documents POST] Erreur:', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// DELETE → suppression d'un document (BDD + Storage si fichier)
// Body JSON : { token, document_id }
// ═══════════════════════════════════════════════════════════════════
export async function DELETE(request, { params }) {
  try {
    const body = await request.json();
    const { token, document_id } = body;

    const user = await verifyToken(token);
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Authentification requise' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!document_id) {
      return new Response(
        JSON.stringify({ ok: false, error: 'document_id requis' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Charger le doc pour récupérer storage_path
    const { data: doc, error: getErr } = await supabaseAdmin
      .from('mandat_documents')
      .select('*')
      .eq('id', document_id)
      .maybeSingle();

    if (getErr || !doc) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Document introuvable' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Si fichier : supprimer du Storage
    if (doc.type === 'file' && doc.storage_path) {
      const { error: storageErr } = await supabaseAdmin
        .storage
        .from(BUCKET)
        .remove([doc.storage_path]);
      if (storageErr) {
        console.warn('[DELETE] Storage remove warning:', storageErr.message);
      }
    }

    // Supprimer en BDD
    const { error: delErr } = await supabaseAdmin
      .from('mandat_documents')
      .delete()
      .eq('id', document_id);

    if (delErr) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Delete échoué', details: delErr.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[/api/mandats/[id]/documents DELETE] Erreur:', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
