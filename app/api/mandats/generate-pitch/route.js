// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/generate-pitch/route.js
// Rédige (ou améliore) le pitch commercial d'un bien à partir des champs du
// mandat + des notes brutes / dictées. Ne persiste rien : renvoie le texte,
// le front le place dans le champ « Description » pour validation par Thomas.
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

const SYSTEM = `Tu es un rédacteur immobilier pour une agence spécialisée dans la vente d'immeubles (Immeubles & Patrimoine).
On te donne les caractéristiques d'un bien et, éventuellement, des notes brutes / dictées de l'agent.
Rédige un DESCRIPTIF commercial en français, sobre et haut de gamme, pour une plaquette destinée à des investisseurs.

Règles :
- 3 à 5 phrases, un seul paragraphe, ton factuel et valorisant (pas de superlatifs creux).
- N'invente AUCUN chiffre ni caractéristique non fournis. N'affiche pas le prix.
- Intègre naturellement ce qui est pertinent : type de bien, ville/emplacement, surface, nombre de lots, points forts dictés.
- Pas de titre, pas de puces, pas de guillemets : juste le texte du descriptif.`;

export async function POST(request) {
  try {
    const { token, mandat = {}, notes = '' } = await request.json();
    const user = await verifyToken(token);
    if (!user) return Response.json({ ok: false, error: 'Authentification requise' }, { status: 401 });

    const faits = [
      mandat.type && `Type : ${mandat.type}${mandat.sousType ? ` (${mandat.sousType})` : ''}`,
      mandat.adresse && `Adresse : ${mandat.adresse}`,
      mandat.ville && `Ville : ${mandat.ville}`,
      mandat.surface && `Surface : ${mandat.surface} m²`,
      mandat.nbLots && `Nombre de lots : ${mandat.nbLots}`,
      mandat.loyersAnnuels && `Loyers annuels : ${mandat.loyersAnnuels} €`,
    ].filter(Boolean).join('\n');

    const userMsg =
      `Caractéristiques du bien :\n${faits || '(peu d\'informations)'}\n\n` +
      (notes.trim() ? `Notes de l'agent (à intégrer, corriger et mettre en forme) :\n${notes.trim()}` : 'Aucune note fournie.');

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
    });

    const texte = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (!texte) return Response.json({ ok: false, error: "L'IA n'a rien renvoyé." }, { status: 502 });
    return Response.json({ ok: true, description: texte });
  } catch (e) {
    console.error('[mandats/generate-pitch]', e);
    return Response.json({ ok: false, error: e.message || 'Erreur serveur' }, { status: 500 });
  }
}
