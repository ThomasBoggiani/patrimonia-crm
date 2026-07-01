// ═══════════════════════════════════════════════════════════════════
// app/api/mandats/[id]/import-folder/route.js
// Pour 1 fichier : catégorise + analyse + (propose ou applique) l'auto-fill
//
// MODES :
//  - mode 'propose' (NOUVEAU) : lit le doc, renvoie le détail des champs
//    { key, label, current, proposed } SANS écrire dans le mandat.
//    Le fichier est quand même catégorisé/rangé (le doc lui-même est déjà stocké).
//  - applyToMandat: true (ANCIEN, conservé) : écrit directement (fallback).
//
// Fallback PDF-image via mupdf (DPE / scans) + prompt enrichi (coût énergie, surface).
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

// Libellés lisibles pour l'écran de validation (clé technique -> label affiché)
const FIELD_LABELS = {
  nom: 'Nom du bien',
  adresse: 'Adresse',
  ville: 'Ville',
  type: "Type d'actif",
  sous_type: 'Sous-type',
  surface: 'Surface (m²)',
  nb_pieces: 'Nombre de pièces',
  nb_chambres: 'Nombre de chambres',
  etage: 'Étage',
  annee_construction: 'Année de construction',
  prix: 'Prix (TTC)',
  prix_net_vendeur: 'Prix net vendeur',
  prix_m2: 'Prix au m²',
  honoraires_charge: 'Honoraires à charge',
  honoraires_taux: 'Honoraires (%)',
  honoraires_montant: 'Honoraires (€)',
  loyers_annuels: 'Loyers annuels',
  rendement: 'Rendement (%)',
  charges_annuelles: 'Charges annuelles',
  taxe_fonciere: 'Taxe foncière',
  dpe_consommation: 'DPE — Consommation (kWh/m²/an)',
  dpe_emissions: 'DPE — Émissions (kgCO₂/m²/an)',
  dpe_date: 'DPE — Date du diagnostic',
  cout_energie_annuel: "Coût annuel d'énergie estimé (€)",
  mandat_numero: 'N° de mandat',
  mandat_type: 'Type de mandat',
  date_signature: 'Date de signature',
  mandat_date_echeance: 'Échéance du mandat',
  nb_lots: 'Nombre de lots',
  description: 'Description',
  commercialisation: 'Commercialisation',
};

function labelFor(key) {
  return FIELD_LABELS[key] || key;
}

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

ATTENTION PARTICULIÈRE À L'AVIS DE TAXE FONCIÈRE :
- "taxe_fonciere" : sur un avis d'imposition de taxe foncière, extrais le MONTANT TOTAL À PAYER (un nombre en euros, ex : 4820). C'est le total de la taxe foncière, PAS les revenus, PAS les bases d'imposition, PAS les taux. Cherche la ligne "Montant de votre taxe foncière" ou "Total à payer".

ATTENTION PARTICULIÈRE AU DPE / AUDIT ÉNERGÉTIQUE (document prioritaire) :
- "dpe_consommation" : la consommation en énergie primaire, en kWh/m²/an (un nombre, ex : 208).
- "dpe_emissions" : les émissions de gaz à effet de serre, en kgCO2/m²/an (un nombre, ex : 45).
- "dpe_date" : la date de réalisation du diagnostic (YYYY-MM-DD).
- "cout_energie_annuel" : le coût annuel d'énergie estimé, en euros (un nombre, ex : 1850). Souvent présenté comme une fourchette "entre X et Y €/an" : prends la valeur haute, ou la moyenne si une seule fourchette.
- "surface" : la surface mentionnée. Pour un lot/appartement c'est la surface loi Carrez ou habitable ; pour un immeuble c'est la surface utile/habitable totale. Mets la surface en m² (un nombre).
- "code_postal" : le code postal de l'adresse du bien (5 chiffres, ex : "75008"). Présent sur tout DPE, mandat ou avis. Extrais-le précisément, c'est essentiel pour la localisation.

Réponds UNIQUEMENT avec un JSON valide (pas de backticks markdown). Format exact :

{
  "category": "diagnostics",
  "data": {
    "nom": "...",
    "adresse": "...",
    "ville": "...",
    "code_postal": "75008",
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
// ───────────────────────────────────────────────────────────────────
async function renderPdfToImages(buffer) {
  const mupdf = await import('mupdf');
  const doc = mupdf.Document.openDocument(buffer, 'application/pdf');
  const pageCount = doc.countPages();
  const toRender = Math.min(pageCount, MAX_VISION_PAGES);
  const zoom = 150 / 72;
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

// ───────────────────────────────────────────────────────────────────
// Analyse un document : renvoie { category, extractedData, visionNote }
// ───────────────────────────────────────────────────────────────────
async function analyzeDocument(buffer, mimeType) {
  let userContent;
  let visionNote = null;

  if (mimeType === 'application/pdf' || mimeType.includes('pdf')) {
    let pdfText = '';
    try {
      const parsed = await pdfParse(buffer);
      pdfText = (parsed.text || '').trim();
    } catch (parseErr) {
      pdfText = '';
    }

    if (pdfText && pdfText.length > 40) {
      const MAX_CHARS = 30000;
      if (pdfText.length > MAX_CHARS) {
        pdfText = pdfText.slice(0, MAX_CHARS) + '\n\n[... suite tronquée ...]';
      }
      userContent = [{ type: 'text', text: 'Voici le contenu textuel du document :\n\n' + pdfText }];
    } else {
      const { images, pageCount, rendered } = await renderPdfToImages(buffer);
      if (images.length === 0) {
        return { category: 'autre', extractedData: {}, unreadable: true, visionNote: 'PDF illisible (aucune page rendue)' };
      }
      if (pageCount > rendered) {
        visionNote = `Document de ${pageCount} pages — seules les ${rendered} premières ont été analysées. Si une info manque, dépose les pages suivantes séparément.`;
      }
      userContent = [
        ...images.map(img => ({ type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } })),
        { type: 'text', text: 'Analyse ce document immobilier (rendu en image' + (images.length > 1 ? 's' : '') + '). Extrais les informations selon les règles.' },
      ];
    }
  } else if (mimeType.startsWith('image/')) {
    const base64 = buffer.toString('base64');
    userContent = [
      { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
      { type: 'text', text: 'Analyse cette image (probablement photo ou scan d\'un bien immobilier).' },
    ];
  } else {
    return { category: 'autre', extractedData: {}, skipped: true, visionNote: null };
  }

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();

  let parsed = { category: 'autre', data: {} };
  try {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    console.error('[import-folder] JSON parse error:', parseErr.message, '\nRaw:', text);
  }

  const category = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : 'autre';
  return { category, extractedData: parsed.data || {}, visionNote, usage: response.usage };
}

export async function POST(request, { params }) {
  try {
    const body = await request.json();
    const { token, storage_path, applyToMandat, mode } = body;

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

    // Analyse du document (commune aux deux modes). Résilient : une erreur d'analyse
    // (IA surchargée, PDF illisible, trop d'images…) ne doit PAS renvoyer 500 —
    // sinon un seul fichier casse tout l'import. On continue en rangeant le doc.
    let analysis;
    try {
      analysis = await analyzeDocument(buffer, mimeType);
    } catch (aiErr) {
      console.error('[import-folder] analyzeDocument a échoué:', aiErr?.message);
      analysis = { category: 'autre', extractedData: {}, aiError: aiErr?.message || 'analyse échouée' };
    }
    const { category, extractedData, visionNote, unreadable, skipped, aiError } = analysis;

    // ═══ MODE PROPOSE : on ne touche PAS au mandat, on renvoie le détail ═══
    if (mode === 'propose') {
      let changes = [];
      if (Object.keys(extractedData).length > 0) {
        const { data: currentMandat } = await supabaseAdmin.from('mandats').select('*').eq('id', mandatId).maybeSingle();
        if (currentMandat) {
          for (const [key, value] of Object.entries(extractedData)) {
            if (value === null || value === undefined || value === '') continue;
            if (key === 'highlights') continue; // géré ailleurs, pas un champ scalaire
            const current = currentMandat[key];
            // On propose seulement si la valeur change réellement
            if (current !== value) {
              changes.push({
                key,
                label: labelFor(key),
                current: current ?? null,
                proposed: value,
              });
            }
          }
        }
      }
      return new Response(JSON.stringify({
        ok: true,
        mode: 'propose',
        category,
        changes,
        note: visionNote || null,
        unreadable: unreadable || false,
        skipped: skipped || false,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // ═══ MODE ANCIEN (applyToMandat direct) — conservé pour ne rien casser ═══
    let filled = [];
    if (applyToMandat && Object.keys(extractedData).length > 0) {
      const { data: currentMandat } = await supabaseAdmin.from('mandats').select('*').eq('id', mandatId).maybeSingle();
      if (currentMandat) {
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
          return new Response(JSON.stringify({
            ok: true, category, data: extractedData, filled: [],
            addressConflict: true, extractedAddress: extractedData.adresse, currentAddress: currentMandat.adresse,
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true, category, data: extractedData, filled, note: visionNote || null, aiError: aiError || null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[/api/mandats/[id]/import-folder] Erreur:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
