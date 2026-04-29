// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/[id]/ai/route.js — v2.0
// Streaming + persistence en BDD
//
// POST /api/mandats/{id}/ai            → streaming chat
// GET  /api/mandats/{id}/ai/history    → ❌ NON, on fait via POST { mode: 'load' }
// POST /api/mandats/{id}/ai            { mode: 'load', token }   → charge l'historique
// POST /api/mandats/{id}/ai            { mode: 'clear', token }  → efface l'historique
// POST /api/mandats/{id}/ai            { token, action|message, history } → stream
// ═══════════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

function buildMandatContext(mandat) {
  const lines = [];
  lines.push(`# Contexte du bien`);
  lines.push(`- Nom : ${mandat.nom || '(non renseigné)'}`);
  lines.push(`- Type : ${mandat.type || '(non renseigné)'}${mandat.sous_type ? ' / ' + mandat.sous_type : ''}`);
  if (mandat.adresse) lines.push(`- Adresse : ${mandat.adresse}`);
  if (mandat.ville) lines.push(`- Ville : ${mandat.ville}`);
  if (mandat.surface) lines.push(`- Surface : ${mandat.surface} m²`);
  if (mandat.nb_pieces) lines.push(`- Pièces : ${mandat.nb_pieces}`);
  if (mandat.nb_chambres) lines.push(`- Chambres : ${mandat.nb_chambres}`);
  if (mandat.etage !== null && mandat.etage !== undefined) lines.push(`- Étage : ${mandat.etage}`);
  if (mandat.prix) lines.push(`- Prix affiché (HAI) : ${mandat.prix} €`);
  if (mandat.prix_net_vendeur) lines.push(`- Prix net vendeur : ${mandat.prix_net_vendeur} €`);
  if (mandat.honoraires_charge) lines.push(`- Honoraires à charge : ${mandat.honoraires_charge}`);
  if (mandat.honoraires_taux) lines.push(`- Taux honoraires : ${mandat.honoraires_taux} %`);
  if (mandat.rendement) lines.push(`- Rendement : ${mandat.rendement} %`);
  if (mandat.loyers_annuels) lines.push(`- Loyers annuels : ${mandat.loyers_annuels} €`);
  if (mandat.charges_annuelles) lines.push(`- Charges courantes annuelles : ${mandat.charges_annuelles} €`);
  if (mandat.dpe_consommation) lines.push(`- DPE consommation : ${mandat.dpe_consommation} kWh/m²/an`);
  if (mandat.dpe_emissions) lines.push(`- DPE émissions : ${mandat.dpe_emissions} kg CO2/m²/an`);
  if (mandat.annee_construction) lines.push(`- Année de construction : ${mandat.annee_construction}`);
  if (mandat.statut_copropriete) lines.push(`- Copropriété : ${mandat.statut_copropriete}`);
  if (mandat.nb_lots) lines.push(`- Nombre de lots copropriété : ${mandat.nb_lots}`);
  lines.push(`- Statut commercial : ${mandat.is_off_market ? 'OFF-MARKET (diffusion restreinte)' : 'Marché ouvert'}`);
  if (mandat.commercialisation) lines.push(`- Type de commercialisation : ${mandat.commercialisation}`);
  if (Array.isArray(mandat.highlights) && mandat.highlights.length > 0) {
    lines.push(`- Points forts ("Nous aimons") : ${mandat.highlights.join(', ')}`);
  }
  if (mandat.description) {
    lines.push(``);
    lines.push(`# Description actuelle du bien`);
    lines.push(mandat.description);
  }
  return lines.join('\n');
}

const QUICK_ACTIONS = {
  descriptif: {
    label: 'Descriptif',
    user: `Génère-moi un descriptif marketing professionnel et engageant pour ce bien, à utiliser sur les portails immobiliers et plaquettes. Le ton doit être valorisant sans être survendu, factuel sur les caractéristiques, avec une accroche initiale forte. Longueur : 200-300 mots. Structure :
1. Une accroche (1 phrase)
2. Une description fluide du bien (2-3 paragraphes)
3. Un dernier paragraphe sur l'environnement/quartier si pertinent

Réponds directement avec le descriptif, sans introduction du type "Voici le descriptif".`,
  },
  email_mandant: {
    label: 'Email mandant',
    user: `Rédige un email professionnel et chaleureux à destination du mandant (le vendeur de ce bien) pour faire un point d'étape sur la commercialisation. L'email doit :
- Commencer par "Cher Madame, Cher Monsieur," (ou similaire)
- Être chaleureux et rassurant
- Faire le point sur les actions menées (en ton générique, sans inventer de chiffres)
- Demander un retour ou proposer un échange téléphonique
- Se terminer par une formule de politesse soignée

Longueur : 150-200 mots. Réponds directement par l'email, sans introduction.`,
  },
  argumentaire: {
    label: 'Argumentaire',
    user: `Génère un argumentaire de vente percutant pour ce bien, à utiliser face à un acheteur intéressé. L'argumentaire doit :
- Identifier 5-7 arguments clés (un par ligne, format puces)
- Anticiper les objections probables avec des éléments de réponse (2-3 objections + réponses)
- Hiérarchiser les arguments du plus fort au plus secondaire

Format clair en 2 sections : "Arguments clés" et "Réponses aux objections probables". Réponds directement avec l'argumentaire.`,
  },
};

// Helper : load conversation depuis BDD
async function loadConversation(mandatId, userId) {
  const { data } = await supabaseAdmin
    .from('ai_conversations')
    .select('messages')
    .eq('mandat_id', mandatId)
    .eq('user_id', userId)
    .maybeSingle();
  return Array.isArray(data?.messages) ? data.messages : [];
}

// Helper : save/update conversation en BDD (upsert)
async function saveConversation(mandatId, userId, messages) {
  const { error } = await supabaseAdmin
    .from('ai_conversations')
    .upsert({
      mandat_id: mandatId,
      user_id: userId,
      messages,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'mandat_id,user_id' });
  if (error) console.error('[AI] saveConversation error:', error.message);
}

// Helper : clear conversation
async function clearConversation(mandatId, userId) {
  const { error } = await supabaseAdmin
    .from('ai_conversations')
    .delete()
    .eq('mandat_id', mandatId)
    .eq('user_id', userId);
  if (error) console.error('[AI] clearConversation error:', error.message);
}

export async function POST(request, { params }) {
  try {
    const body = await request.json();
    const { token, action, message, mode } = body;

    const user = await verifyToken(token);
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Authentification requise' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { id: mandatId } = params;
    if (!mandatId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'ID mandat manquant' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mode : load history
    if (mode === 'load') {
      const messages = await loadConversation(mandatId, user.id);
      return new Response(
        JSON.stringify({ ok: true, messages }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mode : clear history
    if (mode === 'clear') {
      await clearConversation(mandatId, user.id);
      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mode : streaming chat (default)
    const { data: mandat, error: mErr } = await supabaseAdmin
      .from('mandats')
      .select('*')
      .eq('id', mandatId)
      .maybeSingle();

    if (mErr || !mandat) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Mandat introuvable' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Construire le user message
    let userMessage;
    let userVisibleLabel; // ce qui sera stocké dans l'historique côté user
    if (action && QUICK_ACTIONS[action]) {
      userMessage = QUICK_ACTIONS[action].user;
      userVisibleLabel = `[Action] ${QUICK_ACTIONS[action].label}`;
    } else if (message) {
      userMessage = message;
      userVisibleLabel = message;
    } else {
      return new Response(
        JSON.stringify({ ok: false, error: 'action ou message requis' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Charger l'historique BDD existant
    const history = await loadConversation(mandatId, user.id);

    // Construire les messages pour l'API Claude
    // (l'historique BDD contient déjà des entrées au bon format)
    const apiMessages = [
      ...history.map(m => ({
        role: m.role,
        // Pour les actions rapides, on remplace le label par le vrai prompt
        content: m.role === 'user' && m.action && QUICK_ACTIONS[m.action]
          ? QUICK_ACTIONS[m.action].user
          : m.content,
      })),
      { role: 'user', content: userMessage },
    ];

    // System prompt
    const mandatContext = buildMandatContext(mandat);
    const systemPrompt = `Tu es l'assistant IA d'Immeubles & Patrimoine, une agence immobilière patrimoniale haut de gamme spécialisée dans les transactions off-market à Paris.

Tu aides les commerciaux à valoriser leurs mandats. Tu tutoies l'utilisateur de manière professionnelle (style "voici ton descriptif"). Tu es direct, précis, sans formules superflues.

Tu as accès aux informations complètes du mandat sur lequel travaille l'utilisateur (ci-dessous). Utilise ces données concrètes dans tes réponses, sans inventer ni extrapoler de chiffres.

${mandatContext}

# Règles
- Réponds en français.
- Ne mentionne jamais "Claude" ou "Anthropic" dans tes réponses.
- Ne raconte pas que tu es un assistant IA, sauf si on te demande explicitement.
- Sois concis et opérationnel. Pas de blabla.
- Si une donnée manque, ne l'invente pas — dis simplement qu'elle est à compléter.`;

    // Appel Claude en mode STREAMING
    const stream = await anthropic.messages.stream({
      model: 'claude-haiku-4-5',
      max_tokens: 2000,
      system: systemPrompt,
      messages: apiMessages,
    });

    // Construire le ReadableStream pour la réponse SSE
    const encoder = new TextEncoder();
    let fullText = '';

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              const chunk = event.delta.text || '';
              fullText += chunk;
              // Format SSE : "data: <json>\n\n"
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: chunk })}\n\n`));
            }
          }

          // Fin du stream → sauver l'historique
          const newHistory = [
            ...history,
            {
              role: 'user',
              content: userVisibleLabel,
              action: action || null,
              ts: new Date().toISOString(),
            },
            {
              role: 'assistant',
              content: fullText,
              ts: new Date().toISOString(),
            },
          ];

          await saveConversation(mandatId, user.id, newHistory);

          // Signal de fin
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        } catch (err) {
          console.error('[AI stream] Erreur:', err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    console.error('[/api/mandats/[id]/ai] Erreur:', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
