// app/api/clients/[id]/ai-chat/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_MESSAGES = 100;
const SUMMARIZE_THRESHOLD = 120; // au-delà, on résume les + anciens
const KEEP_AFTER_SUMMARY = 80;   // on garde les 80 derniers après résumé

// ─────────────────────────────────────────────────────────
// Helpers Supabase
// ─────────────────────────────────────────────────────────
function getSupabase(authHeader) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    }
  );
}

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// ─────────────────────────────────────────────────────────
// Chargement contexte client (fiche + interactions + mandats actifs + emails Outlook)
// ─────────────────────────────────────────────────────────
async function loadContext(supabase, clientId, userId, origin, authHeader) {
  // 1) Fiche client
  const { data: client, error: cErr } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();
  if (cErr) throw new Error(`Client introuvable: ${cErr.message}`);

  // 2) Interactions (50 dernières)
  const { data: interactions } = await supabase
    .from('interactions')
    .select('id, type, contenu, created_at, profile_id')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(50);

  // 3) Mandats actifs (statut différent de vendu/archivé)
  const { data: mandats } = await supabase
    .from('mandats')
    .select('id, titre, type_bien, prix_affichage, surface, nb_pieces, nb_chambres, ville, quartier, arrondissement, etage, statut, highlights, description')
    .in('statut', ['actif', 'en_cours', 'disponible', 'a_vendre'])
    .order('created_at', { ascending: false })
    .limit(80);

  // 4) Emails Outlook (20 derniers liés à l'email du client)
  let emails = [];
  if (client?.email) {
    try {
      const url = `${origin}/api/microsoft/emails?email=${encodeURIComponent(client.email)}&limit=20`;
      const res = await fetch(url, { headers: { Authorization: authHeader } });
      if (res.ok) {
        const json = await res.json();
        emails = (json.emails || json.value || []).slice(0, 20).map(e => ({
          subject: e.subject,
          from: e.from?.emailAddress?.address || e.from,
          to: (e.toRecipients || []).map(r => r.emailAddress?.address).join(', '),
          date: e.receivedDateTime || e.sentDateTime,
          preview: (e.bodyPreview || '').slice(0, 300)
        }));
      }
    } catch (e) {
      console.warn('[ai-chat] emails Outlook KO:', e.message);
    }
  }

  return { client, interactions: interactions || [], mandats: mandats || [], emails };
}

// ─────────────────────────────────────────────────────────
// Construction du system prompt avec contexte injecté
// ─────────────────────────────────────────────────────────
function buildSystemPrompt(ctx, summary) {
  const { client, interactions, mandats, emails } = ctx;

  const clientBlock = JSON.stringify({
    id: client.id,
    type: client.type, // acheteur / vendeur / les deux
    civilite: client.civilite,
    prenom: client.prenom,
    nom: client.nom,
    email: client.email,
    tel: client.tel,
    statut: client.statut,
    budget_min: client.budget_min,
    budget_max: client.budget_max,
    surface_min: client.surface_min,
    surface_max: client.surface_max,
    nb_pieces_min: client.nb_pieces_min,
    secteurs_recherche: client.secteurs_recherche,
    type_bien_recherche: client.type_bien_recherche,
    details_recherche: client.details_recherche,
    notes: client.notes,
    created_at: client.created_at
  }, null, 2);

  const interactionsBlock = interactions.slice(0, 30).map(i =>
    `- [${i.created_at?.slice(0, 10)}] ${i.type}: ${(i.contenu || '').slice(0, 200)}`
  ).join('\n') || '(aucune interaction)';

  const mandatsBlock = mandats.slice(0, 50).map(m =>
    `- ID ${m.id} | ${m.titre || m.type_bien} | ${m.ville || ''} ${m.quartier || ''} | ${m.surface || '?'}m² | ${m.nb_pieces || '?'}p | ${m.prix_affichage || '?'}€ | ${m.statut}`
  ).join('\n') || '(aucun mandat actif)';

  const emailsBlock = emails.length
    ? emails.map(e => `- [${(e.date || '').slice(0, 10)}] ${e.subject || '(sans objet)'} — de ${e.from} → ${e.to}\n  "${e.preview}"`).join('\n')
    : '(aucun email Outlook récent)';

  const summaryBlock = summary ? `\n## RÉSUMÉ DES ÉCHANGES PRÉCÉDENTS (anciens, condensés)\n${summary}\n` : '';

  return `Tu es l'assistant IA de Patrimonia CRM, spécialisé en immobilier patrimonial off-market parisien.
Tu aides l'agent à mieux servir un client précis : recommander des mandats, rédiger des emails, analyser le profil, créer tâches/RDV.

## RÈGLES
- Tu réponds en français, ton professionnel mais chaleureux.
- Tu es CONCIS par défaut. Détaillé seulement si on te le demande.
- Quand tu recommandes des mandats, utilise le tool \`recommend_mandats\` (ne récite PAS la liste en texte).
- Quand tu rédiges un email à envoyer, utilise le tool \`draft_email\` — l'agent validera dans une modale avant envoi réel.
- Quand tu crées une tâche, interaction, ou mises à jour client → utilise les tools dédiés.
- Si une info te manque pour bien faire, POSE UNE QUESTION avant d'agir. Ne suppose pas.
- Tu ne donnes JAMAIS de conseil juridique ou fiscal contraignant.

## CONTEXTE CLIENT
${clientBlock}

## 30 DERNIÈRES INTERACTIONS
${interactionsBlock}

## 20 DERNIERS EMAILS OUTLOOK (échanges avec ce client)
${emailsBlock}

## ${mandats.length} MANDATS ACTIFS DISPONIBLES (extrait)
${mandatsBlock}
${summaryBlock}`;
}

// ─────────────────────────────────────────────────────────
// Définition des tools exposés à Claude
// ─────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'recommend_mandats',
    description: 'Recommander une liste de mandats au client en se basant sur son profil. Renvoie les IDs des mandats les plus pertinents avec une justification courte par mandat.',
    input_schema: {
      type: 'object',
      properties: {
        mandat_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs (UUID) des mandats à recommander, dans l\'ordre de pertinence (max 5).'
        },
        justification: {
          type: 'string',
          description: 'Pourquoi ces mandats matchent ce client (1-3 phrases globales).'
        },
        per_mandat_notes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Note courte (1 phrase) par mandat, dans le même ordre que mandat_ids.'
        }
      },
      required: ['mandat_ids', 'justification']
    }
  },
  {
    name: 'draft_email',
    description: 'Préparer un brouillon d\'email à envoyer au client via Outlook. Le brouillon sera affiché dans une modale d\'aperçu avant envoi.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Destinataire (par défaut, email du client).' },
        subject: { type: 'string' },
        body_html: { type: 'string', description: 'Corps en HTML simple (paragraphes <p>, listes <ul>, gras <strong>).' },
        intent: { type: 'string', enum: ['relance', 'presentation_bien', 'reponse', 'remerciement', 'rdv', 'autre'] }
      },
      required: ['subject', 'body_html', 'intent']
    }
  },
  {
    name: 'create_task',
    description: 'Créer une tâche (todo) liée à ce client.',
    input_schema: {
      type: 'object',
      properties: {
        titre: { type: 'string' },
        echeance: { type: 'string', description: 'Date ISO YYYY-MM-DD (optionnel)' },
        priorite: { type: 'string', enum: ['basse', 'normale', 'haute'] }
      },
      required: ['titre']
    }
  },
  {
    name: 'log_interaction',
    description: 'Ajouter une ligne dans l\'historique des interactions du client (appel, email, RDV, note...).',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['appel', 'email', 'rdv', 'note', 'sms', 'visite'] },
        contenu: { type: 'string' }
      },
      required: ['type', 'contenu']
    }
  },
  {
    name: 'update_client',
    description: 'Mettre à jour des champs précis de la fiche client (notes, statut, critères de recherche). Champs autorisés uniquement.',
    input_schema: {
      type: 'object',
      properties: {
        notes: { type: 'string' },
        statut: { type: 'string' },
        budget_min: { type: 'number' },
        budget_max: { type: 'number' },
        surface_min: { type: 'number' },
        surface_max: { type: 'number' },
        details_recherche: { type: 'string' }
      }
    }
  }
];

const ALLOWED_CLIENT_FIELDS = ['notes', 'statut', 'budget_min', 'budget_max', 'surface_min', 'surface_max', 'details_recherche'];

// ─────────────────────────────────────────────────────────
// Exécution des tools côté serveur (pour ceux qui modifient la BDD)
// ─────────────────────────────────────────────────────────
async function executeTool(toolName, toolInput, { supabase, clientId, userId, client }) {
  try {
    switch (toolName) {
      case 'recommend_mandats':
        // Pas d'effet de bord BDD : juste passé au front pour affichage
        return { ok: true, kind: 'ui', payload: toolInput };

      case 'draft_email':
        // Pas d'effet de bord : front affichera la modale et appellera /api/microsoft/emails POST si validé
        return {
          ok: true,
          kind: 'ui',
          payload: { ...toolInput, to: toolInput.to || client.email }
        };

      case 'create_task': {
        const { data, error } = await supabase.from('todos').insert({
          titre: toolInput.titre,
          echeance: toolInput.echeance || null,
          priorite: toolInput.priorite || 'normale',
          client_id: clientId,
          assigned_to: userId,
          created_by: userId,
          statut: 'a_faire'
        }).select().single();
        if (error) throw error;
        return { ok: true, kind: 'db', payload: data };
      }

      case 'log_interaction': {
        const { data, error } = await supabase.from('interactions').insert({
          client_id: clientId,
          profile_id: userId,
          type: toolInput.type,
          contenu: toolInput.contenu
        }).select().single();
        if (error) throw error;
        return { ok: true, kind: 'db', payload: data };
      }

      case 'update_client': {
        const update = {};
        for (const k of ALLOWED_CLIENT_FIELDS) {
          if (toolInput[k] !== undefined) update[k] = toolInput[k];
        }
        if (Object.keys(update).length === 0) {
          return { ok: false, error: 'Aucun champ valide à mettre à jour' };
        }
        const { data, error } = await supabase
          .from('clients')
          .update(update)
          .eq('id', clientId)
          .select()
          .single();
        if (error) throw error;
        return { ok: true, kind: 'db', payload: data };
      }

      default:
        return { ok: false, error: `Tool inconnu: ${toolName}` };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────────
// Résumé auto si conversation trop longue
// ─────────────────────────────────────────────────────────
async function summarizeOldMessages(anthropic, oldMessages, existingSummary) {
  if (!oldMessages.length) return existingSummary || '';
  const text = oldMessages.map(m => `[${m.role}] ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content).slice(0, 500)}`).join('\n');
  try {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Voici un historique de conversation entre un agent immo et son IA assistante au sujet d'un client. Résume en 5-10 puces les points clés (préférences exprimées, mandats déjà discutés, décisions prises, actions en attente). Sois factuel et concis.\n\nRésumé existant à intégrer: ${existingSummary || '(aucun)'}\n\nNouveaux messages à résumer:\n${text}`
      }]
    });
    return resp.content.find(c => c.type === 'text')?.text || existingSummary || '';
  } catch (e) {
    console.warn('[ai-chat] summarize KO:', e.message);
    return existingSummary || '';
  }
}

// ─────────────────────────────────────────────────────────
// POST : nouveau message dans la conversation
// ─────────────────────────────────────────────────────────
export async function POST(req, { params }) {
  try {
    const { id: clientId } = params;
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader) return NextResponse.json({ error: 'Auth requise' }, { status: 401 });

    const supabase = getSupabase(authHeader);
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) return NextResponse.json({ error: 'User invalide' }, { status: 401 });

    const body = await req.json();
    const userMessage = (body.message || '').trim();
    if (!userMessage) return NextResponse.json({ error: 'Message vide' }, { status: 400 });

    // Charge contexte
    const origin = new URL(req.url).origin;
    const ctx = await loadContext(supabase, clientId, user.id, origin, authHeader);

    // Charge ou crée la conversation
    const service = getServiceSupabase();
    let { data: conv } = await service
      .from('client_ai_conversations')
      .select('*')
      .eq('client_id', clientId)
      .eq('user_id', user.id)
      .maybeSingle();

    let messages = conv?.messages || [];
    let summary = conv?.summary || '';

    // Push message utilisateur
    messages.push({ role: 'user', content: userMessage });

    // Si trop long, résume les anciens
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    if (messages.length > SUMMARIZE_THRESHOLD) {
      const cutoff = messages.length - KEEP_AFTER_SUMMARY;
      const toSummarize = messages.slice(0, cutoff);
      summary = await summarizeOldMessages(anthropic, toSummarize, summary);
      messages = messages.slice(cutoff);
    }

    // Appel Claude avec tools (boucle agentique courte : max 4 tours)
    const systemPrompt = buildSystemPrompt(ctx, summary);
    const toolsExecuted = [];
    const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));

    let finalText = '';
    let loops = 0;
    const MAX_LOOPS = 4;

    while (loops < MAX_LOOPS) {
      loops++;
      const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        tools: TOOLS,
        messages: apiMessages
      });

      // Concatène le texte généré dans ce tour
      const textBlocks = resp.content.filter(c => c.type === 'text').map(c => c.text);
      if (textBlocks.length) finalText += (finalText ? '\n\n' : '') + textBlocks.join('\n');

      // Stop si pas de tool_use
      if (resp.stop_reason !== 'tool_use') {
        apiMessages.push({ role: 'assistant', content: resp.content });
        break;
      }

      // Exécute les tools
      apiMessages.push({ role: 'assistant', content: resp.content });
      const toolResults = [];
      for (const block of resp.content) {
        if (block.type !== 'tool_use') continue;
        const result = await executeTool(block.name, block.input, {
          supabase: service, clientId, userId: user.id, client: ctx.client
        });
        toolsExecuted.push({ name: block.name, input: block.input, result });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result).slice(0, 2000)
        });
      }
      apiMessages.push({ role: 'user', content: toolResults });
    }

    // Persiste la conversation (assistant message = dernier état du turn)
    const lastAssistant = apiMessages.filter(m => m.role === 'assistant').slice(-1)[0];
    messages.push({
      role: 'assistant',
      content: finalText || '(action exécutée)',
      tools: toolsExecuted,
      raw: lastAssistant?.content || null,
      ts: new Date().toISOString()
    });

    // Cap dur
    if (messages.length > MAX_MESSAGES + 20) {
      messages = messages.slice(-MAX_MESSAGES);
    }

    if (conv) {
      await service.from('client_ai_conversations').update({
        messages, summary
      }).eq('id', conv.id);
    } else {
      await service.from('client_ai_conversations').insert({
        client_id: clientId, user_id: user.id, messages, summary
      });
    }

    return NextResponse.json({
      reply: finalText || '(action exécutée)',
      tools: toolsExecuted,
      messages_count: messages.length
    });

  } catch (e) {
    console.error('[ai-chat POST]', e);
    return NextResponse.json({ error: e.message || 'Erreur serveur' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// GET : conversation existante
// ─────────────────────────────────────────────────────────
export async function GET(req, { params }) {
  try {
    const { id: clientId } = params;
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader) return NextResponse.json({ error: 'Auth requise' }, { status: 401 });

    const supabase = getSupabase(authHeader);
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) return NextResponse.json({ error: 'User invalide' }, { status: 401 });

    const service = getServiceSupabase();
    const { data: conv } = await service
      .from('client_ai_conversations')
      .select('messages, summary, updated_at')
      .eq('client_id', clientId)
      .eq('user_id', user.id)
      .maybeSingle();

    return NextResponse.json({
      messages: conv?.messages || [],
      summary: conv?.summary || '',
      updated_at: conv?.updated_at || null
    });
  } catch (e) {
    console.error('[ai-chat GET]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// DELETE : reset conversation (utile debug)
// ─────────────────────────────────────────────────────────
export async function DELETE(req, { params }) {
  try {
    const { id: clientId } = params;
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader) return NextResponse.json({ error: 'Auth requise' }, { status: 401 });

    const supabase = getSupabase(authHeader);
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) return NextResponse.json({ error: 'User invalide' }, { status: 401 });

    const service = getServiceSupabase();
    await service.from('client_ai_conversations')
      .delete()
      .eq('client_id', clientId)
      .eq('user_id', user.id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
