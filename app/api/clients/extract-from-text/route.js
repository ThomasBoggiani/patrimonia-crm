// ═══════════════════════════════════════════════════════════════════
// app/api/clients/extract-from-text/route.js
// Crée un prospect à partir d'un texte collé (annonce Leboncoin / SeLoger,
// mail entrant, notes d'appel…). L'IA en extrait les coordonnées et les
// critères de recherche ; rien n'est enregistré ici — le front pré-remplit
// le formulaire, Thomas vérifie puis valide.
// ═══════════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 30;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

const PROMPT = `Tu assistes un agent immobilier spécialisé dans la vente d'immeubles.
On te donne un texte brut : une annonce (Leboncoin, SeLoger…), un mail entrant, ou des notes d'appel.
Ta tâche : en extraire les informations du PROSPECT (la personne à recontacter) et ses critères.

N'invente JAMAIS. Si une information est absente, omets la clé.

Extrais :
- "prenom", "nom" : la personne. Si seul un nom d'agence/société apparaît, remplis "societe".
- "societe"
- "tel" : numéro de téléphone, format lisible (ex. "06 12 34 56 78").
- "email"
- "budgetMin", "budgetMax" : en euros, nombres entiers sans espaces. Si un seul prix est
  donné, mets-le dans "budgetMax".
- "zones" : tableau des villes/secteurs concernés (inclus la ville du bien s'il y en a une).
- "typologiesRecherchees" : tableau parmi ["Immeubles","Hôtels","Résidentiel","Terrains","Parking","Locaux commerciaux"].
- "detailsRecherche" : 1 à 3 phrases résumant la demande et tout détail utile au rappel
  (surface, rendement attendu, motivation, délai).

Réponds UNIQUEMENT avec un JSON valide, sans backticks ni préambule :
{"prenom":"","nom":"","societe":"","tel":"","email":"","budgetMin":0,"budgetMax":0,"zones":[],"typologiesRecherchees":[],"detailsRecherche":""}`;

export async function POST(request) {
  try {
    const { token, texte } = await request.json();

    const user = await verifyToken(token);
    if (!user) {
      return Response.json({ ok: false, error: 'Authentification requise' }, { status: 401 });
    }
    if (!texte || String(texte).trim().length < 15) {
      return Response.json({ ok: false, error: 'Colle un texte un peu plus long.' }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: PROMPT,
      messages: [{ role: 'user', content: String(texte).slice(0, 12000) }],
    });

    const raw = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    let champs = {};
    try {
      champs = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim());
    } catch {
      return Response.json({ ok: false, error: "L'IA n'a pas renvoyé un résultat exploitable." }, { status: 502 });
    }

    // Nettoyage : on ne renvoie que des valeurs réellement utiles
    const nombre = (v) => {
      const n = parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    };
    const liste = (v) => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()) : []);
    const texteOu = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');

    return Response.json({
      ok: true,
      champs: {
        prenom: texteOu(champs.prenom),
        nom: texteOu(champs.nom),
        societe: texteOu(champs.societe),
        tel: texteOu(champs.tel),
        email: texteOu(champs.email).toLowerCase(),
        budgetMin: nombre(champs.budgetMin),
        budgetMax: nombre(champs.budgetMax),
        zones: liste(champs.zones),
        typologiesRecherchees: liste(champs.typologiesRecherchees),
        detailsRecherche: texteOu(champs.detailsRecherche),
      },
    });
  } catch (e) {
    console.error('[clients/extract-from-text]', e);
    return Response.json({ ok: false, error: e.message || 'Erreur serveur' }, { status: 500 });
  }
}
