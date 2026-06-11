// app/api/ai/conversation/route.js
// API unifiée de persistance des conversations IA (assistants global / mandat / client).
// Une seule table : ai_conversations (scope, entity_id, user_id, messages, summary).
// - GET  : charge l'historique d'une conversation
// - POST : crée ou met à jour (upsert) la conversation avec les messages fournis
//
// Cette route ne fait QUE la persistance. La logique IA (appel Claude, outils) est ailleurs.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const VALID_SCOPES = ['global', 'mandat', 'client'];

// Récupère l'utilisateur depuis le token Authorization
async function getUser(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data?.user || null;
}

// ─────────────────────────────────────────────────────────────────
// GET /api/ai/conversation?scope=mandat&entity_id=xxx
// Renvoie { conversation: { id, messages, summary } | null }
// ─────────────────────────────────────────────────────────────────
export async function GET(request) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'global';
    const entityId = searchParams.get('entity_id') || null;

    if (!VALID_SCOPES.includes(scope)) {
      return NextResponse.json({ error: 'scope invalide' }, { status: 400 });
    }
    if (scope !== 'global' && !entityId) {
      return NextResponse.json({ error: 'entity_id requis pour ce scope' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('ai_conversations')
      .select('id, messages, summary, updated_at')
      .eq('scope', scope)
      .eq('user_id', user.id);

    if (scope === 'global') {
      query = query.is('entity_id', null);
    } else {
      query = query.eq('entity_id', entityId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error('[ai/conversation GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      conversation: data
        ? { id: data.id, messages: data.messages || [], summary: data.summary || null }
        : null,
    });
  } catch (e) {
    console.error('[ai/conversation GET] crash', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────
// POST /api/ai/conversation
// Body : { scope, entity_id, messages, summary? }
// Upsert : crée ou met à jour la conversation. Renvoie { conversation }
// ─────────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const body = await request.json();
    const scope = body.scope || 'global';
    const entityId = body.entity_id || null;
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const summary = body.summary ?? null;

    if (!VALID_SCOPES.includes(scope)) {
      return NextResponse.json({ error: 'scope invalide' }, { status: 400 });
    }
    if (scope !== 'global' && !entityId) {
      return NextResponse.json({ error: 'entity_id requis pour ce scope' }, { status: 400 });
    }

    // Cherche une conversation existante pour ce (scope, entity, user)
    let findQuery = supabaseAdmin
      .from('ai_conversations')
      .select('id')
      .eq('scope', scope)
      .eq('user_id', user.id);
    findQuery = scope === 'global'
      ? findQuery.is('entity_id', null)
      : findQuery.eq('entity_id', entityId);

    const { data: existing } = await findQuery.maybeSingle();

    const now = new Date().toISOString();

    if (existing) {
      // Mise à jour
      const { data, error } = await supabaseAdmin
        .from('ai_conversations')
        .update({ messages, summary, updated_at: now })
        .eq('id', existing.id)
        .select('id, messages, summary')
        .single();
      if (error) {
        console.error('[ai/conversation POST update]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ conversation: data });
    } else {
      // Création
      const row = {
        scope,
        entity_id: entityId,
        user_id: user.id,
        messages,
        summary,
        // Compat : on remplit aussi mandat_id si scope mandat (colonne legacy encore présente)
        mandat_id: scope === 'mandat' ? entityId : null,
        created_at: now,
        updated_at: now,
      };
      const { data, error } = await supabaseAdmin
        .from('ai_conversations')
        .insert(row)
        .select('id, messages, summary')
        .single();
      if (error) {
        console.error('[ai/conversation POST insert]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ conversation: data });
    }
  } catch (e) {
    console.error('[ai/conversation POST] crash', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
