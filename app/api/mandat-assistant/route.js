// ═══════════════════════════════════════════════════════════════════
// app/api/mandat-assistant/route.js
// Assistant IA unifié par mandat, avec function calling et historique
// MOTEUR : OpenAI GPT-4o
// VERSION : avec logs debug
// ═══════════════════════════════════════════════════════════════════

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// ─────────────────────────────────────────────────────────
// SYSTEM PROMPT de l'assistant
// ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es l'assistant IA dédié à un mandat immobilier dans le CRM Patrimonia (Immeubles & Patrimoine, agence parisienne off-market patrimoniale).

CONTEXTE MÉTIER :
- Patrimonia gère des mandats B2B (immeubles, hôtels, locaux commerciaux) et B2C (résidentiel : appartements/maisons/hôtels particuliers)
- Tu es associé à UN mandat précis dont les données sont fournies dans le premier message
- Tu peux modifier les champs du mandat, générer des arguments commerciaux, lire les documents, etc.

PRINCIPES :
- La FICHE MANDAT est la source unique de vérité — les modifications utilisateur ont TOUJOURS priorité sur tes propositions
- Pour les modifications de champs, AGIS DIRECTEMENT en appelant l'outil update_mandat_field, sauf si l'utilisateur demande explicitement de "proposer" ou "valider d'abord"
- Tu réponds en français, ton court et professionnel, sans jargon inutile
- Tu utilises tes outils dès que c'est pertinent

OUTILS DISPONIBLES :
- update_mandat_field(field, value) : modifie un champ du mandat (description, prix, surface, etc.)
- read_mandat_documents() : liste les documents associés
- generate_commercial_arguments() : génère 4 arguments commerciaux

ARBORESCENCE DES TYPES DE BIENS :
- B2B : "Immeubles" (Habitation/Mixte/Commercial), "Hôtels" (Hébergements hôteliers/Hôtels classiques/Sociaux), "Terrains", "Parking", "Locaux commerciaux" (Bureaux/Boutiques/Retails Park)
- B2C : "Résidentiel" (Appartements/Maison/Hôtels particuliers)

Tu es proactif. Quand on te demande de modifier quelque chose, tu appelles l'outil immédiatement.`;

// ─────────────────────────────────────────────────────────
// OUTILS de l'assistant (function calling)
// ─────────────────────────────────────────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'update_mandat_field',
      description: 'Met à jour un champ du mandat dans la base de données. À utiliser dès que l\'utilisateur demande une modification.',
      parameters: {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            description: 'Le nom du champ à modifier (ex: prix, surface, nom, adresse, description, loyers_annuels, rendement, dpe_consommation, etc.)',
          },
          value: {
            description: 'La nouvelle valeur (string, number, ou null)',
          },
        },
        required: ['field', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_mandat_documents',
      description: 'Liste les documents associés au mandat. Utile pour voir quels diagnostics, baux, mandats signés, etc. sont disponibles.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_commercial_arguments',
      description: 'Génère 3-5 arguments commerciaux pour valoriser le mandat auprès des acquéreurs, basés sur ses caractéristiques (prix, surface, état locatif, emplacement, potentiel, etc.).',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

// ─────────────────────────────────────────────────────────
// IMPLEMENTATIONS des outils
// ─────────────────────────────────────────────────────────

async function tool_update_mandat_field({ mandatId, field, value }) {
  const ALLOWED_FIELDS = [
    'nom', 'adresse', 'ville', 'prix', 'prix_net_vendeur', 'prix_m2', 'surface',
    'nb_pieces', 'nb_chambres', 'etage', 'annee_construction', 'nb_lots',
    'loyers_annuels', 'loyers_projetes', 'rendement', 'rendement_optimise',
    'charges_annuelles', 'taxe_fonciere', 'dpe_consommation', 'dpe_emissions',
    'dpe_date', 'honoraires_taux', 'honoraires_montant', 'honoraires_charge',
    'mandat_numero', 'mandat_type', 'mandat_date_echeance',
    'description', 'arguments_commerciaux', 'commercialisation', 'statut',
    'type', 'sous_type', 'marche',
  ];

  if (!ALLOWED_FIELDS.includes(field)) {
    return { ok: false, error: `Champ '${field}' non autorisé à la modification automatique` };
  }

  const { error, data } = await supabaseAdmin
    .from('mandats')
    .update({ [field]: value })
    .eq('id', mandatId)
    .select();

  if (error) {
    console.error('[tool_update_mandat_field] erreur Supabase:', error);
    return { ok: false, error: error.message };
  }
  console.log('[tool_update_mandat_field] OK - rows updated:', data?.length || 0);
  return { ok: true, field, value, rows_updated: data?.length || 0, message: `Champ '${field}' mis à jour avec succès` };
}

async function tool_read_mandat_documents({ mandatId }) {
  const { data, error } = await supabaseAdmin
    .from('mandat_documents')
    .select('id, nom, category, type, taille_bytes, created_at')
    .eq('mandat_id', mandatId)
    .order('created_at', { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, count: data?.length || 0, documents: data || [] };
}

async function tool_generate_commercial_arguments({ mandatId }) {
  const { data: mandat, error } = await supabaseAdmin
    .from('mandats')
    .select('*')
    .eq('id', mandatId)
    .single();

  if (error || !mandat) return { ok: false, error: 'Mandat introuvable' };

  const prompt = `Génère 4 arguments commerciaux courts et percutants pour ce mandat immobilier. Format : tableau de 4 strings, sans numérotation.

Mandat :
- Adresse : ${mandat.adresse || 'N/A'}, ${mandat.ville || 'N/A'}
- Type : ${mandat.type || ''} ${mandat.sous_type ? '- ' + mandat.sous_type : ''}
- Prix : ${mandat.prix ? mandat.prix + ' €' : 'N/A'}
- Surface : ${mandat.surface ? mandat.surface + ' m²' : 'N/A'}
- Loyers actuels : ${mandat.loyers_annuels ? mandat.loyers_annuels + ' €/an' : 'N/A'}
- Loyers projetés : ${mandat.loyers_projetes ? mandat.loyers_projetes + ' €/an' : 'N/A'}
- DPE : ${mandat.dpe_consommation ? mandat.dpe_consommation + ' kWh/m²' : 'N/A'}
- Description : ${mandat.description || 'Aucune'}

Réponse JSON strict : { "arguments": ["...", "...", "...", "..."] }`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 600,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  });

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
    return { ok: true, arguments: parsed.arguments || [] };
  } catch (e) {
    return { ok: false, error: 'Erreur génération arguments' };
  }
}

// ─────────────────────────────────────────────────────────
// Dispatcher d'outils
// ─────────────────────────────────────────────────────────
async function executeToolCall(toolCall, mandatId) {
  const name = toolCall.function.name;
  let args = {};
  try {
    args = JSON.parse(toolCall.function.arguments || '{}');
  } catch (e) {
    console.error('[executeToolCall] JSON parse error:', e);
    return { ok: false, error: 'Arguments JSON invalides' };
  }

  console.log('[executeToolCall] Exécution:', name, 'avec args:', JSON.stringify(args));

  if (name === 'update_mandat_field') {
    return await tool_update_mandat_field({ mandatId, ...args });
  }
  if (name === 'read_mandat_documents') {
    return await tool_read_mandat_documents({ mandatId });
  }
  if (name === 'generate_commercial_arguments') {
    return await tool_generate_commercial_arguments({ mandatId });
  }
  return { ok: false, error: `Outil inconnu : ${name}` };
}

// ─────────────────────────────────────────────────────────
// Récupère le contexte initial d'un mandat
// ─────────────────────────────────────────────────────────
async function getMandatContext(mandatId) {
  const { data: mandat } = await supabaseAdmin
    .from('mandats')
    .select('*')
    .eq('id', mandatId)
    .single();

  if (!mandat) return null;

  const lines = [
    `Mandat : ${mandat.nom || 'Sans nom'}`,
    `Adresse : ${mandat.adresse || 'N/A'}, ${mandat.ville || 'N/A'}`,
    `Type : ${mandat.type || ''} ${mandat.sous_type ? '· ' + mandat.sous_type : ''}`,
    `Marché : ${mandat.marche || 'N/A'}`,
    `Prix : ${mandat.prix ? mandat.prix.toLocaleString('fr') + ' €' : 'N/A'}`,
    `Surface : ${mandat.surface ? mandat.surface + ' m²' : 'N/A'}`,
    `Loyers actuels : ${mandat.loyers_annuels ? mandat.loyers_annuels.toLocaleString('fr') + ' €/an' : 'N/A'}`,
    `Loyers projetés : ${mandat.loyers_projetes ? mandat.loyers_projetes.toLocaleString('fr') + ' €/an' : 'N/A'}`,
    `Statut : ${mandat.statut || 'N/A'}`,
    `Commercialisation : ${mandat.commercialisation || 'N/A'}`,
    `Description actuelle : ${mandat.description ? mandat.description.slice(0, 200) + (mandat.description.length > 200 ? '...' : '') : 'aucune'}`,
  ];
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────
// Charge ou crée le chat
// ─────────────────────────────────────────────────────────
async function loadOrCreateChat(mandatId, userId) {
  const { data } = await supabaseAdmin
    .from('mandat_chats')
    .select('id, messages')
    .eq('mandat_id', mandatId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) return { id: data.id, messages: data.messages || [] };

  const { data: created, error } = await supabaseAdmin
    .from('mandat_chats')
    .insert({ mandat_id: mandatId, user_id: userId, messages: [] })
    .select('id, messages')
    .single();

  if (error) throw error;
  return { id: created.id, messages: [] };
}

async function saveChat(chatId, messages) {
  const { error } = await supabaseAdmin
    .from('mandat_chats')
    .update({ messages })
    .eq('id', chatId);
  if (error) console.error('[mandat-assistant] saveChat error:', error);
}

// ─────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const body = await request.json();
    const { token, mandat_id, message, action } = body;

    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Auth requise' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    if (!mandat_id) {
      return new Response(JSON.stringify({ ok: false, error: 'mandat_id requis' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'load_history') {
      const chat = await loadOrCreateChat(mandat_id, user.id);
      const visible = (chat.messages || []).filter(m => m.role === 'user' || (m.role === 'assistant' && m.content && !m.tool_calls));
      return new Response(JSON.stringify({ ok: true, messages: visible }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'reset') {
      const chat = await loadOrCreateChat(mandat_id, user.id);
      await saveChat(chat.id, []);
      return new Response(JSON.stringify({ ok: true, messages: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ ok: false, error: 'message requis' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const chat = await loadOrCreateChat(mandat_id, user.id);
    const history = chat.messages || [];

    const mandatContext = await getMandatContext(mandat_id);

    const messagesForLLM = [
      { role: 'system', content: SYSTEM_PROMPT + '\n\n═══ CONTEXTE DU MANDAT (à jour) ═══\n' + (mandatContext || 'Mandat introuvable') },
      ...history,
      { role: 'user', content: message },
    ];

    console.log('[mandat-assistant] === Nouvel appel ===');
    console.log('[mandat-assistant] mandat_id:', mandat_id);
    console.log('[mandat-assistant] message user:', message);
    console.log('[mandat-assistant] historique length:', history.length);

    let finalResponse = null;
    let updatedHistory = [...history, { role: 'user', content: message }];

    for (let iter = 0; iter < 5; iter++) {
      console.log('[mandat-assistant] === Iteration', iter, '===');

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1500,
        messages: messagesForLLM,
        tools: TOOLS,
      });

      const choice = response.choices[0];
      const assistantMsg = choice.message;

      console.log('[mandat-assistant] finish_reason:', choice.finish_reason);
      console.log('[mandat-assistant] tool_calls présents:', !!assistantMsg.tool_calls);
      console.log('[mandat-assistant] content brut:', (assistantMsg.content || '').slice(0, 200));

      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
        finalResponse = assistantMsg.content;
        updatedHistory.push({ role: 'assistant', content: assistantMsg.content });
        break;
      }

      console.log('[mandat-assistant] Tool calls demandés:', JSON.stringify(assistantMsg.tool_calls, null, 2));

      messagesForLLM.push(assistantMsg);
      updatedHistory.push({
        role: 'assistant',
        content: assistantMsg.content || null,
        tool_calls: assistantMsg.tool_calls,
      });

      for (const toolCall of assistantMsg.tool_calls) {
        const toolResult = await executeToolCall(toolCall, mandat_id);
        console.log('[mandat-assistant] Résultat outil:', JSON.stringify(toolResult, null, 2));
        const toolMsg = {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        };
        messagesForLLM.push(toolMsg);
        updatedHistory.push(toolMsg);
      }
    }

    if (!finalResponse) finalResponse = 'Désolé, je n\'ai pas pu finaliser la réponse.';

    await saveChat(chat.id, updatedHistory);

    return new Response(JSON.stringify({
      ok: true,
      response: finalResponse,
      chat_id: chat.id,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[/api/mandat-assistant] Erreur:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
