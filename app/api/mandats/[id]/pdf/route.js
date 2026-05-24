// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/[id]/pdf/route.js — VERSION v13.6 (clean restore)
// ═══════════════════════════════════════════════════════════════════

import { renderToStream } from '@react-pdf/renderer';
import React from 'react';
import { createClient } from '@supabase/supabase-js';

import PlaquetteAcheteur from '@/lib/pdf/templates/PlaquetteAcheteur';
import RapportVendeur from '@/lib/pdf/templates/RapportVendeur';
import FicheInterne from '@/lib/pdf/templates/FicheInterne';
import { getLocationImages } from '@/lib/maps';

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
      .select('id, email, prenom, nom, telephone, avatar_url, fonction')
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

  const startDate = new Date(period.start);
  const endDate = new Date(period.end);
  // Inclure toute la journée de fin
  endDate.setHours(23, 59, 59, 999);

  // ─── Charger les deals (matchings vendeur/acheteur) ───
  const { data: deals = [] } = await supabaseAdmin
    .from('deals')
    .select('id, statut, created_at, updated_at, client_id, mandat_id, notes')
    .eq('mandat_id', mandatId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  // ─── Charger les clients pour les noms ───
  const clientIds = [...new Set((deals || []).map(d => d.client_id).filter(Boolean))];
  let clientsById = {};
  if (clientIds.length > 0) {
    const { data: clients = [] } = await supabaseAdmin
      .from('clients')
      .select('id, prenom, nom, societe')
      .in('id', clientIds);
    clientsById = Object.fromEntries((clients || []).map(c => [c.id, c]));
  }

  // ─── Charger les tâches sur le mandat ───
  const { data: todos = [] } = await supabaseAdmin
    .from('todos')
    .select('id, titre, statut, priorite, echeance, created_at, updated_at')
    .eq('lien_type', 'mandat')
    .eq('lien_id', mandatId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  // ─── Charger le mandat pour les dates clés ───
  const { data: mandat } = await supabaseAdmin
    .from('mandats')
    .select('created_at, date_signature, date_vente')
    .eq('id', mandatId)
    .maybeSingle();

  // ─── Calculer les stats ───
  const dealsList = deals || [];
  const stats = {
    nb_contacts: dealsList.length,
    nb_visites: dealsList.filter(d => d.statut === 'Visite').length,
    nb_offres: dealsList.filter(d => d.statut === 'Offre' || d.statut === 'Promesse' || d.statut === 'Gagné').length,
    nb_vues: 'N/A',
  };

  // ─── Construire les events (chronologie) ───
  const events = [];

  // 1. Création du mandat (si dans la période)
  if (mandat?.created_at) {
    const createdAt = new Date(mandat.created_at);
    if (createdAt >= startDate && createdAt <= endDate) {
      events.push({
        date: mandat.created_at,
        type: 'Mandat',
        label: '📋 Création du mandat',
        description: 'Le mandat est entré en sourcing',
      });
    }
  }

  // 2. Signature du mandat
  if (mandat?.date_signature) {
    const sigDate = new Date(mandat.date_signature);
    if (sigDate >= startDate && sigDate <= endDate) {
      events.push({
        date: mandat.date_signature,
        type: 'Signature',
        label: '✍️ Signature du mandat',
        description: 'Le mandat a été signé',
      });
    }
  }

  // 3. Date de vente
  if (mandat?.date_vente) {
    const venteDate = new Date(mandat.date_vente);
    if (venteDate >= startDate && venteDate <= endDate) {
      events.push({
        date: mandat.date_vente,
        type: 'Vente',
        label: '🏆 Vente conclue',
        description: 'La transaction a été finalisée',
      });
    }
  }

  // 4. Deals (matchings)
  for (const d of dealsList) {
    const client = clientsById[d.client_id];
    const clientName = client
      ? `${client.prenom || ''} ${client.nom || ''}`.trim() || client.societe || 'Client'
      : 'Client';

    let label = `📞 Contact : ${clientName}`;
    if (d.statut === 'Visite') label = `👁️ Visite : ${clientName}`;
    if (d.statut === 'Offre') label = `💰 Offre reçue : ${clientName}`;
    if (d.statut === 'Promesse') label = `📝 Promesse signée : ${clientName}`;
    if (d.statut === 'Gagné') label = `🏆 Vente : ${clientName}`;
    if (d.statut === 'Perdu') label = `❌ Affaire perdue : ${clientName}`;

    events.push({
      date: d.created_at,
      type: d.statut || 'Contact',
      label,
      description: d.notes || `Statut : ${d.statut}`,
    });
  }

  // 5. Tâches importantes
  for (const t of todos || []) {
    events.push({
      date: t.created_at,
      type: 'Tâche',
      label: `✅ ${t.titre}`,
      description: t.statut === 'Fait' ? 'Tâche réalisée' : `Priorité ${t.priorite || 'normale'}`,
    });
  }

  // ─── Tri chronologique inversé (plus récent en premier) ───
  events.sort((a, b) => new Date(b.date) - new Date(a.date));

  return { stats, events };
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

    // Charger TOUS les profils actifs (utilisé pour plaquette ET rapport)
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('id, prenom, nom, email, fonction, telephone, avatar_url')
      .eq('actif', true);

    if (pErr) console.error('[PDF] Profiles query error:', pErr.message);

    // Construire le sender enrichi (l'utilisateur connecté)
    let senderProfile = null;
    if (user?.id && profiles) {
      senderProfile = profiles.find(p => p.id === user.id) || null;
    }

    const conseillerEnriched = senderProfile ? {
      id: senderProfile.id,
      prenom: senderProfile.prenom,
      nom: senderProfile.nom,
      email: senderProfile.email,
      telephone: senderProfile.telephone,
      fonction: senderProfile.fonction || 'Conseiller',
      photo: ensureAbsoluteUrl(senderProfile.avatar_url, request),
      full_name: `${senderProfile.prenom || ''} ${senderProfile.nom || ''}`.trim() || 'Conseiller',
      initiales: `${(senderProfile.prenom || '').charAt(0)}${(senderProfile.nom || '').charAt(0)}`.toUpperCase(),
    } : (conseiller ? {
      ...conseiller,
      photo: ensureAbsoluteUrl(conseiller.avatar_url, request),
      initiales: `${(conseiller.prenom || '').charAt(0)}${(conseiller.nom || '').charAt(0)}`.toUpperCase(),
    } : null);

    let pdfElement;
    let filename;

    if (template === 'plaquette') {
      const teamMembers = {};
      let ownerProfile = null;

      for (const p of (profiles || [])) {
        const initials = `${(p.prenom || '').charAt(0)}${(p.nom || '').charAt(0)}`.toUpperCase();
        if (initials) {
          teamMembers[initials] = {
            name: `${p.prenom || ''} ${p.nom || ''}`.trim(),
            role: p.fonction || 'Conseiller',
            email: p.email,
            phone: p.telephone || null,
            photo: ensureAbsoluteUrl(p.avatar_url, request),
          };
        }
        if (mandat.profile_id && p.id === mandat.profile_id) {
          ownerProfile = p;
        }
      }

      let ownerInitials = '';
      if (ownerProfile) {
        ownerInitials = `${(ownerProfile.prenom || '').charAt(0)}${(ownerProfile.nom || '').charAt(0)}`.toUpperCase();
      } else if (mandat.owner && mandat.owner.length <= 3) {
        ownerInitials = mandat.owner.toUpperCase();
      }
      const mandatEnriched = { ...mandat, ownerInitials };

      // Fetch les images de localisation (vue satellite + cadastre)
      // Utiliser les assets stockés si disponibles (cache), sinon les régénérer
      let locationImages = { satellite: null, cadastre: null, parcelle: null, transports: null, geocode: null };

      if (mandat.satellite_image_url || mandat.cadastre_image_url || mandat.parcelle_data || mandat.transports_data) {
        // Cache hit : on télécharge les URLs stockées en base64
        console.log('[PDF] Using cached assets for mandat', mandatId);
        const [satellite, cadastre] = await Promise.all([
          mandat.satellite_image_url ? (await fetch(mandat.satellite_image_url).then(r => r.ok ? r.arrayBuffer() : null).then(b => b ? `data:image/jpeg;base64,${Buffer.from(b).toString('base64')}` : null).catch(() => null)) : null,
          mandat.cadastre_image_url ? (await fetch(mandat.cadastre_image_url).then(r => r.ok ? r.arrayBuffer() : null).then(b => b ? `data:image/png;base64,${Buffer.from(b).toString('base64')}` : null).catch(() => null)) : null,
        ]);
        locationImages = {
          satellite,
          cadastre,
          parcelle: mandat.parcelle_data,
          transports: mandat.transports_data,
          geocode: null,
        };
      } else if (mandat.adresse) {
        // Cache miss : on génère à la volée
        console.log('[PDF] Cache MISS, fetching live for mandat', mandatId);
        try {
          locationImages = await getLocationImages(mandat.adresse);
          console.log('[PDF] Location images:', {
            address: mandat.adresse,
            satellite: !!locationImages.satellite,
            cadastre: !!locationImages.cadastre,
            geocoded: !!locationImages.geocode
          });
        } catch (e) {
          console.warn('[PDF] getLocationImages KO:', e.message);
        }
      }

      pdfElement = React.createElement(PlaquetteAcheteur, {
        mandat: mandatEnriched,
        conseiller: conseillerEnriched,
        logoUrl,
        teamMembers,
        locationImages,
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
        conseiller: conseillerEnriched,
        logoUrl,
        period,
        stats,
        events,
      });
      filename = `Rapport_${slugify(mandat.nom)}_${startStr}_${endStr}.pdf`;
    } else if (template === 'interne') {
      pdfElement = React.createElement(FicheInterne, {
        mandat,
        conseiller: conseillerEnriched,
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
