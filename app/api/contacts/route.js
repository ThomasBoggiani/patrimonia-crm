// app/api/contacts/route.js
// API contacts unifiés (mandants, acquéreurs, apporteurs, notaires...)
// + agrégation des rôles depuis clients et mandat_contacts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─────────────────────────────────────────────────────────────────
// GET /api/contacts?q=...&categorie=...&role=...
// Retourne les contacts avec leurs rôles agrégés
// ─────────────────────────────────────────────────────────────────

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';
    const categorie = searchParams.get('categorie') || null;
    const roleFilter = searchParams.get('role') || null;
    const limit = parseInt(searchParams.get('limit') || '200', 10);

    // 1. Charge les contacts (avec filtre recherche/catégorie)
    let query = supabaseAdmin
      .from('contacts')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(Math.min(limit, 500));

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

    const { data: contacts, error } = await query;
    if (error) {
      console.error('[api/contacts GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const ids = (contacts || []).map(c => c.id);

    // 2. Charge en parallèle : clients liés + mandat_contacts liés
    const [clientsRes, mandatContactsRes] = await Promise.all([
      ids.length > 0
        ? supabaseAdmin.from('clients').select('id, contact_id, typologie, owner, statut, budget_min, budget_max').in('contact_id', ids)
        : Promise.resolve({ data: [] }),
      ids.length > 0
        ? supabaseAdmin.from('mandat_contacts').select('contact_id, role, mandat_id').in('contact_id', ids)
        : Promise.resolve({ data: [] }),
    ]);

    const clientsByContact = {};
    for (const c of clientsRes.data || []) {
      if (!clientsByContact[c.contact_id]) clientsByContact[c.contact_id] = [];
      clientsByContact[c.contact_id].push(c);
    }

    const mandatRolesByContact = {};
    for (const mc of mandatContactsRes.data || []) {
      if (!mandatRolesByContact[mc.contact_id]) mandatRolesByContact[mc.contact_id] = new Set();
      mandatRolesByContact[mc.contact_id].add(mc.role);
    }

    // 3. Agrège les rôles
    const enriched = (contacts || []).map(c => {
      const roles = new Set();
      const clientsLinked = clientsByContact[c.id] || [];
      if (clientsLinked.length > 0) roles.add('acquereur');
      const mandatRoles = mandatRolesByContact[c.id] || new Set();
      mandatRoles.forEach(r => {
        // mandat_contacts.role : 'mandant' / 'proprietaire' / 'interlocuteur' / 'acquereur' / 'apporteur' / 'notaire_vendeur' / 'notaire_acquereur'
        if (r === 'mandant' || r === 'proprietaire') roles.add('mandant');
        else if (r === 'apporteur_mandat') roles.add('apporteur_mandat');
        else if (r === 'apporteur_acquereur') roles.add('apporteur_acquereur');
        else if (r === 'notaire_vendeur' || r === 'notaire_acquereur') roles.add('notaire');
        else if (r === 'acquereur') roles.add('acquereur');
      });
      // Catégorie agence → tag agence automatique
      if (c.categorie === 'agence') roles.add('agence');
      return {
        ...c,
        roles: Array.from(roles),
        clients_count: clientsLinked.length,
        client_typologies: [...new Set(clientsLinked.map(x => x.typologie).filter(Boolean))],
        client_owners: [...new Set(clientsLinked.map(x => x.owner).filter(Boolean))],
      };
    });

    // 4. Filtre par rôle si demandé
    let filtered = enriched;
    if (roleFilter) {
      if (roleFilter === 'sans_role') {
        filtered = enriched.filter(c => c.roles.length === 0);
      } else {
        filtered = enriched.filter(c => c.roles.includes(roleFilter));
      }
    }

    return NextResponse.json({ contacts: filtered });
  } catch (e) {
    console.error('[api/contacts GET] crash', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────
// POST /api/contacts (inchangé)
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
