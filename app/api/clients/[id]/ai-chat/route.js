// app/api/clients/[id]/ai-chat/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk'; 
import { callGraph } from '@/lib/microsoft-graph';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_MESSAGES = 100;
const SUMMARIZE_THRESHOLD = 120;
const KEEP_AFTER_SUMMARY = 80;

// Statuts mandats considérés comme "actifs/dispo à proposer"
const ACTIVE_MANDAT_STATUTS = ['Sourcing', 'Analyse', 'Commercialisation'];

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
// Chargement contexte client
// ─────────────────────────────────────────────────────────
async function loadContext(supabase, clientId, serverUserId) {
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
    .select('id, type, resume, next_step, date_next_step, date, created_at, created_by')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(50);

  // 3) Mandats actifs (statuts Sourcing / Analyse / Commercialisation)
  const { data: mandats } = await supabase
    .from('mandats')
    .select('*')
    .in('statut', ACTIVE_MANDAT_STATUTS)
    .order('created_at', { ascending: false })
    .limit(80);

  // 4) Emails Outlook (20 derniers échangés avec ce client : entrants + sortants)
  // ⚠️ Format calqué EXACTEMENT sur app/api/microsoft/emails/route.js qui marche
  let emails = [];
  if (client?.email) {
    try {
      const select = '$select=id,subject,bodyPreview,from,toRecipients,receivedDateTime,sentDateTime,isRead,webLink';
      const safeEmailLower = client.email.toLowerCase().trim();

      // ⚠️ Graph rejette les filtres complexes (from + orderby, toRecipients/any) en 400.
      // Stratégie : fetch large sans filtre serveur, puis filtrage côté Node.
      const fetchSize = 100;
      const orderbyRecv = encodeURIComponent('receivedDateTime desc');
      const orderbySent = encodeURIComponent('sentDateTime desc');
      const endpointFrom = `/me/mailFolders/Inbox/messages?$top=${fetchSize}&$orderby=${orderbyRecv}&${select}`;
      const endpointTo = `/me/mailFolders/SentItems/messages?$top=${fetchSize}&$orderby=${orderbySent}&${select}`;

      const adminSb = getServiceSupabase();

      const [resFrom, resTo] = await Promise.allSettled([
        callGraph({ supabase: adminSb, userId: serverUserId, endpoint: endpointFrom }),
        callGraph({ supabase: adminSb, userId: serverUserId, endpoint: endpointTo }),
      ]);

      const allFrom = resFrom.status === 'fulfilled' ? (resFrom.value?.value || []) : [];
      const allTo = resTo.status === 'fulfilled' ? (resTo.value?.value || []) : [];

      // Filtrage côté Node sur l'adresse email (case-insensitive)
      const fromRaw = allFrom.filter(m =>
        m.from?.emailAddress?.address?.toLowerCase().trim() === safeEmailLower
      );
      const toRaw = allTo.filter(m =>
        (m.toRecipients || []).some(r =>
          r.emailAddress?.address?.toLowerCase().trim() === safeEmailLower
        )
      );
      // Merge + dédup + tri par date desc + cap 20
      const seen = new Set();
      const merged = [];
      for (const e of [...fromRaw, ...toRaw]) {
        if (e.id && !seen.has(e.id)) {
          seen.add(e.id);
          merged.push(e);
        }
      }
      merged.sort((a, b) => {
        const da = new Date(a.receivedDateTime || a.sentDateTime || 0).getTime();
        const db = new Date(b.receivedDateTime || b.sentDateTime || 0).getTime();
        return db - da;
      });

      emails = merged.slice(0, 20).map(e => ({
        subject: e.subject,
        from: e.from?.emailAddress?.address || '',
        to: (e.toRecipients || []).map(r => r.emailAddress?.address).filter(Boolean).join(', '),
        date: e.receivedDateTime || e.sentDateTime,
        preview: (e.bodyPreview || '').slice(0, 300)
      }));

      // Logs détaillés pour debug
      console.log('[ai-chat] Recherche emails pour', client.email);
      console.log('[ai-chat] resFrom status:', resFrom.status, resFrom.status === 'rejected' ? resFrom.reason?.message : `${fromRaw.length} emails`);
      console.log('[ai-chat] resTo status:', resTo.status, resTo.status === 'rejected' ? resTo.reason?.message : `${toRaw.length} emails`);
      console.log('[ai-chat] Total dédupé:', emails.length, 'emails');
    } catch (e) {
      console.warn('[ai-chat] emails Outlook KO:', e.message);
    }
  }

  return { client, interactions: interactions || [], mandats: mandats || [], emails };
}

// ─────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────
function buildSystemPrompt(ctx, summary) {
  const { client, interactions, mandats, emails } = ctx;

  const clientBlock = JSON.stringify({
    id: client.id,
    nom: client.nom,
    prenom: client.prenom,
    societe: client.societe,
    email: client.email,
    tel: client.tel,
    typologie: client.typologie,           // ex: acheteur / vendeur
    nature: client.nature,                  // particulier / pro / institutionnel...
    statut: client.statut,
    maturite: client.maturite,              // chaud / tiède / froid (selon convention)
    origine: client.origine,
    owner: client.owner,
    budget_min: client.budget_min,
    budget_max: client.budget_max,
    rendement_min: client.rendement_min,
    zones: client.zones,
    typologies_recherchees: client.typologies_recherchees,
    details_recherche: client.details_recherche,
    source: client.source,
    created_at: client.created_at
  }, null, 2);

  const interactionsBlock = interactions.slice(0, 30).map(i => {
    const d = (i.date || i.created_at || '').slice(0, 10);
    const next = i.next_step ? ` | Next: ${i.next_step}${i.date_next_step ? ' (' + i.date_next_step + ')' : ''}` : '';
    return `- [${d}] ${i.type || 'note'}: ${(i.resume || '').slice(0, 220)}${next}`;
  }).join('\n') || '(aucune interaction)';

  const mandatsBlock = mandats.slice(0, 50).map(m => {
    const titre = m.titre || m.adresse || m.type_bien || '(sans titre)';
    const lieu = [m.ville, m.quartier, m.arrondissement].filter(Boolean).join(' ');
    const surface = m.surface ? `${m.surface}m²` : '?';
    const pieces = m.nb_pieces ? `${m.nb_pieces}p` : '?';
    const prix = m.prix_affichage || m.prix || '?';
    return `- ID ${m.id} | ${titre} | ${lieu} | ${surface} | ${pieces} | ${prix}€ | statut:${m.statut}`;
  }).join('\n') || '(aucun mandat actif)';

  const emailsBlock = emails.length
    ? emails.map(e => `- [${(e.date || '').slice(0, 10)}] ${e.subject || '(sans objet)'} — de ${e.from} → ${e.to}\n  "${e.preview}"`).join('\n')
    : '(aucun email Outlook récent)';

  const summaryBlock = summary ? `\n## RÉSUMÉ DES ÉCHANGES PRÉCÉDENTS (anciens, condensés)\n${summary}\n` : '';

  return `Tu es l'assistant IA de Patrimonia CRM, spécialisé en immobilier patrimonial off-market parisien (Immeubles & Patrimoine).
Tu aides l'agent à mieux servir un client précis : recommander des mandats, rédiger des emails, analyser le profil, créer tâches/RDV.

## RÈGLES
- Tu réponds en français, ton professionnel mais chaleureux.
- Tu es CONCIS par défaut. Détaillé seulement si on te le demande.
- Quand tu recommandes des mandats, utilise OBLIGATOIREMENT le tool \`recommend_mandats\` (ne récite PAS la liste en texte brut).
- Quand tu rédiges un email à envoyer, utilise OBLIGATOIREMENT le tool \`draft_email\` — l'agent validera dans une modale avant envoi réel.
- Quand tu crées une tâche, interaction, ou mises à jour client → utilise les tools dédiés.
- Si une info te manque pour bien faire, POSE UNE QUESTION avant d'agir. Ne suppose pas.
- Tu ne donnes JAMAIS de conseil juridique ou fiscal contraignant.

## CONTEXTE CLIENT
${clientBlock}

## 30 DERNIÈRES INTERACTIONS
${interactionsBlock}

## 20 DERNIERS EMAILS OUTLOOK (échanges avec ce client)
${emailsBlock}

## ${mandats.length} MANDATS ACTIFS (statuts: ${ACTIVE_MANDAT_STATUTS.join(', ')})
${mandatsBlock}
${summaryBlock}`;
}

// ─────────────────────────────────────────────────────────
// Tools exposés à Claude
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
        resume: { type: 'string', description: 'Résumé de l\'interaction.' },
        next_step: { type: 'string', description: 'Prochaine étape (optionnel).' },
        date_next_step: { type: 'string', description: 'Date ISO YYYY-MM-DD pour la prochaine étape (optionnel).' }
      },
      required: ['type', 'resume']
    }
  },
  {
    name: 'update_client',
    description: 'Mettre à jour des champs précis de la fiche client (statut, maturité, critères de recherche, détails). Champs autorisés uniquement.',
    input_schema: {
      type: 'object',
      properties: {
        statut: { type: 'string' },
        maturite: { type: 'string' },
        budget_min: { type: 'number' },
        budget_max: { type: 'number' },
        rendement_min: { type: 'number' },
        details_recherche: { type: 'string' }
      }
    }
  }
];

const ALLOWED_CLIENT_FIELDS = ['statut', 'maturite', 'budget_min', 'budget_max', 'rendement_min', 'details_recherche'];

// ─────────────────────────────────────────────────────────
// Exécution des tools
// ─────────────────────────────────────────────────────────
async function executeTool(toolName, toolInput, { service, clientId, userId, client }) {
  try {
    switch (toolName) {
      case 'recommend_mandats':
        return { ok: true, kind: 'ui', payload: toolInput };

      case 'draft_email':
        return {
          ok: true,
          kind: 'ui',
          payload: { ...toolInput, to: toolInput.to || client.email }
        };

      case 'create_task': {
        const { data, error } = await service.from('todos').insert({
          titre: toolInput.titre,
          echeance: toolInput.echeance || null,
          priorite: toolInput.priorite || 'normale',
          lien_type: 'client',
          lien_id: clientId,
          assigned_to_user_id: userId,
          created_by: userId,
          statut: 'À faire'
        }).select().single();
        if (error) throw error;
        return { ok: true, kind: 'db', payload: data };
      }

      case 'log_interaction': {
        const { data, error } = await service.from('interactions').insert({
          client_id: clientId,
          created_by: userId,
          type: toolInput.type,
          resume: toolInput.resume,
          next_step: toolInput.next_step || null,
          date_next_step: toolInput.date_next_step || null,
          date: new Date().toISOString().slice(0, 10)
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
        update.updated_by = userId;
        update.updated_at = new Date().toISOString();
        const { data, error } = await service
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
  const text = oldMessages.map(m => {
    const c = typeof m.content === 'string' ? m.content : JSON.stringify(m.content).slice(0, 500);
    return `[${m.role}] ${c}`;
  }).join('\n');
  try {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Voici un historique de conversation entre un agent immobilier et son IA assistante au sujet d'un client. Résume en 5-10 puces les points clés (préférences exprimées, mandats déjà discutés, décisions prises, actions en attente). Sois factuel et concis.\n\nRésumé existant à intégrer: ${existingSummary || '(aucun)'}\n\nNouveaux messages à résumer:\n${text}`
      }]
    });
    return resp.content.find(c => c.type === 'text')?.text || existingSummary || '';
  } catch (e) {
    console.warn('[ai-chat] summarize KO:', e.message);
    return existingSummary || '';
  }
}

// ─────────────────────────────────────────────────────────
// POST : nouveau message
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

    const ctx = await loadContext(supabase, clientId, user.id);

    const service = getServiceSupabase();
    let { data: conv } = await service
      .from('client_ai_conversations')
      .select('*')
      .eq('client_id', clientId)
      .eq('user_id', user.id)
      .maybeSingle();

    let messages = conv?.messages || [];
    let summary = conv?.summary || '';

    messages.push({ role: 'user', content: userMessage });

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    if (messages.length > SUMMARIZE_THRESHOLD) {
      const cutoff = messages.length - KEEP_AFTER_SUMMARY;
      const toSummarize = messages.slice(0, cutoff);
      summary = await summarizeOldMessages(anthropic, toSummarize, summary);
      messages = messages.slice(cutoff);
    }

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

      const textBlocks = resp.content.filter(c => c.type === 'text').map(c => c.text);
      if (textBlocks.length) finalText += (finalText ? '\n\n' : '') + textBlocks.join('\n');

      if (resp.stop_reason !== 'tool_use') {
        apiMessages.push({ role: 'assistant', content: resp.content });
        break;
      }

      apiMessages.push({ role: 'assistant', content: resp.content });
      const toolResults = [];
      for (const block of resp.content) {
        if (block.type !== 'tool_use') continue;
        const result = await executeTool(block.name, block.input, {
          service, clientId, userId: user.id, client: ctx.client
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

    messages.push({
      role: 'assistant',
      content: finalText || '(action exécutée)',
      tools: toolsExecuted,
      ts: new Date().toISOString()
    });

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
      messages_count: messages.length,
      _debug: {
        client_email: ctx.client?.email || null,
        nb_emails_loaded: ctx.emails?.length || 0,
        nb_interactions_loaded: ctx.interactions?.length || 0,
        nb_mandats_loaded: ctx.mandats?.length || 0,
        emails_preview: (ctx.emails || []).slice(0, 3).map(e => ({
          subject: e.subject,
          from: e.from,
          to: e.to,
          date: e.date
        }))
      }
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
// DELETE : reset conversation
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
