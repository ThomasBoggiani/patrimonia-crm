// ═══════════════════════════════════════════════════════════════════
// app/api/ai-send-plaquette/route.js
// Workflow chainé : Envoyer plaquette mandat à un (ou plusieurs) destinataire(s)
// 
// Pour chaque destinataire :
// 1. Cherche le client en BDD (par email) → crée si nouveau
// 2. Crée/maj le deal Mandat↔Client avec statut='Envoye'
// 3. Génère le corps de l'email depuis template
// 4. Délègue l'envoi (avec plaquette PDF en PJ) à /api/email-drafts/send-batch
// 5. Renvoie le récap
// ═══════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

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

// Template email pour envoi de plaquette
function buildEmailTemplate({ prenom, mandat, profile, questionnaireToken }) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://patrimonia-crm.vercel.app';
  const questionnaireLink = questionnaireToken
    ? `${baseUrl}/q/${questionnaireToken}`
    : null;

  const greeting = prenom ? `Bonjour ${prenom},` : 'Bonjour,';
  const senderName = profile ? `${profile.prenom || ''} ${profile.nom || ''}`.trim() : '';
  const senderFonction = profile?.fonction || '';
  const senderPhone = profile?.telephone || '';
  const senderEmail = profile?.email || '';

  // Description compacte du bien
  const mandatDescription = [
    mandat.nom,
    mandat.adresse,
    mandat.ville,
    mandat.prix ? `${Number(mandat.prix).toLocaleString('fr-FR')} €` : null,
    mandat.surface ? `${mandat.surface} m²` : null,
  ].filter(Boolean).join(' · ');

  // Signature personnelle si configurée, sinon signature par défaut
  const signature = profile?.email_signature || `
<p style="margin: 12px 0 4px 0;"><strong>${senderName}</strong><br>
${senderFonction}<br>
<em>Immeubles & Patrimoine</em></p>
<p style="margin: 4px 0; font-size: 13px; color: #666;">
${senderPhone ? `📞 ${senderPhone}<br>` : ''}
${senderEmail ? `✉️ <a href="mailto:${senderEmail}">${senderEmail}</a><br>` : ''}
🌐 <a href="https://www.immeubles-patrimoine.fr">www.immeubles-patrimoine.fr</a>
</p>`;

  const html = `
<div style="font-family: Georgia, 'Times New Roman', serif; color: #2C2620; max-width: 600px; line-height: 1.6;">
  <p>${greeting}</p>

  <p>J'ai le plaisir de vous adresser, en pièce jointe, la <strong>plaquette de présentation</strong> du bien suivant :</p>

  <p style="background: #FBF9F4; padding: 12px 16px; border-left: 3px solid #9CAF88; margin: 16px 0;">
    <strong>${mandatDescription}</strong>
  </p>

  <p>Je reste à votre disposition pour échanger sur cette opportunité et répondre à toutes vos questions.</p>

  ${questionnaireLink ? `
  <p style="background: #F0F4EC; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
    💡 Pour mieux cerner vos critères d'investissement et vous proposer des opportunités sur-mesure,
    n'hésitez pas à <a href="${questionnaireLink}" style="color: #5C6E4F; font-weight: bold;">remplir notre questionnaire en 3 minutes</a>.
  </p>
  ` : ''}

  <p>Bien cordialement,</p>

  ${signature}
</div>`;

  return {
    subject: `Plaquette de présentation — ${mandat.nom || mandat.adresse || 'Bien off-market'}`,
    htmlBody: html,
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, mandatId, destinataires } = body;

    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    if (!mandatId) {
      return new Response(JSON.stringify({ ok: false, error: 'mandatId requis' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (!Array.isArray(destinataires) || destinataires.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'destinataires (tableau) requis' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 1. Récupérer le mandat
    const { data: mandat, error: mErr } = await supabaseAdmin.from('mandats').select('*').eq('id', mandatId).single();
    if (mErr || !mandat) {
      return new Response(JSON.stringify({ ok: false, error: 'Mandat introuvable' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // 2. Récupérer le profil utilisateur (pour signature)
    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single();

    const results = {
      clients_created: [],
      clients_found: [],
      deals_created: [],
      deals_updated: [],
      emails_to_send: [],
      errors: [],
    };

    // 3. Pour chaque destinataire : résoudre client, créer/maj deal, préparer email
    for (const dest of destinataires) {
      const { email, prenom, nom } = dest;
      if (!email || !email.includes('@')) {
        results.errors.push({ email, reason: 'Email invalide' });
        continue;
      }

      try {
        // 3.1 Chercher client par email
        let client = null;
        const { data: existingClient } = await supabaseAdmin
          .from('clients')
          .select('*')
          .ilike('email', email)
          .maybeSingle();

        if (existingClient) {
          client = existingClient;
          results.clients_found.push({ id: client.id, prenom: client.prenom, nom: client.nom, email: client.email });
        } else {
          // 3.2 Créer client
          const { data: newClient, error: cErr } = await supabaseAdmin
            .from('clients')
            .insert({
              email: email,
              prenom: prenom || null,
              nom: nom || null,
              statut: 'Actif',
              created_by: user.id,
              source: 'IA - Envoi plaquette',
            })
            .select()
            .single();
          if (cErr || !newClient) {
            results.errors.push({ email, reason: 'Erreur création client: ' + (cErr?.message || 'inconnue') });
            continue;
          }
          client = newClient;
          results.clients_created.push({ id: client.id, prenom: client.prenom, nom: client.nom, email: client.email });
        }

        // 3.3 Chercher deal existant Mandat↔Client
        const { data: existingDeal } = await supabaseAdmin
          .from('deals')
          .select('*')
          .eq('mandat_id', mandatId)
          .eq('client_id', client.id)
          .maybeSingle();

        const dealUpdate = {
          statut: 'Envoye',
          date_envoi: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        };

        if (existingDeal) {
          await supabaseAdmin.from('deals').update(dealUpdate).eq('id', existingDeal.id);
          results.deals_updated.push({ id: existingDeal.id, client_id: client.id });
        } else {
          const { data: newDeal } = await supabaseAdmin
            .from('deals')
            .insert({
              mandat_id: mandatId,
              client_id: client.id,
              ...dealUpdate,
              created_by: user.id,
            })
            .select()
            .single();
          if (newDeal) results.deals_created.push({ id: newDeal.id, client_id: client.id });
        }

        // 3.4 Préparer l'email pour cette personne
        const { subject, htmlBody } = buildEmailTemplate({
          prenom: client.prenom || prenom,
          mandat,
          profile,
          questionnaireToken: profile?.questionnaire_token,
        });

        results.emails_to_send.push({
          clientId: client.id,
          to: email,
          subject,
          htmlBody,
        });
      } catch (e) {
        console.error('[ai-send-plaquette] Erreur destinataire:', email, e);
        results.errors.push({ email, reason: e.message });
      }
    }

    // 4. Si aucun email à envoyer, on s'arrête là
    if (results.emails_to_send.length === 0) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Aucun email à envoyer',
        results,
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 5. Déléguer l'envoi au endpoint send-batch (qui attache la plaquette PDF)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://patrimonia-crm.vercel.app';
    const sendRes = await fetch(`${baseUrl}/api/email-drafts/send-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        mandatId,
        emails: results.emails_to_send,
        attachPlaquette: true,
      }),
    });
    const sendData = await sendRes.json();

    if (!sendData.ok) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Échec envoi: ' + (sendData.error || 'inconnu'),
        results,
        sendError: sendData,
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      ok: true,
      mandat: { id: mandat.id, nom: mandat.nom },
      results: {
        clients_created: results.clients_created,
        clients_found: results.clients_found,
        deals_created: results.deals_created.length,
        deals_updated: results.deals_updated.length,
        emails_sent: sendData.sentCount || 0,
        emails_failed: sendData.failedCount || 0,
        errors: [...results.errors, ...(sendData.errors || [])],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[/api/ai-send-plaquette] Erreur:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
