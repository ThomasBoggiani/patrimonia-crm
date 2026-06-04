// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/[id]/import-folder/route.js
// Pour 1 fichier : catégorise + analyse + auto-fill BDD du mandat
// Le client appelle cette route 1x par fichier (en parallèle limité)
//
// MAJ : fallback PDF-image. Si pdf-parse ne renvoie aucun texte (DPE / scan),
//       on rend les pages en images via mupdf et on les envoie à la vision Claude.
//       Prompt d'extraction enrichi (DPE complet, coût énergie, surface).
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

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const BUCKET = 'mandat-docs';

const VALID_CATEGORIES = ['mandat', 'diagnostics', 'plans_photos', 'notes', 'mandant', 'autre'];

// Nombre max de pages rendues en image pour un PDF scanné (sécurité anti-timeout)
const MAX_VISION_PAGES = 12;

async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

const PROMPT = `Tu es un expert immobilier. Tu analyses un document fourni en pièce jointe (texte ou image(s)), pour 2 tâches :

1. CATEGORISER le document parmi :
   - mandat : mandat de vente, compromis, promesse, contrat
   - diagnostics : DPE, audit énergétique, plomb, amiante, électricité, gaz, ERP, termite
   - plans_photos : plans, photos du bien
   - notes : notes internes, mémos, descriptifs marketing
   - mandant : pièce identité, RIB, KBIS, justificatif domicile
   - autre : tout le reste

2. EXTRAIRE les données immobilières utiles, UNIQUEMENT celles explicitement présentes dans le document. N'invente JAMAIS.

ATTENTION PARTICULIÈRE AU DPE / AUDIT ÉNERGÉTIQUE (document prioritaire) :
- "dpe_consommation" : la consommation en énergie primaire, en kWh/m²/an (un nombre, ex : 208).
- "dpe_emissions" : les émissions de gaz à effet de serre, en kgCO2/m²/an (un nombre, ex : 45).
- "dpe_date" : la date de réalisation du diagnostic (YYYY-MM-DD).
- "cout_energie_annuel" : le coût annuel d'énergie estimé, en euros (un nombre, ex : 1850). Souvent présenté comme une fourchette "entre X et Y €/an" : prends la valeur haute, ou la moyenne si une seule fourchette.
- "surface" : la surface mentionnée. Pour un lot/appartement c'est la surface loi Carrez ou habitable ; pour un immeuble c'est la surface utile/habitable totale. Mets la surface en m² (un nombre).

Réponds UNIQUEMENT avec un JSON valide (pas de backticks markdown). Format exact :

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
    "honoraires_charge": "De l'acquéreur|Du vendeur",
    "honoraires_taux": 5.26,
    "honoraires_montant": 19000,
    "loyers_annuels": 12000,
    "rendement": 4.5,
    "charges_annuelles": 7000,
    "taxe_fonciere": 1500,
    "dpe_consommation": 208,
    "dpe_emissions": 45,
    "dpe_date": "2026-01-13",
    "cout_energie_annuel": 1850,
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

Règles :
- "category" : OBLIGATOIRE, une des 6 valeurs.
- "data" : NE METS PAS les clés qu'on ne peut pas extraire. Champs numériques = number. Dates = YYYY-MM-DD.
- Pas de préambule, juste le JSON.`;

// ───────────────────────────────────────────────────────────────────
// Rend les premières pages d'un PDF en images PNG (base64) via mupdf.
// Utilisé en fallback quand pdf-parse ne renvoie aucun texte.
// Renvoie { images: [{media_type, data}], pageCount, rendered }
// ───────────────────────────────────────────────────────────────────
async function renderPdfToImages(buffer) {
  const mupdf = await import('mupdf');
  const doc = mupdf.Document.openDocument(buffer, 'application/pdf');
  const pageCount = doc.countPages();
  const toRender = Math.min(pageCount, MAX_VISION_PAGES);
  const zoom = 150 / 72; // 150 DPI : bon compromis lisibilité / taille
  const matrix = mupdf.Matrix.scale(zoom, zoom);

  const images = [];
  for (let i = 0; i < toRender; i++) {
    try {
      const page = doc.loadPage(i);
      const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
      const png = pixmap.asPNG();
      images.push({
        media_type: 'image/png',
        data: Buffer.from(png).toString('base64'),
      });
    } catch (e) {
      console.warn('[import-folder] render page', i, 'failed:', e.message);
    }
  }
  return { images, pageCount, rendered: toRender };
}

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
    let visionNote = null; // message à remonter si on a dû tronquer un PDF long

    if (mimeType === 'application/pdf' || mimeType.includes('pdf')) {
      // 1) On tente d'abord l'extraction texte (rapide, gratuite, illimitée en pages)
      let pdfText = '';
      try {
        const parsed = await pdfParse(buffer);
        pdfText = (parsed.text || '').trim();
      } catch (parseErr) {
        pdfText = '';
      }

      if (pdfText && pdfText.length > 40) {
        // PDF avec vrai texte → on lit tout le texte
        const MAX_CHARS = 30000;
        if (pdfText.length > MAX_CHARS) {
          pdfText = pdfText.slice(0, MAX_CHARS) + '\n\n[... suite tronquée ...]';
        }
        userContent = [{
          type: 'text',
          text: 'Voici le contenu textuel du document :\n\n' + pdfText,
        }];
      } else {
        // 2) PDF sans texte (DPE, scan) → fallback VISION : on rend les pages en images
        try {
          const { images, pageCount, rendered } = await renderPdfToImages(buffer);
          if (images.length === 0) {
            return new Response(JSON.stringify({
              ok: true, category: 'autre', data: {}, unreadable: true,
              message: 'PDF illisible (aucune page rendue)',
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          if (pageCount > rendered) {
            visionNote = `Document de ${pageCount} pages — seules les ${rendered} premières ont été analysées. Si une info manque, dépose les pages suivantes séparément.`;
          }
          userContent = [
            ...images.map(img => ({
              type: 'image',
              source: { type: 'base64', media_type: img.media_type, data: img.data },
            })),
            { type: 'text', text: 'Analyse ce document immobilier (rendu en image' + (images.length > 1 ? 's' : '') + '). Extrais les informations selon les règles.' },
          ];
        } catch (renderErr) {
          console.error('[import-folder] render fallback error:', renderErr);
          return new Response(JSON.stringify({
            ok: true, category: 'autre', data: {}, unreadable: true,
            message: 'PDF non analysable : ' + renderErr.message,
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }
    } else if (mimeType.startsWith('image/')) {
      // Image directe : vision Claude
      const base64 = buffer.toString('base64');
      userContent = [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: 'Analyse cette image (probablement photo ou scan d\'un bien immobilier).' },
      ];
    } else {
      // Type inconnu → on classe en "autre" sans analyser
      return new Response(JSON.stringify({
        ok: true, category: 'autre', data: {}, skipped: true,
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

    // Si on a un mandatId valide ET applyToMandat=true ET des données extraites → mettre à jour le mandat
    let filled = [];
    if (applyToMandat && Object.keys(extractedData).length > 0) {
      const { data: currentMandat } = await supabaseAdmin.from('mandats').select('*').eq('id', mandatId).maybeSingle();
      if (currentMandat) {
        // Vérification adresse (anti-écrasement)
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
          // Conflit d'adresse → on n'extrait pas, on le signale
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
      note: visionNote,
      usage: response.usage,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[/api/mandats/[id]/import-folder] Erreur:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
