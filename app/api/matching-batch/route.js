// ═══════════════════════════════════════════════════════════════════
// app/api/matching-batch/route.js
// Matching auto batch : déclenche le calcul des matches après save mandat/client
// 
// Input : { token, mandatId?, clientId? } (un seul des deux)
// Output : { ok, notifsCreated, ownersNotified, mandatsProcessed, clientsProcessed }
// 
// Logique :
//   - Si mandatId : on calcule les matches de ce mandat avec tous les clients actifs
//   - Si clientId : on calcule les matches de ce client avec tous les mandats actifs
//   - On regroupe par owner du client
//   - Anti-spam : si une paire (mandat, client, owner) a été notifiée dans les 24h, on skippe
//   - Sinon, on crée 1 notif agrégée par owner + on tracke dans matching_notifications
// ═══════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { matchMandatsForClient, matchClientsForMandat } from '@/lib/matching';

export const maxDuration = 30;

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

// Map initials/owner string → profile.id
async function resolveOwnerToProfileId(ownerStr) {
  if (!ownerStr) return null;
  // Mapping connu (initiales → id) — peut être étendu via lecture BDD
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, prenom, nom')
    .ilike('prenom', `${ownerStr[0]}%`); // approche basique : initiale du prénom
  if (profile && profile.length > 0) {
    // Match exact sur les initiales (TB = Thomas Boggiani)
    const match = profile.find(p => {
      const ini = (p.prenom?.[0] || '') + (p.nom?.[0] || '');
      return ini.toUpperCase() === ownerStr.toUpperCase();
    });
    return match?.id || null;
  }
  return null;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, mandatId, clientId } = body;

    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    if (!mandatId && !clientId) {
      return new Response(JSON.stringify({ ok: false, error: 'mandatId ou clientId requis' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Charger les paires (mandat, client) à matcher
    const pairs = []; // [{ mandat, client, score, raisons }]

    if (mandatId) {
      const { data: mandat } = await supabaseAdmin.from('mandats').select('*').eq('id', mandatId).single();
      if (!mandat) {
        return new Response(JSON.stringify({ ok: false, error: 'Mandat introuvable' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      const { data: clients } = await supabaseAdmin.from('clients').select('*');
      const matches = matchClientsForMandat(mandat, clients || []);
      for (const m of matches) {
        pairs.push({ mandat, client: m.client, score: m.score, raisons: m.raisons });
      }
    } else if (clientId) {
      const { data: client } = await supabaseAdmin.from('clients').select('*').eq('id', clientId).single();
      if (!client) {
        return new Response(JSON.stringify({ ok: false, error: 'Client introuvable' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      const { data: mandats } = await supabaseAdmin.from('mandats').select('*');
      const matches = matchMandatsForClient(client, mandats || []);
      for (const m of matches) {
        pairs.push({ mandat: m.mandat, client, score: m.score, raisons: m.raisons });
      }
    }

    if (pairs.length === 0) {
      return new Response(JSON.stringify({ ok: true, notifsCreated: 0, ownersNotified: [], pairs: 0, message: 'Aucun match trouvé' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Anti-spam : filtrer les paires déjà notifiées dans les 24h
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentNotifs } = await supabaseAdmin
      .from('matching_notifications')
      .select('mandat_id, client_id, notified_owner_id')
      .gte('notified_at', cutoff);

    const recentSet = new Set((recentNotifs || []).map(n => `${n.mandat_id}::${n.client_id}::${n.notified_owner_id}`));

    // Regrouper par owner du client (qu'on notifiera)
    const groupedByOwner = {}; // { profileId: { ownerStr, mandatPairs: { mandatId: { mandat, clients: [] } } } }

    for (const pair of pairs) {
      const ownerStr = pair.client.owner;
      if (!ownerStr) continue;
      // Résolution owner (initiales) → profile.id
      const profileId = await resolveOwnerToProfileId(ownerStr);
      if (!profileId) continue;

      const dedupeKey = `${pair.mandat.id}::${pair.client.id}::${profileId}`;
      if (recentSet.has(dedupeKey)) continue; // déjà notifié récemment

      if (!groupedByOwner[profileId]) {
        groupedByOwner[profileId] = { ownerStr, mandatPairs: {} };
      }
      if (!groupedByOwner[profileId].mandatPairs[pair.mandat.id]) {
        groupedByOwner[profileId].mandatPairs[pair.mandat.id] = { mandat: pair.mandat, clients: [] };
      }
      groupedByOwner[profileId].mandatPairs[pair.mandat.id].clients.push({
        client: pair.client, score: pair.score, raisons: pair.raisons
      });
    }

    // Créer les notifs + entrées de tracking
    let notifsCreated = 0;
    const ownersNotified = [];
    const trackingRows = [];
    const notifRows = [];

    for (const [profileId, data] of Object.entries(groupedByOwner)) {
      for (const [matchedMandatId, mandatData] of Object.entries(data.mandatPairs)) {
        const clientLabels = mandatData.clients
          .map(c => `${c.client.prenom || ''} ${c.client.nom || ''}`.trim() || c.client.societe || 'Client')
          .filter(Boolean);
        const nbClients = clientLabels.length;
        const mandatLabel = mandatData.mandat.nom || mandatData.mandat.adresse || 'Mandat';

        const titre = nbClients === 1
          ? `🎯 Nouveau bien pour votre client`
          : `🎯 Nouveau bien pour ${nbClients} de vos clients`;
        const message = nbClients === 1
          ? `Le mandat "${mandatLabel}" matche votre client ${clientLabels[0]}.`
          : `Le mandat "${mandatLabel}" matche vos clients : ${clientLabels.join(', ')}.`;

        notifRows.push({
          user_id: profileId,
          type: 'matching_batch',
          titre,
          message,
          lien_type: 'mandat',
          lien_id: matchedMandatId,
          lue: false,
          created_by: user.id,
        });

        // Tracker chaque paire
        for (const c of mandatData.clients) {
          trackingRows.push({
            mandat_id: matchedMandatId,
            client_id: c.client.id,
            notified_owner_id: profileId,
            score: c.score,
          });
        }

        notifsCreated++;
        if (!ownersNotified.includes(data.ownerStr)) ownersNotified.push(data.ownerStr);
      }
    }

    // Insert en batch
    if (notifRows.length > 0) {
      const { error: notifErr } = await supabaseAdmin.from('notifications').insert(notifRows);
      if (notifErr) console.warn('[matching-batch] Erreur insert notifs:', notifErr.message);
    }
    if (trackingRows.length > 0) {
      const { error: trackErr } = await supabaseAdmin
        .from('matching_notifications')
        .upsert(trackingRows, { onConflict: 'mandat_id,client_id,notified_owner_id' });
      if (trackErr) console.warn('[matching-batch] Erreur insert tracking:', trackErr.message);
    }

    return new Response(JSON.stringify({
      ok: true,
      pairs: pairs.length,
      notifsCreated,
      ownersNotified,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[/api/matching-batch] Erreur:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
