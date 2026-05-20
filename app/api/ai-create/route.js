// ═══════════════════════════════════════════════════════════════════
// app/api/ai-create/route.js
// API universelle : Fichiers + Texte + Audio → 6 intentions
// MOTEUR : OpenAI GPT-4o
// Intentions : mandat | client | both | task | event | email | note | unknown
// ═══════════════════════════════════════════════════════════════════

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

function getDateContext() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  const nextWeek = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const todayLabel = dayNames[now.getDay()] + ' ' + now.toLocaleDateString('fr-FR');
  return { today, tomorrow, nextWeek, todayLabel };
}

const SYSTEM_PROMPT_BASE = `Tu es l'assistant IA universel du CRM Patrimonia (Immeubles & Patrimoine, agence parisienne off-market patrimoniale).

Tu reçois du contenu (texte, document, transcription vocale) et tu dois :

1. DÉTECTER l'INTENTION :
   - "mandat" : un bien immobilier à vendre
   - "client" : un acheteur potentiel / investisseur
   - "both" : les 2 (ex: un email avec un bien ET un acheteur)
   - "task" : une tâche à faire / un rappel ("rappelle-moi", "à faire", "ne pas oublier")
   - "event" : un RDV / rendez-vous / visite avec date et heure ("RDV demain 14h", "visite jeudi 10h")
   - "email" : un brouillon d'email à rédiger ("rédige un mail à", "réponds à")
   - "note" : une note libre / observation à enregistrer ("note importante", "info à retenir")
   - "unknown" : impossible à déterminer

2. EXTRAIRE les données pour l'intention détectée.

═══════════════════════════════════════════════════════════════════
ARBORESCENCE DES TYPES DE BIENS (pour mandat)
═══════════════════════════════════════════════════════════════════

Pour chaque mandat, tu dois identifier :
- "marche" : "b2b" (investissement) OU "b2c" (habitation pour habiter)
- "type" : la famille principale
- "sous_type" : le sous-type précis (peut être absent si pas pertinent)

═══ MARCHÉ B2B (investissement professionnel) ═══
Famille "Immeubles" → sous_type parmi : "Habitation", "Mixte", "Commercial"
Famille "Hôtels" → sous_type parmi : "Hébergements hôteliers", "Hôtels classiques", "Sociaux"
Famille "Terrains" → pas de sous_type
Famille "Parking" → pas de sous_type
Famille "Locaux commerciaux" → sous_type parmi : "Bureaux", "Boutiques", "Retails Park"

═══ MARCHÉ B2C (habitation pour particulier) ═══
Famille "Résidentiel" → sous_type parmi : "Appartements", "Maison", "Hôtels particuliers"

Dans le doute, B2B est le défaut.

═══════════════════════════════════════════════════════════════════
FORMAT DE RÉPONSE (JSON STRICT, pas de markdown)
═══════════════════════════════════════════════════════════════════

{
  "type": "mandat|client|both|task|event|email|note|unknown",
  "confidence": 0.95,
  "reasoning": "Description courte de ce que tu as détecté",
  "mandat": { /* si type=mandat ou both */ },
  "client": { /* si type=client ou both */ },
  "task": { /* si type=task */ },
  "event": { /* si type=event */ },
  "email": { /* si type=email */ },
  "note": { /* si type=note */ }
}

═══════════════════════════════════════════════════════════════════
FORMAT mandat (b2b ou b2c)
═══════════════════════════════════════════════════════════════════

{
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
  "rendement_optimise": 6.2,
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
}

═══════════════════════════════════════════════════════════════════
FORMAT client
═══════════════════════════════════════════════════════════════════

{
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
  "typologies_recherchees": ["Immeubles", "Habitation", "Mixte"],
  "origine": "Apporteur|Réseau|Site web|Email|...",
  "maturite": "Chaud|Moyen|Froid"
}

═══════════════════════════════════════════════════════════════════
FORMAT task (tâche à faire)
═══════════════════════════════════════════════════════════════════

{
  "titre": "Appeler le mandant pour valider le prix",
  "echeance": "2026-05-22",
  "priorite": "Haute|Moyenne|Basse",
  "lien_type": "mandat|client|null",
  "lien_hint": "nom ou prénom de la personne / mandat lié, si évoqué (sinon null)"
}

Pour echeance : utilise la date du jour fournie dans le contexte. "Demain" = jour+1, "vendredi" = prochain vendredi, etc.

═══════════════════════════════════════════════════════════════════
FORMAT event (RDV / Rendez-vous)
═══════════════════════════════════════════════════════════════════

{
  "titre": "Visite immeuble Versailles",
  "date_debut": "2026-05-22T14:00:00",
  "date_fin": "2026-05-22T15:00:00",
  "lieu": "9 rue Hoche, Versailles",
  "participants": ["Philippe Chibaud", "Judith Kessous"],
  "description": "Visite avec le mandant et le notaire",
  "lien_type": "mandat|client|null",
  "lien_hint": "nom du mandat/client lié si évoqué"
}

═══════════════════════════════════════════════════════════════════
FORMAT email (brouillon)
═══════════════════════════════════════════════════════════════════

{
  "destinataire": "philippe.chibaud@example.com ou nom si email inconnu",
  "objet": "Point d'étape mandat Versailles",
  "corps": "Bonjour Philippe,\\n\\nJe reviens vers vous concernant...",
  "lien_type": "mandat|client|null",
  "lien_hint": "nom du mandat/client lié si évoqué"
}

═══════════════════════════════════════════════════════════════════
FORMAT note (note libre / observation)
═══════════════════════════════════════════════════════════════════

{
  "contenu": "Observation rapide : le DPE n'est plus à jour, à refaire avant commercialisation",
  "lien_type": "mandat|client|null",
  "lien_hint": "nom du mandat/client si évoqué"
}

═══════════════════════════════════════════════════════════════════
COMMENT EXTRAIRE UN CLIENT (rappel)
═══════════════════════════════════════════════════════════════════

- client.marche = "b2c" si typologie="Particuliers", sinon "b2b"
- client.typologies_recherchees pour B2B : familles + sous-types à plat (ex: ["Immeubles", "Habitation", "Mixte"])
- client.typologies_recherchees pour B2C : sous-types + nb pièces (ex: ["Appartements", "T3", "T4"])
- Tel : prendre le mobile en priorité (06, 07, +336, +337)

═══════════════════════════════════════════════════════════════════
RÈGLES GÉNÉRALES
═══════════════════════════════════════════════════════════════════

- Ne mets PAS les clés que tu ne peux pas extraire (pas de null, pas de '').
- "type" est OBLIGATOIRE (= l'intention détectée).
- Pour 'task'/'event' : utilise la DATE DU JOUR fournie dans le contexte (jamais d'invention).
- Si tu ne sais pas, type='unknown'.
- Pas de préambule, juste le JSON.`;

async function callGPT(userContent) {
  const openaiContent = userContent.map(part => {
    if (part.type === 'text') return { type: 'text', text: part.text };
    if (part.type === 'image') {
      const { media_type, data } = part.source;
      return { type: 'image_url', image_url: { url: `data:${media_type};base64,${data}` } };
    }
    return null;
  }).filter(Boolean);

  const dc = getDateContext();
  const fullSystem = SYSTEM_PROMPT_BASE + `\n\n═══ CONTEXTE DATE ═══\nDate du jour : ${dc.today} (${dc.todayLabel})\nDemain : ${dc.tomorrow}\nDans 7 jours : ${dc.nextWeek}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2500,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: fullSystem },
      { role: 'user', content: openaiContent },
    ],
  });

  const text = response.choices[0]?.message?.content || '';
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

// Cherche le mandat/client lié évoqué dans une task/event/email/note
async function resolveLink(lienType, lienHint) {
  if (!lienHint || !lienType) return null;
  const hint = lienHint.toLowerCase();
  if (lienType === 'mandat') {
    const { data } = await supabaseAdmin
      .from('mandats')
      .select('id, nom, adresse, ville')
      .or(`nom.ilike.%${hint}%,adresse.ilike.%${hint}%,ville.ilike.%${hint}%`)
      .limit(3);
    return data && data.length > 0 ? { suggestions: data } : null;
  }
  if (lienType === 'client') {
    const { data } = await supabaseAdmin
      .from('clients')
      .select('id, prenom, nom, societe, email')
      .or(`nom.ilike.%${hint}%,prenom.ilike.%${hint}%,societe.ilike.%${hint}%`)
      .limit(3);
    return data && data.length > 0 ? { suggestions: data } : null;
  }
  return null;
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

    const { parsed, usage } = await callGPT(userContent);

    if (forceType && ['mandat', 'client', 'both', 'task', 'event', 'email', 'note'].includes(forceType)) {
      parsed.type = forceType;
    }

    // Defaults pour mandat
    if (parsed.mandat && !parsed.mandat.marche) {
      parsed.mandat.marche = 'b2b';
    }
    if (parsed.client && !parsed.client.marche) {
      const B2C_TYPOLOGIES = ['Particuliers'];
      if (B2C_TYPOLOGIES.includes(parsed.client.typologie)) {
        parsed.client.marche = 'b2c';
      } else if (parsed.client.typologie) {
        parsed.client.marche = 'b2b';
      }
    }
    if (parsed.client && parsed.client.sous_typologie && parsed.client.typologie !== 'Foncières') {
      delete parsed.client.sous_typologie;
    }

    const duplicates = await findDuplicates(parsed);

    // Pour task/event/email/note : résoudre le lien évoqué
    let linkSuggestions = null;
    for (const intent of ['task', 'event', 'email', 'note']) {
      if (parsed.type === intent && parsed[intent] && parsed[intent].lien_hint) {
        linkSuggestions = await resolveLink(parsed[intent].lien_type, parsed[intent].lien_hint);
        if (linkSuggestions) break;
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      type: parsed.type,
      confidence: parsed.confidence || 0,
      reasoning: parsed.reasoning || '',
      mandat: parsed.mandat || null,
      client: parsed.client || null,
      task: parsed.task || null,
      event: parsed.event || null,
      email: parsed.email || null,
      note: parsed.note || null,
      duplicates,
      link_suggestions: linkSuggestions,
      usage,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[/api/ai-create] Erreur:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
