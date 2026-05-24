// app/api/microsoft/inbox/classify/route.js
// Classifie un batch d'emails via Claude (Anthropic SDK).
// Appelée en background depuis /api/microsoft/inbox GET.
// Stocke les résultats dans la table email_categories pour cache.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORIES = ['business', 'notification', 'internal', 'transaction', 'newsletter', 'autre'];

// Patterns rapides pour pré-classification sans appel IA (économie de tokens)
const NOTIFICATION_PATTERNS = [
  /no-reply@/i, /noreply@/i, /donotreply@/i,
  /@vercel\.com$/i, /@github\.com$/i, /@openai\.com$/i,
  /@supabase\.io$/i, /@anthropic\.com$/i, /@stripe\.com$/i,
  /@cloudflare\.com$/i, /@netlify\.com$/i, /@aws\.amazon\.com$/i
];

const NEWSLETTER_PATTERNS = [
  /unsubscribe/i, /se désabonner/i, /newsletter@/i,
  /@mailchimp\.com$/i, /@sendinblue\.com$/i, /@brevo\.com$/i
];

const INTERNAL_DOMAIN = 'immeubles-patrimoine.fr';

function quickClassify(email) {
  const addr = (email.fromAddress || '').toLowerCase();
  const subject = (email.subject || '').toLowerCase();
  const body = (email.bodyPreview || '').toLowerCase();

  // Notification (auto / technique)
  if (NOTIFICATION_PATTERNS.some(p => p.test(addr))) {
    return { categorie: 'notification', confiance: 0.95, raison: 'Sender pattern auto' };
  }

  // Internal (même domaine)
  if (addr.endsWith(`@${INTERNAL_DOMAIN}`)) {
    return { categorie: 'internal', confiance: 0.9, raison: 'Domaine interne' };
  }

  // Newsletter
  if (NEWSLETTER_PATTERNS.some(p => p.test(addr) || p.test(body))) {
    return { categorie: 'newsletter', confiance: 0.85, raison: 'Pattern newsletter' };
  }

  // Contact CRM matché → très probablement business
  if (email.hasCrmMatch) {
    return { categorie: 'business', confiance: 0.85, raison: 'Contact CRM' };
  }

  return null; // Nécessite l'IA
}

async function classifyWithAI(emails) {
  const list = emails.map((e, i) => 
    `[${i}] FROM: ${e.fromName || ''} <${e.fromAddress || ''}>\nSUBJECT: ${e.subject || '(sans objet)'}\nPREVIEW: ${(e.bodyPreview || '').slice(0, 300)}`
  ).join('\n\n---\n\n');

  const prompt = `Tu es un classificateur d'emails pour une agence immobilière B2B haut de gamme (Immeubles & Patrimoine, off-market 5-15M€).

Catégories possibles :
- "business" : échanges métier avec mandants, acheteurs, notaires, agences partenaires, family offices, foncières, marchands de biens, promoteurs, fonds (vrais échanges commerciaux)
- "notification" : alertes auto de services techniques (Vercel, GitHub, OpenAI, Supabase, Stripe, AWS, etc.)
- "internal" : mails entre membres de l'équipe Immeubles & Patrimoine
- "transaction" : factures, paiements, banque, comptabilité, fiscalité
- "newsletter" : campagnes commerciales, abonnements, actualités, prospection entrante massive
- "autre" : tout le reste (personnel, indéterminé)

Classifie ces ${emails.length} emails. Réponds UNIQUEMENT en JSON, format strict :
{ "results": [{ "index": 0, "categorie": "business", "confiance": 0.9 }, ...] }

Emails :

${list}`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0]?.text || '{}';
  // Extrait le JSON (au cas où il y a du texte autour)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn('[classify] No JSON in AI response:', text);
    return [];
  }
  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.results || [];
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
    const { messages } = body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages requis' }, { status: 400 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Phase 1 : quick classification (sans appel IA) pour les patterns évidents
    const results = [];
    const needsAI = [];
    const needsAIIndices = [];

    for (let i = 0; i < messages.length; i++) {
      const quick = quickClassify(messages[i]);
      if (quick) {
        results.push({ messageId: messages[i].id, ...quick });
      } else {
        needsAI.push(messages[i]);
        needsAIIndices.push(i);
      }
    }

    // Phase 2 : appel IA pour les emails qui n'ont pas été classés rapidement
    if (needsAI.length > 0) {
      try {
        // Batch par 20 pour respecter les limites de tokens
        const BATCH_SIZE = 20;
        for (let i = 0; i < needsAI.length; i += BATCH_SIZE) {
          const batch = needsAI.slice(i, i + BATCH_SIZE);
          const aiResults = await classifyWithAI(batch);
          for (const r of aiResults) {
            const msg = batch[r.index];
            if (!msg) continue;
            const cat = CATEGORIES.includes(r.categorie) ? r.categorie : 'autre';
            results.push({
              messageId: msg.id,
              categorie: cat,
              confiance: typeof r.confiance === 'number' ? r.confiance : 0.5,
              raison: 'IA'
            });
          }
        }
      } catch (aiErr) {
        console.error('[classify] AI error:', aiErr);
        // En cas d'erreur IA, on classe en 'autre' avec faible confiance
        for (const msg of needsAI) {
          if (!results.find(r => r.messageId === msg.id)) {
            results.push({
              messageId: msg.id,
              categorie: 'autre',
              confiance: 0.1,
              raison: 'IA error'
            });
          }
        }
      }
    }

    // Phase 3 : upsert dans email_categories
    const rows = results.map(r => ({
      message_id: r.messageId,
      user_id: user.id,
      categorie: r.categorie,
      confiance: r.confiance,
      raison: r.raison || null
    }));

    if (rows.length > 0) {
      const { error: upsertErr } = await adminSupabase
        .from('email_categories')
        .upsert(rows, { onConflict: 'message_id' });
      if (upsertErr) {
        console.error('[classify] upsert error:', upsertErr);
      }
    }

    return NextResponse.json({
      classified: results.length,
      quick: messages.length - needsAI.length,
      ai: needsAI.length
    });
  } catch (err) {
    console.error('[classify] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
