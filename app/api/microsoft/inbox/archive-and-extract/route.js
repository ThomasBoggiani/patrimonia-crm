// app/api/microsoft/inbox/archive-and-extract/route.js
// Pour chaque email entrant business+internal non encore archivé :
// 1. Crée une entrée dans interactions (lié au client_id si match CRM)
// 2. Demande à Claude de détecter si une action est attendue
// 3. Si oui : crée une todo (statut "À faire")
// 4. Marque l'email comme archivé dans email_categories

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Détecte si un mail contient une action attendue + propose une todo
async function detectActions(email) {
  const prompt = `Tu es un assistant pour un agent immobilier B2B haut de gamme (Immeubles & Patrimoine).

Analyse cet email reçu et détermine si une action est attendue de la part de l'agent.

Email reçu :
FROM: ${email.fromName || ''} <${email.fromAddress || ''}>
SUBJECT: ${email.subject || ''}
BODY:
${(email.bodyPreview || '').slice(0, 1500)}

Tu dois identifier :
1. Une demande explicite (l'expéditeur attend quelque chose : doc, réponse, RDV, info)
2. Une promesse de l'expéditeur (il s'engage à envoyer/faire qqch → tâche de relance)
3. Une opportunité business (un mandant propose un bien, un acheteur exprime un intérêt)

Si AUCUNE action n'est attendue (newsletter, info pure, accusé de réception), réponds :
{ "needs_action": false }

Si UNE OU PLUSIEURS actions sont attendues, réponds :
{
  "needs_action": true,
  "todos": [
    {
      "titre": "Titre court et actionnable (verbe à l'infinitif)",
      "priorite": "Haute" | "Moyenne" | "Basse",
      "echeance_jours": 3,
      "raison": "1 ligne expliquant pourquoi"
    }
  ]
}

Règles :
- Si demande explicite urgente : priorite "Haute", echeance 1-3 jours
- Si promesse de l'expéditeur : créer une tâche de RELANCE à J+7
- Si simple info / accusé : pas de todo
- Maximum 2 todos par email
- Titre en français, format "Action verbe + objet" (ex: "Renvoyer le lien à Paul Lemoine", "Relancer Adevinta sur API")

Réponds UNIQUEMENT en JSON, sans markdown.`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0]?.text || '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { needs_action: false };
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.warn('[archive-and-extract] JSON parse error:', e);
    return { needs_action: false };
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const accessToken = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Session invalide' }, { status: 401 });

    const body = await request.json();
    const { emails } = body;
    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'emails requis' }, { status: 400 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const results = [];

    for (const email of emails) {
      try {
        // 1. Vérifie qu'on n'a pas déjà archivé ce mail
        const { data: existing } = await adminSupabase
          .from('email_categories')
          .select('archived_at, interaction_id')
          .eq('message_id', email.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existing?.archived_at) {
          results.push({ messageId: email.id, status: 'already_archived' });
          continue;
        }

        // 2. Construit le résumé (sujet + 200 premiers caractères)
        const subject = email.subject || '(sans objet)';
        const preview = (email.bodyPreview || '').slice(0, 200).trim();
        const resume = preview ? `${subject} — ${preview}` : subject;

        // 3. Crée l'entrée interactions
        const interactionPayload = {
          client_id: email.clientId || null,
          mandat_id: null,
          date: email.receivedDate ? email.receivedDate.split('T')[0] : new Date().toISOString().split('T')[0],
          type: 'email_entrant',
          resume: resume.slice(0, 500), // safety
          created_by: user.id,
          metadata: {
            message_id: email.id,
            from_name: email.fromName,
            from_address: email.fromAddress,
            web_link: email.webLink,
            has_attachments: email.hasAttachments || false,
            categorie: email.categorie,
            archived_via: 'inbox_auto'
          }
        };

        const { data: interaction, error: intErr } = await adminSupabase
          .from('interactions')
          .insert(interactionPayload)
          .select('id')
          .single();

        if (intErr) {
          console.error('[archive-and-extract] interaction insert error:', intErr);
          results.push({ messageId: email.id, status: 'error', error: intErr.message });
          continue;
        }

        // 4. Analyse IA pour détecter les actions
        let todosCreated = 0;
        try {
          const analysis = await detectActions(email);

          if (analysis.needs_action && Array.isArray(analysis.todos) && analysis.todos.length > 0) {
            const todosToInsert = analysis.todos.slice(0, 2).map(t => {
              const echeanceJours = Math.max(1, Math.min(30, t.echeance_jours || 3));
              const echeance = new Date();
              echeance.setDate(echeance.getDate() + echeanceJours);
              return {
                titre: (t.titre || 'Action à traiter').slice(0, 200),
                priorite: ['Haute', 'Moyenne', 'Basse'].includes(t.priorite) ? t.priorite : 'Moyenne',
                statut: 'À faire',
                echeance: echeance.toISOString().split('T')[0],
                lien_type: email.clientId ? 'client' : null,
                lien_id: email.clientId || null,
                created_by: user.id,
                assigned_to_user_id: user.id
              };
            });

            const { error: todoErr } = await adminSupabase
              .from('todos')
              .insert(todosToInsert);

            if (todoErr) {
              console.error('[archive-and-extract] todo insert error:', todoErr);
            } else {
              todosCreated = todosToInsert.length;
            }
          }
        } catch (aiErr) {
          console.warn('[archive-and-extract] AI error (continuing):', aiErr.message);
        }

        // 5. Marque le mail comme archivé
        await adminSupabase
          .from('email_categories')
          .update({
            archived_at: new Date().toISOString(),
            interaction_id: interaction.id,
            todos_count: todosCreated
          })
          .eq('message_id', email.id)
          .eq('user_id', user.id);

        results.push({
          messageId: email.id,
          status: 'archived',
          interactionId: interaction.id,
          todosCreated
        });
      } catch (e) {
        console.error('[archive-and-extract] error on email:', email.id, e);
        results.push({ messageId: email.id, status: 'error', error: e.message });
      }
    }

    return NextResponse.json({
      processed: results.length,
      archived: results.filter(r => r.status === 'archived').length,
      todosTotal: results.reduce((sum, r) => sum + (r.todosCreated || 0), 0),
      results
    });
  } catch (err) {
    console.error('[archive-and-extract] global error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
