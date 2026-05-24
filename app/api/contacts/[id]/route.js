// app/api/contacts/[id]/route.js
// Get / Update / Delete un contact spécifique + ses relations

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─────────────────────────────────────────────────────────────────
// GET /api/contacts/[id]
// Retourne le contact + tous ses liens (mandats + clients)
// ─────────────────────────────────────────────────────────────────

export async function GET(_request, { params }) {
  try {
    const { id } = params;

    const [{ data: contact, error: e1 }, { data: mandatLinks, error: e2 }, { data: clientLinks, error: e3 }] =
      await Promise.all([
        supabaseAdmin.from('contacts').select('*').eq('id', id).maybeSingle(),
        supabaseAdmin
          .from('mandat_contacts')
          .select('id, role, est_principal, notes, mandat:mandats(id, nom, statut, ville)')
          .eq('contact_id', id),
        supabaseAdmin
          .from('clients')
          .select('id, nom, prenom, societe, statut, typologie, marche, owner')
          .eq('contact_id', id),
      ]);

    if (e1) {
      console.error('[api/contacts/[id] GET]', e1);
      return NextResponse.json({ error: e1.message }, { status: 500 });
    }
    if (!contact) {
      return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 });
    }

    return NextResponse.json({
      contact,
      mandats: mandatLinks || [],
      clients: clientLinks || [],
    });
  } catch (e) {
    console.error('[api/contacts/[id] GET] crash', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────
// PATCH /api/contacts/[id]
// ─────────────────────────────────────────────────────────────────

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();

    const allowedFields = [
      'prenom', 'nom', 'societe', 'email', 'tel',
      'type_contact', 'categorie',
      'adresse', 'ville', 'code_postal',
      'notes',
    ];
    const patch = {};
    for (const k of allowedFields) {
      if (k in body) patch[k] = body[k];
    }

    const { data, error } = await supabaseAdmin
      .from('contacts')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[api/contacts/[id] PATCH]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ contact: data });
  } catch (e) {
    console.error('[api/contacts/[id] PATCH] crash', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────
// DELETE /api/contacts/[id]
// ─────────────────────────────────────────────────────────────────

export async function DELETE(_request, { params }) {
  try {
    const { id } = params;

    const { data: clientLinks } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('contact_id', id)
      .limit(1);

    if (clientLinks && clientLinks.length > 0) {
      return NextResponse.json(
        { error: 'Ce contact est lié à un client, impossible de supprimer' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from('contacts').delete().eq('id', id);

    if (error) {
      console.error('[api/contacts/[id] DELETE]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[api/contacts/[id] DELETE] crash', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
