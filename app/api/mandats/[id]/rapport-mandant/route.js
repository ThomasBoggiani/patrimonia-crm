// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/[id]/rapport-mandant/route.js — v1
// Génère le rapport d'activité commerciale pour le mandant (PDF)
// Reçoit en POST body : { period, profilAcquereurs, retours, prochaines, evolution }
// Calcule auto : stats, diffusion active
// ═══════════════════════════════════════════════════════════════════

import { renderToStream } from '@react-pdf/renderer';
import React from 'react';
import { createClient } from '@supabase/supabase-js';
import RapportMandant from '@/lib/pdf/templates/RapportMandant';

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

// Définitions de plateformes (doit matcher DiffusionInline)
const PLATEFORMES_DEFS = {
  site_ip: { name: 'Notre site' },
  seloger: { name: 'SeLoger' },
  leboncoin: { name: 'LeBonCoin' },
  lefigaro: { name: 'Le Figaro' },
  bellesdemeures: { name: 'BellesDemeures' },
  jinka: { name: 'Jinka' },
};

export async function POST(request, { params }) {
  try {
    const { id: mandatId } = params;
    const body = await request.json();
    const {
      period,           // { label: 'Avril 2026', start: '2026-04-01', end: '2026-04-30' }
      profilAcquereurs,
      retours = [],
      prochaines = [],
      evolution = [],
    } = body || {};

    // Auth via Bearer
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Récupérer le mandat
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

    // Stats : compter les interactions sur la période
    let startISO = null, endISO = null;
    if (period?.start && period?.end) {
      startISO = new Date(period.start).toISOString();
      const endDate = new Date(period.end);
      endDate.setHours(23, 59, 59, 999);
      endISO = endDate.toISOString();
    }

    let interactionsQuery = supabaseAdmin
      .from('interactions')
      .select('id, type, date, client_id, resume, metadata')
      .eq('mandat_id', mandatId);
    if (startISO && endISO) {
      interactionsQuery = interactionsQuery.gte('date', startISO).lte('date', endISO);
    }
    const { data: interactions = [] } = await interactionsQuery;

    const emailsSortants = (interactions || []).filter(i => i.type === 'email_sortant');
    const envoisPlaquette = emailsSortants.filter(i => {
      const resume = (i.resume || '').toLowerCase();
      const meta = i.metadata ? JSON.stringify(i.metadata).toLowerCase() : '';
      return resume.includes('plaquette') || meta.includes('plaquette') || resume.includes('présentation');
    });
    const nbEnvoisPlaquette = envoisPlaquette.length;
    const nbAppels = (interactions || []).filter(i => i.type === 'appel').length;

    // Visites : depuis deals
    let dealsQuery = supabaseAdmin
      .from('deals')
      .select('id, statut, created_at, updated_at')
      .eq('mandat_id', mandatId);
    if (startISO && endISO) {
      dealsQuery = dealsQuery.gte('created_at', startISO).lte('created_at', endISO);
    }
    const { data: deals = [] } = await dealsQuery;
    const nbVisites = (deals || []).filter(d => d.statut === 'Visite').length;

    // Vues plateformes : depuis diffusion_plateformes
    const diffusion = Array.isArray(mandat.diffusion_plateformes) ? mandat.diffusion_plateformes : [];
    const nbVuesTotal = diffusion.reduce((sum, p) => sum + (parseInt(p?.vues || 0) || 0), 0);

    // Diffusion active
    const diffusionActive = diffusion
      .filter(p => p?.active)
      .map(p => ({
        key: p.key,
        name: PLATEFORMES_DEFS[p.key]?.name || p.name || p.key,
      }));

    // Conseiller : profil de l'utilisateur connecté
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, prenom, nom, email, fonction, telephone')
      .eq('id', user.id)
      .maybeSingle();

    const conseiller = profile ? {
      full_name: `${profile.prenom || ''} ${profile.nom || ''}`.trim() || 'Conseiller',
      fonction: profile.fonction || 'Conseiller',
      email: profile.email,
      telephone: profile.telephone,
    } : { full_name: 'Conseiller', fonction: 'Conseiller', email: '' };

    const stats = {
      nbEnvoisPlaquette,
      nbAppels,
      nbVisites,
      nbVuesTotal,
    };

    // Logo URL
    const host = request.headers.get('host') || 'patrimonia-crm.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const logoUrl = `${protocol}://${host}/logo-ip-sage.png`;

    // Génération PDF
    const pdfElement = React.createElement(RapportMandant, {
      mandat,
      conseiller,
      period,
      stats,
      diffusionActive,
      profilAcquereurs,
      retours,
      prochaines,
      evolution,
      logoUrl,
    });

    const stream = await renderToStream(pdfElement);

    // Mettre à jour dernier_rapport_envoye_at (utile pour cron futur)
    // Note : on ne le met à jour que quand on ENVOIE pour de vrai (pas juste prévisualiser).
    // Si le body contient { markAsSent: true }, on update. Sinon non.
    if (body?.markAsSent) {
      await supabaseAdmin
        .from('mandats')
        .update({ dernier_rapport_envoye_at: new Date().toISOString() })
        .eq('id', mandatId);
    }

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Rapport_${(period?.label || 'mandant').replace(/\s+/g, '_')}_${mandatId}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });

  } catch (e) {
    console.error('[rapport-mandant] Erreur:', e);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', detail: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
