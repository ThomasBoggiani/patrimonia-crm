// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/[id]/import-folder/route.js
// Pour 1 fichier : catégorise + analyse + auto-fill BDD du mandat
// Le client appelle cette route 1x par fichier (en parallèle limité)
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

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const BUCKET = 'mandat-docs';

const VALID_CATEGORIES = ['mandat', 'diagnostics', 'plans_photos', 'notes', 'mandant', 'autre'];

async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

const PROMPT = `Tu es un expert immobilier. Tu analyses un document fourni en pi\u00e8ce jointe (texte ou image), pour 2 t\u00e2ches :

1. CATEGORISER le document parmi :
   - mandat : mandat de vente, compromis, promesse, contrat
   - diagnostics : DPE, plomb, amiante, \u00e9lectricit\u00e9, gaz, ERP, termite
   - plans_photos : plans, photos du bien
   - notes : notes internes, m\u00e9mos, descriptifs marketing
   - mandant : pi\u00e8ce identit\u00e9, RIB, KBIS, justificatif domicile
   - autre : tout le reste

2. EXTRAIRE les donn\u00e9es immobili\u00e8res utiles, UNIQUEMENT celles explicitement pr\u00e9sentes dans le document. N'invente JAMAIS.

R\u00e9ponds UNIQUEMENT avec un JSON valide (pas de backticks markdown). Format exact :

{
  "category": "diagnostics",
  "data": {
    "nom": "...",
    "adresse": "...",
    "ville": "...",
    "type": "Appartement|Studio|Maison|Immeuble|Terrain|Local commercial|Bureau",
    "sous_type": "T1|T2|T3|...",
    "surface": 28.36,
    "nb_pieces": 2,
    "nb_chambres": 1,
    "etage": 2,
    "annee_construction": 1965,
    "prix": 399000,
    "prix_net_vendeur": 380000,
    "prix_m2": 14069,
    "honoraires_charge": "De l'acqu\u00e9reur|Du vendeur",
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
    "mandat_type": "EXCLUSIF|SEMI EXCLUSIF|SIMPLE",
    "date_signature": "2026-02-19",
    "mandat_date_echeance": "2026-08-19",
    "nb_lots": 146,
    "description": "...",
    "highlights": ["..."],
    "commercialisation": "Mandat exclusif|Mandat simple|Off-market"
  }
}

R\u00e8gles :
- "category" : OBLIGATOIRE, une des 6 valeurs.
- "data" : NE METS PAS les cl\u00e9s qu'on ne peut pas extraire. Champs num\u00e9riques = number. Dates = YYYY-MM-DD.
- Pas de pr\u00e9ambule, juste le JSON.`;

export async function POST(request, { params }) {
  try {
    const body = await request.json();
    const { token, storage_path, applyToMandat } = body;

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
    const mimeType = fileData.type || 'application/octet-stream';

    let userContent;

    if (mimeType === 'application/pdf' || mimeType.includes('pdf')) {
      // PDF : extraction texte
      let pdfText = '';
      try {
        const parsed = await pdfParse(buffer);
        pdfText = (parsed.text || '').trim();
      } catch (parseErr) {
        // PDF non lisible (probablement scan image) → fallback : on ne peut pas analyser
        return new Response(JSON.stringify({
          ok: true,
          category: 'autre',
          data: {},
          unreadable: true,
          message: 'PDF illisible (probablement un scan image)',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (!pdfText) {
        return new Response(JSON.stringify({
          ok: true,
          category: 'autre',
          data: {},
          unreadable: true,
          message: 'PDF sans texte extractible',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      const MAX_CHARS = 30000;
      if (pdfText.length > MAX_CHARS) {
        pdfText = pdfText.slice(0, MAX_CHARS) + '\n\n[... suite tronqu\u00e9e ...]';
      }

      userContent = [{
        type: 'text',
        text: 'Voici le contenu textuel du document :\n\n' + pdfText,
      }];
    } else if (mimeType.startsWith('image/')) {
      // Image : vision Claude
      const base64 = buffer.toString('base64');
      userContent = [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: 'Analyse cette image (probablement photo d\'un bien immobilier).' },
      ];
    } else {
      // Type inconnu → on classe en "autre" sans analyser
      return new Response(JSON.stringify({
        ok: true,
        category: 'autre',
        data: {},
        skipped: true,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Appel Claude
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2000,
      system: PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    let parsed = { category: 'autre', data: {} };
    try {
      const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[import-folder] JSON parse error:', parseErr.message, '\nRaw:', text);
    }

    const category = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : 'autre';
    const extractedData = parsed.data || {};

    // Si on a un mandatId valide ET applyToMandat=true ET des donn\u00e9es extraites → mettre \u00e0 jour le mandat
    let filled = [];
    if (applyToMandat && Object.keys(extractedData).length > 0) {
      const { data: currentMandat } = await supabaseAdmin.from('mandats').select('*').eq('id', mandatId).maybeSingle();
      if (currentMandat) {
        // V\u00e9rification adresse (anti-\u00e9crasement)
        const extractedAddr = (extractedData.adresse || '').trim().toLowerCase();
        const currentAddr = (currentMandat.adresse || '').trim().toLowerCase();
        const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
        const addrConflict = extractedAddr && currentAddr
          && !normalize(extractedAddr).includes(normalize(currentAddr))
          && !normalize(currentAddr).includes(normalize(extractedAddr));

        if (!addrConflict) {
          const updates = {};
          for (const [key, value] of Object.entries(extractedData)) {
            if (value === null || value === undefined || value === '') continue;
            if (currentMandat[key] !== value) {
              updates[key] = value;
              filled.push(key);
            }
          }
          if (Object.keys(updates).length > 0) {
            await supabaseAdmin.from('mandats').update(updates).eq('id', mandatId);
          }
        } else {
          // Conflit d'adresse \u2192 on extrait pas, on le signale
          return new Response(JSON.stringify({
            ok: true,
            category,
            data: extractedData,
            filled: [],
            addressConflict: true,
            extractedAddress: extractedData.adresse,
            currentAddress: currentMandat.adresse,
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      category,
      data: extractedData,
      filled,
      usage: response.usage,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[/api/mandats/[id]/import-folder] Erreur:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
