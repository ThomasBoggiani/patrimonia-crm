// app/api/clients/[id]/ai-chat/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

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
async function loadContext(supabase, clientId, origin, authHeader) {
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

  // 4) Emails Outlook (20 derniers liés à l'email du client)
  let emails = [];
  if (client?.email) {
    try {
      const url = `${origin}/api/microsoft/emails?email=${encodeURIComponent(client.email)}&limit=20`;
      const res = await fetch(url, { headers: { Authorization: authHeader } });
      if (res.ok) {
        const json = await res.json();
        const raw = json.emails || json.value || json.messages || [];
        emails = raw.slice(0, 20).map(e => ({
          subject: e.subject,
          from: e.from?.emailAddress?.address || e.from || '',
          to: (e.toRecipients || []).map(r => r.emailAddress?.address).filter(Boolean).join(', '),
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
- Si une info te
