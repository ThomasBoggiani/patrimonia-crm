// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/[id]/pdf/route.js — VERSION v13.3 (clean)
// ═══════════════════════════════════════════════════════════════════

import { renderToStream } from '@react-pdf/renderer';
import React from 'react';
import { createClient } from '@supabase/supabase-js';

import PlaquetteAcheteur from '@/lib/pdf/templates/PlaquetteAcheteur';
import RapportVendeur from '@/lib/pdf/templates/RapportVendeur';
import FicheInterne from '@/lib/pdf/templates/FicheInterne';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    console.warn('[/api/mandats/[id]/pdf] Token invalide:', error?.message);
    return null;
  }
  return user;
}

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
      .select('id, email, prenom, nom')
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
    };
  }

  return { mandat, conseiller };
}

async function loadVendeurStats(mandatId, period) {
  if (!period?.start || !period?.end) {
    return { stats: {}, events: [] };
  }
  return {
    stats: { nb_visites: 0, nb_contacts: 0, nb_offres: 0, nb_vues: 0 },
    events: [],
  };
}

function getLogoUrl(request, isOffMarket) {
  const host = request.headers.get('host') || 'patrimonia-crm.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}/logo-ip-sage.png`;
}

function ensureAbsoluteUrl(path, request) {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const host = request.headers.get('host') || 'patrimonia-crm.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}${path.startsWith('/') ? '' : '/'}${path}`;
}

export async function GET(request, { params }) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const template = url.searchParams.get('template') || 'plaquette';
    const startStr = url.searchParams.get('start');
    const endStr = url.searchParams.get('end');

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

    const { mandat, conseiller, error } = await loadMandatData(mandatId);
    if (error) {
      return new Response(
        JSON.stringify({ ok: false, error }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const logoUrl = getLogoUrl(request, mandat.is_off_market === true);

    let pdfElement;
    let filename;

    if (template === 'plaquette') {
      const { data: profiles, error: pErr } = await supabaseAdmin
        .from('profiles')
        .select(.select('id, prenom, nom, email, fonction, telephone, photo_url'))
        .eq('actif', true);

      if (pErr) console.error('[PDF Plaquette] Profiles query error:', pErr.message);

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
            phone: p.telephone || null,
            photo: ensureAbsoluteUrl(p.photo_url, request),
          };
        }
        if (mandat.profile_id && p.id === mandat.profile_id) {
          ownerProfile = p;
        }
        if (user?.id && p.id === user.id) {
          senderProfile = p;
        }
      }

      let ownerInitials = '';
      if (ownerProfile) {
        ownerInitials = `${(ownerProfile.prenom || '').charAt(0)}${(ownerProfile.nom || '').charAt(0)}`.toUpperCase();
      } else if (mandat.owner && mandat.owner.length <= 3) {
        ownerInitials = mandat.owner.toUpperCase();
      }
      const mandatEnriched = { ...mandat, ownerInitials };

      const conseillerEnriched = senderProfile ? {
        id: senderProfile.id,
        prenom: senderProfile.prenom,
        nom: senderProfile.nom,
        email: senderProfile.email,
        telephone: senderProfile.telephone,
        fonction: senderProfile.fonction || 'Conseiller',
        photo: ensureAbsoluteUrl(senderProfile.photo_url, request),
        full_name: `${senderProfile.prenom || ''} ${senderProfile.nom || ''}`.trim() || 'Conseiller',
        initiales: `${(senderProfile.prenom || '').charAt(0)}${(senderProfile.nom || '').charAt(0)}`.toUpperCase(),
      } : (conseiller ? {
        ...conseiller,
        photo: ensureAbsoluteUrl(conseiller.photo_url, request),
        initiales: `${(conseiller.prenom || '').charAt(0)}${(conseiller.nom || '').charAt(0)}`.toUpperCase(),
      } : null);

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
