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
Tu reçois du contenu (texte, document, transcription vocale) et tu dois :

1. DÉTECTER le type de contenu :
   - "mandat" : un bien immobilier à vendre
   - "client" : un acheteur potentiel / investisseur
   - "both" : les 2 (ex: un email avec un bien ET un acheteur)
   - "unknown" : impossible à déterminer

2. EXTRAIRE les données pour la (les) fiche(s).

═══════════════════════════════════════════════════════════════════
ARBORESCENCE DES TYPES DE BIENS (CRITIQUE)
═══════════════════════════════════════════════════════════════════

Pour chaque mandat, tu dois identifier :
- "marche" : "b2b" (investissement) OU "b2c" (habitation pour habiter)
- "type" : la famille principale
- "sous_type" : le sous-type précis (peut être absent si pas pertinent)

═══ MARCHÉ B2B (investissement professionnel) ═══

Famille "Immeubles" → sous_type parmi : "Immeuble d'habitation", "Mixte", "Commercial"
Famille "Hôtels" → sous_type parmi : "Hébergements hôteliers", "Hôtels classiques", "Sociaux"
Famille "Terrains" → pas de sous_type
Famille "Parking" → pas de sous_type
Famille "Locaux commerciaux" → sous_type parmi : "Bureaux", "Boutiques", "Retails Park"

═══ MARCHÉ B2C (habitation pour particulier) ═══

Type parmi : "Appartement", "Maison", "Hôtel particulier"
(Pas de sous_type pour le B2C)

═══ COMMENT CHOISIR ═══

- Si on parle d'un **immeuble entier** d'appartements → b2b, type="Immeubles", sous_type="Immeuble d'habitation"
- Si on parle d'un **appartement T3** vendu individuellement → b2c, type="Appartement"
- Si on parle d'une **maison** vendue à un particulier → b2c, type="Maison"
- Si on parle d'un **hôtel particulier** comme résidence → b2c, type="Hôtel particulier"
- Si on parle d'un **immeuble mixte** (commerces RDC + appartements) → b2b, type="Immeubles", sous_type="Mixte"
- Si on parle d'un **hôtel** au sens commercial (hôtellerie) → b2b, type="Hôtels", sous_type="Hôtels classiques"
- Si on parle de **bureaux** d'entreprise → b2b, type="Locaux commerciaux", sous_type="Bureaux"
- Si on parle d'un **terrain** → b2b, type="Terrains"
- Dans le doute, B2B est le défaut (le métier de l'agence est l'investissement)

═══════════════════════════════════════════════════════════════════
FORMAT DE RÉPONSE (JSON STRICT, pas de markdown)
═══════════════════════════════════════════════════════════════════

{
  "type": "mandat|client|both|unknown",
  "confidence": 0.95,
  "reasoning": "Description courte de ce que tu as détecté",
  "mandat": {
    "nom": "...",
    "adresse": "...",
    "ville": "...",
    "marche": "b2b|b2c",
    "type": "...",
    "sous_type": "...",
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
    "marche": "b2b|b2c",
    "typologie": "Foncières|Marchands de biens|Particuliers|Fonds|Promoteurs|Family Office",
    "sous_typologie": "Privées|Publiques",
    "nature": "Personne physique|SCI|SARL|SAS|...",
    "budget_min": 0,
    "budget_max": 0,
    "rendement_min": 0,
    "zones": ["Paris 7e", "Paris 8e"],
    "typologies_recherchees": ["Immeubles", "Immeuble d'habitation", "Mixte"],
    "origine": "Apporteur|Réseau|Site web|Email|...",
    "maturite": "Chaud|Moyen|Froid"
  }
}

═══════════════════════════════════════════════════════════════════
COMMENT EXTRAIRE UN CLIENT (CRITIQUE)
═══════════════════════════════════════════════════════════════════

═══ MARCHÉ CLIENT (b2b vs b2c) ═══

Tu dois TOUJOURS identifier client.marche :
- "b2c" si typologie="Particuliers" (personne qui cherche pour habiter)
- "b2b" si typologie ∈ {Foncières, Marchands de biens, Fonds, Promoteurs, Family Office}

Comment choisir :
- Une personne physique qui cherche un appartement, une maison, un hôtel particulier pour y habiter → b2c, typologie="Particuliers"
- Une société, fonds, foncière, family office, investisseur professionnel → b2b
- Une SCI familiale qui cherche un placement locatif → b2b (Marchands de biens ou Particuliers selon contexte ; par défaut Particuliers si très petite SCI personnelle)
- Dans le doute, B2B est le défaut.

═══ CLIENT B2B : typologies_recherchees ═══

Le tableau "typologies_recherchees" doit contenir les FAMILLES recherchées ET leurs SOUS-TYPES, à PLAT.

Exemples :
- Client cherche des immeubles mixtes et résidentiels :
  → ["Immeubles", "Immeuble d'habitation", "Mixte"]
- Client cherche tous types d'immeubles (pas de précision) :
  → ["Immeubles"]
- Client cherche bureaux + boutiques :
  → ["Locaux commerciaux", "Bureaux", "Boutiques"]
- Client cherche hôtels et terrains :
  → ["Hôtels", "Hôtels classiques", "Terrains"]

RÈGLE : si un sous-type est mentionné, AJOUTE AUSSI sa famille parente.

═══ CLIENT B2C : typologies_recherchees ═══

Le tableau "typologies_recherchees" doit contenir les TYPES recherchés + les NOMBRES DE PIÈCES, à PLAT.

Types possibles : "Appartement", "Maison", "Hôtel particulier"
Nombres de pièces possibles : "Studio / T1", "T2", "T3", "T4", "T5", "T6+"

Exemples :
- Client cherche un T3 ou T4 à Paris :
  → ["Appartement", "T3", "T4"]
- Client cherche une maison ou un appartement T5 :
  → ["Maison", "Appartement", "T5"]
- Client cherche juste "un bien à habiter" sans précision :
  → ["Appartement"]

═══════════════════════════════════════════════════════════════════

RÈGLES :
- Ne mets PAS les clés que tu ne peux pas extraire (pas de null, pas de '').
- "type" est OBLIGATOIRE.
- Pour mandat : "marche" et "type" sont OBLIGATOIRES si on identifie un bien.
- "sous_type" UNIQUEMENT si pertinent (selon l'arborescence ci-dessus).
- Pour client : "marche" et "typologie" sont OBLIGATOIRES si on identifie un acheteur.
- Pour client.sous_typologie : UNIQUEMENT si typologie="Foncières" → "Privées" ou "Publiques". JAMAIS pour les autres typologies.
- Pour client.typologies_recherchees : respecter STRICTEMENT le vocabulaire ci-dessus (familles + sous-types B2B, ou types + pièces B2C). Pas de mélange B2B/B2C dans le même client.
- Si type='mandat', n'inclus PAS la clé "client" (et vice-versa).
- Si type='both', inclus les 2.
- Si type='unknown', n'inclus ni "mandat" ni "client".
- TÉLÉPHONE CLIENT : si la source mentionne plusieurs numéros (fixe + mobile, ou pro + perso), TOUJOURS prendre le mobile/portable en priorité dans le champ "tel". Ignore le fixe. Un numéro mobile français commence par 06, 07, +336, +337.
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

    let userContent = [];
    let allTextContent = '';

    if (mode === 'text' && text) {
      allTextContent = text;
      userContent = [{ type: 'text', text: 'Voici le contenu à analyser :\n\n' + text }];
    } else if (mode === 'audio' && audioTranscription) {
      allTextContent = audioTranscription;
      userContent = [{ type: 'text', text: 'Voici une transcription vocale à analyser :\n\n' + audioTranscription }];
    } else if (mode === 'files' && Array.isArray(files) && files.length > 0) {
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

    const { parsed, usage } = await callClaude(userContent);

    if (forceType && ['mandat', 'client', 'both'].includes(forceType)) {
      parsed.type = forceType;
    }

    // Defaults : si l'IA a oublié le marché, on déduit b2b par défaut
    if (parsed.mandat && !parsed.mandat.marche) {
      parsed.mandat.marche = 'b2b';
    }
    // Idem côté client : déduit du `typologie` si manquant
    if (parsed.client && !parsed.client.marche) {
      const B2C_TYPOLOGIES = ['Particuliers'];
      if (B2C_TYPOLOGIES.includes(parsed.client.typologie)) {
        parsed.client.marche = 'b2c';
      } else if (parsed.client.typologie) {
        parsed.client.marche = 'b2b';
      }
    }
    // Anti-erreur IA : sous_typologie uniquement valide pour Foncières
    if (parsed.client && parsed.client.sous_typologie && parsed.client.typologie !== 'Foncières') {
      delete parsed.client.sous_typologie;
    }

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
