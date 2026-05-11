// ═══════════════════════════════════════════════════════════════════
// app/api/email-drafts/generate/route.js
// Génère un draft d'email personnalisé pour proposer un mandat à un client
// 
// Input : { token, mandatId, clientId }
// Output : { ok, subject, body, htmlBody, matchReasons, score }
// ═══════════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { matchClientsForMandat } from '@/lib/matching';

export const maxDuration = 30;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

function buildSystemPrompt(mandat, client, commercial, matchReasons) {
  const clientName = `${client.prenom || ''} ${client.nom || ''}`.trim() || client.societe || 'cher client';
  const isCorporate = !!client.societe;
  const formality = isCorporate ? 'vouvoiement professionnel' : 'vouvoiement chaleureux';

  return `Tu es ${commercial?.prenom || 'le commercial'} ${commercial?.nom || ''} d'Immeubles & Patrimoine, un cabinet de conseil immobilier patrimonial off-market basé à Paris.

Tu écris un email PERSONNALISÉ à un client pour lui présenter un bien qui correspond à ses critères de recherche.

═══ DESTINATAIRE ═══
${JSON.stringify({
  nom: clientName,
  societe: client.societe || null,
  typologie: client.typologie || null,
  budget_min: client.budget_min,
  budget_max: client.budget_max,
  zones: client.zones || [],
  typologies_recherchees: client.typologies_recherchees || [],
  rendement_min: client.rendement_min || null,
  maturite: client.maturite || null,
}, null, 2)}

═══ BIEN À PROPOSER ═══
${JSON.stringify({
  nom: mandat.nom,
  adresse: mandat.adresse,
  ville: mandat.ville,
  type: mandat.type,
  sous_type: mandat.sous_type,
  surface: mandat.surface,
  prix: mandat.prix,
  loyers_annuels: mandat.loyers_annuels,
  rendement: mandat.rendement,
  rendement_optimise: mandat.rendement_optimise,
  dpe_consommation: mandat.dpe_consommation,
  nb_lots: mandat.nb_lots,
  description: mandat.description ? mandat.description.slice(0, 1000) : null,
  highlights: mandat.highlights || [],
  commercialisation: mandat.commercialisation,
}, null, 2)}

═══ RAISONS DU MATCH ═══
${(matchReasons || []).join(', ')}

═══ TON & STYLE ═══
- ${formality}
- Ton confidentiel et premium (off-market)
- Email court : 8-12 lignes maximum
- Pas de formules cliché ("J'espère que vous allez bien")
- Aller directement à l'essentiel : pourquoi ce bien matche les critères du client
- Mentionner 2-3 caractéristiques clés du bien (prix, rendement, emplacement, point fort)
- Proposer une suite concrète (visite, brochure)
- Signer en bas avec le prénom du commercial

═══ RÉPONSE ═══
Renvoie UNIQUEMENT un JSON valide (pas de backticks markdown) :

{
  "subject": "[Off-market] Immeuble Paris 11e — 12,6% de rendement",
  "body": "Bonjour ${clientName},\\n\\nJe vous adresse en exclusivité un bien qui correspond parfaitement à vos critères...\\n\\n...",
  "htmlBody": "<p>Bonjour ${clientName},</p><p>Je vous adresse en exclusivité un bien qui correspond...</p>..."
}

Règles :
- "subject" : max 70 caractères, accrocheur, mentionne "off-market" ou le bien clé
- "body" : texte brut avec sauts de ligne (\\n)
- "htmlBody" : version HTML avec <p>, <strong> pour mettre en valeur prix/rendement/chiffres clés
- TOUS les textes en FRANÇAIS
- Pas de préambule, pas de markdown, UNIQUEMENT le JSON`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, mandatId, clientId } = body;

    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    if (!mandatId || !clientId) {
      return new Response(JSON.stringify({ ok: false, error: 'mandatId et clientId requis' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Charger mandat + client + profil commercial
    const [mandatRes, clientRes, profileRes] = await Promise.all([
      supabaseAdmin.from('mandats').select('*').eq('id', mandatId).single(),
      supabaseAdmin.from('clients').select('*').eq('id', clientId).single(),
      supabaseAdmin.from('profiles').select('prenom, nom, email').eq('id', user.id).single(),
    ]);

    if (mandatRes.error || !mandatRes.data) {
      return new Response(JSON.stringify({ ok: false, error: 'Mandat introuvable' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    if (clientRes.error || !clientRes.data) {
      return new Response(JSON.stringify({ ok: false, error: 'Client introuvable' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const mandat = mandatRes.data;
    const client = clientRes.data;
    const commercial = profileRes.data || null;

    // Calculer les raisons du match
    const matches = matchClientsForMandat(mandat, [client]);
    const myMatch = matches.find(m => m.client.id === clientId);
    const matchReasons = myMatch?.raisons || [];
    const score = myMatch?.score || 0;

    // Appel Claude
    const systemPrompt = buildSystemPrompt(mandat, client, commercial, matchReasons);
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Génère le draft email pour ce client.' }],
    });

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    let parsed;
    try {
      const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('[email-drafts/generate] JSON parse error:', e.message, '\nRaw:', text.slice(0, 500));
      return new Response(JSON.stringify({ ok: false, error: 'L\'IA n\'a pas renvoyé de JSON valide.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      ok: true,
      subject: parsed.subject || '',
      body: parsed.body || '',
      htmlBody: parsed.htmlBody || '',
      matchReasons,
      score,
      clientEmail: client.email || null,
      clientName: `${client.prenom || ''} ${client.nom || ''}`.trim() || client.societe || '',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[/api/email-drafts/generate] Erreur:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
