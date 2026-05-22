// app/api/mandats/[id]/plaquette-cached/route.js
//
// Retourne le PDF de la plaquette d'un mandat depuis le cache Supabase Storage.
// Si le PDF n'existe pas dans le bucket : appelle l'endpoint /pdf?type=plaquette,
// stocke le résultat dans le bucket, puis le retourne.
// Cela évite de regénérer la plaquette à chaque envoi.

import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BUCKET = 'mandat-plaquettes';

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

function getStoragePath(mandatId) {
  return `${mandatId}.pdf`;
}

export async function GET(request, { params }) {
  try {
    const { id: mandatId } = params;
    if (!mandatId) {
      return new Response(JSON.stringify({ ok: false, error: 'id requis' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Vérif authentification (token dans query param ?token= OU header Authorization)
    const url = new URL(request.url);
    let token = url.searchParams.get('token');
    if (!token) {
      const authHeader = request.headers.get('authorization') || '';
      token = authHeader.replace(/^Bearer\s+/i, '').trim();
    }
    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    const storagePath = getStoragePath(mandatId);

    // 1. Cherche dans le cache
    const { data: cachedFile, error: downloadErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .download(storagePath);

    if (cachedFile && !downloadErr) {
      // Cache hit ! On retourne le PDF direct
      console.log(`[plaquette-cached] CACHE HIT for ${mandatId}`);

      // Sécurité : on s'assure que plaquette_cached_at est bien set en BDD
      // (cas où le PDF existe dans le bucket mais la colonne est null)
      supabaseAdmin
        .from('mandats')
        .select('plaquette_cached_at')
        .eq('id', mandatId)
        .single()
        .then(({ data: current }) => {
          if (current && current.plaquette_cached_at === null) {
            supabaseAdmin
              .from('mandats')
              .update({ plaquette_cached_at: new Date().toISOString() })
              .eq('id', mandatId)
              .then(({ error }) => {
                if (error) console.warn(`[plaquette-cached] Cache timestamp sync failed:`, error.message);
                else console.log(`[plaquette-cached] Cache timestamp synced for ${mandatId}`);
              });
          }
        });

      const buffer = Buffer.from(await cachedFile.arrayBuffer());
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="plaquette_${mandatId}.pdf"`,
          'X-Plaquette-Source': 'cache'
        }
      });
    }

    // 2. Cache miss → on génère via l'endpoint existant
    // Note : /api/mandats/[id]/pdf attend le token en query param ?token= et le paramètre ?template=
    console.log(`[plaquette-cached] CACHE MISS for ${mandatId}, generating...`);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://patrimonia-crm.vercel.app';
    const genRes = await fetch(`${baseUrl}/api/mandats/${mandatId}/pdf?template=plaquette&token=${encodeURIComponent(token)}`);

    if (!genRes.ok) {
      const errText = await genRes.text();
      console.error('[plaquette-cached] Generation failed:', errText);
      return new Response(JSON.stringify({ ok: false, error: 'Génération plaquette échouée', detail: errText }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    const pdfBuffer = Buffer.from(await genRes.arrayBuffer());

    // 3. Stocke dans le bucket (en arrière-plan, on n'attend pas que ce soit fini)
    // Puis met à jour plaquette_cached_at sur le mandat pour signaler que le cache est frais
    supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, pdfBuffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/pdf'
      })
      .then(({ error: uploadErr }) => {
        if (uploadErr) {
          console.warn(`[plaquette-cached] Cache save failed for ${mandatId}:`, uploadErr.message);
        } else {
          console.log(`[plaquette-cached] Cache saved for ${mandatId}`);
          // Marque le mandat comme ayant une plaquette en cache fraîche
          supabaseAdmin
            .from('mandats')
            .update({ plaquette_cached_at: new Date().toISOString() })
            .eq('id', mandatId)
            .then(({ error }) => {
              if (error) console.warn(`[plaquette-cached] Cache timestamp save failed:`, error.message);
            });
        }
      });

    // 4. Retourne le PDF
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="plaquette_${mandatId}.pdf"`,
        'X-Plaquette-Source': 'generated'
      }
    });

  } catch (e) {
    console.error('[plaquette-cached] Erreur:', e);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', detail: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

// DELETE : invalide le cache pour un mandat (appelé quand le mandat est modifié)
export async function DELETE(request, { params }) {
  try {
    const { id: mandatId } = params;
    if (!mandatId) {
      return new Response(JSON.stringify({ ok: false, error: 'id requis' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .remove([getStoragePath(mandatId)]);

    if (error) {
      console.warn(`[plaquette-cached] Delete failed for ${mandatId}:`, error.message);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: true, mandatId }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('[plaquette-cached] DELETE erreur:', e);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', detail: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
