// app/api/clients/[id]/ai-suggestions/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MODEL = 'claude-haiku-4-5-20251001';
const ACTIVE_MANDAT_STATUTS = ['Sourcing', 'Analyse', 'Commercialisation'];

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

// ─────────────────────────────────────────────────────────
// Calcul des signaux pré-IA (déterministes, côté serveur)
// ─────────────────────────────────────────────────────────
function computeSignals({ client, interactions, mandats }) {
  const now = new Date();

  // 1) Jours depuis dernier contact
  const lastInteraction = interactions[0]; // déjà trié desc
  let daysSinceContact = null;
  if (lastInteraction) {
    const d = new Date(lastInteraction.date || lastInteraction.created_at);
    daysSinceContact = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  }

  // 2) Next step en retard (date_next_step < aujourd'hui sur la dernière interaction)
  let overdueNextStep = null;
  for (const i of interactions.slice(0, 5)) {
    if (i.date_next_step && i.next_step) {
      const ns = new Date(i.date_next_step);
      if (ns < now) {
        const daysLate = Math.floor((now - ns) / (1000 * 60 * 60 * 24));
        overdueNextStep = { texte: i.next_step, days_late: daysLate, date: i.date_next_step };
        break;
      }
    }
  }

  // 3) Mandats matchant le budget client
  const bMin = Number(client.budget_min) || 0;
  const bMax = Number(client.budget_max) || Infinity;
  const matchingBudget = mandats.filter(m => {
    const prix = Number(m.prix_affichage || m.prix || 0);
    if (!prix) return false;
    return prix >= bMin * 0.8 && prix <= bMax * 1.2; // marge ±20%
  });

  // 4) Mandats jamais évoqués dans les interactions (recherche de l'ID dans le résumé)
  const mandatsEvoques = new Set();
  for (const i of interactions) {
    const text = `${i.resume || ''} ${i.next_step || ''}`.toLowerCase();
    for (const m of mandats) {
      if (text.includes(String(m.id).toLowerCase().slice(0, 8))) mandatsEvoques.add(m.id);
    }
  }
  const matchingNeufs = matchingBudget.filter(m => !mandatsEvoques.has(m.id));

  // 5) Ancienneté du client
  const createdAt = new Date(client.created_at);
  const daysSinceCreation = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

  // 6) Maturité / statut "chauds"
  const isHot = ['chaud', 'tiede', 'tiède', 'actif'].some(v =>
    String(client.maturite || client.statut || '').toLowerCase().includes(v)
  );

  return {
    daysSinceContact,
    overdueNextStep,
    nbMatchingBudget: matchingBudget.length,
    nbMatchingNeufs: matchingNeufs.length,
    matchingNeufsExtraits: matchingNeufs.slice(0, 5).map(m => ({
      id: m.id,
      titre: m.titre || m.adresse || m.type_bien,
      prix: m.prix_affichage || m.prix,
      ville: m.ville,
      surface: m.surface
    })),
    daysSinceCreation,
    isHot,
    nbInteractions: interactions.length
  };
}

// ─────────────────────────────────────────────────────────
// POST : génère 2-3 suggestions
// ─────────────────────────────────────────────────────────
export async function POST(req, { params }) {
  try {
    const { id: clientId } = params;
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader) return NextResponse.json({ error: 'Auth requise' }, { status: 401 });

    const supabase = getSupabase(authHeader);
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) return NextResponse.json({ error: 'User invalide' }, { status: 401 });

    // Charge client + interactions + mandats actifs
    const { data: client, error: cErr } = await supabase
      .from('clients').select('*').eq('id', clientId).single();
    if (cErr) throw new Error(`Client introuvable: ${cErr.message}`);

    const { data: interactions = [] } = await supabase
      .from('interactions')
      .select('id, type, resume, next_step, date_next_step, date, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(30);

    const { data: mandats = [] } = await supabase
      .from('mandats')
      .select('*')
      .in('statut', ACTIVE_MANDAT_STATUTS)
      .order('created_at', { ascending: false })
      .limit(80);

    const signals = computeSignals({ client, interactions, mandats });

    // Si vraiment rien à dire → réponse statique pour économiser un appel IA
    if (
      signals.daysSinceContact !== null && signals.daysSinceContact < 3 &&
      !signals.overdueNextStep &&
      signals.nbMatchingNeufs === 0
    ) {
      return NextResponse.json({
        suggestions: `Pas de signal urgent sur ce client.\n\n- Dernier contact il y a ${signals.daysSinceContact} jour(s)\n- ${signals.nbMatchingBudget} mandat(s) matchant son budget\n- Tu peux lui envoyer une présentation de bien ciblée si un nouveau mandat arrive.`,
        signals
      });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `Tu es l'assistant IA de Patrimonia CRM. Tu dois proposer 2 ou 3 suggestions d'action très courtes pour cet agent au sujet de ce client.

## CLIENT
${JSON.stringify({
  nom: `${client.prenom || ''} ${client.nom || ''}`.trim(),
  societe: client.societe,
  typologie: client.typologie,
  nature: client.nature,
  statut: client.statut,
  maturite: client.maturite,
  budget_min: client.budget_min,
  budget_max: client.budget_max,
  zones: client.zones,
  typologies_recherchees: client.typologies_recherchees,
  details_recherche: client.details_recherche
}, null, 2)}

## SIGNAUX CALCULÉS
${JSON.stringify(signals, null, 2)}

## DERNIÈRES INTERACTIONS (5)
${interactions.slice(0, 5).map(i => `- [${(i.date || i.created_at || '').slice(0, 10)}] ${i.type}: ${(i.resume || '').slice(0, 200)}${i.next_step ? ' | Next: ' + i.next_step : ''}`).join('\n') || '(aucune)'}

## CONSIGNES
- Réponds en français, format markdown.
- Maximum 3 puces, chacune en 1-2 phrases.
- Chaque puce DOIT être actionnable : commence par un verbe ("Relancer", "Envoyer", "Créer", "Proposer", "Demander").
- Si un next_step est en retard, mets-le en première suggestion.
- Si des mandats neufs matchent le budget, propose une présentation ciblée.
- Si dernier contact > 30 jours, propose une relance.
- Sois concret : nomme des biens, des actions précises, pas de banalité.
- Pas d'introduction, pas de conclusion, juste les puces.`;

    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const suggestions = resp.content.find(c => c.type === 'text')?.text || '';

    return NextResponse.json({ suggestions, signals });

  } catch (e) {
    console.error('[ai-suggestions]', e);
    return NextResponse.json({ error: e.message || 'Erreur serveur' }, { status: 500 });
  }
}
