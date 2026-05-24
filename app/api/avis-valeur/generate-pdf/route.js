// ═══════════════════════════════════════════════════════════════════
// app/api/avis-valeur/generate-pdf/route.js
// Génère l'avis de valeur en PDF React-PDF
// POST { mandatId } → renvoie un PDF
// ═══════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import AvisDeValeur from '@/lib/pdf/templates/AvisDeValeur';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

async function fetchTeamMembers() {
  try {
    const { data, error } = await supabaseAdmin
      .from('team_members')
      .select('*');
    if (error || !data) return {};
    const map = {};
    for (const m of data) {
      const initials = (m.initiales || m.initials || '').toUpperCase();
      if (initials) {
        map[initials] = {
          name: m.name || m.nom || '',
          role: m.role || m.fonction || '',
          email: m.email || '',
          phone: m.phone || m.telephone || '',
          photo: m.avatar_url || m.photo || null,
          initials,
        };
      }
    }
    return map;
  } catch (e) {
    console.warn('[avis-valeur/pdf] fetchTeamMembers error:', e.message);
    return {};
  }
}

export async function POST(request) {
  try {
    // Auth : token DANS le body OU dans le header
    let token = null;
    const authHeader = request.headers.get('authorization') || '';
    token = authHeader.replace(/^Bearer\s+/i, '').trim() || null;

    let mandatId = null;
    try {
      const body = await request.json();
      mandatId = body?.mandatId;
      if (!token && body?.token) token = body.token;
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Body JSON requis avec mandatId' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!mandatId) {
      return new Response(JSON.stringify({ ok: false, error: 'mandatId requis' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Récupère le mandat
    const { data: mandat, error: mErr } = await supabaseAdmin
      .from('mandats')
      .select('*')
      .eq('id', mandatId)
      .maybeSingle();

    if (mErr || !mandat) {
      return new Response(JSON.stringify({ ok: false, error: 'Mandat introuvable' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Charge l'équipe
    const teamMembers = await fetchTeamMembers();

    // Conseiller = utilisateur courant
    let conseiller = null;
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (profile) {
        conseiller = {
          initiales: (profile.initiales || profile.initials || '').toUpperCase(),
          name: profile.name || profile.nom || user.email,
          email: user.email,
        };
      }
    } catch (e) {
      console.warn('[avis-valeur/pdf] conseiller error:', e.message);
    }

    console.log('[avis-valeur/pdf] Génération PDF pour mandat', mandatId);

    // Render PDF
    const pdfBuffer = await renderToBuffer(
      React.createElement(AvisDeValeur, {
        mandat,
        avisData: mandat.avis_valeur || {},
        conseiller,
        teamMembers,
      })
    );

    console.log('[avis-valeur/pdf] PDF généré:', pdfBuffer.length, 'bytes');

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="avis-valeur-${(mandat.nom || mandatId).replace(/[^\w-]/g, '_').slice(0, 60)}.pdf"`,
      },
    });
  } catch (e) {
    console.error('[avis-valeur/pdf] Erreur:', e);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', detail: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
