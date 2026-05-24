// app/api/contacts/route.js
// API contacts unifiés (mandants, acquéreurs, apporteurs, notaires...)

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─────────────────────────────────────────────────────────────────
// GET /api/contacts?q=...&categorie=...
// ─────────────────────────────────────────────────────────────────

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';
    const categorie = searchParams.get('categorie') || null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let query = supabaseAdmin
      .from('contacts')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(Math.min(limit, 200));

    if (q) {
      const safe = q.replace(/[,()]/g, '');
      const like = `%${safe}%`;
      query = query.or(
        `prenom.ilike.${like},nom.ilike.${like},societe.ilike.${like},email.ilike.${like},tel.ilike.${like}`
      );
    }

    if (categorie) {
      query = query.eq('categorie', categorie);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[api/contacts GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ contacts: data || [] });
  } catch (e) {
    console.error('[api/contacts GET] crash', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────
// POST /api/contacts
// ─────────────────────────────────────────────────────────────────

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      prenom = null,
      nom = null,
      societe = null,
      email = null,
      tel = null,
      type_contact = 'personne_physique',
      categorie = null,
      adresse = null,
      ville = null,
      code_postal = null,
      notes = null,
      created_by = null,
    } = body || {};

    if (!nom && !societe) {
      return NextResponse.json(
        { error: 'Au moins le nom ou la société est requis' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('contacts')
      .insert({
        prenom,
        nom,
        societe,
        email,
        tel,
        type_contact,
        categorie,
        adresse,
        ville,
        code_postal,
        notes,
        created_by,
      })
      .select()
      .single();

    if (error) {
      console.error('[api/contacts POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ contact: data });
  } catch (e) {
    console.error('[api/contacts POST] crash', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
