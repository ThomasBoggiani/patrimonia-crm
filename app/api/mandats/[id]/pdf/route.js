// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/[id]/pdf/route.js
// 
// Endpoint qui génère le PDF d'un mandat selon le template choisi.
// 
// Usage :
//   GET /api/mandats/{uuid}/pdf?template=plaquette
//   GET /api/mandats/{uuid}/pdf?template=rapport&start=2026-01-01&end=2026-04-01
//   GET /api/mandats/{uuid}/pdf?template=interne
// 
// Templates :
//   - plaquette : pour les acheteurs (= défaut)
//   - rapport   : pour le vendeur (avec params start + end)
//   - interne   : pour archive équipe
// 
// Auth : utilisateur authentifié (cookie Supabase)
// ═══════════════════════════════════════════════════════════════════

import { renderToStream } from '@react-pdf/renderer';
import React from 'react';
import { createClient } from '@supabase/supabase-js';

import PlaquetteAcheteur from '@/lib/pdf/templates/PlaquetteAcheteur';
import RapportVendeur from '@/lib/pdf/templates/RapportVendeur';
import FicheInterne from '@/lib/pdf/templates/FicheInterne';

// Client Supabase admin (on charge le mandat sans avoir besoin de RLS).
// L'auth utilisateur est vérifiée séparément via le cookie.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─────────────────────────────────────────────────────────────────
// AUTH : vérifie que l'utilisateur appelant est bien authentifié
// ─────────────────────────────────────────────────────────────────

async function getCurrentUser(request) {
  // Récupère le token Supabase depuis le cookie
  const cookieHeader = request.headers.get('cookie') || '';

  // Le nom du cookie Supabase commence par "sb-" et finit par "-auth-token"
  const cookieMatch = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/);
  if (!cookieMatch) return null;

  let token;
  try {
    // Le cookie est encodé URL + JSON
    const decoded = decodeURIComponent(cookieMatch[1]);
    const parsed = JSON.parse(decoded);
    token = Array.isArray(parsed) ? parsed[0] : parsed.access_token;
  } catch (e) {
    return null;
  }

  if (!token) return null;

  // Vérifie le token et récupère le user
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  return user;
}

// ─────────────────────────────────────────────────────────────────
// LOAD MANDAT + CONSEILLER
// ─────────────────────────────────────────────────────────────────

async function loadMandatData(mandatId) {
  // Charge le mandat
  const { data: mandat, error: mErr } = await supabaseAdmin
    .from('mandats')
    .select('*')
    .eq('id', mandatId)
    .maybeSingle();

  if (mErr || !mandat) {
    return { error: 'Mandat introuvable', mandat: null };
  }

  // Charge le conseiller via profile_id (puis fallback owner texte)
  let conseiller = null;
  if (mandat.profile_id) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, tel')
      .eq('id', mandat.profile_id)
      .maybeSingle();
    conseiller = profile;
  }

  // Si pas de profile_id, on construit un conseiller basique avec les initiales
  if (!conseiller && mandat.owner) {
    conseiller = {
      full_name: mandat.owner, // affiche les initiales par défaut
      email: null,
      tel: null,
    };
  }

  return { mandat, conseiller };
}

// ─────────────────────────────────────────────────────────────────
// LOAD STATS POUR LE RAPPORT VENDEUR
// ─────────────────────────────────────────────────────────────────
// Pour la v1, on calcule des stats simples basées sur les interactions
// du CRM dans la période donnée. À enrichir plus tard avec un vrai pipeline.

async function loadVendeurStats(mandatId, period) {
  if (!period?.start || !period?.end) {
    return { stats: {}, events: [] };
  }

  // Pour l'instant, on retourne des stats basiques.
  // À connecter aux vraies tables (visites, deals, etc.) selon ton schéma v12.
  // Tu pourras ajuster cette fonction quand tu auras défini ces tables.

  // EXEMPLE : si tu as une table "visites" liée aux mandats par mandat_id :
  //
  // const { data: visites } = await supabaseAdmin
  //   .from('visites')
  //   .select('*')
  //   .eq('mandat_id', mandatId)
  //   .gte('date', period.start)
  //   .lte('date', period.end);

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
// CONSTRUCTION URL DES LOGOS (absolues)
// ─────────────────────────────────────────────────────────────────

function getLogoUrl(request, isOffMarket) {
  // On construit l'URL absolue à partir de l'host de la requête
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
    const user = await getCurrentUser(request);
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Authentification requise' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Récupération paramètres
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
      // Validation des dates pour le rapport
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
