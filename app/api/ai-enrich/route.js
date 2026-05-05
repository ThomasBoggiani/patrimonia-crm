// ═══════════════════════════════════════════════════════════════════
// app/api/ai-enrich/route.js
// API d'enrichissement IA d'un mandat EXISTANT
// Modes :
//  - 'smart_update'      : MAJ intelligente, l'IA peut écraser des champs si elle a une info plus précise
//  - 'prefill_empty_only': remplit UNIQUEMENT les champs vides/null, jamais d'écrasement
// ═══════════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export const maxDuration = 60;

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

const FIELDS_DESCRIPTION = `
Champs disponibles dans la table mandats :
- nom, adresse, ville, type, sous_type
- surface (number), nb_pieces (int), nb_chambres (int), etage (int), annee_construction (int)
- prix (number), prix_net_vendeur (number), prix_m2 (number)
- honoraires_charge ('De l'acquéreur'|'Du vendeur'), honoraires_taux (number), honoraires_montant (number)
- loyers_annuels (number), rendement (number), charges_annuelles (number), taxe_fonciere (number)
- dpe_consommation (number), dpe_emissions (number), dpe_date (date YYYY-MM-DD)
- mandat_numero, mandat_type ('EXCLUSIF'|'SEMI EXCLUSIF'|'SIMPLE'), mandat_date_echeance (date YYYY-MM-DD)
- nb_lots (int), description (text long, peut être enrichi/réécrit)
- commercialisation ('Off-market'|'Mandat exclusif'|'Mandat simple')
`;

function buildPrompt(mode, currentMandat) {
  const isPrefillOnly = mode === 'prefill_empty_only';

  return `Tu es un expert immobilier patrimonial. On te demande d'enrichir une fiche mandat existante avec de nouvelles informations.

═══ FICHE MANDAT EXISTANTE ═══
${JSON.stringify(currentMandat, null, 2)}

═══ MODE ═══
"${mode}"
${isPrefillOnly
    ? `Mode PREFILL_EMPTY_ONLY : tu dois UNIQUEMENT remplir les champs qui sont actuellement vides, null, ou égaux à 0 pour les nombres. Tu ne dois JAMAIS écraser un champ déjà rempli, même si le nouveau contenu donne une info différente.`
    : `Mode SMART_UPDATE : tu peux mettre à jour des champs déjà remplis SI le nouveau contenu apporte une information manifestement plus précise, plus récente, ou corrige une erreur. Sois conservateur : en cas de doute, n'écris pas le champ.`
}

═══ CHAMPS DISPONIBLES ═══
${FIELDS_DESCRIPTION}

═══ INSTRUCTIONS ═══
1. Analyse le NOUVEAU CONTENU fourni ci-dessous
2. Compare avec la fiche existante
3. Renvoie UNIQUEMENT les champs à modifier sous forme JSON

Format de réponse OBLIGATOIRE (JSON brut, pas de backticks markdown) :
{
  "updates": {
    "prix": 450000,
    "surface": 65.2,
    "description": "..."
  },
  "reasoning": "Description courte de ce que tu as déduit du nouveau contenu et pourquoi tu modifies ces champs",
  "confidence": 0.92
}

RÈGLES STRICTES :
- "updates" peut être un objet vide {} si rien n'est à modifier
- N'inclus PAS les champs inchangés dans "updates"
- Pour les nombres, utilise des nombres JSON (pas de chaînes)
- Pour les dates, utilise le format YYYY-MM-DD
- "reasoning" doit être en français, court (max 200 caractères)
- Réponds UNIQUEMENT avec le JSON, pas de préambule`;
}

async function callClaude(systemPrompt, userContent) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  try {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    return { parsed: JSON.parse(cleaned), usage: response.usage };
  } catch (e) {
    console.error('[ai-enrich] JSON parse error:', e.message, '\nRaw:', text);
    return { parsed: { updates: {}, reasoning: 'Erreur parsing IA', confidence: 0 }, usage: response.usage };
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, mandatId, mode = 'smart_update', text, files, audioTranscription } = body;

    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    if (!mandatId) {
      return new Response(JSON.stringify({ ok: false, error: 'mandatId requis' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!['smart_update', 'prefill_empty_only'].includes(mode)) {
      return new Response(JSON.stringify({ ok: false, error: 'mode invalide' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // ─── Charger le mandat existant ───
    const { data: currentMandat, error: loadErr } = await supabaseAdmin
      .from('mandats')
      .select('*')
      .eq('id', mandatId)
      .single();

    if (loadErr || !currentMandat) {
      return new Response(JSON.stringify({ ok: false, error: 'Mandat introuvable' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // On nettoie le mandat pour le prompt : on retire les champs techniques (id, created_at, owner, etc.)
    const cleanMandat = {};
    const KEEP_FIELDS = [
      'nom', 'adresse', 'ville', 'type', 'sous_type', 'surface', 'nb_pieces', 'nb_chambres', 'etage',
      'annee_construction', 'prix', 'prix_net_vendeur', 'prix_m2', 'honoraires_charge', 'honoraires_taux',
      'honoraires_montant', 'loyers_annuels', 'rendement', 'charges_annuelles', 'taxe_fonciere',
      'dpe_consommation', 'dpe_emissions', 'dpe_date', 'mandat_numero', 'mandat_type',
      'mandat_date_echeance', 'nb_lots', 'description', 'commercialisation'
    ];
    for (const k of KEEP_FIELDS) {
      if (currentMandat[k] !== null && currentMandat[k] !== undefined) {
        cleanMandat[k] = currentMandat[k];
      }
    }

    // ─── Construire le contenu utilisateur ───
    let userContent = [];

    if (text && text.trim()) {
      userContent.push({ type: 'text', text: 'NOUVEAU CONTENU (texte) :\n\n' + text });
    } else if (audioTranscription && audioTranscription.trim()) {
      userContent.push({ type: 'text', text: 'NOUVEAU CONTENU (transcription vocale) :\n\n' + audioTranscription });
    } else if (Array.isArray(files) && files.length > 0) {
      userContent.push({ type: 'text', text: 'NOUVEAU CONTENU (fichiers) :\n\n' });
      for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        const { data: fileData, error: dlErr } = await supabaseAdmin.storage.from('mandat-docs').download(filePath);
        if (dlErr || !fileData) continue;

        const arrayBuffer = await fileData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = fileData.type || 'application/octet-stream';

        if (mimeType === 'application/pdf' || mimeType.includes('pdf')) {
          try {
            const parsed = await pdfParse(buffer);
            const txt = (parsed.text || '').trim().slice(0, 15000);
            if (txt) {
              userContent.push({ type: 'text', text: `[Document ${i + 1} : ${filePath.split('/').pop()}]\n${txt}\n\n` });
            }
          } catch (e) {
            console.warn('[ai-enrich] PDF parse failed:', e.message);
          }
        } else if (mimeType.startsWith('image/')) {
          const base64 = buffer.toString('base64');
          userContent.push({ type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } });
          userContent.push({ type: 'text', text: `[Image ${i + 1}]\n` });
        }
      }
    } else {
      return new Response(JSON.stringify({ ok: false, error: 'Aucun contenu fourni (text/audioTranscription/files requis)' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // ─── Appel IA ───
    const systemPrompt = buildPrompt(mode, cleanMandat);
    const { parsed, usage } = await callClaude(systemPrompt, userContent);

    // ─── Filtrer les updates : ne garder que les champs de KEEP_FIELDS ───
    const updates = {};
    for (const [k, v] of Object.entries(parsed.updates || {})) {
      if (!KEEP_FIELDS.includes(k)) continue;
      if (v === null || v === undefined || v === '') continue;
      // Si mode prefill_empty_only, on s'assure aussi côté serveur que le champ est bien vide
      if (mode === 'prefill_empty_only') {
        const existing = currentMandat[k];
        const isEmpty = existing === null || existing === undefined || existing === '' || existing === 0;
        if (!isEmpty) continue;
      }
      updates[k] = v;
    }

    return new Response(JSON.stringify({
      ok: true,
      mandatId,
      mode,
      currentValues: cleanMandat,
      updates,
      reasoning: parsed.reasoning || '',
      confidence: parsed.confidence || 0,
      usage,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[/api/ai-enrich] Erreur:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
