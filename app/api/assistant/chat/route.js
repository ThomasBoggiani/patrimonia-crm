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
- search_mandats : chercher dans les mandats par nom, adresse, ville, type, prix, statut, etc.
- search_clients : chercher dans les clients par nom, société, typologie, budget, etc.

⚠️ Tu ne peux RIEN créer, modifier ou supprimer pour le moment. Ces capacités arriveront plus tard.

STYLE
- Tutoie Thomas.
- Court et direct, jamais bavard.
- En français.
- Mets en gras les noms importants (mandats, clients) avec **double étoiles**.
- Si tu trouves plusieurs résultats, liste-les de façon concise (1 ligne par item).
- Si tu ne trouves rien, dis-le clairement et propose une recherche alternative.
- Si l'utilisateur demande "tous" ou "les derniers" ou "combien", appelle search_mandats ou search_clients SANS filtre, ça retourne par défaut les plus récents.

CONTEXTE MÉTIER
- "Mandat" = un bien immobilier en vente (immeuble, appartement, local commercial, etc.). Champ "nom" = titre du mandat (ex: "Immeuble 9 rue Hoche Versailles").
- "Client" = un acquéreur potentiel.
- Statut mandat : Sourcing, En cours, Mandat signé, Vendu, Abandonné.
- Maturité client : valeur dans la table (peut être "Faible", "Moyen", "Élevé", "Chaud", etc. — utilise ce que tu vois dans les résultats).
- Typologie client : "Foncières", "Family Office", "Particuliers", etc.
- Marché : "B2B" ou "B2C".
- Les prix sont en euros, souvent en millions.
- Owner : initiales du commercial responsable (ex: "TB" = Thomas Boggiani).

UTILISATION DES OUTILS
- N'hésite pas à appeler plusieurs fois les outils pour raffiner ta recherche.
- Si Thomas pose une question vague, fais d'abord une recherche large, puis affine.`;
}

// ==========================================================================
// DÉFINITION DES OUTILS (function calling OpenAI)
// ==========================================================================

const tools = [
  {
    type: 'function',
    function: {
      name: 'search_mandats',
      description: 'Cherche dans la table des mandats (biens immobiliers à vendre). Retourne une liste de mandats correspondant aux critères. Si aucun filtre n\'est fourni, retourne les mandats les plus récents.',
      parameters: {
        type: 'object',
        properties: {
          query_text: {
            type: 'string',
            description: 'Texte libre à chercher dans le nom, l\'adresse ou la ville du mandat. Optionnel.'
          },
          ville: {
            type: 'string',
            description: 'Filtre par ville (ex: "Paris", "Versailles"). Optionnel.'
          },
          statut: {
            type: 'string',
            description: 'Filtre par statut. Valeurs possibles : "Sourcing", "En cours", "Mandat signé", "Vendu", "Abandonné". Optionnel.'
          },
          type: {
            type: 'string',
            description: 'Filtre par type de bien (ex: "Immeubles", "Appartements", "Locaux commerciaux"). Optionnel.'
          },
          prix_min: {
            type: 'number',
            description: 'Prix minimum en euros. Optionnel.'
          },
          prix_max: {
            type: 'number',
            description: 'Prix maximum en euros. Optionnel.'
          },
          owner: {
            type: 'string',
            description: 'Filtre par owner (initiales du commercial). Ex: "TB". Optionnel.'
          },
          limit: {
            type: 'integer',
            description: 'Nombre max de résultats. Défaut : 10, max 20.'
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
      description: 'Cherche dans la table des clients (acquéreurs). Retourne une liste de clients correspondant aux critères. Si aucun filtre n\'est fourni, retourne les clients les plus récents.',
      parameters: {
        type: 'object',
        properties: {
          query_text: {
            type: 'string',
            description: 'Texte libre à chercher dans nom, prénom, société ou email. Optionnel.'
          },
          typologie: {
            type: 'string',
            description: 'Filtre par typologie (ex: "Foncières", "Family Office", "Particuliers"). Optionnel.'
          },
          marche: {
            type: 'string',
            description: 'Filtre par marché. Valeurs possibles : "B2B", "B2C". Optionnel.'
          },
          maturite: {
            type: 'string',
            description: 'Filtre par maturité. Valeurs typiques : "Faible", "Moyen", "Élevé". Optionnel.'
          },
          statut: {
            type: 'string',
            description: 'Filtre par statut. Ex: "Actif". Optionnel.'
          },
          owner: {
            type: 'string',
            description: 'Filtre par owner (initiales du commercial). Ex: "TB". Optionnel.'
          },
          budget_min: {
            type: 'number',
            description: 'Budget min en euros (le client a un budget >= cette valeur). Optionnel.'
          },
          budget_max: {
            type: 'number',
            description: 'Budget max en euros (le client a un budget <= cette valeur). Optionnel.'
          },
          limit: {
            type: 'integer',
            description: 'Nombre max de résultats. Défaut : 10, max 20.'
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
  const { query_text, ville, statut, type, prix_min, prix_max, owner, limit = 10 } = args;

  let query = supabaseAdmin
    .from('mandats')
    .select('id, nom, adresse, ville, statut, prix, surface, type, sous_type, owner, marche, commercialisation, created_at')
    .limit(Math.min(limit, 20));

  if (query_text && query_text.trim()) {
    const q = `%${query_text.trim()}%`;
    query = query.or(`nom.ilike.${q},adresse.ilike.${q},ville.ilike.${q}`);
  }
  if (ville) query = query.ilike('ville', `%${ville}%`);
  if (statut) query = query.eq('statut', statut);
  if (type) query = query.eq('type', type);
  if (owner) query = query.eq('owner', owner);
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
      nom: m.nom || '(sans nom)',
      adresse: m.adresse,
      ville: m.ville,
      statut: m.statut,
      prix: m.prix,
      surface: m.surface,
      type: m.type,
      sous_type: m.sous_type,
      owner: m.owner,
      marche: m.marche,
      commercialisation: m.commercialisation
    }))
  };
}

async function executeSearchClients(args) {
  const { query_text, typologie, marche, maturite, statut, owner, budget_min, budget_max, limit = 10 } = args;

  let query = supabaseAdmin
    .from('clients')
    .select('id, prenom, nom, societe, email, tel, typologie, sous_typologie, marche, maturite, statut, budget_min, budget_max, rendement_min, zones, typologies_recherchees, owner, created_at')
    .limit(Math.min(limit, 20));

  if (query_text && query_text.trim()) {
    const q = `%${query_text.trim()}%`;
    query = query.or(`prenom.ilike.${q},nom.ilike.${q},societe.ilike.${q},email.ilike.${q}`);
  }
  if (typologie) query = query.eq('typologie', typologie);
  if (marche) query = query.eq('marche', marche);
  if (maturite) query = query.eq('maturite', maturite);
  if (statut) query = query.eq('statut', statut);
  if (owner) query = query.eq('owner', owner);
  if (typeof budget_min === 'number') query = query.gte('budget_min', budget_min);
  if (typeof budget_max === 'number') query = query.lte('budget_max', budget_max);

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
      sous_typologie: c.sous_typologie,
      marche: c.marche,
      maturite: c.maturite,
      statut: c.statut,
      budget_min: c.budget_min,
      budget_max: c.budget_max,
      rendement_min: c.rendement_min,
      zones: c.zones,
      typologies_recherchees: c.typologies_recherchees,
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
