// ═══════════════════════════════════════════════════════════════════
// app/api/leads/wordpress/route.js
// Reçoit les leads depuis WordPress (Contact Form 7)
// 
// Sécurité : token secret dans le header X-Webhook-Secret
// Types de leads : 'vendeur' (crée un mandat) ou 'acheteur' (crée un client)
// ═══════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// CORS pour permettre l'appel depuis WordPress
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Webhook-Secret',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request) {
  try {
    // 1. Vérification du token secret
    const secret = request.headers.get('x-webhook-secret');
    if (!secret || secret !== process.env.WORDPRESS_WEBHOOK_SECRET) {
      console.warn('[wordpress-leads] Tentative non autorisée');
      return new Response(JSON.stringify({ ok: false, error: 'Non autorisé' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // 2. Parse du body
    const body = await request.json();
    const { type, data } = body;

    if (!type || !['vendeur', 'acheteur'].includes(type)) {
      return new Response(JSON.stringify({ ok: false, error: 'Type invalide (vendeur/acheteur)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    if (!data) {
      return new Response(JSON.stringify({ ok: false, error: 'data requis' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // 3. Responsable par défaut des leads WordPress : Thomas Ezquerra (direction).
    //    (à transformer en réglage configurable si l'attribution doit évoluer)
    const { data: ownerProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, prenom, nom')
      .eq('prenom', 'Thomas')
      .eq('nom', 'Ezquerra')
      .maybeSingle();

    const ownerUserId = ownerProfile?.id || null;
    const ownerName = ownerProfile ? `${ownerProfile.prenom} ${ownerProfile.nom}`.trim() : null;

    // 4. Création selon le type
    if (type === 'vendeur') {
      // ─── VENDEUR : crée un mandat ───
      const {
        nom_complet = '',
        email = '',
        telephone = '',
        type_bien = '',
        adresse = '',
        ville = '',
        code_postal = '',
        prix_souhaite = 0,
        surface = 0,
        message = '',
      } = data;

      // Vérifier doublons (même adresse)
      if (adresse) {
        const { data: doublons } = await supabaseAdmin
          .from('mandats')
          .select('id, nom')
          .ilike('adresse', `%${adresse}%`)
          .limit(1);
        if (doublons && doublons.length > 0) {
          return new Response(JSON.stringify({
            ok: true,
            duplicate: true,
            existingMandatId: doublons[0].id,
            message: 'Mandat similaire existant',
          }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
        }
      }

      const mandatNom = `${type_bien || 'Bien'} ${ville || adresse || nom_complet}`.trim();

      const { data: mandat, error: mErr } = await supabaseAdmin.from('mandats').insert({
        nom: mandatNom,
        adresse: [adresse, code_postal, ville].filter(Boolean).join(' ') || 'À renseigner',
        ville: ville || null,
        type: type_bien || "Immeuble d'habitation",
        prix: parseFloat(prix_souhaite) || 0,
        surface: parseFloat(surface) || 0,
        statut: 'Sourcing',
        commercialisation: 'Off-market',
        
        pourvoyeur_id: ownerUserId,
        contact: nom_complet,
        tel: telephone,
        description: message ? `[Lead WordPress] ${message}` : '[Lead WordPress] Demande d\'estimation',
        created_by: ownerUserId,
      }).select().single();

      if (mErr) {
        console.error('[wordpress-leads] Erreur création mandat:', mErr);
        return new Response(JSON.stringify({ ok: false, error: mErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      // Créer une tâche pour TB
      await supabaseAdmin.from('todos').insert({
        titre: `📞 Rappeler ${nom_complet} (lead WordPress vendeur)`,
        priorite: 'Haute',
        statut: 'À faire',
        echeance: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // demain
        assignee: ownerName,
        assigned_to_user_id: ownerUserId,
        created_by: ownerUserId,
        lien_type: 'mandat',
        lien_id: mandat.id,
      });

      return new Response(JSON.stringify({
        ok: true,
        type: 'vendeur',
        mandatId: mandat.id,
        message: 'Mandat créé + tâche assignée à la direction',
      }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
    }

    if (type === 'acheteur') {
      // ─── ACHETEUR : crée un client ───
      const {
        nom_complet = '',
        email = '',
        telephone = '',
        societe = '',
        budget_min = 0,
        budget_max = 0,
        zones = '',
        typologies = '',
        message = '',
      } = data;

      // Vérifier doublons (email ou téléphone)
      if (email || telephone) {
        const { data: doublons } = await supabaseAdmin
          .from('clients')
          .select('id, prenom, nom')
          .or([email && `email.eq.${email}`, telephone && `tel.eq.${telephone}`].filter(Boolean).join(','))
          .limit(1);
        if (doublons && doublons.length > 0) {
          return new Response(JSON.stringify({
            ok: true,
            duplicate: true,
            existingClientId: doublons[0].id,
            message: 'Client existant',
          }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
        }
      }

      // Découper nom_complet en prenom + nom
      const parts = (nom_complet || '').trim().split(/\s+/);
      const prenom = parts[0] || 'Lead';
      const nom = parts.slice(1).join(' ') || 'WordPress';

      // Source unique = contacts : trouver/créer le contact avant le client
      const emailNormalized = (email || '').toLowerCase().trim() || null;
      let contactId = null;
      if (emailNormalized) {
        const { data: existingContact } = await supabaseAdmin
          .from('contacts').select('id').eq('email', emailNormalized).maybeSingle();
        if (existingContact?.id) contactId = existingContact.id;
      }
      if (!contactId) {
        const { data: newContact, error: ctErr } = await supabaseAdmin
          .from('contacts')
          .insert({
            prenom,
            nom,
            societe: societe || null,
            email: emailNormalized,
            tel: telephone || null,
            postures: ['acheteur'],
            categorie: 'autre',
            qualite: 'neutre',
            created_by: ownerUserId,
          })
          .select('id').single();
        if (ctErr) console.error('[wordpress-leads] Erreur création contact:', ctErr);
        else contactId = newContact.id;
      }

      const { data: client, error: cErr } = await supabaseAdmin.from('clients').insert({
        prenom,
        nom,
        societe: societe || null,
        email: emailNormalized,
        tel: telephone || null,
        contact_id: contactId,
        typologie: 'Investisseur',
        statut: 'Actif',
        budget_min: parseFloat(budget_min) || null,
        budget_max: parseFloat(budget_max) || null,
        zones: zones ? zones.split(',').map(z => z.trim()) : [],
        typologies_recherchees: typologies ? typologies.split(',').map(t => t.trim()) : [],
        notes: message ? `[Lead WordPress] ${message}` : '[Lead WordPress]',

        created_by: ownerUserId,
      }).select().single();

      if (cErr) {
        console.error('[wordpress-leads] Erreur création client:', cErr);
        return new Response(JSON.stringify({ ok: false, error: cErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      // Créer une tâche pour TB
      await supabaseAdmin.from('todos').insert({
        titre: `📞 Rappeler ${nom_complet} (lead WordPress acheteur)`,
        priorite: 'Haute',
        statut: 'À faire',
        echeance: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        assignee: ownerName,
        assigned_to_user_id: ownerUserId,
        created_by: ownerUserId,
        lien_type: 'client',
        lien_id: client.id,
      });

      return new Response(JSON.stringify({
        ok: true,
        type: 'acheteur',
        clientId: client.id,
        message: 'Client créé + tâche assignée à la direction',
      }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
    }
  } catch (err) {
    console.error('[wordpress-leads] Erreur:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
}
