// app/api/assistant/chat/route.js
//
// Assistant Patrimonia - Phase 2.0
// Endpoint de chat avec function calling GPT-4o.
// Pour cette phase, l'IA n'a que 2 outils de LECTURE :
//   - search_mandats : cherche dans la table mandats
//   - search_clients : cherche dans la table clients
// Aucune création ni modification possible à cette étape.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ==========================================================================
// SYSTEM PROMPT
// ==========================================================================

function buildSystemPrompt() {
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return `Tu es l'Assistant Patrimonia, l'IA intégrée au CRM d'Immeubles & Patrimoine (off-market patrimonial Paris).

Date du jour : ${today}.

RÔLE
Tu aides Thomas (le fondateur) à naviguer dans son CRM : tu peux chercher des mandats (biens immobiliers à vendre) et des clients (acquéreurs).

CAPACITÉS ACTUELLES (Phase 2.0)
- search_mandats : chercher dans les mandats par adresse, ville, type, prix, statut, etc.
- search_clients : chercher dans les clients par nom, ville recherchée, budget, typologie B2B/B2C, etc.

⚠️ Tu ne peux RIEN créer, modifier ou supprimer pour le moment. Ces capacités arriveront plus tard.

STYLE
- Tutoie Thomas.
- Court et direct, jamais bavard.
- En français.
- Mets en gras les noms importants (mandats, clients) avec **double étoiles**.
- Si tu trouves plusieurs résultats, liste-les de façon concise (1 ligne par item).
- Si tu ne trouves rien, dis-le clairement et propose une recherche alternative.

CONTEXTE MÉTIER
- "Mandat" = un bien immobilier en vente (immeuble, appartement, local commercial, etc.).
- "Client" = un acquéreur potentiel (B2C = particulier, B2B = institutionnel comme foncière, family office).
- "Statut mandat" : Sourcing, Mandat signé, En cours, Vendu, Abandonné.
- "Maturité client" : Tiède, Chaud, Brûlant.
- Les prix sont en euros, souvent en millions.

UTILISATION DES OUTILS
- N'hésite pas à appeler plusieurs fois les outils pour raffiner ta recherche.
- Si Thomas pose une question vague, fais d'abord une recherche large, puis affine.
- Avant de répondre, vérifie que tu as bien les infos nécessaires en BDD.`;
}

// ==========================================================================
// DÉFINITION DES OUTILS (function calling OpenAI)
// ==========================================================================

const tools = [
  {
    type: 'function',
    function: {
      name: 'search_mandats',
      description: 'Cherche dans la table des mandats (biens immobiliers à vendre). Retourne une liste de mandats correspondant aux critères.',
      parameters: {
        type: 'object',
        properties: {
          query_text: {
            type: 'string',
            description: 'Texte libre à chercher dans le titre, l\'adresse, la ville ou la référence du mandat. Optionnel.'
          },
          ville: {
            type: 'string',
            description: 'Filtre par ville exacte (ex: "Paris", "Versailles"). Optionnel.'
          },
          statut: {
            type: 'string',
            description: 'Filtre par statut. Valeurs possibles : "Sourcing", "Mandat signé", "En cours", "Vendu", "Abandonné". Optionnel.'
          },
          prix_min: {
            type: 'number',
            description: 'Prix minimum en euros. Optionnel.'
          },
          prix_max: {
            type: 'number',
            description: 'Prix maximum en euros. Optionnel.'
          },
          limit: {
            type: 'integer',
            description: 'Nombre max de résultats. Défaut : 10.'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_clients',
      description: 'Cherche dans la table des clients (acquéreurs). Retourne une liste de clients correspondant aux critères.',
      parameters: {
        type: 'object',
        properties: {
          query_text: {
            type: 'string',
            description: 'Texte libre à chercher dans le nom, prénom, société ou email. Optionnel.'
          },
          typologie: {
            type: 'string',
            description: 'Filtre par typologie. Valeurs possibles : "B2C", "B2B". Optionnel.'
          },
          maturite: {
            type: 'string',
            description: 'Filtre par maturité. Valeurs possibles : "Tiède", "Chaud", "Brûlant". Optionnel.'
          },
          statut: {
            type: 'string',
            description: 'Filtre par statut client. Optionnel.'
          },
          limit: {
            type: 'integer',
            description: 'Nombre max de résultats. Défaut : 10.'
          }
        },
        required: []
      }
    }
  }
];

// ==========================================================================
// IMPLÉMENTATION DES OUTILS
// ==========================================================================

async function executeSearchMandats(args) {
  const { query_text, ville, statut, prix_min, prix_max, limit = 10 } = args;

  let query = supabaseAdmin
    .from('mandats')
    .select('id, titre, adresse, ville, statut, prix, surface, type_bien, owner, created_at')
    .limit(Math.min(limit, 20));

  if (query_text && query_text.trim()) {
    const q = `%${query_text.trim()}%`;
    query = query.or(`titre.ilike.${q},adresse.ilike.${q},ville.ilike.${q},reference.ilike.${q}`);
  }
  if (ville) query = query.ilike('ville', `%${ville}%`);
  if (statut) query = query.eq('statut', statut);
  if (typeof prix_min === 'number') query = query.gte('prix', prix_min);
  if (typeof prix_max === 'number') query = query.lte('prix', prix_max);

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) {
    console.error('[assistant/chat] search_mandats error:', error);
    return { error: error.message, results: [] };
  }
  return {
    count: data?.length || 0,
    results: (data || []).map(m => ({
      id: m.id,
      titre: m.titre || '(sans titre)',
      adresse: m.adresse,
      ville: m.ville,
      statut: m.statut,
      prix: m.prix,
      surface: m.surface,
      type_bien: m.type_bien,
      owner: m.owner
    }))
  };
}

async function executeSearchClients(args) {
  const { query_text, typologie, maturite, statut, limit = 10 } = args;

  let query = supabaseAdmin
    .from('clients')
    .select('id, prenom, nom, societe, email, tel, typologie, maturite, statut, ville_recherche, budget_min, budget_max, owner, created_at')
    .limit(Math.min(limit, 20));

  if (query_text && query_text.trim()) {
    const q = `%${query_text.trim()}%`;
    query = query.or(`prenom.ilike.${q},nom.ilike.${q},societe.ilike.${q},email.ilike.${q}`);
  }
  if (typologie) query = query.eq('typologie', typologie);
  if (maturite) query = query.eq('maturite', maturite);
  if (statut) query = query.eq('statut', statut);

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) {
    console.error('[assistant/chat] search_clients error:', error);
    return { error: error.message, results: [] };
  }
  return {
    count: data?.length || 0,
    results: (data || []).map(c => ({
      id: c.id,
      nom_complet: [c.prenom, c.nom].filter(Boolean).join(' ') || c.societe || '(anonyme)',
      societe: c.societe,
      email: c.email,
      tel: c.tel,
      typologie: c.typologie,
      maturite: c.maturite,
      statut: c.statut,
      ville_recherche: c.ville_recherche,
      budget_min: c.budget_min,
      budget_max: c.budget_max,
      owner: c.owner
    }))
  };
}

async function executeTool(name, args) {
  switch (name) {
    case 'search_mandats': return await executeSearchMandats(args);
    case 'search_clients': return await executeSearchClients(args);
    default:
      return { error: `Outil inconnu : ${name}` };
  }
}

// ==========================================================================
// BOUCLE PRINCIPALE
// ==========================================================================

export async function POST(req) {
  try {
    const body = await req.json();
    const userMessages = Array.isArray(body?.messages) ? body.messages : [];

    if (!userMessages.length) {
      return NextResponse.json({ error: 'messages requis' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY manquante' }, { status: 500 });
    }

    // Construction de la conversation pour OpenAI
    const conversation = [
      { role: 'system', content: buildSystemPrompt() },
      ...userMessages
    ];

    // Boucle de function calling (max 6 itérations pour éviter les boucles infinies)
    const MAX_ITERATIONS = 6;
    let finalMessage = null;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: conversation,
          tools,
          tool_choice: 'auto',
          temperature: 0.3
        })
      });

      if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        console.error('[assistant/chat] OpenAI error:', errText);
        return NextResponse.json(
          { error: 'Erreur OpenAI', detail: errText },
          { status: 500 }
        );
      }

      const openaiData = await openaiRes.json();
      const choice = openaiData?.choices?.[0];
      const msg = choice?.message;

      if (!msg) {
        return NextResponse.json({ error: 'Réponse OpenAI vide' }, { status: 500 });
      }

      // Si l'IA veut appeler des outils
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        conversation.push(msg);

        for (const toolCall of msg.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs = {};
          try {
            toolArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch (e) {
            console.error('[assistant/chat] JSON parse args error:', e);
          }

          console.log(`[assistant/chat] Tool call: ${toolName}`, toolArgs);
          const toolResult = await executeTool(toolName, toolArgs);

          conversation.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        }
        // On reboucle pour que l'IA continue
        continue;
      }

      // Sinon, c'est la réponse finale
      finalMessage = msg.content || '';
      break;
    }

    if (finalMessage === null) {
      return NextResponse.json(
        { error: 'Limite d\'itérations atteinte sans réponse finale' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: finalMessage,
      role: 'assistant'
    });

  } catch (e) {
    console.error('[assistant/chat] Erreur:', e);
    return NextResponse.json(
      { error: 'Erreur serveur', detail: e.message },
      { status: 500 }
    );
  }
}
