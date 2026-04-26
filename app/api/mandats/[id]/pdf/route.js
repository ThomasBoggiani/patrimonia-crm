// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/[id]/pdf/route.js — VERSION CORRIGÉE v12.2.1
// 
// Utilise @supabase/ssr (déjà dans ton package.json v12) pour gérer 
// l'auth de manière robuste, quel que soit le format de cookie.
// 
// Usage :
//   GET /api/mandats/{uuid}/pdf?template=plaquette
//   GET /api/mandats/{uuid}/pdf?template=rapport&start=2026-01-01&end=2026-04-01
//   GET /api/mandats/{uuid}/pdf?template=interne
// ═══════════════════════════════════════════════════════════════════

import { renderToStream } from '@react-pdf/renderer';
import React from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

import PlaquetteAcheteur from '@/lib/pdf/templates/PlaquetteAcheteur';
import RapportVendeur from '@/lib/pdf/templates/RapportVendeur';
import FicheInterne from '@/lib/pdf/templates/FicheInterne';

// Client admin pour charger les données (bypasse RLS).
// On vérifie l'auth séparément AVANT d'utiliser ce client.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─────────────────────────────────────────────────────────────────
// AUTH : utilise @supabase/ssr pour gérer les cookies proprement
// ─────────────────────────────────────────────────────────────────

async function getCurrentUser() {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        // Pas besoin de set/remove pour une simple lecture
        set() {},
        remove() {},
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// ─────────────────────────────────────────────────────────────────
// LOAD MANDAT + CONSEILLER
// ─────────────────────────────────────────────────────────────────

async function loadMandatData(mandatId) {
  const { data: mandat, error: mErr } = await supabaseAdmin
    .from('mandats')
    .select('*')
    .eq('id', mandatId)
    .maybeSingle();

  if (mErr || !mandat) {
    return { error: 'Mandat introuvable', mandat: null };
  }

  let conseiller = null;
  if (mandat.profile_id) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, tel')
      .eq('id', mandat.profile_id)
      .maybeSingle();
    conseiller = profile;
  }

  if (!conseiller && mandat.owner) {
    conseiller = {
      full_name: mandat.owner,
      email: null,
      tel: null,
    };
  }

  return { mandat, conseiller };
}

// ─────────────────────────────────────────────────────────────────
// LOAD STATS POUR LE RAPPORT VENDEUR
// ─────────────────────────────────────────────────────────────────

async function loadVendeurStats(mandatId, period) {
  if (!period?.start || !period?.end) {
    return { stats: {}, events: [] };
  }
  // À enrichir plus tard avec les vraies tables (visites, deals…)
  return {
    stats: {
      nb_visites: 0,
      nb_contacts: 0,
      nb_offres: 0,
      nb_vues: 0,
    },
    events: [],
  };
}

// ─────────────────────────────────────────────────────────────────
// CONSTRUCTION URL DES LOGOS
// ─────────────────────────────────────────────────────────────────

function getLogoUrl(request, isOffMarket) {
  const host = request.headers.get('host') || 'patrimonia-crm.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  return isOffMarket
    ? `${baseUrl}/logos/logo-ip-offmarket.png`
    : `${baseUrl}/logos/logo-ip-standard.png`;
}

// ─────────────────────────────────────────────────────────────────
// HANDLER GET
// ─────────────────────────────────────────────────────────────────

export async function GET(request, { params }) {
  try {
    // 1. Auth
    const user = await getCurrentUser();
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Authentification requise' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Paramètres
    const { id: mandatId } = params;
    const url = new URL(request.url);
    const template = url.searchParams.get('template') || 'plaquette';
    const startStr = url.searchParams.get('start');
    const endStr = url.searchParams.get('end');

    if (!mandatId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'ID mandat manquant' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Chargement données
    const { mandat, conseiller, error } = await loadMandatData(mandatId);
    if (error) {
      return new Response(
        JSON.stringify({ ok: false, error }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Logo selon mode
    const logoUrl = getLogoUrl(request, mandat.is_off_market === true);

    // 5. Sélection template
    let pdfElement;
    let filename;

    if (template === 'plaquette') {
      pdfElement = React.createElement(PlaquetteAcheteur, {
        mandat,
        conseiller,
        logoUrl,
      });
      filename = `Plaquette_${slugify(mandat.nom)}.pdf`;
    } else if (template === 'rapport') {
      if (!startStr || !endStr) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: 'Pour un rapport, fournir start et end (format YYYY-MM-DD)',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const period = { start: startStr, end: endStr };
      const { stats, events } = await loadVendeurStats(mandatId, period);

      pdfElement = React.createElement(RapportVendeur, {
        mandat,
        conseiller,
        logoUrl,
        period,
        stats,
        events,
      });
      filename = `Rapport_${slugify(mandat.nom)}_${startStr}_${endStr}.pdf`;
    } else if (template === 'interne') {
      pdfElement = React.createElement(FicheInterne, {
        mandat,
        conseiller,
        logoUrl,
      });
      filename = `Fiche_interne_${slugify(mandat.nom)}.pdf`;
    } else {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Template inconnu : "${template}". Valeurs : plaquette, rapport, interne.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Rendu
    const stream = await renderToStream(pdfElement);

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[/api/mandats/[id]/pdf] Erreur:', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────────

function slugify(str) {
  if (!str) return 'mandat';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
}
