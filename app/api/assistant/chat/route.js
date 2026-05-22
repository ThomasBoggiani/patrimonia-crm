// app/api/assistant/chat/route.js
//
// Assistant Patrimonia - Phase 4.1 (avec propose_create_mandat)
// - L'IA peut proposer des actions (création, modification, envoi)
// - Les propositions sont retournées au frontend pour validation utilisateur
// - L'exécution réelle se fait via /api/assistant/execute APRÈS confirmation

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

function buildSystemPrompt(context, pdfTexts) {
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

Si l'utilisateur pose une question vague, il parle de CE mandat sauf indication contraire.`;
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

Si l'utilisateur pose une question vague, il parle de CE client sauf indication contraire.`;
  }

  let pdfBlock = '';
  if (pdfTexts && pdfTexts.length > 0) {
    pdfBlock = '\n\nPIÈCES JOINTES PDF\nL\'utilisateur a joint les documents suivants :\n';
    pdfTexts.forEach((p, i) => {
      pdfBlock += `\n=== PDF ${i + 1} : ${p.name} ===\n${p.text}\n=== FIN PDF ${i + 1} ===\n`;
    });
  }

  return `Tu es l'Assistant Patrimonia, l'IA intégrée au CRM d'Immeubles & Patrimoine (off-market patrimonial Paris).

Date du jour : ${today}.

RÔLE
Tu aides Thomas (le fondateur) à naviguer dans son CRM, créer des mandats, et analyser des documents.

CAPACITÉS ACTUELLES (Phase 4.1)
- search_mandats : chercher dans les mandats
- search_clients : chercher dans les clients
- propose_create_mandat : PROPOSER la création d'un mandat (l'utilisateur confirme avant exécution)
- Analyse de PDF et d'images joints

⚠️ Pour les créations, tu PROPOSES via propose_create_mandat — Thomas confirme ensuite. Tu ne crées JAMAIS directement.

STYLE
- Tutoie Thomas.
- Court et direct, jamais bavard.
- En français.
- Mets en gras les noms importants (**double étoiles**).
- Si tu trouves plusieurs résultats, liste-les de façon concise (1 ligne par item).

CONTEXTE MÉTIER
- "Mandat" = un bien immobilier en vente.
- Statut mandat (valeurs typiques) : "Sourcing", "En cours", "Mandat signé", "Vendu", "Abandonné".
- Type mandat (valeurs typiques) : "Immeubles", "Appartements", "Locaux commerciaux", "Maisons", etc.
- Commercialisation : "Off-market" (défaut) ou "Public".
- Marché : "B2B" ou "B2C".
- Owner : initiales du commercial (ex: "TB" = Thomas Boggiani).
- Les prix sont en euros, souvent en millions. Convertis "2,5 M€" en 2500000.

UTILISATION DES OUTILS
- N'hésite pas à appeler plusieurs fois les outils pour raffiner ta recherche.
- Si Thomas demande de créer un mandat, utilise propose_create_mandat avec les infos disponibles. Mets des valeurs par défaut sensées si manquantes (statut="Sourcing", commercialisation="Off-market").
- Si Thomas dit "crée un mandat à partir de ce PDF", lis le PDF en contexte, extrais les infos, puis appelle propose_create_mandat.${contextBlock}${pdfBlock}`;
}

// ==========================================================================
// OUTILS
// ==========================================================================

const tools = [
  {
    type: 'function',
    function: {
      name: 'search_mandats',
      description: 'Cherche dans la table des mandats. Sans filtre, retourne les plus récents.',
      parameters: {
        type: 'object',
        properties: {
          query_text: { type: 'string', description: 'Texte libre dans nom, adresse, ville.' },
          ville: { type: 'string' },
          statut: { type: 'string' },
          type: { type: 'string' },
          prix_min: { type: 'number' },
          prix_max: { type: 'number' },
          owner: { type: 'string' },
          limit: { type: 'integer' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_clients',
      description: 'Cherche dans la table des clients. Sans filtre, retourne les plus récents.',
      parameters: {
        type: 'object',
        properties: {
          query_text: { type: 'string' },
          typologie: { type: 'string' },
          marche: { type: 'string' },
          maturite: { type: 'string' },
          statut: { type: 'string' },
          owner: { type: 'string' },
          budget_min: { type: 'number' },
          budget_max: { type: 'number' },
          limit: { type: 'integer' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'propose_create_mandat',
      description: 'PROPOSE la création d\'un mandat. Ne crée RIEN en base. Retourne une proposition que Thomas devra valider manuellement avant exécution. Utilise les valeurs par défaut sensées si infos manquantes.',
      parameters: {
        type: 'object',
        properties: {
          nom: { type: 'string', description: 'Titre du mandat (ex: "Immeuble 9 rue Hoche Versailles"). OBLIGATOIRE.' },
          adresse: { type: 'string', description: 'Adresse complète du bien.' },
          ville: { type: 'string', description: 'Ville.' },
          type: { type: 'string', description: 'Type de bien (Immeubles, Appartements, etc.). Défaut "Immeubles".' },
          sous_type: { type: 'string', description: 'Sous-type optionnel.' },
          prix: { type: 'number', description: 'Prix annoncé en euros.' },
          surface: { type: 'number', description: 'Surface en m².' },
          nb_lots: { type: 'integer', description: 'Nombre de lots.' },
          nb_pieces: { type: 'integer', description: 'Nombre de pièces.' },
          nb_chambres: { type: 'integer', description: 'Nombre de chambres.' },
          etage: { type: 'integer', description: 'Étage.' },
          loyers_annuels: { type: 'number', description: 'Loyers annuels en euros.' },
          statut: { type: 'string', description: 'Statut. Défaut "Sourcing".' },
          commercialisation: { type: 'string', description: 'Défaut "Off-market".' },
          marche: { type: 'string', description: 'B2B ou B2C.' },
          description: { type: 'string', description: 'Description libre.' },
          contact: { type: 'string', description: 'Nom du contact mandant.' },
          tel: { type: 'string', description: 'Téléphone du contact.' }
        },
        required: ['nom']
      }
    }
  }
];

// ==========================================================================
// IMPLÉMENTATION DES OUTILS DE LECTURE
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
      id: m.id, nom: m.nom || '(sans nom)', adresse: m.adresse, ville: m.ville,
      statut: m.statut, prix: m.prix, surface: m.surface, type: m.type,
      sous_type: m.sous_type, owner: m.owner, marche: m.marche, commercialisation: m.commercialisation
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
      societe: c.societe, email: c.email, tel: c.tel,
      typologie: c.typologie, sous_typologie: c.sous_typologie,
      marche: c.marche, maturite: c.maturite, statut: c.statut,
      budget_min: c.budget_min, budget_max: c.budget_max, rendement_min: c.rendement_min,
      zones: c.zones, typologies_recherchees: c.typologies_recherchees, owner: c.owner
    }))
  };
}

// ==========================================================================
// IMPLÉMENTATION DES OUTILS DE PROPOSITION (ne créent RIEN en BDD)
// ==========================================================================

function buildProposeCreateMandatResult(args) {
  // L'outil ne CRÉE rien. Il retourne juste la proposition structurée.
  // Le frontend récupère ça via le champ proposed_action et affiche la carte.
  const formatPrix = (p) => {
    if (typeof p !== 'number') return null;
    return new Intl.NumberFormat('fr-FR').format(p) + ' €';
  };

  const data = {
    nom: args.nom || '(sans nom)',
    adresse: args.adresse || null,
    ville: args.ville || null,
    type: args.type || 'Immeubles',
    sous_type: args.sous_type || null,
    prix: args.prix || 0,
    surface: args.surface || 0,
    nb_lots: args.nb_lots || 1,
    nb_pieces: args.nb_pieces || null,
    nb_chambres: args.nb_chambres || null,
    etage: args.etage || null,
    loyers_annuels: args.loyers_annuels || 0,
    statut: args.statut || 'Sourcing',
    commercialisation: args.commercialisation || 'Off-market',
    marche: args.marche || null,
    description: args.description || null,
    contact: args.contact || null,
    tel: args.tel || null
  };

  const fields = [
    { label: 'Nom', value: data.nom },
    { label: 'Adresse', value: data.adresse || '—' },
    { label: 'Ville', value: data.ville || '—' },
    { label: 'Type', value: data.type + (data.sous_type ? ' / ' + data.sous_type : '') },
    { label: 'Prix', value: formatPrix(data.prix) || '—' },
    { label: 'Surface', value: data.surface ? data.surface + ' m²' : '—' },
    { label: 'Statut', value: data.statut },
    { label: 'Commercialisation', value: data.commercialisation }
  ];

  if (data.contact) fields.push({ label: 'Contact', value: data.contact });
  if (data.tel) fields.push({ label: 'Téléphone', value: data.tel });

  return {
    proposed: true,
    type: 'create_mandat',
    summary: 'Mandat à créer',
    fields,
    data
  };
}

async function executeTool(name, args) {
  switch (name) {
    case 'search_mandats': return await executeSearchMandats(args);
    case 'search_clients': return await executeSearchClients(args);
    case 'propose_create_mandat': return buildProposeCreateMandatResult(args);
    default:
      return { error: `Outil inconnu : ${name}` };
  }
}

// ==========================================================================
// PJ : Helpers
// ==========================================================================

async function downloadFromSignedUrl(signedUrl) {
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error(`Téléchargement échoué : ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function extractPdfTextFromBuffer(buffer) {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (e) {
    console.error('[assistant/chat] PDF extract error:', e);
    return '';
  }
}

function bufferToDataUrl(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

// ==========================================================================
// BOUCLE PRINCIPALE
// ==========================================================================

export async function POST(req) {
  try {
    const body = await req.json();
    const userMessages = Array.isArray(body?.messages) ? body.messages : [];
    const context = body?.context || null;
    const attachments = Array.isArray(body?.attachments) ? body.attachments : [];

    if (!userMessages.length) {
      return NextResponse.json({ error: 'messages requis' }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY manquante' }, { status: 500 });
    }

    // Traitement PJ
    const pdfTexts = [];
    const imageAttachments = [];
    for (const att of attachments) {
      if (!att?.type || !att?.signedUrl) continue;
      try {
        const buffer = await downloadFromSignedUrl(att.signedUrl);
        if (att.type === 'application/pdf') {
          const text = await extractPdfTextFromBuffer(buffer);
          if (text) pdfTexts.push({ name: att.name || 'document.pdf', text: text.slice(0, 50000) });
        } else if (att.type.startsWith('image/')) {
          imageAttachments.push({
            type: 'image_url',
            image_url: { url: bufferToDataUrl(buffer, att.type) }
          });
        }
      } catch (e) {
        console.error('[assistant/chat] Download attachment error:', att.name, e);
      }
    }

    const conversation = [
      { role: 'system', content: buildSystemPrompt(context, pdfTexts) },
      ...userMessages
    ];

    if (imageAttachments.length > 0) {
      const lastUserIdx = conversation.length - 1;
      const lastMsg = conversation[lastUserIdx];
      if (lastMsg && lastMsg.role === 'user') {
        const textContent = typeof lastMsg.content === 'string' ? lastMsg.content : '';
        conversation[lastUserIdx] = {
          role: 'user',
          content: [
            { type: 'text', text: textContent || 'Analyse cette/ces image(s).' },
            ...imageAttachments
          ]
        };
      }
    }

    // Boucle function calling — capture les propositions
    const MAX_ITERATIONS = 6;
    let finalMessage = null;
    let proposedAction = null;

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
        return NextResponse.json({ error: 'Erreur OpenAI', detail: errText }, { status: 500 });
      }

      const openaiData = await openaiRes.json();
      const msg = openaiData?.choices?.[0]?.message;
      if (!msg) {
        return NextResponse.json({ error: 'Réponse OpenAI vide' }, { status: 500 });
      }

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        conversation.push(msg);

        for (const toolCall of msg.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs = {};
          try { toolArgs = JSON.parse(toolCall.function.arguments || '{}'); }
          catch (e) { console.error('[assistant/chat] JSON parse args error:', e); }

          console.log(`[assistant/chat] Tool call: ${toolName}`, toolArgs);
          const toolResult = await executeTool(toolName, toolArgs);

          // Si l'outil est une proposition, on capture pour le retourner au front
          if (toolResult?.proposed) {
            proposedAction = {
              type: toolResult.type,
              summary: toolResult.summary,
              fields: toolResult.fields,
              data: toolResult.data
            };
          }

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
      return NextResponse.json({ error: 'Limite d\'itérations atteinte sans réponse finale' }, { status: 500 });
    }

    const response = { message: finalMessage, role: 'assistant' };
    if (proposedAction) response.proposed_action = proposedAction;

    return NextResponse.json(response);

  } catch (e) {
    console.error('[assistant/chat] Erreur:', e);
    return NextResponse.json({ error: 'Erreur serveur', detail: e.message }, { status: 500 });
  }
}
