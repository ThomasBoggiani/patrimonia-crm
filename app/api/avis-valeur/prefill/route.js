// ═══════════════════════════════════════════════════════════════════
// app/api/avis-valeur/prefill/route.js
// Génère un PREMIER JET d'avis de valeur (JSON) à partir des données du mandat.
// Adapté au marché : BtoB (immeuble/investissement) = analyse complète
// (capitalisation, reconversion) ; BtoC (habitation) = version resserrée.
// Ne persiste rien : renvoie le JSON, l'éditeur le charge, Thomas valide/ajuste.
// ⚠️ Les CHIFFRES de marché restent à valider (sources officielles = étape suivante).
// ═══════════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
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

function faitsMandat(m) {
  const lots = Array.isArray(m?.etat_locatif) ? m.etat_locatif : [];
  const caActuel = lots.reduce((s, l) => s + (parseFloat(l.loyer) || 0) * 12, 0);
  const caPotentiel = lots.reduce((s, l) => {
    const p = parseFloat(l.loyer_potentiel) || 0;
    return s + (p > 0 ? p : (parseFloat(l.loyer) || 0)) * 12;
  }, 0);
  return [
    m?.nom && `Nom : ${m.nom}`,
    m?.adresse && `Adresse : ${m.adresse}`,
    m?.ville && `Ville : ${m.ville}`,
    m?.code_postal && `Code postal : ${m.code_postal}`,
    m?.type && `Type : ${m.type}${m.sous_type || m.sousType ? ` (${m.sous_type || m.sousType})` : ''}`,
    m?.surface && `Surface : ${m.surface} m²`,
    m?.nb_lots && `Nombre de lots : ${m.nb_lots}`,
    m?.annee_construction && `Année de construction : ${m.annee_construction}`,
    m?.prix_net_vendeur && `Prix net vendeur souhaité : ${m.prix_net_vendeur} €`,
    m?.prix && `Prix FAI : ${m.prix} €`,
    caActuel > 0 && `Revenus locatifs actuels : ${Math.round(caActuel)} €/an`,
    caPotentiel > 0 && `Revenus locatifs potentiels : ${Math.round(caPotentiel)} €/an`,
    m?.loyers_annuels && `Loyers annuels (global) : ${m.loyers_annuels} €`,
    m?.taxe_fonciere && `Taxe foncière : ${m.taxe_fonciere} €`,
    Array.isArray(m?.highlights) && m.highlights.length && `Points forts détectés : ${m.highlights.join(' ; ')}`,
    m?.description && `Descriptif : ${m.description}`,
  ].filter(Boolean).join('\n');
}

const REGLES_COMMUNES = `
Réponds UNIQUEMENT avec un JSON valide (aucun texte hors JSON, pas de backticks).
Tu écris en français, ton sobre et professionnel d'expert immobilier.
N'INVENTE PAS de faits vérifiables (architecte, transactions précises nominatives) : reste sur des formulations prudentes.
Les CHIFFRES de marché (prix/m² de zone, valeurs) sont des ESTIMATIONS À VALIDER : appuie-toi sur le prix net vendeur / les loyers fournis et un raisonnement de marché plausible, sans surévaluer.
Nombres : entiers en euros, sans espaces ni symboles.`;

const SCHEMA_B2B = `Structure JSON attendue (immeuble / investissement) :
{
 "localisation": {"transports": "", "commentaire": ""},
 "situation_locative": {"commentaire": ""},
 "caracteristiques": {"annee_construction": "", "architecte": "", "distribution": "", "atouts_distinctifs": ["",""], "commentaire": ""},
 "comparables": {"prix_zone_min": 0, "prix_zone_max": 0, "rendement_zone_min": 0, "rendement_zone_max": 0, "transactions_recentes": "", "commentaire": ""},
 "swot": {"forces": ["",""], "opportunites": ["",""], "facteurs_limitatifs": ["",""], "menaces": ["",""]},
 "methode_m2": {"valeur_basse": {"prix_m2": 0, "valeur_totale": 0, "commentaire": ""}, "valeur_centrale": {"prix_m2": 0, "valeur_totale": 0, "commentaire": ""}, "valeur_haute": {"prix_m2": 0, "valeur_totale": 0, "commentaire": ""}},
 "methode_capi": {"ca_base": 0, "hypotheses": [{"rendement_pct": 0, "valeur_acte": 0, "lecture": ""}], "zone_atterrissage": ""},
 "reconversion": {"usages": [{"titre": "", "description": ""}], "bilan_financier": "", "profils_acquereurs": ["",""]},
 "preconisation": {"recommandation": "", "prix_coup_de_coeur": 0, "prix_marche": 0, "prix_plancher": 0, "avis_client": ""}
}
Renseigne la capitalisation (methode_capi) à partir des revenus locatifs. Propose 2-3 usages de reconversion pertinents seulement s'ils sont plausibles, sinon laisse la liste vide.`;

const SCHEMA_B2C = `Structure JSON attendue (logement d'habitation) — version resserrée, PAS d'analyse d'investissement :
{
 "localisation": {"transports": "", "commentaire": ""},
 "situation_locative": {"commentaire": ""},
 "caracteristiques": {"annee_construction": "", "architecte": "", "distribution": "", "atouts_distinctifs": ["",""], "commentaire": ""},
 "comparables": {"prix_zone_min": 0, "prix_zone_max": 0, "rendement_zone_min": 0, "rendement_zone_max": 0, "transactions_recentes": "", "commentaire": ""},
 "swot": {"forces": ["",""], "opportunites": ["",""], "facteurs_limitatifs": ["",""], "menaces": ["",""]},
 "methode_m2": {"valeur_basse": {"prix_m2": 0, "valeur_totale": 0, "commentaire": ""}, "valeur_centrale": {"prix_m2": 0, "valeur_totale": 0, "commentaire": ""}, "valeur_haute": {"prix_m2": 0, "valeur_totale": 0, "commentaire": ""}},
 "methode_capi": {"ca_base": 0, "hypotheses": [], "zone_atterrissage": ""},
 "reconversion": {"usages": [], "bilan_financier": "", "profils_acquereurs": []},
 "preconisation": {"recommandation": "", "prix_coup_de_coeur": 0, "prix_marche": 0, "prix_plancher": 0, "avis_client": ""}
}
Laisse methode_capi et reconversion VIDES (non pertinents pour un logement). Concentre-toi sur la comparaison au m², les atouts et la préconisation de prix.`;

export async function POST(request) {
  try {
    const { token, mandatId } = await request.json();
    const user = await verifyToken(token);
    if (!user) return Response.json({ ok: false, error: 'Authentification requise' }, { status: 401 });
    if (!mandatId) return Response.json({ ok: false, error: 'mandatId requis' }, { status: 400 });

    const { data: m, error } = await supabaseAdmin.from('mandats').select('*').eq('id', mandatId).single();
    if (error || !m) return Response.json({ ok: false, error: 'Mandat introuvable' }, { status: 404 });

    const estB2C = m.marche === 'b2c';
    const faits = faitsMandat(m);
    if (!faits || faits.length < 20) {
      return Response.json({ ok: false, error: "Renseigne au moins l'adresse, la surface et un prix avant de pré-remplir." }, { status: 400 });
    }

    const system = `Tu rédiges un AVIS DE VALEUR pour l'agence Immeubles & Patrimoine.
Marché : ${estB2C ? 'HABITATION (BtoC)' : 'IMMEUBLE / INVESTISSEMENT (BtoB)'}.
${REGLES_COMMUNES}
${estB2C ? SCHEMA_B2C : SCHEMA_B2B}`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      system,
      messages: [{ role: 'user', content: `Données du bien :\n${faits}\n\nProduis le JSON de l'avis de valeur.` }],
    });

    const raw = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    let avis;
    try { avis = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()); }
    catch { return Response.json({ ok: false, error: "L'IA n'a pas renvoyé un résultat exploitable." }, { status: 502 }); }

    return Response.json({ ok: true, avis, marche: m.marche });
  } catch (e) {
    console.error('[avis-valeur/prefill]', e);
    return Response.json({ ok: false, error: e.message || 'Erreur serveur' }, { status: 500 });
  }
}
