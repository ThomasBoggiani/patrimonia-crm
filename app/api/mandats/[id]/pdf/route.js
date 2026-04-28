// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/[id]/pdf/route.js — VERSION FINALE v12.2.2
// 
// Auth par token Supabase passé dans l'URL (param ?token=...)
// Le token est récupéré côté client via supabase.auth.getSession()
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
  
  // On utilise le client admin pour vérifier le token
  // (Supabase admin peut décoder n'importe quel JWT signé par le projet)
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) {
    console.warn('[/api/mandats/[id]/pdf] Token invalide:', error?.message);
    return null;
  }
  
  return user;
}

// ─────────────────────────────────────────────────────────────────
// BUILD TEAM POUR PAGE ÉQUIPE PLAQUETTE
// Retourne un array [{ name, role, email, phone, photo, isBoss, position }]
// - Boss (Thomas Ezquerra) → toujours au centre
// - Détenteur du mandat → à gauche (position: 'left')
// - Expéditeur (conseiller connecté) → à droite (position: 'right')
// - Dédoublonne si 2 rôles tombent sur la même personne
// ─────────────────────────────────────────────────────────────────

async function buildTeamForPlaquette({ mandatProfileId, senderUserId }) {
  // 1. Charger tous les profils actifs
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, prenom, nom, email, tel, fonction, photo_url')
    .eq('actif', true);

  if (!profiles || profiles.length === 0) {
    console.warn('[buildTeamForPlaquette] Aucun profil actif trouvé');
    return [];
  }

  // Helper pour transformer un profil en objet team member
  const toMember = (p, extra = {}) => ({
    name: `${p.prenom || ''} ${p.nom || ''}`.trim() || 'Conseiller',
    role: p.fonction || 'Conseiller',
    email: p.email || null,
    phone: p.tel || null,
    photo: p.photo_url || null,
    profileId: p.id,
    ...extra,
  });

  // 2. Trouver le boss : Thomas Ezquerra
  const boss = profiles.find(p =>
    (p.prenom || '').toLowerCase() === 'thomas' &&
    (p.nom || '').toLowerCase() === 'ezquerra'
  );

  // 3. Trouver le détenteur du mandat
  const owner = mandatProfileId
    ? profiles.find(p => p.id === mandatProfileId)
    : null;

  // 4. Trouver l'expéditeur (conseiller connecté)
  const sender = senderUserId
    ? profiles.find(p => p.id === senderUserId)
    : null;

  // 5. Construire l'équipe en dédoublonnant
  const team = [];
  const usedIds = new Set();

  // Boss au centre (priorité absolue)
  if (boss) {
    team.push(toMember(boss, { isBoss: true, position: 'center' }));
    usedIds.add(boss.id);
  }

  // Détenteur à gauche (sauf si c'est déjà le boss)
  if (owner && !usedIds.has(owner.id)) {
    team.push(toMember(owner, { isBoss: false, position: 'left' }));
    usedIds.add(owner.id);
  }

  // Expéditeur à droite (sauf si c'est déjà boss ou détenteur)
  if (sender && !usedIds.has(sender.id)) {
    team.push(toMember(sender, { isBoss: false, position: 'right' }));
    usedIds.add(sender.id);
  }

  console.log('[buildTeamForPlaquette] Équipe construite :', JSON.stringify(team.map(m => ({
    name: m.name,
    isBoss: m.isBoss,
    position: m.position,
    hasPhoto: !!m.photo,
  })), null, 2));

  return team;
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
  // Le nouveau logo épuré sage est utilisé pour les 2 modes
  // (le mode off-market sera ajusté visuellement par le palette noir/or)
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
      // Construction de l'array team pour la page équipe
      const team = await buildTeamForPlaquette({
        mandatProfileId: mandat.profile_id,
        senderUserId: user.id,
      });

      pdfElement = React.createElement(PlaquetteAcheteur, {
        mandat,
        conseiller,
        logoUrl,
        team,
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
