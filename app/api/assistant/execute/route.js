// app/api/assistant/execute/route.js
//
// Exécute une action APRÈS confirmation utilisateur depuis le chat Assistant.
// Ce endpoint reçoit une "action" (validée côté UI) et l'exécute en base.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 30;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// ==========================================================================
// ACTIONS
// ==========================================================================

async function executeCreateMandat(data, userId) {
  // Préparation des champs avec valeurs par défaut
  const row = {
    nom: data.nom || 'Sans nom',
    adresse: data.adresse || null,
    ville: data.ville || null,
    type: data.type || 'Immeubles',
    sous_type: data.sous_type || null,
    prix: typeof data.prix === 'number' ? data.prix : 0,
    surface: typeof data.surface === 'number' ? data.surface : 0,
    nb_lots: typeof data.nb_lots === 'number' ? data.nb_lots : 1,
    nb_pieces: typeof data.nb_pieces === 'number' ? data.nb_pieces : null,
    nb_chambres: typeof data.nb_chambres === 'number' ? data.nb_chambres : null,
    etage: typeof data.etage === 'number' ? data.etage : null,
    loyers_annuels: typeof data.loyers_annuels === 'number' ? data.loyers_annuels : 0,
    statut: data.statut || 'Sourcing',
    commercialisation: data.commercialisation || 'Off-market',
    marche: data.marche || null,
    description: data.description || null,
    contact: data.contact || null,
    tel: data.tel || null,
    created_by: userId || null
  };

  const { data: inserted, error } = await supabaseAdmin
    .from('mandats')
    .insert(row)
    .select('id, nom')
    .single();

  if (error) {
    console.error('[assistant/execute] create_mandat error:', error);
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    result: {
      id: inserted.id,
      label: inserted.nom,
      type: 'mandat'
    }
  };
}

// ==========================================================================
// HANDLER
// ==========================================================================

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, token } = body;

    if (!action || !action.type || !action.data) {
      return NextResponse.json({ ok: false, error: 'action invalide' }, { status: 400 });
    }

    // Vérification token (obligatoire pour les actions de création)
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Authentification requise' }, { status: 401 });
    }

    let result;
    switch (action.type) {
      case 'create_mandat':
        result = await executeCreateMandat(action.data, user.id);
        break;
      default:
        return NextResponse.json({ ok: false, error: `Type d'action inconnu : ${action.type}` }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch (e) {
    console.error('[assistant/execute] Erreur:', e);
    return NextResponse.json({ ok: false, error: 'Erreur serveur', detail: e.message }, { status: 500 });
  }
}
