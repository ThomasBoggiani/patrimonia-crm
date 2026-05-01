// ═══════════════════════════════════════════════════════════════════
// app/api/ai-create/route.js
// API unifiée : Fichiers + Texte + Audio → Mandat / Client / Les 2
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

const SYSTEM_PROMPT = `Tu es un expert immobilier patrimonial et acquisition off-market.
Tu reçois du contenu (texte de message, document, transcription vocale) et tu dois :

1. DÉTECTER le type de contenu :
   - "mandat" : un bien immobilier à vendre (vendeur, off-market, mandat)
   - "client" : un acheteur potentiel / investisseur
   - "both" : les 2 (ex: un email avec un bien ET un acheteur)
   - "unknown" : impossible à déterminer

2. EXTRAIRE les données pour la (les) fiche(s).

Réponds UNIQUEMENT avec un JSON valide (pas de backticks markdown). Format :

{
  "type": "mandat|client|both|unknown",
  "confidence": 0.95,
  "reasoning": "Description courte de ce que tu as détecté",
  "mandat": {
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
    "mandat_numero": "293",
    "mandat_type": "EXCLUSIF|SEMI EXCLUSIF|SIMPLE",
    "mandat_date_echeance": "2026-08-19",
    "nb_lots": 146,
    "description": "...",
    "commercialisation": "Off-market|Mandat exclusif|Mandat simple"
  },
  "client": {
    "prenom": "...",
    "nom": "...",
    "societe": "...",
    "tel": "...",
    "email": "...",
    "typologie": "Investisseur|Promoteur|Particulier|SCPI|Family office|Mandant",
    "nature": "Personne physique|SCI|SARL|SAS|...",
    "budget_min": 0,
    "budget_max": 0,
    "rendement_min": 0,
    "zones": ["Paris 7e", "Paris 8e"],
    "typologies_recherchees": ["Immeuble d'habitation", "Bureau"],
    "origine": "Apporteur|Réseau|Site web|Email|...",
    "maturite": "Chaud|Moyen|Froid"
  }
}

RÈGLES :
- Ne mets PAS les clés que tu ne peux pas extraire (pas de null, pas de '').
- "type" est OBLIGATOIRE.
- Si type='mandat', n'inclus PAS la clé "client" (et vice-versa).
- Si type='both', inclus les 2 (mandat + client).
- Si type='unknown', n'inclus ni "mandat" ni "client".
- Pas de préambule, juste le JSON.`;

async function callClaude(userContent) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  try {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    return { parsed: JSON.parse(cleaned), usage: response.usage };
  } catch (e) {
    console.error('[ai-create] JSON parse error:', e.message, '\nRaw:', text);
    return { parsed: { type: 'unknown', reasoning: 'Parse error' }, usage: response.usage };
  }
}

// Cherche les doublons potentiels en BDD
async function findDuplicates(parsed) {
  const result = { mandat: null, client: null };

  if ((parsed.type === 'mandat' || parsed.type === 'both') && parsed.mandat) {
    const m = parsed.mandat;
    let query = supabaseAdmin.from('mandats').select('id, nom, adresse, ville, prix');
    if (m.adresse) {
      // On normalise un peu l'adresse pour le matching
      const adr = m.adresse.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '');
      const adrParts = adr.split(/\s+/).filter(p => p.length > 3).slice(0, 3).join(' ');
      if (adrParts) query = query.ilike('adresse', '%' + adrParts.split(' ')[0] + '%');
    }
    const { data } = await query.limit(5);
    if (data && data.length > 0) result.mandat = data;
  }

  if ((parsed.type === 'client' || parsed.type === 'both') && parsed.client) {
    const c = parsed.client;
    const orFilters = [];
    if (c.email) orFilters.push('email.ilike.' + c.email);
    if (c.tel) orFilters.push('tel.ilike.' + c.tel.replace(/\s/g, ''));
    if (c.nom && c.prenom) orFilters.push(`and(nom.ilike.${c.nom},prenom.ilike.${c.prenom})`);
    if (orFilters.length > 0) {
      const { data } = await supabaseAdmin.from('clients').select('id, prenom, nom, societe, email, tel').or(orFilters.join(',')).limit(5);
      if (data && data.length > 0) result.client = data;
    }
  }

  return result;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, mode, text, files, audioTranscription, forceType } = body;

    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // ─── Construire le contenu utilisateur selon le mode ───
    let userContent = [];
    let allTextContent = '';

    if (mode === 'text' && text) {
      allTextContent = text;
      userContent = [{ type: 'text', text: 'Voici le contenu à analyser :\n\n' + text }];
    } else if (mode === 'audio' && audioTranscription) {
      allTextContent = audioTranscription;
      userContent = [{ type: 'text', text: 'Voici une transcription vocale à analyser :\n\n' + audioTranscription }];
    } else if (mode === 'files' && Array.isArray(files) && files.length > 0) {
      // Pour chaque fichier (storage_path), récupérer le contenu
      const parts = [{ type: 'text', text: 'Voici les contenus à analyser :\n\n' }];
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
              parts.push({ type: 'text', text: `[Document ${i + 1} : ${filePath.split('/').pop()}]\n${txt}\n\n` });
              allTextContent += '\n' + txt;
            }
          } catch (e) {
            console.warn('[ai-create] PDF parse failed:', e.message);
          }
        } else if (mimeType.startsWith('image/')) {
          const base64 = buffer.toString('base64');
          parts.push({ type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } });
          parts.push({ type: 'text', text: `[Image ${i + 1}]\n` });
        }
      }
      userContent = parts;
    } else {
      return new Response(JSON.stringify({ ok: false, error: 'Mode invalide (text/audio/files)' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (userContent.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'Aucun contenu à analyser' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // ─── Appel IA ───
    const { parsed, usage } = await callClaude(userContent);

    // ─── Force type si demandé ───
    if (forceType && ['mandat', 'client', 'both'].includes(forceType)) {
      parsed.type = forceType;
    }

    // ─── Détection doublons ───
    const duplicates = await findDuplicates(parsed);

    return new Response(JSON.stringify({
      ok: true,
      type: parsed.type,
      confidence: parsed.confidence || 0,
      reasoning: parsed.reasoning || '',
      mandat: parsed.mandat || null,
      client: parsed.client || null,
      duplicates,
      usage,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[/api/ai-create] Erreur:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
