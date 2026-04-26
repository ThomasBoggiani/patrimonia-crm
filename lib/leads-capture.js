// ═══════════════════════════════════════════════════════════════════
// lib/leads-capture.js — VERSION FINALE v12.1.3
// 
// Aligné sur le schéma RÉEL de toutes les tables :
// 
// clients : id, nom, prenom, societe, tel, email, typologie, nature, 
//           budget_min, budget_max, rendement_min, zones, 
//           typologies_recherchees, statut, maturite, origine, owner, 
//           created_at, updated_at, created_by, updated_by, 
//           outlook_contact_id, source, source_detail, 
//           site_first_seen_at, site_last_seen_at
// 
// interactions : id, client_id, date, type, resume, next_step, 
//                date_next_step, created_at, created_by, metadata
// 
// notifications : id, user_id, type, titre, message, lien_type, 
//                 lien_id, lue, created_by, created_at
// 
// Corrections vs v12.1.2 :
// - findOrCreateClient : "telephone" → "tel"
// - findOrCreateClient : "type_client" → "typologie"
// ═══════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// ─────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MIN = 10;
const DIRECTOR_EMAIL = 'thomas.boggiani@immeubles-patrimoine.fr';
const SOURCE_VALUE = 'site_wordpress';

const DISPOSABLE_EMAIL_DOMAINS = [
  'yopmail.com', 'mailinator.com', 'guerrillamail.com', 'tempmail.com',
  'throwaway.email', 'trashmail.com', '10minutemail.com', 'temp-mail.org',
  'fakeinbox.com', 'getnada.com', 'maildrop.cc', 'mintemail.com',
  'sharklasers.com', 'guerrillamailblock.com', 'pokemail.net', 'spam4.me',
];

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// ─────────────────────────────────────────────────────────────────
// 1. VÉRIFICATION CLÉ API
// ─────────────────────────────────────────────────────────────────

export function verifyApiKey(request) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.SITE_WEBHOOK_API_KEY;

  if (!expectedKey) {
    console.error('[leads-capture] SITE_WEBHOOK_API_KEY non configurée');
    return { ok: false, status: 500, error: 'Configuration serveur manquante' };
  }

  if (!apiKey || apiKey !== expectedKey) {
    return { ok: false, status: 401, error: 'Clé API invalide' };
  }

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────
// 2. HONEYPOT
// ─────────────────────────────────────────────────────────────────

export function checkHoneypot(body) {
  if (body._honeypot && body._honeypot.trim() !== '') {
    return { isBot: true };
  }
  return { isBot: false };
}

// ─────────────────────────────────────────────────────────────────
// 3. RATE LIMIT PAR IP
// ─────────────────────────────────────────────────────────────────

export async function checkRateLimit(ip) {
  if (!ip || ip === 'unknown') {
    return { allowed: true };
  }

  const { data, error } = await supabaseAdmin.rpc('count_recent_captures_by_ip', {
    p_ip: ip,
    p_minutes: RATE_LIMIT_WINDOW_MIN,
  });

  if (error) {
    console.error('[rate-limit] Erreur RPC:', error);
    return { allowed: true };
  }

  if (data >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      message: `Trop de requêtes depuis cette adresse (${data} en ${RATE_LIMIT_WINDOW_MIN} min)`,
    };
  }

  return { allowed: true, current: data };
}

// ─────────────────────────────────────────────────────────────────
// 4. VALIDATION EMAIL
// ─────────────────────────────────────────────────────────────────

export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Email manquant' };
  }

  const cleaned = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(cleaned)) {
    return { valid: false, reason: 'Format email invalide' };
  }

  const domain = cleaned.split('@')[1];
  if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
    return { valid: false, reason: 'Domaine email jetable non autorisé' };
  }

  return { valid: true, email: cleaned };
}

// ─────────────────────────────────────────────────────────────────
// 5. FIND OR CREATE CLIENT  ← CORRIGÉ pour le schéma v12 réel
// ─────────────────────────────────────────────────────────────────
// Colonnes utilisées : email, prenom, nom, tel, typologie, source, 
// source_detail, site_first_seen_at, site_last_seen_at, owner, created_at

export async function findOrCreateClient({
  email,
  prenom,
  nom,
  telephone,         // → mappé sur "tel" en BDD
  typeClient,        // → mappé sur "typologie" en BDD
  sourceDetail,
  ownerId,
}) {
  // 1) Recherche par email
  const { data: existing, error: searchError } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (searchError) {
    console.error('[findOrCreateClient] Erreur recherche:', searchError);
    throw new Error('Erreur lors de la recherche client');
  }

  // 2a) Existe → enrichissement sans écrasement
  if (existing) {
    const updates = {
      site_last_seen_at: new Date().toISOString(),
    };

    // Enrichissement uniquement si vide
    if (!existing.tel && telephone) updates.tel = telephone;
    if (!existing.prenom && prenom) updates.prenom = prenom;
    if (!existing.nom && nom) updates.nom = nom;
    if (!existing.source) updates.source = SOURCE_VALUE;
    if (!existing.site_first_seen_at) updates.site_first_seen_at = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('clients')
      .update(updates)
      .eq('id', existing.id);

    if (updateError) {
      console.error('[findOrCreateClient] Erreur update:', updateError);
    }

    return { client: { ...existing, ...updates }, isNew: false };
  }

  // 2b) N'existe pas → création
  const now = new Date().toISOString();
  const { data: created, error: createError } = await supabaseAdmin
    .from('clients')
    .insert({
      email,
      prenom: prenom || '',
      nom: nom || '',
      tel: telephone || '',
      typologie: typeClient || 'Particuliers',
      source: SOURCE_VALUE,
      source_detail: sourceDetail,
      site_first_seen_at: now,
      site_last_seen_at: now,
      owner: ownerId || null,
      created_at: now,
    })
    .select()
    .single();

  if (createError) {
    console.error('[findOrCreateClient] Erreur create:', createError);
    throw new Error('Erreur lors de la création du client');
  }

  return { client: created, isNew: true };
}

// ─────────────────────────────────────────────────────────────────
// 6. CRÉATION INTERACTION
// ─────────────────────────────────────────────────────────────────

export async function createInteraction({
  clientId,
  type,
  resume,
  metadata,
  createdBy,
}) {
  const today = new Date().toISOString().split('T')[0];

  const { error } = await supabaseAdmin
    .from('interactions')
    .insert({
      client_id: clientId,
      date: today,
      type: type,
      resume: resume,
      metadata: metadata,
      created_at: new Date().toISOString(),
      created_by: createdBy || null,
    });

  if (error) {
    console.error('[createInteraction] Erreur:', error);
  }
}

// ─────────────────────────────────────────────────────────────────
// 7. RÉSOLUTION DE L'OWNER
// ─────────────────────────────────────────────────────────────────

export async function resolveOwner({ bienRef = null }) {
  if (bienRef) {
    const { data: mandat, error } = await supabaseAdmin
      .from('mandats')
      .select('id, owner, reference, titre')
      .eq('reference', bienRef)
      .maybeSingle();

    if (!error && mandat?.owner) {
      return {
        ownerId: mandat.owner,
        mandatId: mandat.id,
        mandatTitre: mandat.titre,
        reason: 'mandat_owner',
      };
    }
  }

  const { data: director } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', DIRECTOR_EMAIL)
    .maybeSingle();

  return {
    ownerId: director?.id || null,
    mandatId: null,
    mandatTitre: null,
    reason: 'director_fallback',
  };
}

// ─────────────────────────────────────────────────────────────────
// 8. NOTIFICATION OWNER
// ─────────────────────────────────────────────────────────────────

export async function notifyOwner({
  userId,
  titre,
  message,
  lienType,
  lienId,
  notifType,
  createdBy,
}) {
  if (!userId) {
    console.warn('[notifyOwner] Aucun userId, notification ignorée');
    return;
  }

  const { error } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: userId,
      type: notifType || 'new_lead',
      titre: titre,
      message: message,
      lien_type: lienType || null,
      lien_id: lienId || null,
      lue: false,
      created_by: createdBy || null,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[notifyOwner] Erreur:', error);
  }
}

// ─────────────────────────────────────────────────────────────────
// 9. LOG D'AUDIT
// ─────────────────────────────────────────────────────────────────

export async function logCapture({
  ip,
  endpoint,
  email,
  status,
  errorMessage = null,
}) {
  await supabaseAdmin
    .from('leads_capture_log')
    .insert({
      ip_address: ip || 'unknown',
      endpoint,
      email,
      status,
      error_message: errorMessage,
    });
}

// ─────────────────────────────────────────────────────────────────
// 10. EXTRACTION IP
// ─────────────────────────────────────────────────────────────────

export function extractIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────
// 11. SANITIZATION
// ─────────────────────────────────────────────────────────────────

export function sanitizeString(str, maxLength = 500) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

export function sanitizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.trim().replace(/[^\d+\s\-.()]/g, '').slice(0, 30);
}

// ─────────────────────────────────────────────────────────────────
// 12. RÉPONSES HTTP
// ─────────────────────────────────────────────────────────────────

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.SITE_ALLOWED_ORIGIN || 'https://immeubles-patrimoine.fr',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    },
  });
}

export function corsPreflightResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': process.env.SITE_ALLOWED_ORIGIN || 'https://immeubles-patrimoine.fr',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
      'Access-Control-Max-Age': '86400',
    },
  });
}
