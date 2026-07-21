// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/estimate/route.js
// Estime un prix « net vendeur » à partir des caractéristiques du bien.
// Ne persiste rien : renvoie une fourchette + un prix conseillé, le front
// remplit le champ « Prix demandé (net vendeur) », Thomas ajuste puis valide.
// C'est une aide à l'estimation, pas un avis de valeur définitif.
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

const SYSTEM = `Tu es un expert en estimation immobilière pour une agence spécialisée dans la vente d'immeubles et de biens d'investissement en France (Immeubles & Patrimoine).
On te donne les caractéristiques d'un bien. Estime un prix « NET VENDEUR » (hors honoraires d'agence) réaliste pour le marché français actuel.

Méthode :
- Appuie-toi sur la surface, la ville/emplacement, le type de bien, l'année, le nombre de lots, et surtout — pour un immeuble de rapport — sur les loyers annuels (approche par le rendement, ex : un immeuble se valorise souvent autour de 4 % à 7 % de rendement brut selon l'emplacement).
- Reste prudent et factuel. Ne surévalue pas. Donne une fourchette basse/haute et un prix conseillé au centre.
- Si les informations sont trop maigres pour estimer, dis-le honnêtement dans "commentaire" et mets les prix à 0.

Réponds UNIQUEMENT avec un JSON valide, sans backticks ni préambule :
{"prixNetVendeur": <nombre entier € conseillé>, "fourchetteBasse": <nombre>, "fourchetteHaute": <nombre>, "commentaire": "<1 phrase courte expliquant la base de l'estimation et sa prudence>"}`;

export async function POST(request) {
  try {
    const { token, mandat = {} } = await request.json();
    const user = await verifyToken(token);
    if (!user) return Response.json({ ok: false, error: 'Authentification requise' }, { status: 401 });

    const faits = [
      mandat.type && `Type : ${mandat.type}${mandat.sousType ? ` (${mandat.sousType})` : ''}`,
      mandat.marche && `Marché : ${mandat.marche === 'b2c' ? 'habitation' : 'immeuble / investissement'}`,
      mandat.adresse && `Adresse : ${mandat.adresse}`,
      mandat.ville && `Ville : ${mandat.ville}`,
      mandat.codePostal && `Code postal : ${mandat.codePostal}`,
      mandat.surface && `Surface : ${mandat.surface} m²`,
      mandat.nbLots && `Nombre de lots : ${mandat.nbLots}`,
      mandat.nbPieces && `Pièces : ${mandat.nbPieces}`,
      mandat.anneeConstruction && `Année de construction : ${mandat.anneeConstruction}`,
      mandat.loyersAnnuels && `Loyers annuels actuels : ${mandat.loyersAnnuels} €`,
      mandat.chargesAnnuelles && `Charges annuelles : ${mandat.chargesAnnuelles} €`,
      mandat.taxeFonciere && `Taxe foncière : ${mandat.taxeFonciere} €`,
    ].filter(Boolean).join('\n');

    if (!faits || faits.length < 20) {
      return Response.json({ ok: false, error: 'Renseigne au moins la ville, la surface et le type de bien pour estimer.' }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Caractéristiques du bien :\n${faits}` }],
    });

    const raw = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    let f = {};
    try { f = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()); }
    catch { return Response.json({ ok: false, error: "L'IA n'a pas renvoyé un résultat exploitable." }, { status: 502 }); }

    const num = (v) => { const n = parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10); return Number.isFinite(n) && n > 0 ? n : 0; };
    const prixNetVendeur = num(f.prixNetVendeur);
    const basse = num(f.fourchetteBasse);
    const haute = num(f.fourchetteHaute);

    let commentaire = typeof f.commentaire === 'string' ? f.commentaire.trim() : '';
    if (prixNetVendeur && basse && haute) {
      commentaire = `Fourchette ${basse.toLocaleString('fr-FR')} – ${haute.toLocaleString('fr-FR')} €. ${commentaire}`;
    }

    return Response.json({ ok: true, prixNetVendeur, fourchetteBasse: basse, fourchetteHaute: haute, commentaire });
  } catch (e) {
    console.error('[mandats/estimate]', e);
    return Response.json({ ok: false, error: e.message || 'Erreur serveur' }, { status: 500 });
  }
}
