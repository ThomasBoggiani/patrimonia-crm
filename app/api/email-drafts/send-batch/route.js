// ═══════════════════════════════════════════════════════════════════
// app/api/email-drafts/send-batch/route.js
// Envoie des emails en batch via Microsoft Graph (M365 connecté)
// 
// Input : { token, mandatId, emails: [{ clientId, to, subject, htmlBody }] }
// Output : { ok, sent, failed, errors }
// ═══════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { callGraph } from '@/lib/microsoft-graph';

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

async function downloadPlaquettePdf(mandatId, token) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://patrimonia-crm.vercel.app';
    const res = await fetch(`${baseUrl}/api/mandats/${mandatId}/plaquette-cached`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.toString('base64');
  } catch (e) {
    console.warn('[send-batch] Plaquette PDF download failed:', e.message);
    return null;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, mandatId, emails, attachPlaquette = true } = body;

    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    if (!Array.isArray(emails) || emails.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'emails (tableau) requis' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Récupérer le nom du mandat pour le nom du PDF en pièce jointe
    const { data: mandat } = await supabaseAdmin.from('mandats').select('nom').eq('id', mandatId).single();
    const mandatLabel = mandat?.nom || 'bien';

    // Télécharger la plaquette PDF UNE FOIS (réutilisée pour tous les emails)
    let pdfBase64 = null;
    if (attachPlaquette && mandatId) {
      pdfBase64 = await downloadPlaquettePdf(mandatId, token);
    }

    const results = { sent: [], failed: [], errors: [] };

    for (const email of emails) {
      const { clientId, to, subject, htmlBody, body: textBody } = email;

      if (!to || !subject || !htmlBody) {
        results.failed.push({ clientId, reason: 'Champs to/subject/htmlBody manquants' });
        continue;
      }

      try {
        const attachments = [];
        if (pdfBase64) {
          const safeName = mandatLabel.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 50);
          attachments.push({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: `Plaquette_${safeName}.pdf`,
            contentType: 'application/pdf',
            contentBytes: pdfBase64,
          });
        }

        const graphPayload = {
          message: {
            subject,
            body: { contentType: 'HTML', content: htmlBody },
            toRecipients: [{ emailAddress: { address: to } }],
            attachments,
          },
          saveToSentItems: true,
        };

        await callGraph({
          supabase: supabaseAdmin,
          userId: user.id,
          endpoint: '/me/sendMail',
          method: 'POST',
          body: graphPayload,
        });

        results.sent.push({ clientId, to });

        // Log l'envoi dans interactions
        await supabaseAdmin.from('interactions').insert({
          mandat_id: mandatId || null,
          client_id: clientId || null,
          type: 'email_sortant',
          resume: `Email envoyé : ${subject}`,
          created_by: user.id,
        });

        // Pilier 2 — Relance automatique : vérifier que le prospect a bien pris
        // connaissance de la plaquette, puis proposer une visite.
        // Déclenchée uniquement sur cet envoi délibéré (jamais sur un email entrant).
        if (clientId) {
          try {
            const echeance = new Date();
            echeance.setDate(echeance.getDate() + 3);
            const titre = `Relancer suite à l'envoi de la plaquette — ${mandatLabel}`;

            // Anti-doublon : une seule relance ouverte par client et par mandat
            const { data: dejaOuverte } = await supabaseAdmin
              .from('todos')
              .select('id')
              .eq('lien_type', 'client')
              .eq('lien_id', clientId)
              .eq('titre', titre)
              .neq('statut', 'Terminé')
              .maybeSingle();

            if (!dejaOuverte) {
              await supabaseAdmin.from('todos').insert({
                titre,
                priorite: 'Moyenne',
                statut: 'À faire',
                echeance: echeance.toISOString().split('T')[0],
                assigned_to_user_id: user.id,
                created_by: user.id,
                lien_type: 'client',
                lien_id: clientId,
              });
            }
          } catch (e) {
            console.warn('[send-batch] relance non créée:', e.message);
          }
        }

      } catch (e) {
        console.error(`[send-batch] Échec envoi à ${to}:`, e.message);
        results.failed.push({ clientId, to, reason: e.message });
        results.errors.push(e.message);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      sentCount: results.sent.length,
      failedCount: results.failed.length,
      sent: results.sent,
      failed: results.failed,
      errors: results.errors,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[/api/email-drafts/send-batch] Erreur:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
