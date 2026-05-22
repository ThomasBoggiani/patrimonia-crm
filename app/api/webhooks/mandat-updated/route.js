// app/api/webhooks/mandat-updated/route.js
//
// Webhook appelé par Supabase Database Webhook à chaque UPDATE de la table 'mandats'.
// Supprime le PDF en cache dans le bucket mandat-plaquettes pour forcer la regénération.
//
// Auth : on attend un header X-Webhook-Secret égal à process.env.SUPABASE_WEBHOOK_SECRET

import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 10;

const BUCKET = 'mandat-plaquettes';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request) {
  try {
    // Vérification du secret webhook
    const secret = request.headers.get('x-webhook-secret') || '';
    const expectedSecret = process.env.SUPABASE_WEBHOOK_SECRET || '';

    if (!expectedSecret) {
      console.error('[webhook/mandat-updated] SUPABASE_WEBHOOK_SECRET non configuré');
      return new Response(JSON.stringify({ ok: false, error: 'Webhook secret non configuré côté serveur' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (secret !== expectedSecret) {
      console.warn('[webhook/mandat-updated] Secret invalide');
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    // Format Supabase Database Webhook : { type, table, record, old_record, schema }
    const mandatId = body?.record?.id || body?.old_record?.id;
    const record = body?.record || {};
    const oldRecord = body?.old_record || {};

    if (!mandatId) {
      console.warn('[webhook/mandat-updated] Pas d\'id dans le body', body);
      return new Response(JSON.stringify({ ok: false, error: 'Pas d\'id mandat' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Détecte si SEUL plaquette_cached_at a changé (anti-boucle)
    // On ignore aussi updated_at qui change toujours
    const IGNORED_FIELDS = new Set(['plaquette_cached_at', 'updated_at']);
    const changedFields = [];
    const allKeys = new Set([...Object.keys(record), ...Object.keys(oldRecord)]);
    for (const key of allKeys) {
      if (IGNORED_FIELDS.has(key)) continue;
      // Comparaison simple (les types JSON sont JSON-stringifiés)
      const a = record[key];
      const b = oldRecord[key];
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        changedFields.push(key);
      }
    }

    if (changedFields.length === 0) {
      console.log(`[webhook/mandat-updated] Skip ${mandatId} (only ignored fields changed)`);
      return new Response(JSON.stringify({ ok: true, mandatId, skipped: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[webhook/mandat-updated] Cache invalidation triggered for ${mandatId} by fields: ${changedFields.join(', ')}`);

    // Supprime le PDF du cache
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .remove([`${mandatId}.pdf`]);

    if (error) {
      // Pas grave si le fichier n'existait pas, on log juste
      console.log(`[webhook/mandat-updated] Cache delete info for ${mandatId}:`, error.message);
    } else {
      console.log(`[webhook/mandat-updated] Cache invalidated for mandat ${mandatId}`);
    }

    // Vérifie si plaquette_cached_at est déjà null pour éviter une boucle de webhooks inutile
    const { data: current } = await supabaseAdmin
      .from('mandats')
      .select('plaquette_cached_at')
      .eq('id', mandatId)
      .single();

    if (current?.plaquette_cached_at !== null) {
      // Set plaquette_cached_at à null pour signaler que le cache n'est plus à jour
      const { error: updateErr } = await supabaseAdmin
        .from('mandats')
        .update({ plaquette_cached_at: null })
        .eq('id', mandatId);
      if (updateErr) {
        console.warn(`[webhook/mandat-updated] Cache timestamp reset failed:`, updateErr.message);
      }
    }

    return new Response(JSON.stringify({ ok: true, mandatId, message: 'Cache invalidated' }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('[webhook/mandat-updated] Erreur:', e);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', detail: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
