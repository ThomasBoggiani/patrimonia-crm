// ═══════════════════════════════════════════════════════════════════
// app/api/ai-analyze/route.js
// Analyse stratégique complète d'un mandat
//
// Inputs : { token, mandatId }
// Process :
//   1. Charge le mandat + tous ses mandat_documents + tous les clients
//   2. Télécharge chaque doc (PDF → texte, images → base64)
//   3. Demande à Claude un rapport en 5 sections JSON
//   4. Auto-remplit les champs VIDES du mandat (full auto)
//   5. Auto-crée les tâches suggérées (assignées au pourvoyeur)
//   6. Append le brief stratégique à mandat.description
//   7. Renvoie le détail complet au client (avec champs à valider en diff)
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

// Champs autorisés pour l'IA
const KEEP_FIELDS = [
  'nom', 'adresse', 'ville', 'type', 'sous_type', 'surface', 'nb_pieces', 'nb_chambres', 'etage',
  'annee_construction', 'prix', 'prix_net_vendeur', 'prix_m2', 'honoraires_charge', 'honoraires_taux',
  'honoraires_montant', 'loyers_annuels', 'rendement', 'charges_annuelles', 'taxe_fonciere',
  'dpe_consommation', 'dpe_emissions', 'dpe_date', 'mandat_numero', 'mandat_type',
  'mandat_date_echeance', 'nb_lots', 'description', 'commercialisation'
];

function isFieldEmpty(v) {
  return v === null || v === undefined || v === '' || (typeof v === 'number' && v === 0);
}

function buildSystemPrompt(currentMandat, clientsBrief) {
  return `Tu es un expert immobilier patrimonial off-market chez Immeubles & Patrimoine, basé à Paris.
Tu analyses un mandat et tous ses documents associés pour produire :
1. Une mise à jour de la fiche
2. Une liste de tâches actionnables
3. Une analyse stratégique de commercialisation

═══ FICHE MANDAT EXISTANTE ═══
${JSON.stringify(currentMandat, null, 2)}

═══ CLIENTS EN BDD (extrait pour matching) ═══
${JSON.stringify(clientsBrief, null, 2)}

═══ CHAMPS AUTORISÉS POUR LES UPDATES ═══
${KEEP_FIELDS.join(', ')}

Format des champs :
- Nombres : sans guillemets (ex: prix: 450000)
- Dates : 'YYYY-MM-DD'
- mandat_type : 'EXCLUSIF' | 'SEMI EXCLUSIF' | 'SIMPLE'
- commercialisation : 'Off-market' | 'Mandat exclusif' | 'Mandat simple'
- honoraires_charge : "De l'acquéreur" | 'Du vendeur'

═══ TA RÉPONSE ═══
Renvoie UNIQUEMENT un JSON valide (pas de backticks markdown), exactement ce format :

{
  "updates": {
    "prix": 450000,
    "surface": 65.2,
    "...": "..."
  },
  "updates_reasoning": "Description courte (max 300 car) de pourquoi ces updates",

  "tasks": [
    {
      "titre": "Demander le DPE actualisé au vendeur",
      "priorite": "Haute",
      "echeance": "2026-05-12",
      "raison": "DPE absent dans les documents fournis"
    }
  ],

  "matching_clients": [
    {
      "client_id": "uuid-du-client-en-bdd",
      "raison": "Budget compatible 400-500k, recherche immeuble Paris 8e"
    }
  ],

  "target_profiles": [
    {
      "type": "Investisseur LMNP",
      "raison": "Rendement attractif 5,2%, fiscalité avantageuse",
      "canaux": ["Réseau cabinet de gestion privée", "SCPI fiscales"]
    }
  ],

  "strategies": [
    "Mise en avant rentabilité 5,2% nette pour cible investisseur",
    "Off-market via deux family offices identifiés"
  ],

  "highlights": [
    "Emplacement Paris 8e",
    "Rendement 5,2% net",
    "Off-market exclusif",
    "Travaux récents 2023"
  ],

  "brief": {
    "forces": ["Emplacement Paris 8e premium", "Rendement supérieur au marché"],
    "faiblesses": ["DPE classe E à anticiper", "Travaux toiture à estimer"],
    "questions_vendeur": ["Date dernier ravalement ?", "Charges syndic réelles 2024 ?"],
    "synthese": "Bien patrimonial qualitatif, à positionner sur cible investisseurs LMNP/family offices..."
  },

  "confidence": 0.85
}

═══ RÈGLES STRICTES ═══
- "updates" : ne mets QUE les champs à modifier ou remplir, n'inclus pas les inchangés
- "tasks" : 3 à 8 tâches max, actionnables, datées
- "matching_clients" : compare le bien aux clients fournis, ne mets que ceux qui matchent vraiment (budget/zone/typologie)
- "target_profiles" : 2 à 5 profils-types d'acheteurs idéaux
- "strategies" : 3 à 5 stratégies concrètes pour vendre off-market
- "highlights" : 4 à 8 points forts COURTS (max 5 mots chacun) à afficher en badges sur la fiche. Ce sont les arguments de vente clés.
- "brief.synthese" : max 500 caractères, ton professionnel
- TOUS les textes en FRANÇAIS
- Réponds UNIQUEMENT le JSON, pas de préambule`;
}

async function callClaude(systemPrompt, userContent) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  try {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    return { parsed: JSON.parse(cleaned), usage: response.usage };
  } catch (e) {
    console.error('[ai-analyze] JSON parse error:', e.message, '\nRaw:', text.slice(0, 500));
    return {
      parsed: { updates: {}, tasks: [], matching_clients: [], target_profiles: [], strategies: [], highlights: [], brief: {} },
      usage: response.usage,
      parseError: true,
    };
  }
}

function formatBriefForDescription(brief, strategies, targetProfiles, datestamp) {
  const lines = [];
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push(`✨ Analyse IA — ${datestamp}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (brief?.synthese) {
    lines.push('');
    lines.push('📋 SYNTHÈSE');
    lines.push(brief.synthese);
  }

  if (brief?.forces?.length) {
    lines.push('');
    lines.push('✅ FORCES');
    brief.forces.forEach(f => lines.push(`  • ${f}`));
  }

  if (brief?.faiblesses?.length) {
    lines.push('');
    lines.push('⚠️ POINTS D\'ATTENTION');
    brief.faiblesses.forEach(f => lines.push(`  • ${f}`));
  }

  if (strategies?.length) {
    lines.push('');
    lines.push('🎯 STRATÉGIES DE COMMERCIALISATION');
    strategies.forEach(s => lines.push(`  • ${s}`));
  }

  if (targetProfiles?.length) {
    lines.push('');
    lines.push('👥 PROFILS ACHETEURS CIBLÉS');
    targetProfiles.forEach(p => {
      lines.push(`  • ${p.type}${p.raison ? ` — ${p.raison}` : ''}`);
    });
  }

  if (brief?.questions_vendeur?.length) {
    lines.push('');
    lines.push('❓ QUESTIONS À POSER AU VENDEUR');
    brief.questions_vendeur.forEach(q => lines.push(`  • ${q}`));
  }

  return lines.join('\n');
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, mandatId } = body;

    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    if (!mandatId) {
      return new Response(JSON.stringify({ ok: false, error: 'mandatId requis' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // ─── 1. Charger le mandat ───
    const { data: mandat, error: mErr } = await supabaseAdmin
      .from('mandats').select('*').eq('id', mandatId).single();
    if (mErr || !mandat) {
      return new Response(JSON.stringify({ ok: false, error: 'Mandat introuvable' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // ─── 2. Charger les documents du mandat ───
    let documents = [];
    try {
      const { data: docs } = await supabaseAdmin
        .from('mandat_documents').select('*').eq('mandat_id', mandatId);
      documents = docs || [];
    } catch (e) {
      console.warn('[ai-analyze] Pas de table mandat_documents ou erreur :', e.message);
    }

    // ─── 3. Charger un brief des clients pour matching ───
    const { data: allClients } = await supabaseAdmin
      .from('clients')
      .select('id, prenom, nom, societe, typologie, budget_min, budget_max, rendement_min, zones, typologies_recherchees, maturite')
      .eq('statut', 'Actif')
      .limit(50);
    const clientsBrief = (allClients || []).map(c => ({
      id: c.id,
      label: `${c.prenom || ''} ${c.nom || ''}`.trim() + (c.societe ? ` (${c.societe})` : ''),
      typologie: c.typologie,
      budget: `${c.budget_min || 0}-${c.budget_max || 0}`,
      rendement_min: c.rendement_min || 0,
      zones: c.zones || [],
      cible: c.typologies_recherchees || [],
      maturite: c.maturite,
    }));

    // ─── 4. Préparer le mandat propre pour le prompt ───
    const cleanMandat = {};
    for (const k of KEEP_FIELDS) {
      if (mandat[k] !== null && mandat[k] !== undefined) cleanMandat[k] = mandat[k];
    }

    // ─── 5. Construire le contenu utilisateur (docs analysés) ───
    const userContent = [];
    let docsSummary = `Le mandat a ${documents.length} document(s) attaché(s).\n\n`;

    if (documents.length === 0) {
      userContent.push({
        type: 'text',
        text: 'Aucun document n\'est attaché à ce mandat. Analyse uniquement les informations de la fiche existante et propose les tâches/stratégies pertinentes.\n\n',
      });
    } else {
      userContent.push({ type: 'text', text: docsSummary });

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const docName = doc.nom_fichier || doc.path || `Document ${i + 1}`;

        // Note texte directe (si présente)
        if (doc.contenu_texte) {
          userContent.push({
            type: 'text',
            text: `[Document ${i + 1} — Note texte : ${docName}]\n${doc.contenu_texte.slice(0, 8000)}\n\n`,
          });
          continue;
        }

        // Sinon télécharger depuis Storage
        if (!doc.path) continue;
        try {
          const { data: fileData, error: dlErr } = await supabaseAdmin.storage
            .from('mandat-docs').download(doc.path);
          if (dlErr || !fileData) continue;

          const arrayBuffer = await fileData.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const mimeType = fileData.type || 'application/octet-stream';

          if (mimeType === 'application/pdf' || mimeType.includes('pdf')) {
            try {
              const parsed = await pdfParse(buffer);
              const txt = (parsed.text || '').trim().slice(0, 12000);
              if (txt) {
                userContent.push({
                  type: 'text',
                  text: `[Document ${i + 1} — PDF : ${docName}]\n${txt}\n\n`,
                });
              }
            } catch (e) {
              console.warn(`[ai-analyze] PDF parse failed for ${docName}:`, e.message);
            }
          } else if (mimeType.startsWith('image/')) {
            const base64 = buffer.toString('base64');
            userContent.push({
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: base64 },
            });
            userContent.push({
              type: 'text',
              text: `[Image ${i + 1} : ${docName}]\n`,
            });
          }
        } catch (e) {
          console.warn(`[ai-analyze] Erreur chargement doc ${docName}:`, e.message);
        }
      }
    }

    // Photos directement attachées au mandat (mandat.photos JSON)
    if (Array.isArray(mandat.photos) && mandat.photos.length > 0) {
      // On en charge max 5 pour ne pas exploser le contexte
      const photoUrls = mandat.photos.slice(0, 5).map(p => (typeof p === 'string' ? p : p?.url)).filter(Boolean);
      userContent.push({ type: 'text', text: `\nLe mandat a aussi ${mandat.photos.length} photo(s) en attachement direct.\n` });
      // On ne charge pas les photos URL (signed) ici pour ne pas multiplier les tokens — l'IA aura déjà les docs
    }

    // ─── 6. Appel IA ───
    const systemPrompt = buildSystemPrompt(cleanMandat, clientsBrief);
    const { parsed, usage, parseError } = await callClaude(systemPrompt, userContent);

    if (parseError) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'L\'IA n\'a pas renvoyé de JSON valide. Réessaye dans quelques secondes.',
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // ─── 7. Filtrer les updates : autoFill (champs vides) vs proposed (champs remplis) ───
    const autoFilled = {}; // champs VIDES qu'on remplit direct
    const proposed = {};   // champs REMPLIS où l'IA propose un changement (à valider par l'user)

    for (const [k, v] of Object.entries(parsed.updates || {})) {
      if (!KEEP_FIELDS.includes(k)) continue;
      if (v === null || v === undefined || v === '') continue;
      const existing = mandat[k];
      if (isFieldEmpty(existing)) {
        autoFilled[k] = v;
      } else {
        // Si valeur identique, ignorer
        if (String(existing).trim() === String(v).trim()) continue;
        proposed[k] = v;
      }
    }

    // ─── 8. Construire la nouvelle description (append du brief) ───
    const datestamp = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const briefText = formatBriefForDescription(parsed.brief, parsed.strategies, parsed.target_profiles, datestamp);
    const existingDesc = mandat.description || '';
    const newDescription = existingDesc.trim()
      ? `${existingDesc}\n\n${briefText}`
      : briefText;

    // ─── 9. Appliquer les updates auto-fill + nouvelle description + highlights ───
    const finalUpdates = { ...autoFilled, description: newDescription };

    // Si l'IA a proposé une description, on l'utilise (en remplaçant celle qu'on vient de construire)
    // Cas particulier : si l'IA met une description "fraîche", on append derrière le brief
    if (autoFilled.description) {
      finalUpdates.description = `${autoFilled.description}\n\n${briefText}`;
    }
    delete autoFilled.description; // Pour ne pas le compter dans autoFilled retourné au client

    // Highlights : on remplace toujours par ceux de l'IA (les points forts les plus pertinents)
    // Si l'IA n'en a pas renvoyé, on garde les anciens (pas d'écrasement par tableau vide)
    if (Array.isArray(parsed.highlights) && parsed.highlights.length > 0) {
      // Limiter à 8 highlights max, chacun max 60 caractères pour ne pas casser l'affichage
      finalUpdates.highlights = parsed.highlights
        .slice(0, 8)
        .map(h => String(h).trim().slice(0, 60))
        .filter(h => h.length > 0);
    }

    const { error: updateErr } = await supabaseAdmin
      .from('mandats').update(finalUpdates).eq('id', mandatId);

    if (updateErr) {
      console.error('[ai-analyze] Erreur update mandat:', updateErr);
      return new Response(JSON.stringify({
        ok: false, error: 'Erreur sauvegarde : ' + updateErr.message,
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // ─── 10. Créer les tâches suggérées (assignées au pourvoyeur) ───
    const createdTasks = [];
    const pourvoyeurId = mandat.pourvoyeur_id || mandat.created_by || null;
    let assigneeName = null;
    if (pourvoyeurId) {
      const { data: pp } = await supabaseAdmin
        .from('profiles').select('prenom, nom').eq('id', pourvoyeurId).single();
      if (pp) assigneeName = `${pp.prenom || ''} ${pp.nom || ''}`.trim();
    }

    if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
      const tasksToInsert = parsed.tasks.slice(0, 10).map(t => ({
        titre: t.titre || t.title || 'Tâche IA',
        priorite: ['Haute', 'Moyenne', 'Basse'].includes(t.priorite) ? t.priorite : 'Moyenne',
        statut: 'À faire',
        echeance: t.echeance || null,
        assignee: assigneeName,
        assigned_to_user_id: pourvoyeurId,
        lien_type: 'mandat',
        lien_id: mandatId,
        created_by: user.id,
      }));

      const { data: insertedTasks, error: tasksErr } = await supabaseAdmin
        .from('todos').insert(tasksToInsert).select();
      if (tasksErr) {
        console.warn('[ai-analyze] Erreur création tâches:', tasksErr.message);
      } else {
        createdTasks.push(...(insertedTasks || []));
      }
    }

    // ─── 11. Réponse au client ───
    return new Response(JSON.stringify({
      ok: true,
      mandatId,
      autoFilled,                          // { champ: nouvelle_valeur } — déjà appliqué en BDD
      proposed,                            // { champ: nouvelle_valeur } — à valider en diff côté client
      currentValues: cleanMandat,          // valeurs avant analyse (pour le diff)
      tasksCreated: createdTasks,          // tâches insérées en BDD
      matchingClients: parsed.matching_clients || [],
      targetProfiles: parsed.target_profiles || [],
      strategies: parsed.strategies || [],
      highlights: finalUpdates.highlights || [],  // points forts (déjà sauvegardés en BDD)
      brief: parsed.brief || {},
      confidence: parsed.confidence || 0,
      reasoning: parsed.updates_reasoning || '',
      docsAnalyzed: documents.length,
      assignedTo: assigneeName,
      usage,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[/api/ai-analyze] Erreur:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Erreur serveur', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
