// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/[id]/ai/route.js
// Endpoint Assistant IA contextuel pour un mandat
// ═══════════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

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

// Construit le contexte mandat pour le system prompt
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

// Templates pour les actions rapides
const QUICK_ACTIONS = {
  descriptif: {
    user: `Génère-moi un descriptif marketing professionnel et engageant pour ce bien, à utiliser sur les portails immobiliers et plaquettes. Le ton doit être valorisant sans être survendu, factuel sur les caractéristiques, avec une accroche initiale forte. Longueur : 200-300 mots. Structure :
1. Une accroche (1 phrase)
2. Une description fluide du bien (2-3 paragraphes)
3. Un dernier paragraphe sur l'environnement/quartier si pertinent

Réponds directement avec le descriptif, sans introduction du type "Voici le descriptif".`,
  },
  email_mandant: {
    user: `Rédige un email professionnel et chaleureux à destination du mandant (le vendeur de ce bien) pour faire un point d'étape sur la commercialisation. L'email doit :
- Commencer par "Cher Madame, Cher Monsieur," (ou similaire)
- Être chaleureux et rassurant
- Faire le point sur les actions menées (en ton générique, sans inventer de chiffres)
- Demander un retour ou proposer un échange téléphonique
- Se terminer par une formule de politesse soignée

Longueur : 150-200 mots. Réponds directement par l'email, sans introduction.`,
  },
  argumentaire: {
    user: `Génère un argumentaire de vente percutant pour ce bien, à utiliser face à un acheteur intéressé. L'argumentaire doit :
- Identifier 5-7 arguments clés (un par ligne, format puces)
- Anticiper les objections probables avec des éléments de réponse (2-3 objections + réponses)
- Hiérarchiser les arguments du plus fort au plus secondaire

Format clair en 2 sections : "Arguments clés" et "Réponses aux objections probables". Réponds directement avec l'argumentaire.`,
  },
};

export async function GET(request, { params })
  try {
    const body = await request.json();
    const { token, action, message, history = [] } = body;

    // Auth
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

    // Charger le mandat
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

    // Construire le system prompt
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

    // Construire les messages
    let userMessage;
    if (action && QUICK_ACTIONS[action]) {
      userMessage = QUICK_ACTIONS[action].user;
    } else if (message) {
      userMessage = message;
    } else {
      return new Response(
        JSON.stringify({ ok: false, error: 'action ou message requis' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Construire la liste de messages avec l'historique
    const messages = [
      ...history.filter(m => m.role && m.content),
      { role: 'user', content: userMessage },
    ];

    // Appel Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: systemPrompt,
      messages,
    });

    const text = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    return new Response(
      JSON.stringify({
        ok: true,
        text,
        usage: response.usage,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err) {
    console.error('[/api/mandats/[id]/ai] Erreur:', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
