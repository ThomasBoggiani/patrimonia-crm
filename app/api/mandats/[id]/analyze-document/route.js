// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/[id]/analyze-document/route.js — v2
// PDF : extraction texte avec pdf-parse (économie tokens)
// Image : vision Claude
// ═══════════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import pdfParse from 'pdf-parse';

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

const EXTRACTION_PROMPT = `Tu es un expert immobilier. Analyse le document et extrait UNIQUEMENT les informations explicitement présentes. N'invente rien.

Réponds UNIQUEMENT avec un JSON valide (sans backticks). Inclus seulement les clés que tu as extraites :

{
  "nom": "...", "type": "Appartement|Studio|Maison|Immeuble|Terrain|Local commercial|Bureau",
  "sous_type": "T1|T2|T3|...", "adresse": "...", "ville": "...",
  "surface": 28.36, "nb_pieces": 2, "nb_chambres": 1, "etage": 2,
  "annee_construction": 1965, "prix": 399000, "prix_net_vendeur": 380000, "prix_m2": 14069,
  "honoraires_charge": "De l'acquéreur|Du vendeur", "honoraires_taux": 5.26, "honoraires_montant": 19000,
  "loyers_annuels": 12000, "rendement": 4.5, "charges_annuelles": 7000, "taxe_fonciere": 1500,
  "dpe_consommation": 208, "dpe_emissions": 45, "dpe_date": "2026-01-13",
  "mandat_numero": "293", "mandat_type": "EXCLUSIF|SEMI EXCLUSIF|SIMPLE",
  "date_signature": "2026-02-19", "mandat_date_echeance": "2026-08-19",
  "nb_lots": 146, "statut_copropriete": "Oui|Non",
  "description": "...", "highlights": ["..."],
  "commercialisation": "Mandat exclusif|Mandat simple|Off-market"
}

Règles : nombres = number, dates = YYYY-MM-DD, hésitation = ne pas mettre la clé. JSON brut uniquement.`;

export async function POST(request, { params }) {
  try {
    const body = await request.json();
    const { token, storage_path } = body;

    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const { id: mandatId } = params;
    if (!mandatId || !storage_path) {
      return new Response(JSON.stringify({ ok: false, error: 'mandatId et storage_path requis' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Télécharger depuis Supabase Storage
    const { data: fileData, error: dlErr } = await supabaseAdmin.storage.from(BUCKET).download(storage_path);
    if (dlErr || !fileData) {
      return new Response(JSON.stringify({ ok: false, error: 'Document introuvable', details: dlErr?.message }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = fileData.type || 'application/pdf';

    let userContent;

    if (mimeType === 'application/pdf' || mimeType.includes('pdf')) {
      // PDF : extraction texte (économie de tokens)
      let pdfText = '';
      try {
        const parsed = await pdfParse(buffer);
        pdfText = (parsed.text || '').trim();
      } catch (parseErr) {
        console.error('[analyze-document] PDF parse failed:', parseErr.message);
        return new Response(JSON.stringify({ ok: false, error: 'Impossible de lire le PDF', details: parseErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }

      if (!pdfText) {
        return new Response(JSON.stringify({ ok: false, error: 'Le PDF ne contient pas de texte extractible (peut-être un scan image ?)' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      // Tronquer si trop long (sécurité)
      const MAX_CHARS = 30000;
      if (pdfText.length > MAX_CHARS) {
        pdfText = pdfText.slice(0, MAX_CHARS) + '\n\n[... suite tronquée ...]';
      }

      userContent = [{
        type: 'text',
        text: 'Voici le contenu textuel du document :\n\n' + pdfText + '\n\nExtrait les données selon le format JSON demandé.',
      }];
    } else if (mimeType.startsWith('image/')) {
      // Image : vision Claude (pas le choix)
      const base64 = buffer.toString('base64');
      userContent = [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: 'Extrait les données selon le format JSON demandé.' },
      ];
    } else {
      return new Response(JSON.stringify({ ok: false, error: 'Type non supporté : ' + mimeType }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Appel Claude (Haiku rapide et économique)
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
      return new Response(JSON.stringify({ ok: false, error: 'Impossible de parser la réponse de l\'IA', raw: text }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // Charger le mandat actuel
    const { data: currentMandat } = await supabaseAdmin.from('mandats').select('*').eq('id', mandatId).maybeSingle();
    if (!currentMandat) {
      return new Response(JSON.stringify({ ok: false, error: 'Mandat introuvable' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Construire l'update : on écrase TOUJOURS avec les nouvelles valeurs (le dernier doc est la source de vérité)
    const updates = {};
    const filled = [];
    for (const [key, value] of Object.entries(extracted)) {
      if (value === null || value === undefined || value === '') continue;
      const current = currentMandat[key];
      if (current !== value) {
        updates[key] = value;
        filled.push(key);
      }
    }

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ ok: true, extracted, filled: [], message: 'Aucune nouvelle valeur à mettre à jour' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const { error: updErr } = await supabaseAdmin.from('mandats').update(updates).eq('id', mandatId);
    if (updErr) {
      return new Response(JSON.stringify({ ok: false, error: 'Update échoué', details: updErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      ok: true,
      extracted,
      filled,
      updates,
      usage: response.usage,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[/api/mandats/[id]/analyze-document] Erreur:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
