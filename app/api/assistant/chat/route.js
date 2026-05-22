// app/api/assistant/chat/route.js
//
// Assistant Patrimonia - Phase 2.1 (avec contexte)
// L'IA a 2 outils de LECTURE : search_mandats, search_clients
// + accepte un "context" décrivant la fiche sur laquelle est l'utilisateur

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

function buildSystemPrompt(context) {
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  let contextBlock = '';

  if (context?.type === 'mandat' && context.data) {
    const m = context.data;
    contextBlock = `

CONTEXTE COURANT
L'utilisateur est sur la fiche du mandat suivant :
- ID : ${m.id}
- Nom : ${m.nom || '(sans nom)'}
- Adresse : ${m.adresse || '(non renseignée)'}
- Ville : ${m.ville || '(non renseignée)'}
- Type : ${m.type || '(non renseigné)'}${m.sous_type ? ' / ' + m.sous_type : ''}
- Statut : ${m.statut || '(non renseigné)'}
- Prix : ${m.prix ? m.prix + ' €' : '(non renseigné)'}
- Surface : ${m.surface ? m.surface + ' m²' : '(non renseignée)'}
- Owner : ${m.owner || '(non renseigné)'}
- Commercialisation : ${m.commercialisation || '(non renseignée)'}

Si l'utilisateur pose une question vague ("résume", "qu'est-ce que c'est", "donne-moi les infos"), il parle de CE mandat sauf indication contraire.`;
  } else if (context?.type === 'client' && context.data) {
    const c = context.data;
    const nom = [c.prenom, c.nom].filter(Boolean).join(' ') || c.societe || '(anonyme)';
    contextBlock = `

CONTEXTE COURANT
L'utilisateur est sur la fiche du client suivant :
- ID : ${c.id}
- Nom : ${nom}
- Société : ${c.societe || '(aucune)'}
- Email : ${c.email || '(non renseigné)'}
- Typologie : ${c.typologie || '(non renseignée)'}
- Marché : ${c.marche || '(non renseigné)'}
- Maturité : ${c.maturite || '(non renseignée)'}
- Statut : ${c.statut || '(non renseigné)'}
- Budget : ${c.budget_min || 0} - ${c.budget_max || 0} €
- Owner : ${c.owner || '(non renseigné)'}

Si l'utilisateur pose une question vague ("résume", "qu'est-ce qu'il cherche"), il parle de CE client sauf indication contraire.`;
  }

  return `Tu es l'Assistant Patrimonia, l'IA intégrée au CRM d'Immeubles & Patrimoine (off-market patrimonial Paris).

Date du jour : ${today}.

RÔLE
Tu aides Thomas (le fondateur) à naviguer dans son CRM : tu peux chercher des mandats (biens immobiliers à vendre) et des clients (acquéreurs).

CAPACITÉS ACTUELLES (Phase 2.1)
- search_mandats : chercher dans les mandats par nom, adresse, ville, type, prix, statut, etc.
- search_clients : chercher dans les clients par nom, société, typologie, budget, etc.

⚠️ Tu ne peux RIEN créer, modifier ou supprimer pour le moment.

STYLE
- Tutoie Thomas.
- Court et direct, jamais bavard.
- En français.
- Mets en gras les noms importants (mandats, clients) avec **double étoiles**.
- Si tu trouves plusieurs résultats, liste-les de façon concise (1 ligne par item).
- Si tu ne trouves rien, dis-le clairement et propose une recherche alternative.
- Si l'utilisateur demande "tous" ou "les derniers" ou "combien", appelle search_mandats ou search_clients SANS filtre, ça retourne par défaut les plus récents.

CONTEXTE MÉTIER
- "Mandat" = un bien immobilier en vente.
- "Client" = un acquéreur potentiel.
- Statut mandat : Sourcing, En cours, Mandat signé, Vendu, Abandonné.
- Maturité client : "Faible", "Moyen", "Élevé".
- Typologie client : "Foncières", "Family Office", "Particuliers", etc.
- Marché : "B2B" ou "B2C".
- Owner : initiales du commercial (ex: "TB" = Thomas Boggiani).

UTILISATION DES OUTILS
- N'hésite pas à appeler plusieurs fois les outils pour raffiner ta recherche.
- Si Thomas pose une question vague, fais d'abord une recherche large, puis affine.${contextBlock}`;
}

// ==========================================================================
// DÉFINITION DES OUTILS
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
          query_text: { type: 'string', description: 'Texte libre à chercher dans nom, adresse ou ville. Optionnel.' },
          ville: { type: 'string', description: 'Filtre par ville. Optionnel.' },
          statut: { type: 'string', description: 'Valeurs : "Sourcing", "En cours", "Mandat signé", "Vendu", "Abandonné". Optionnel.' },
          type: { type: 'string', description: 'Type de bien (ex: "Immeubles", "Appartements"). Optionnel.' },
          prix_min: { type: 'number', description: 'Prix minimum en euros. Optionnel.' },
          prix_max: { type: 'number', description: 'Prix maximum en euros. Optionnel.' },
          owner: { type: 'string', description: 'Initiales du commercial. Optionnel.' },
          limit: { type: 'integer', description: 'Nombre max de résultats. Défaut 10, max 20.' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_clients',
      description: 'Cherche dans la table des clients (acquéreurs). Si aucun filtre n\'est fourni, retourne les clients les plus récents.',
      parameters: {
        type: 'object',
        properties: {
          query_text: { type: 'string', description: 'Texte libre à chercher dans nom, prénom, société ou email. Optionnel.' },
          typologie: { type: 'string', description: 'Ex: "Foncières", "Family Office", "Particuliers". Optionnel.' },
          marche: { type: 'string', description: 'Valeurs : "B2B", "B2C". Optionnel.' },
          maturite: { type: 'string', description: 'Valeurs : "Faible", "Moyen", "Élevé". Optionnel.' },
          statut: { type: 'string', description: 'Ex: "Actif". Optionnel.' },
          owner: { type: 'string', description: 'Initiales du commercial. Optionnel.' },
          budget_min: { type: 'number', description: 'Budget min en euros. Optionnel.' },
          budget_max: { type: 'number', description: 'Budget max en euros. Optionnel.' },
          limit: { type: 'integer', description: 'Nombre max de résultats. Défaut 10, max 20.' }
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
    const context = body?.context || null;

    if (!userMessages.length) {
      return NextResponse.json({ error: 'messages requis' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY manquante' }, { status: 500 });
    }

    const conversation = [
      { role: 'system', content: buildSystemPrompt(context) },
      ...userMessages
    ];

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
        continue;
      }

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
