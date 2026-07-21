// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/extract-fields/route.js
// Extrait les champs d'un mandat à partir d'un texte libre (dictée / notes).
// Ne persiste rien : renvoie les champs, le front remplit les cases VIDES du
// formulaire (jamais d'écrasement), Thomas vérifie puis enregistre.
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
On te donne un texte libre (dictée ou notes) décrivant un bien. Extrais-en les caractéristiques.

N'invente JAMAIS. Si une donnée est absente, omets la clé.

Extrais (clés exactes) :
- "nom" : intitulé court du bien (ex : "Immeuble 12 rue de la Paix"). Génère-le depuis l'adresse si pertinent.
- "adresse" : numéro + voie.
- "ville"
- "code_postal"
- "surface" : nombre (m²).
- "prix" : prix en euros, nombre entier sans espaces (frais d'agence inclus si précisé).
- "loyersAnnuels" : loyers annuels en euros, nombre.
- "taxeFonciere" : nombre.
- "chargesAnnuelles" : nombre.
- "anneeConstruction" : année (nombre).
- "nbLots" : nombre de lots (immeuble).
- "nbPieces", "nbChambres", "etage" : nombres (logement).
- "marche" : "b2b" pour un immeuble / bien d'investissement, "b2c" pour un logement d'habitation.

Réponds UNIQUEMENT avec un JSON valide, sans backticks ni préambule. Exemple de forme :
{"nom":"","adresse":"","ville":"","code_postal":"","surface":0,"prix":0,"loyersAnnuels":0,"taxeFonciere":0,"chargesAnnuelles":0,"anneeConstruction":0,"nbLots":0,"nbPieces":0,"nbChambres":0,"etage":0,"marche":""}`;

export async function POST(request) {
  try {
    const { token, texte } = await request.json();
    const user = await verifyToken(token);
    if (!user) return Response.json({ ok: false, error: 'Authentification requise' }, { status: 401 });
    if (!texte || String(texte).trim().length < 10) {
      return Response.json({ ok: false, error: 'Texte trop court.' }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: PROMPT,
      messages: [{ role: 'user', content: String(texte).slice(0, 8000) }],
    });

    const raw = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    let f = {};
    try { f = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()); }
    catch { return Response.json({ ok: false, error: "L'IA n'a pas renvoyé un résultat exploitable." }, { status: 502 }); }

    const num = (v) => { const n = parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10); return Number.isFinite(n) && n > 0 ? n : 0; };
    const txt = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');
    const marche = f.marche === 'b2c' ? 'b2c' : (f.marche === 'b2b' ? 'b2b' : '');

    const champs = {
      nom: txt(f.nom),
      adresse: txt(f.adresse),
      ville: txt(f.ville),
      code_postal: txt(f.code_postal),
      surface: num(f.surface),
      prix: num(f.prix),
      loyersAnnuels: num(f.loyersAnnuels),
      taxeFonciere: num(f.taxeFonciere),
      chargesAnnuelles: num(f.chargesAnnuelles),
      anneeConstruction: num(f.anneeConstruction),
      nbLots: num(f.nbLots),
      nbPieces: num(f.nbPieces),
      nbChambres: num(f.nbChambres),
      etage: num(f.etage),
      ...(marche ? { marche } : {}),
    };

    return Response.json({ ok: true, champs });
  } catch (e) {
    console.error('[mandats/extract-fields]', e);
    return Response.json({ ok: false, error: e.message || 'Erreur serveur' }, { status: 500 });
  }
}
