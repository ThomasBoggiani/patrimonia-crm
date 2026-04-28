// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/[id]/pdf/route.js — VERSION v13.1
//
// Auth par token Supabase passé dans l'URL (param ?token=...)
//
// Usage :
//   GET /api/mandats/{uuid}/pdf?template=plaquette&token=eyJhbG...
//   GET /api/mandats/{uuid}/pdf?template=rapport&start=...&end=...&token=...
//   GET /api/mandats/{uuid}/pdf?template=interne&token=...
// ═══════════════════════════════════════════════════════════════════

import { renderToStream } from '@react-pdf/renderer';
import React from 'react';
import { createClient } from '@supabase/supabase-js';

import PlaquetteAcheteur from '@/lib/pdf/templates/PlaquetteAcheteur';
import RapportVendeur from '@/lib/pdf/templates/RapportVendeur';
import FicheInterne from '@/lib/pdf/templates/FicheInterne';

// Client admin pour charger les données (bypasse RLS).
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─────────────────────────────────────────────────────────────────
// AUTH par token URL
// ─────────────────────────────────────────────────────────────────

async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    console.warn('[/api/mandats/[id]/pdf] Token invalide:', error?.message);
    return null;
  }
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
      .select('id, email, prenom, nom, tel')
      .eq('id', mandat.profile_id)
      .maybeSingle();

    if (profile) {
      conseiller = {
        ...profile,
        full_name: `${profile.prenom || ''} ${profile.nom || ''}`.trim() || 'Conseiller',
      };
    }
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

// Construit une URL absolue à partir d'un chemin relatif
function ensureAbsoluteUrl(path, request) {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const host = request.headers.get('host') || 'patrimonia-crm.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}${path.startsWith('/') ? '' : '/'}${path}`;
}
function getLogoUrl(request, isOffMarket) {
  const host = request.headers.get('host') || 'patrimonia-crm.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;
  return `${baseUrl}/logo-ip-sage.png`;
}

// ─────────────────────────────────────────────────────────────────
// HANDLER GET
// ─────────────────────────────────────────────────────────────────

export async function GET(request, { params }) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const template = url.searchParams.get('template') || 'plaquette';
    const startStr = url.searchParams.get('start');
    const endStr = url.searchParams.get('end');

    // 1. Auth par token URL
    const user = await verifyToken(token);
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Authentification requise' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. ID mandat
    const { id: mandatId } = params;
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
      // Construction du dictionnaire des membres pour la page équipe
      const { data: profiles, error: pErr } = await supabaseAdmin
        .from('profiles')
        .select('id, prenom, nom, email, fonction, photo_url')
        .eq('actif', true);

      console.log('[PDF Plaquette] profiles count =', profiles?.length || 0);
      if (pErr) console.error('[PDF Plaquette] Erreur profiles query:', pErr.message);

      const teamMembers = {};
      let ownerProfile = null;
      let senderProfile = null;

      for (const p of (profiles || [])) {
        const initials = `${(p.prenom || '').charAt(0)}${(p.nom || '').charAt(0)}`.toUpperCase();
        if (initials) {
          teamMembers[initials] = {
            name: `${p.prenom || ''} ${p.nom || ''}`.trim(),
            role: p.fonction || 'Conseiller',
            email: p.email,
            phone: null,
            photo: ensureAbsoluteUrl(p.photo_url, request),
          };
        }
        // Identifier le détenteur du mandat par profile_id
        if (mandat.profile_id && p.id === mandat.profile_id) {
          ownerProfile = p;
        }
        // Identifier l'expéditeur (utilisateur connecté)
        if (user?.id && p.id === user.id) {
          senderProfile = p;
        }
      }

      // Calculer les initiales du détenteur
      // Stratégie : 1) profile_id si présent, 2) mandat.owner si court (≤3 chars = probablement initiales)
      let ownerInitials = '';
      if (ownerProfile) {
        ownerInitials = `${(ownerProfile.prenom || '').charAt(0)}${(ownerProfile.nom || '').charAt(0)}`.toUpperCase();
      } else if (mandat.owner && mandat.owner.length <= 3) {
        ownerInitials = mandat.owner.toUpperCase();
      }
      const mandatEnriched = { ...mandat, ownerInitials };

      // Calculer les infos du sender (utilisateur connecté = celui qui envoie le PDF)
      const conseillerEnriched = senderProfile ? {
        id: senderProfile.id,
        prenom: senderProfile.prenom,
        nom: senderProfile.nom,
        email: senderProfile.email,
        full_name: `${senderProfile.prenom || ''} ${senderProfile.nom || ''}`.trim() || 'Conseiller',
        initiales: `${(senderProfile.prenom || '').charAt(0)}${(senderProfile.nom || '').charAt(0)}`.toUpperCase(),
      } : (conseiller ? {
        ...conseiller,
        initiales: `${(conseiller.prenom || '').charAt(0)}${(conseiller.nom || '').charAt(0)}`.toUpperCase(),
      } : null);

      // Logs de debug
      console.log('[PDF Plaquette] mandat.profile_id =', mandat.profile_id);
      console.log('[PDF Plaquette] mandat.owner =', mandat.owner);
      console.log('[PDF Plaquette] ownerInitials calculés =', ownerInitials);
      console.log('[PDF Plaquette] sender = user.id', user?.id, '→ initiales =', conseillerEnriched?.initiales);
      console.log('[PDF Plaquette] teamMembers keys =', Object.keys(teamMembers));

      pdfElement = React.createElement(PlaquetteAcheteur, {
        mandat: mandatEnriched,
        conseiller: conseillerEnriched,
        logoUrl,
        teamMembers,
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
