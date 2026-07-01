// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/[id]/extract-etat-locatif/route.js
// Sprint 4 — Étape B : lit un document d'état locatif (PDF tableau, scan/photo)
// et en extrait la liste des LOTS (un par ligne) pour pré-remplir le tableau.
// NE touche PAS au mandat : renvoie juste { ok, lots } au front, qui les affiche
// dans l'éditeur pour validation. Thomas n'a plus qu'à ajouter le loyer optimisé.
//
// Même méthode que import-folder : pdf-parse (texte) sinon mupdf (images) + Claude.
// ═══════════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BUCKET = 'mandat-docs';
const MAX_VISION_PAGES = 12;

async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

const PROMPT = `Tu es un expert immobilier. On te fournit un document d'ÉTAT LOCATIF (rent roll) d'un immeuble — un tableau qui liste les lots/logements et leurs loyers.

Ta tâche : extraire UNE LIGNE PAR LOT. N'invente JAMAIS : n'extrais que ce qui est explicitement présent. Si une colonne n'existe pas, omets la clé pour ce lot.

Pour chaque lot, extrais :
- "numero" : numéro ou identifiant du lot (texte court, ex : "12", "Lot 3", "RDC").
- "type" : nature/description du lot (ex : "T2", "Studio", "Local commercial", "Cave", "Parking").
- "surface" : surface en m² (nombre).
- "locataire" : nom du locataire en place (texte). Vide si le lot est libre/vacant.
- "loyer" : loyer MENSUEL en euros (nombre). Si le document donne un loyer ANNUEL, divise par 12 et arrondis.
- "bail_debut" : date de début du bail (YYYY-MM-DD) si présente.
- "bail_duree" : durée du bail en années (nombre entier) si présente.
- "statut" : "loué" si un locataire est en place, sinon "libre" (ou "vacant" si explicitement vacant).

Réponds UNIQUEMENT avec un JSON valide (pas de backticks markdown), au format exact :

{
  "lots": [
    { "numero": "1", "type": "T2", "surface": 42, "locataire": "M. Dupont", "loyer": 850, "bail_debut": "2023-06-01", "bail_duree": 3, "statut": "loué" },
    { "numero": "2", "type": "Studio", "surface": 24, "loyer": 0, "statut": "libre" }
  ]
}

Règles :
- "lots" : tableau, une entrée par lot trouvé. Si le document n'est PAS un état locatif ou ne contient aucun lot exploitable, renvoie { "lots": [] }.
- Loyers et surfaces = nombres (pas de symboles ni d'espaces). Dates = YYYY-MM-DD.
- Pas de préambule, juste le JSON.`;

async function renderPdfToImages(buffer) {
  const mupdf = await import('mupdf');
  const doc = mupdf.Document.openDocument(buffer, 'application/pdf');
  const pageCount = doc.countPages();
  const toRender = Math.min(pageCount, MAX_VISION_PAGES);
  const matrix = mupdf.Matrix.scale(150 / 72, 150 / 72);
  const images = [];
  for (let i = 0; i < toRender; i++) {
    try {
      const page = doc.loadPage(i);
      const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
      images.push({ media_type: 'image/png', data: Buffer.from(pixmap.asPNG()).toString('base64') });
    } catch (e) {
      console.warn('[extract-etat-locatif] render page', i, 'failed:', e.message);
    }
  }
  return { images, pageCount, rendered: toRender };
}

async function extractLots(buffer, mimeType) {
  let userContent;

  if (mimeType === 'application/pdf' || mimeType.includes('pdf')) {
    let pdfText = '';
    try {
      const parsed = await pdfParse(buffer);
      pdfText = (parsed.text || '').trim();
    } catch { pdfText = ''; }

    if (pdfText && pdfText.length > 40) {
      const MAX_CHARS = 30000;
      if (pdfText.length > MAX_CHARS) pdfText = pdfText.slice(0, MAX_CHARS) + '\n\n[... suite tronquée ...]';
      userContent = [{ type: 'text', text: "Voici le contenu textuel du document d'état locatif :\n\n" + pdfText }];
    } else {
      const { images } = await renderPdfToImages(buffer);
      if (images.length === 0) return { lots: [], unreadable: true };
      userContent = [
        ...images.map(img => ({ type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } })),
        { type: 'text', text: "Voici un document d'état locatif rendu en image(s). Extrais les lots." },
      ];
    }
  } else if (mimeType.startsWith('image/')) {
    userContent = [
      { type: 'image', source: { type: 'base64', media_type: mimeType, data: buffer.toString('base64') } },
      { type: 'text', text: "Voici la photo/scan d'un état locatif. Extrais les lots." },
    ];
  } else {
    return { lots: [], skipped: true };
  }

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    system: PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  let parsed = { lots: [] };
  try {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error('[extract-etat-locatif] JSON parse error:', e.message, '\nRaw:', text);
  }
  const lots = Array.isArray(parsed.lots) ? parsed.lots : [];
  return { lots, usage: response.usage };
}

export async function POST(request, { params }) {
  try {
    const { token, storage_path } = await request.json();

    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const { id: mandatId } = params;
    if (!mandatId || !storage_path) {
      return new Response(JSON.stringify({ ok: false, error: 'mandatId et storage_path requis' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { data: fileData, error: dlErr } = await supabaseAdmin.storage.from(BUCKET).download(storage_path);
    if (dlErr || !fileData) {
      return new Response(JSON.stringify({ ok: false, error: 'Document introuvable', details: dlErr?.message }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const mimeType = fileData.type || 'application/octet-stream';

    const { lots, unreadable, skipped } = await extractLots(buffer, mimeType);

    return new Response(JSON.stringify({
      ok: true,
      lots,
      count: lots.length,
      note: unreadable ? 'Document illisible' : (skipped ? 'Format non supporté (PDF ou image attendu)' : null),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[extract-etat-locatif] error:', e);
    return new Response(JSON.stringify({ ok: false, error: e.message || 'Erreur serveur' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
