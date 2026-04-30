// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/[id]/categorize-files/route.js
// Catégorise un batch de noms de fichiers en 1 seul appel IA
// ═══════════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

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

const CATEGORIES_LIST = [
  { id: 'mandat',         desc: 'Mandat de vente, mandat exclusif, mandat simple, contrat de vente, compromis, promesse de vente' },
  { id: 'diagnostics',    desc: 'DPE, diagnostic plomb, amiante, électricité, gaz, ERP, termite, ENSA, audit énergétique' },
  { id: 'plans_photos',   desc: 'Plans architecte, plans 2D/3D, photos HD, photos professionnelles, photos drone' },
  { id: 'notes',          desc: 'Notes internes, mémo, observations, descriptif marketing' },
  { id: 'mandant',        desc: 'Pièce identité, RIB, justificatif domicile, KBIS, statuts société' },
  { id: 'autre',          desc: 'Tout autre type de document non classable' },
];

const SYSTEM_PROMPT = `Tu es un expert immobilier. Tu reçois une liste de noms de fichiers, et tu dois associer chaque fichier à UNE des catégories suivantes :

${CATEGORIES_LIST.map(c => '- ' + c.id + ' : ' + c.desc).join('\n')}

Réponds UNIQUEMENT avec un JSON valide (pas de backticks markdown), au format :
{
  "categories": {
    "nom_du_fichier_1.pdf": "diagnostics",
    "nom_du_fichier_2.jpg": "plans_photos",
    ...
  }
}

Règles :
- La clé est le nom de fichier exact (avec son extension), tel que tu l'as reçu.
- La valeur est l'ID exact d'une des catégories.
- Si tu doutes, mets "autre".
- Pas de préambule, pas d'explication, juste le JSON.`;

export async function POST(request, { params }) {
  try {
    const body = await request.json();
    const { token, fileNames } = body;

    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    if (!Array.isArray(fileNames) || fileNames.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'fileNames doit \u00eatre un tableau non vide' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const userMessage = 'Voici les fichiers \u00e0 cat\u00e9goriser :\n\n' + fileNames.map((n, i) => (i + 1) + '. ' + n).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    let parsed = {};
    try {
      const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[categorize-files] JSON parse error:', parseErr.message, '\nRaw:', text);
      // Fallback : tout en "autre"
      const fallback = {};
      for (const n of fileNames) fallback[n] = 'autre';
      return new Response(JSON.stringify({ ok: true, categories: fallback, fallback: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Compléter pour les fichiers manquants
    const finalCategories = {};
    const validIds = new Set(CATEGORIES_LIST.map(c => c.id));
    for (const n of fileNames) {
      const cat = parsed?.categories?.[n];
      finalCategories[n] = (cat && validIds.has(cat)) ? cat : 'autre';
    }

    return new Response(JSON.stringify({
      ok: true,
      categories: finalCategories,
      usage: response.usage,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[/api/mandats/[id]/categorize-files] Erreur:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
