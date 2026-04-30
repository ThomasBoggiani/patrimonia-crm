// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/[id]/analyze-document/route.js
// Analyse un doc déjà stocké dans Supabase Storage et met à jour le mandat
// ═══════════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const BUCKET = 'mandat-docs';

async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

const EXTRACTION_PROMPT = `Tu es un expert immobilier qui analyse des documents pour extraire des données structurées.

Analyse le document fourni et extrait UNIQUEMENT les informations qui y sont **explicitement présentes**. N'invente JAMAIS de valeur.

Réponds UNIQUEMENT avec un objet JSON valide (sans backticks markdown, sans préambule), avec les clés suivantes (toutes optionnelles, n'inclus QUE celles que tu as réussi à extraire) :

{
  "nom": "Titre / nom du bien",
  "type": "Appartement | Studio | Maison | Immeuble | Terrain | Local commercial | Bureau",
  "sous_type": "T1 | T2 | T3 | T4 | T5+ | Loft | Duplex | etc.",
  "adresse": "Adresse complète du bien",
  "ville": "Ville (avec arrondissement si Paris)",
  "surface": 28.36,
  "nb_pieces": 2,
  "nb_chambres": 1,
  "etage": 2,
  "annee_construction": 1965,
  "prix": 399000,
  "prix_net_vendeur": 380000,
  "prix_m2": 14069,
  "honoraires_charge": "De l'acquéreur | Du vendeur",
  "honoraires_taux": 5.26,
  "honoraires_montant": 19000,
  "loyers_annuels": 12000,
  "rendement": 4.5,
  "charges_annuelles": 7000,
  "taxe_fonciere": 1500,
  "dpe_consommation": 208,
  "dpe_emissions": 45,
  "dpe_date": "2026-01-13",
  "mandat_numero": "293",
  "mandat_type": "EXCLUSIF | SEMI EXCLUSIF | SIMPLE",
  "date_signature": "2026-02-19",
  "mandat_date_echeance": "2026-08-19",
  "nb_lots": 146,
  "statut_copropriete": "Oui | Non",
  "description": "Texte descriptif du bien (paragraphe entier)",
  "highlights": ["Point fort 1", "Point fort 2"],
  "commercialisation": "Mandat exclusif | Mandat simple | Off-market"
}

# Règles strictes
- NE METS PAS les clés dont la valeur est absente du document.
- Pour les nombres : retourne des nombres (pas de strings, pas d'unités).
- Pour les dates : format ISO YYYY-MM-DD strictement.
- Pour le DPE, attention à ne pas confondre consommation (kWh) et émissions (kg CO2).
- Si tu hésites entre 2 valeurs, ne mets pas la clé.
- Pas d'explication, juste le JSON brut.`;

export async function POST(request, { params }) {
  try {
    const body = await request.json();
    const { token, storage_path, document_id } = body;

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

    if (!storage_path) {
      return new Response(
        JSON.stringify({ ok: false, error: 'storage_path requis' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Télécharger le fichier depuis Supabase Storage
    const { data: fileData, error: dlErr } = await supabaseAdmin
      .storage
      .from(BUCKET)
      .download(storage_path);

    if (dlErr || !fileData) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Document introuvable dans Storage', details: dlErr?.message }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Convertir en base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = fileData.type || 'application/pdf';

    // Construire le contenu pour Claude
    const userContent = [];
    if (mimeType.startsWith('image/')) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: mimeType, data: base64 },
      });
    } else if (mimeType === 'application/pdf' || mimeType.includes('pdf')) {
      userContent.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      });
    } else {
      return new Response(
        JSON.stringify({ ok: false, error: `Type de fichier non support\u00e9 : ${mimeType}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    userContent.push({
      type: 'text',
      text: 'Extrait toutes les donn\u00e9es disponibles selon le format JSON demand\u00e9.',
    });

    // Appel Claude
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2000,
      system: EXTRACTION_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    let extracted = {};
    try {
      const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      extracted = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[analyze-document] JSON parse error:', parseErr.message, '\nRaw:', text);
      return new Response(
        JSON.stringify({ ok: false, error: 'Impossible de parser la r\u00e9ponse de l\'IA', raw: text }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Charger le mandat actuel pour ne PAS écraser les valeurs existantes
    const { data: currentMandat } = await supabaseAdmin
      .from('mandats')
      .select('*')
      .eq('id', mandatId)
      .maybeSingle();

    if (!currentMandat) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Mandat introuvable' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Construire l'update : on écrase TOUJOURS avec les nouvelles valeurs
    // (le dernier document est considéré comme la source de vérité la plus à jour)
    const updates = {};
    const filled = [];
    for (const [key, value] of Object.entries(extracted)) {
      if (value === null || value === undefined || value === '') continue;
      const current = currentMandat[key];
      // On ne met à jour que si la valeur a changé (pour éviter un UPDATE inutile)
      if (current !== value) {
        updates[key] = value;
        filled.push(key);
      }
    }

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ ok: true, extracted, filled: [], message: 'Aucun champ vide \u00e0 remplir' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update le mandat
    const { error: updErr } = await supabaseAdmin
      .from('mandats')
      .update(updates)
      .eq('id', mandatId);

    if (updErr) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Update mandat \u00e9chou\u00e9', details: updErr.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        extracted,
        filled,
        updates,
        usage: response.usage,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[/api/mandats/[id]/analyze-document] Erreur:', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
