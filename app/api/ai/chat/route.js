// ═══════════════════════════════════════════════════════════════════
// app/api/ai/chat/route.js — ROUTE IA UNIFIÉE (v1.0)
//
// Un seul assistant pour 3 scopes : global / mandat / client.
//   POST { token, scope, entity_id, message|action, attachments } → streaming SSE
//   POST { token, scope, entity_id, mode:'load' }                 → historique JSON
//   POST { token, scope, entity_id, mode:'clear' }                → efface
//
// Combine le meilleur des 3 anciennes routes :
//   - streaming SSE              (ex mandats/[id]/ai)
//   - 12 outils propose_*        (ex assistant/chat, philosophie "propose → valide")
//   - contexte + matching        (ex clients/[id]/ai-chat + lib/matching réutilisé)
//   - persistance unifiée        (ai_conversations : scope/entity_id/user_id)
//   - style maison I&P           (prompt, action "descriptif")
// ═══════════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { matchClientsForMandat, matchMandatsForClient } from '@/lib/matching';

export const runtime = 'nodejs';
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5';
const VALID_SCOPES = ['global', 'mandat', 'client'];
const ACTIVE_MANDAT_STATUTS = ['Sourcing', 'Analyse', 'Commercialisation'];

async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// Charge le tone of voice entreprise (settings) + celui du commercial courant (profiles).
// Renvoie { entreprise, commercial } (chaînes, vides si non renseignées).
async function loadTones(userId) {
  let entreprise = '';
  let commercial = '';
  try {
    const { data: s } = await supabaseAdmin
      .from('settings').select('value').eq('key', 'tone_of_voice_entreprise').maybeSingle();
    // value est jsonb : soit {"texte": "..."} soit une chaîne
    if (s?.value) {
      if (typeof s.value === 'string') entreprise = s.value;
      else if (typeof s.value === 'object' && typeof s.value.texte === 'string') entreprise = s.value.texte;
    }
  } catch (e) { /* ignore */ }
  try {
    if (userId) {
      const { data: p } = await supabaseAdmin
        .from('profiles').select('tone_of_voice').eq('id', userId).maybeSingle();
      if (p?.tone_of_voice && typeof p.tone_of_voice === 'string') commercial = p.tone_of_voice;
    }
  } catch (e) { /* ignore */ }
  return { entreprise: entreprise.trim(), commercial: commercial.trim() };
}

// Construit le bloc de prompt "tone of voice" hiérarchisé (entreprise prioritaire).
function buildToneBlock(tones) {
  if (!tones || (!tones.entreprise && !tones.commercial)) return '';
  const parts = ['\n\n# TON DE VOIX (pour les emails et messages rédigés au nom du commercial)'];
  if (tones.entreprise) {
    parts.push(`\n## Ton de l'entreprise (SOCLE — à respecter absolument, prioritaire)\n${tones.entreprise}`);
  }
  if (tones.commercial) {
    parts.push(`\n## Ton personnel du commercial (à appliquer DANS LE RESPECT du ton entreprise ci-dessus ; en cas de contradiction, le ton entreprise prime)\n${tones.commercial}`);
  }
  parts.push(`\nN.B. : ce ton de voix s'applique aux emails et messages signés par le commercial. Les descriptifs commerciaux d'un bien suivent, eux, le STYLE MAISON défini plus haut.`);
  return parts.join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// STYLE MAISON — descriptifs Immeubles & Patrimoine
// ═══════════════════════════════════════════════════════════════════
const STYLE_MAISON = `STYLE MAISON IMMEUBLES & PATRIMOINE (à respecter pour tout descriptif commercial).
Il existe DEUX déclinaisons selon le marché du bien (marche = b2b investissement OU b2c habitation). Choisis la bonne selon le mandat.

═══ DÉCLINAISON B2B / INVESTISSEMENT (immeubles, hôtels, locaux, terrains) ═══
1. TITRE entre guillemets : accroche + bénéfice clé (ex : "Hôtel à restructurer avec fort potentiel – création de valeur immédiate").
2. Ouverture signature : "Immeubles et Patrimoine vous présente cet actif..." + surface + composition + potentiel en une phrase dense.
3. L'environnement / le cadre : copropriété, cour, porche, calme, ambiance.
4. Le quartier : esprit du secteur, commerces, transports → argument de demande locative.
5. Le projet / potentiel : ce qu'on peut créer (chambres, exploitation, optimisation).
6. Données chiffrées factuelles : répartition lots/surfaces, CA brut projeté (avec source si connue, ex "Données Checkmyguest"), autorisations (DP, changement de destination), surface actuelle vs potentielle.
7. Prix : montant + mention honoraires ("honoraires inclus" ou "à la charge de l'acquéreur").
8. Closing : "Opération idéale pour investisseur ou marchand recherchant..." + "Dossier complet sur demande."
Ton : orienté investisseur et création de valeur, factuel, chiffres concrets.

═══ DÉCLINAISON B2C / HABITATION (appartements, maisons, hôtels particuliers) ═══
1. TITRE en MAJUSCULES, télégraphique : VILLE/ARRDT – RUE – SURFACE – ARGUMENT PHARE (ex : "PARIS 16ᵉ – RUE MICHEL-ANGE – 42 M² AU CALME ABSOLU SUR GRANDE COUR INTÉRIEURE").
2. Ouverture : situe le quartier, puis "Immeubles et Patrimoine vous présente ce..." + caractéristiques clés.
3. Composition PIÈCE PAR PIÈCE : entrée, cuisine, séjour, chambre(s), salle d'eau/bains, etc.
4. État & confort : rénové ou non, travaux éventuels, exposition, luminosité, calme, vue.
5. Annexes & immeuble : cave, gardien, digicode, fibre, chauffage, ascenseur, travaux votés.
6. Profil acquéreur ciblé : "idéale pour un jeune couple en première acquisition, un pied-à-terre parisien, ou pour loger un enfant étudiant..." (adapter au bien).
7. Liste à puces "Les atouts du bien :" reprenant tous les points forts, AVEC les données chiffrées en fin de liste (charges annuelles, taxe foncière).
8. Phrase de clôture valorisante sur l'art de vivre / la qualité de l'adresse.
Ton : chaleureux et concret, art de vivre, sans survente.

RÈGLE ABSOLUE (les deux déclinaisons) : ne JAMAIS inventer de chiffre. N'utilise que les données réelles du mandat ci-dessus ; si une donnée manque, n'écris pas la ligne correspondante.`;

// ═══════════════════════════════════════════════════════════════════
// CONTEXTE MANDAT
// ═══════════════════════════════════════════════════════════════════
function buildMandatContext(mandat) {
  const lines = [];
  lines.push(`# Contexte du bien (mandat)`);
  lines.push(`- ID : ${mandat.id}`);
  lines.push(`- Nom : ${mandat.nom || '(non renseigné)'}`);
  lines.push(`- Type : ${mandat.type || '(non renseigné)'}${mandat.sous_type ? ' / ' + mandat.sous_type : ''}`);
  if (mandat.adresse) lines.push(`- Adresse : ${mandat.adresse}`);
  if (mandat.ville) lines.push(`- Ville : ${mandat.ville}`);
  if (mandat.code_postal) lines.push(`- Code postal : ${mandat.code_postal}`);
  if (mandat.surface) lines.push(`- Surface : ${mandat.surface} m²`);
  if (mandat.nb_pieces) lines.push(`- Pièces : ${mandat.nb_pieces}`);
  if (mandat.nb_chambres) lines.push(`- Chambres : ${mandat.nb_chambres}`);
  if (mandat.etage !== null && mandat.etage !== undefined) lines.push(`- Étage : ${mandat.etage}`);
  if (mandat.prix) lines.push(`- Prix affiché : ${mandat.prix} €`);
  if (mandat.loyers_annuels) lines.push(`- Loyers annuels : ${mandat.loyers_annuels} €`);
  if (mandat.charges_annuelles) lines.push(`- Charges courantes annuelles : ${mandat.charges_annuelles} €`);
  if (mandat.rendement) lines.push(`- Rendement : ${mandat.rendement} %`);
  if (mandat.dpe_consommation) lines.push(`- DPE consommation : ${mandat.dpe_consommation} kWh/m²/an`);
  if (mandat.dpe_emissions) lines.push(`- DPE émissions : ${mandat.dpe_emissions} kg CO2/m²/an`);
  if (mandat.annee_construction) lines.push(`- Année de construction : ${mandat.annee_construction}`);
  if (mandat.nb_lots) lines.push(`- Nombre de lots copropriété : ${mandat.nb_lots}`);
  if (mandat.statut) lines.push(`- Statut : ${mandat.statut}`);
  if (mandat.commercialisation) lines.push(`- Commercialisation : ${mandat.commercialisation}`);
  if (mandat.marche) lines.push(`- Marché : ${mandat.marche}`);
  if (Array.isArray(mandat.highlights) && mandat.highlights.length > 0) {
    lines.push(`- Points forts : ${mandat.highlights.join(', ')}`);
  }
  if (mandat.etat_locatif) {
    try {
      const el = typeof mandat.etat_locatif === 'string' ? JSON.parse(mandat.etat_locatif) : mandat.etat_locatif;
      if (Array.isArray(el) && el.length) lines.push(`- État locatif : ${el.length} lot(s) renseigné(s)`);
    } catch (e) { /* ignore */ }
  }
  if (mandat.description) {
    lines.push(``);
    lines.push(`# Description actuelle`);
    lines.push(mandat.description);
  }
  return lines.join('\n');
}

// Contacts liés au mandat (mandant/propriétaire, apporteurs, notaires) via le
// pivot mandat_contacts. Sans ça, l'assistant ne "voit" pas le propriétaire du
// bien alors qu'il est affiché sur la fiche.
const MANDAT_CONTACT_ROLE_LABELS = {
  mandant: 'Mandant (propriétaire du bien)',
  apporteur_mandat: 'Apporteur du mandat',
  apporteur_acquereur: "Apporteur d'acquéreur",
  notaire_vendeur: 'Notaire vendeur',
  notaire_acquereur: 'Notaire acquéreur',
};

async function buildMandatContacts(mandatId) {
  if (!mandatId) return '';
  let data;
  try {
    const res = await supabaseAdmin
      .from('mandat_contacts')
      .select('role, contact:contacts(prenom, nom, societe, email, tel)')
      .eq('mandat_id', mandatId);
    data = res.data;
  } catch (e) { return ''; }
  if (!Array.isArray(data) || data.length === 0) return '';

  const lines = ['', '# Contacts liés à ce mandat (déjà renseignés sur la fiche)'];
  let any = false;
  for (const mc of data) {
    const c = mc.contact;
    if (!c) continue;
    const nom = [c.prenom, c.nom].filter(Boolean).join(' ') || c.societe || '(sans nom)';
    const parts = [nom];
    if (c.societe && (c.prenom || c.nom)) parts.push(`société : ${c.societe}`);
    if (c.email) parts.push(`email : ${c.email}`);
    if (c.tel) parts.push(`tél : ${c.tel}`);
    lines.push(`- ${MANDAT_CONTACT_ROLE_LABELS[mc.role] || mc.role} : ${parts.join(' — ')}`);
    any = true;
  }
  if (!any) return '';
  lines.push(`\nCes coordonnées sont disponibles : si on te demande "qui est le propriétaire/mandant" ou d'écrire au mandant, utilise le contact ci-dessus. Ne réponds PAS qu'elles sont manquantes.`);
  return lines.join('\n');
}

// Clients compatibles pour ce mandat (réutilise lib/matching)
async function buildMandatMatching(mandat) {
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, prenom, nom, societe, typologie, marche, maturite, statut, budget_min, budget_max, rendement_min, zones, typologies_recherchees, owner')
    .limit(500);
  if (!Array.isArray(clients) || !clients.length) return '';
  const matches = matchClientsForMandat(mandat, clients).slice(0, 8);
  if (!matches.length) return '\n\n# Clients compatibles\n(aucun client compatible trouvé pour le moment)';
  const lines = matches.map(({ client, score, raisons }) => {
    const nom = [client.prenom, client.nom].filter(Boolean).join(' ') || client.societe || '(anonyme)';
    return `- [${score}%] ${nom} (id ${client.id}) — ${(raisons || []).slice(0, 2).join(' ; ')}`;
  });
  return `\n\n# Clients compatibles (matching automatique, du meilleur au moins bon)\n${lines.join('\n')}`;
}

// ═══════════════════════════════════════════════════════════════════
// CONTEXTE CLIENT
// ═══════════════════════════════════════════════════════════════════
async function buildClientContext(client) {
  const lines = [];
  const nom = [client.prenom, client.nom].filter(Boolean).join(' ') || client.societe || '(anonyme)';
  lines.push(`# Contexte du client (acquéreur)`);
  lines.push(`- ID : ${client.id}`);
  lines.push(`- Nom : ${nom}`);
  if (client.societe) lines.push(`- Société : ${client.societe}`);
  if (client.email) lines.push(`- Email : ${client.email}`);
  if (client.tel) lines.push(`- Téléphone : ${client.tel}`);
  if (client.typologie) lines.push(`- Typologie : ${client.typologie}${client.sous_typologie ? ' / ' + client.sous_typologie : ''}`);
  if (client.marche) lines.push(`- Marché : ${client.marche}`);
  if (client.maturite) lines.push(`- Maturité : ${client.maturite}`);
  if (client.statut) lines.push(`- Statut : ${client.statut}`);
  if (client.budget_min || client.budget_max) lines.push(`- Budget : ${client.budget_min || 0} → ${client.budget_max || 0} €`);
  if (client.rendement_min) lines.push(`- Rendement min recherché : ${client.rendement_min} %`);
  if (Array.isArray(client.zones) && client.zones.length) lines.push(`- Zones recherchées : ${client.zones.join(', ')}`);
  if (Array.isArray(client.typologies_recherchees) && client.typologies_recherchees.length) lines.push(`- Typologies recherchées : ${client.typologies_recherchees.join(', ')}`);
  if (client.details_recherche) lines.push(`- Détails recherche : ${client.details_recherche}`);

  // Interactions récentes
  const { data: interactions } = await supabaseAdmin
    .from('interactions')
    .select('type, resume, next_step, date_next_step, date, created_at')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })
    .limit(15);
  if (Array.isArray(interactions) && interactions.length) {
    lines.push(``);
    lines.push(`# 15 dernières interactions`);
    interactions.forEach(i => {
      const d = (i.date || i.created_at || '').slice(0, 10);
      const next = i.next_step ? ` | Next: ${i.next_step}${i.date_next_step ? ' (' + i.date_next_step + ')' : ''}` : '';
      lines.push(`- [${d}] ${i.type || 'note'}: ${(i.resume || '').slice(0, 200)}${next}`);
    });
  }

  return lines.join('\n');
}

// Mandats compatibles pour ce client (réutilise lib/matching)
async function buildClientMatching(client) {
  const { data: mandats } = await supabaseAdmin
    .from('mandats')
    .select('*')
    .in('statut', ACTIVE_MANDAT_STATUTS)
    .limit(200);
  if (!Array.isArray(mandats) || !mandats.length) return '';
  const matches = matchMandatsForClient(client, mandats).slice(0, 8);
  if (!matches.length) return '\n\n# Mandats compatibles\n(aucun mandat actif compatible pour le moment)';
  const lines = matches.map(({ mandat, score, raisons }) => {
    return `- [${score}%] ${mandat.nom || mandat.adresse || '(sans nom)'} (id ${mandat.id}) — ${(raisons || []).slice(0, 2).join(' ; ')}`;
  });
  return `\n\n# Mandats compatibles (matching automatique, du meilleur au moins bon)\n${lines.join('\n')}`;
}

// ═══════════════════════════════════════════════════════════════════
// QUICK ACTIONS
// ═══════════════════════════════════════════════════════════════════
const QUICK_ACTIONS = {
  descriptif: {
    label: 'Descriptif',
    scopes: ['mandat'],
    user: `Rédige un descriptif commercial pour ce bien en respectant SCRUPULEUSEMENT le style maison Immeubles & Patrimoine (titre entre guillemets, ouverture signature, environnement, quartier, projet/potentiel, données chiffrées factuelles, prix + honoraires, closing). N'invente aucun chiffre : utilise uniquement les données réelles du mandat ci-dessus. Réponds directement avec le descriptif, sans phrase d'introduction.`,
  },
  email_mandant: {
    label: 'Email mandant',
    scopes: ['mandat'],
    user: `Rédige un email professionnel et chaleureux au mandant (le vendeur) pour faire un point d'étape sur la commercialisation. Commence par "Chère Madame, Cher Monsieur,". Sois rassurant, fais le point sans inventer de chiffres, propose un échange téléphonique, termine par une formule soignée et la signature Immeubles & Patrimoine. 150-200 mots. Réponds directement par l'email.`,
  },
  argumentaire: {
    label: 'Argumentaire',
    scopes: ['mandat'],
    user: `Génère un argumentaire de vente percutant pour ce bien face à un acquéreur. Deux sections : "Arguments clés" (5-7 puces, du plus fort au plus secondaire) et "Réponses aux objections probables" (2-3 objections + réponses). Appuie-toi sur les données réelles du mandat. Réponds directement avec l'argumentaire.`,
  },
  aide_vente: {
    label: 'Aide à la vente',
    scopes: ['mandat'],
    user: `Génère une fiche d'aide à la vente pour ce bien, en deux parties, en t'appuyant uniquement sur les données réelles du mandat :

PARTIE 1 — "Profils acquéreurs idéaux" : liste 3 à 5 profils types d'acquéreurs pertinents pour ce bien, classés du plus pertinent au moins pertinent. Pour chaque profil :
- un titre de profil (ex : "Jeune couple primo-accédant", "Pied-à-terre parisien", "Parents d'étudiant", "Investisseur patrimonial")
- une note en étoiles de ⭐ à ⭐⭐⭐⭐⭐ selon la pertinence
- 4 à 5 puces de raisons concrètes pourquoi ce bien leur convient

PARTIE 2 — "Arguments de visite" : 5 à 7 phrases courtes et percutantes (entre guillemets) que le commercial doit répéter sur place pendant la visite, formulées de façon orale et convaincante.

Adapte le ton au marché du bien (habitation B2C = art de vivre ; investissement B2B = rendement/création de valeur). Réponds directement avec la fiche.`,
  },
  email_relance: {
    label: 'Email de relance',
    scopes: ['client'],
    user: `Rédige un email de relance professionnel et chaleureux pour ce client, en t'appuyant sur son profil et les mandats compatibles ci-dessus. Mets en avant 1 ou 2 biens pertinents sans tout détailler. Termine par une proposition d'échange et la signature Immeubles & Patrimoine. Réponds directement par l'email.`,
  },
  synthese_client: {
    label: 'Synthèse client',
    scopes: ['client'],
    user: `Fais une synthèse opérationnelle de ce client : son profil, sa maturité, ce qu'il recherche, les mandats compatibles les plus pertinents, et les prochaines actions recommandées. Sois concis et actionnable.`,
  },
};

// ═══════════════════════════════════════════════════════════════════
// OUTILS (format Anthropic) — repris de assistant/chat, philosophie propose→valide
// ═══════════════════════════════════════════════════════════════════
const tools = [
  { name: 'search_mandats', description: 'Cherche dans la table des mandats. Sans filtre, retourne les plus récents.',
    input_schema: { type: 'object', properties: {
      query_text: { type: 'string' }, ville: { type: 'string' }, statut: { type: 'string' },
      type: { type: 'string' }, prix_min: { type: 'number' }, prix_max: { type: 'number' },
      owner: { type: 'string' }, limit: { type: 'integer' } }, required: [] } },
  { name: 'search_clients', description: 'Cherche dans la table des clients. Sans filtre, retourne les plus récents.',
    input_schema: { type: 'object', properties: {
      query_text: { type: 'string' }, typologie: { type: 'string' }, marche: { type: 'string' },
      maturite: { type: 'string' }, statut: { type: 'string' }, owner: { type: 'string' },
      budget_min: { type: 'number' }, budget_max: { type: 'number' }, limit: { type: 'integer' } }, required: [] } },
  { name: 'search_interactions', description: 'Cherche dans l\'historique des échanges (emails, appels, RDV, notes). À utiliser dès qu\'on demande "les emails", "les derniers échanges", "qui m\'a contacté", etc.',
    input_schema: { type: 'object', properties: {
      client_id: { type: 'string' }, mandat_id: { type: 'string' }, type: { type: 'string' },
      since_days: { type: 'integer' }, limit: { type: 'integer' } }, required: [] } },
  { name: 'propose_create_mandat', description: 'PROPOSE la création d\'un mandat. Ne crée RIEN, l\'utilisateur valide.',
    input_schema: { type: 'object', properties: {
      nom: { type: 'string' }, adresse: { type: 'string' }, ville: { type: 'string' },
      type: { type: 'string' }, sous_type: { type: 'string' }, prix: { type: 'number' },
      surface: { type: 'number' }, nb_lots: { type: 'integer' }, nb_pieces: { type: 'integer' },
      nb_chambres: { type: 'integer' }, etage: { type: 'integer' }, loyers_annuels: { type: 'number' },
      statut: { type: 'string' }, commercialisation: { type: 'string' }, marche: { type: 'string' },
      description: { type: 'string' }, contact: { type: 'string' }, tel: { type: 'string' } }, required: ['nom'] } },
  { name: 'propose_create_client', description: 'PROPOSE la création d\'un client. Typologies VALIDES : "Foncières" (sous_typologies "Privées"/"Publiques"), "Marchands de biens", "Particuliers", "Fonds", "Promoteurs", "Family Office". Marché déduit : "Particuliers"=b2c, autres=b2b.',
    input_schema: { type: 'object', properties: {
      prenom: { type: 'string' }, nom: { type: 'string' }, societe: { type: 'string' },
      email: { type: 'string' }, tel: { type: 'string' },
      typologie: { type: 'string', enum: ['Foncières', 'Marchands de biens', 'Particuliers', 'Fonds', 'Promoteurs', 'Family Office'] },
      sous_typologie: { type: 'string', enum: ['Privées', 'Publiques'] },
      marche: { type: 'string', enum: ['b2b', 'b2c'] },
      maturite: { type: 'string', enum: ['Chaud', 'Moyen', 'Tiède', 'Froid'] },
      statut: { type: 'string', enum: ['Actif', 'Inactif', 'Mandant'] }, origine: { type: 'string' }, budget_min: { type: 'number' },
      budget_max: { type: 'number' }, rendement_min: { type: 'number' }, details_recherche: { type: 'string' } }, required: ['nom'] } },
  { name: 'propose_create_task', description: 'PROPOSE la création d\'une tâche todo. Ne crée RIEN, l\'utilisateur valide.',
    input_schema: { type: 'object', properties: {
      titre: { type: 'string' }, echeance: { type: 'string' }, priorite: { type: 'string' },
      statut: { type: 'string' }, lien_type: { type: 'string' }, lien_id: { type: 'string' } }, required: ['titre'] } },
  { name: 'propose_create_event', description: 'PROPOSE la création d\'un RDV Outlook. Ne crée RIEN, l\'utilisateur valide.',
    input_schema: { type: 'object', properties: {
      titre: { type: 'string' }, date_debut: { type: 'string' }, duree_minutes: { type: 'integer' },
      lieu: { type: 'string' }, description: { type: 'string' }, participants: { type: 'array', items: { type: 'string' } } }, required: ['titre', 'date_debut'] } },
  { name: 'propose_create_interaction', description: 'PROPOSE la création d\'une note/interaction sur un client ou mandat. Ne crée RIEN, l\'utilisateur valide.',
    input_schema: { type: 'object', properties: {
      type: { type: 'string' }, resume: { type: 'string' }, client_id: { type: 'string' },
      mandat_id: { type: 'string' }, next_step: { type: 'string' }, date_next_step: { type: 'string' } }, required: ['type', 'resume'] } },
  { name: 'propose_update_mandat', description: 'PROPOSE la modification d\'un mandat existant. Ne modifie RIEN, l\'utilisateur valide. Pour modifier la description/le type/le prix du mandat courant, utilise son ID.',
    input_schema: { type: 'object', properties: {
      id: { type: 'string' }, nom: { type: 'string' }, adresse: { type: 'string' }, ville: { type: 'string' },
      type: { type: 'string' }, sous_type: { type: 'string' }, prix: { type: 'number' }, surface: { type: 'number' },
      statut: { type: 'string' }, commercialisation: { type: 'string' }, marche: { type: 'string' }, description: { type: 'string' } }, required: ['id'] } },
  { name: 'propose_update_client', description: 'PROPOSE la modification d\'un client existant. Ne modifie RIEN, l\'utilisateur valide.',
    input_schema: { type: 'object', properties: {
      id: { type: 'string' }, prenom: { type: 'string' }, nom: { type: 'string' }, societe: { type: 'string' },
      email: { type: 'string' }, tel: { type: 'string' }, typologie: { type: 'string' }, marche: { type: 'string' },
      maturite: { type: 'string' }, statut: { type: 'string' }, budget_min: { type: 'number' }, budget_max: { type: 'number' } }, required: ['id'] } },
  { name: 'propose_send_email', description: 'PROPOSE l\'envoi d\'un email simple. Ne fait RIEN, l\'utilisateur valide.',
    input_schema: { type: 'object', properties: {
      to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' }, client_id: { type: 'string' } }, required: ['to', 'subject', 'body'] } },
  { name: 'propose_add_photos', description: 'PROPOSE d\'ajouter des PHOTOS à la galerie du BIEN (mandat courant). Deux cas : (1) l\'utilisateur a joint des PHOTOS (fichiers image) ; (2) l\'utilisateur a joint une FICHE PDF (ex. annonce d\'un confrère) contenant des photos → le système extrait automatiquement les photos incrustées dans le PDF. Utilise cet outil dès que l\'utilisateur veut récupérer des photos, y compris depuis un PDF. Ne fait RIEN, l\'utilisateur valide. N\'invente aucune URL : le système attache automatiquement les photos réellement présentes. Fournis simplement l\'ID du mandat courant.',
    input_schema: { type: 'object', properties: {
      mandat_id: { type: 'string', description: 'ID du mandat courant (présent dans le contexte).' } }, required: ['mandat_id'] } },
  { name: 'propose_send_plaquette', description: 'PROPOSE l\'envoi d\'une plaquette PDF d\'un mandat à un client. Ne fait RIEN, l\'utilisateur valide. IMPORTANT : tu DOIS rédiger un custom_message COMPLET et auto-suffisant (jamais vide), car ce message constituera l\'INTÉGRALITÉ du corps de l\'email (seule la signature officielle de l\'agence sera ajoutée automatiquement après). Le message doit, dans le ton de voix du commercial : (1) saluer correctement le destinataire (utilise « Bonjour » + le nom ; n\'invente PAS la civilité Madame/Monsieur si tu n\'es pas sûr du genre) ; (2) présenter brièvement le bien et indiquer que la plaquette est jointe ; (3) inclure vers la fin une courte phrase invitant les professionnels de l\'immobilier et investisseurs à remplir le questionnaire (présent dans la signature) pour recevoir des opportunités off-market ciblées ; (4) se terminer par la formule de clôture du commercial. Ne rédige PAS toi-même le bloc de signature officielle (nom/coordonnées) : il est ajouté automatiquement.',
    input_schema: { type: 'object', properties: {
      mandat_id: { type: 'string' }, client_id: { type: 'string' }, custom_message: { type: 'string', description: 'Corps COMPLET de l\'email à rédiger obligatoirement (salutation + présentation + plaquette jointe + invitation questionnaire pour pros/investisseurs + clôture). Jamais vide.' } }, required: ['mandat_id', 'client_id', 'custom_message'] } },
];

// ═══════════════════════════════════════════════════════════════════
// SEARCHES (lecture) — repris de assistant/chat
// ═══════════════════════════════════════════════════════════════════
async function executeSearchMandats(args) {
  const { query_text, ville, statut, type, prix_min, prix_max, owner, limit = 10 } = args;
  let query = supabaseAdmin.from('mandats')
    .select('id, nom, adresse, ville, statut, prix, surface, type, sous_type, owner, marche, commercialisation, created_at')
    .limit(Math.min(limit, 20));
  if (query_text && query_text.trim()) {
    const safe = `%${query_text.trim()}%`.replace(/[,()]/g, '');
    query = query.or(`nom.ilike.${safe},adresse.ilike.${safe},ville.ilike.${safe}`);
  }
  if (ville) query = query.ilike('ville', `%${ville}%`);
  if (statut) query = query.eq('statut', statut);
  if (type) query = query.eq('type', type);
  if (owner) query = query.eq('owner', owner);
  if (typeof prix_min === 'number') query = query.gte('prix', prix_min);
  if (typeof prix_max === 'number') query = query.lte('prix', prix_max);
  query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) return { error: error.message, results: [] };
  return { count: data?.length || 0, results: data || [] };
}

async function executeSearchClients(args) {
  const { query_text, typologie, marche, maturite, statut, owner, budget_min, budget_max, limit = 10 } = args;
  let query = supabaseAdmin.from('clients')
    .select('id, prenom, nom, societe, email, tel, typologie, sous_typologie, marche, maturite, statut, budget_min, budget_max, rendement_min, zones, typologies_recherchees, owner, created_at')
    .limit(Math.min(limit, 20));
  if (query_text && query_text.trim()) {
    const safe = `%${query_text.trim()}%`.replace(/[,()]/g, '');
    query = query.or(`prenom.ilike.${safe},nom.ilike.${safe},societe.ilike.${safe},email.ilike.${safe}`);
  }
  if (typologie) query = query.eq('typologie', typologie);
  if (marche) query = query.eq('marche', marche);
  if (maturite) query = query.eq('maturite', maturite);
  if (statut) query = query.eq('statut', statut);
  if (owner) query = query.eq('owner', owner);
  if (typeof budget_min === 'number') query = query.gte('budget_min', budget_min);
  if (typeof budget_max === 'number') query = query.lte('budget_max', budget_max);
  query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) return { error: error.message, results: [] };
  return { count: data?.length || 0, results: (data || []).map(c => ({ ...c, nom_complet: [c.prenom, c.nom].filter(Boolean).join(' ') || c.societe || '(anonyme)' })) };
}

async function executeSearchInteractions(args) {
  const { client_id, mandat_id, type, since_days, limit = 20 } = args;
  let query = supabaseAdmin.from('interactions')
    .select('id, type, resume, date, client_id, mandat_id, next_step, date_next_step, metadata, created_at')
    .limit(Math.min(limit, 50));
  if (client_id) query = query.eq('client_id', client_id);
  if (mandat_id) query = query.eq('mandat_id', mandat_id);
  if (type) query = query.eq('type', type);
  if (typeof since_days === 'number' && since_days > 0) {
    const date = new Date(); date.setDate(date.getDate() - since_days);
    query = query.gte('date', date.toISOString().split('T')[0]);
  }
  query = query.order('date', { ascending: false });
  const { data, error } = await query;
  if (error) return { error: error.message, results: [] };
  return { count: data?.length || 0, results: data || [] };
}

// ═══════════════════════════════════════════════════════════════════
// BUILDERS DE PROPOSITION — repris de assistant/chat
// ═══════════════════════════════════════════════════════════════════
const formatPrix = (p) => typeof p === 'number' && p > 0 ? new Intl.NumberFormat('fr-FR').format(p) + ' €' : null;
const formatDate = (d) => { if (!d) return null; try { const x = new Date(d); return isNaN(x.getTime()) ? d : x.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return d; } };

function buildProposeCreateMandat(args) {
  const data = { nom: args.nom || 'Sans nom', adresse: args.adresse || null, ville: args.ville || null,
    type: args.type || 'Immeubles', sous_type: args.sous_type || null, prix: args.prix || 0, surface: args.surface || 0,
    nb_lots: args.nb_lots || 1, nb_pieces: args.nb_pieces || null, nb_chambres: args.nb_chambres || null, etage: args.etage || null,
    loyers_annuels: args.loyers_annuels || 0, statut: args.statut || 'Sourcing', commercialisation: args.commercialisation || 'Off-market',
    marche: args.marche || null, description: args.description || null, contact: args.contact || null, tel: args.tel || null };
  const fields = [
    { label: 'Nom', value: data.nom }, { label: 'Adresse', value: data.adresse || '—' }, { label: 'Ville', value: data.ville || '—' },
    { label: 'Type', value: data.type + (data.sous_type ? ' / ' + data.sous_type : '') }, { label: 'Prix', value: formatPrix(data.prix) || '—' },
    { label: 'Surface', value: data.surface ? data.surface + ' m²' : '—' }, { label: 'Statut', value: data.statut }, { label: 'Commercialisation', value: data.commercialisation } ];
  if (data.contact) fields.push({ label: 'Contact', value: data.contact });
  if (data.tel) fields.push({ label: 'Téléphone', value: data.tel });
  return { proposed: true, type: 'create_mandat', summary: 'Mandat à créer', fields, data };
}

function buildProposeCreateClient(args) {
  const data = { prenom: args.prenom || null, nom: args.nom || null, societe: args.societe || null, email: args.email || null, tel: args.tel || null,
    typologie: args.typologie || 'Particuliers', sous_typologie: args.sous_typologie || null, marche: args.marche || null,
    maturite: args.maturite || 'Moyen', statut: args.statut || 'Actif', origine: args.origine || 'Apporteur',
    budget_min: args.budget_min || 0, budget_max: args.budget_max || 0, rendement_min: args.rendement_min || 0, details_recherche: args.details_recherche || null };
  const warnings = [];
  if (!data.email) warnings.push('email');
  if (!data.tel) warnings.push('téléphone');
  if (!data.budget_min && !data.budget_max) warnings.push('budget');
  const nomComplet = [data.prenom, data.nom].filter(Boolean).join(' ') || data.societe || '—';
  const fields = [
    { label: 'Prénom', value: data.prenom || '—' }, { label: 'Nom', value: data.nom || '—' }, { label: 'Société', value: data.societe || '—' },
    { label: 'Email', value: data.email || '—' }, { label: 'Téléphone', value: data.tel || '—' },
    { label: 'Typologie', value: data.typologie + (data.sous_typologie ? ' / ' + data.sous_typologie : '') },
    { label: 'Marché', value: data.marche ? data.marche.toUpperCase() : '—' },
    { label: 'Budget', value: (data.budget_min || data.budget_max) ? `${formatPrix(data.budget_min) || '0 €'} → ${formatPrix(data.budget_max) || '0 €'}` : '—' },
    { label: 'Maturité', value: data.maturite }, { label: 'Statut', value: data.statut } ];
  if (data.details_recherche) fields.push({ label: 'Recherche', value: data.details_recherche });
  return { proposed: true, type: 'create_client', summary: `Client à créer : ${nomComplet}`, fields, data,
    warnings: warnings.length ? `Champs recommandés manquants : ${warnings.join(', ')}` : null };
}

function buildProposeCreateTask(args) {
  const data = { titre: args.titre || 'Nouvelle tâche', echeance: args.echeance || null, priorite: args.priorite || 'Normale',
    statut: args.statut || 'À faire', lien_type: args.lien_type || null, lien_id: args.lien_id || null };
  const fields = [{ label: 'Titre', value: data.titre }, { label: 'Échéance', value: data.echeance || '—' }, { label: 'Priorité', value: data.priorite }, { label: 'Statut', value: data.statut }];
  if (data.lien_type) fields.push({ label: 'Lié à', value: `${data.lien_type} ${data.lien_id || ''}` });
  return { proposed: true, type: 'create_task', summary: 'Tâche à créer', fields, data };
}

function buildProposeCreateEvent(args) {
  const data = { titre: args.titre || 'Nouveau RDV', date_debut: args.date_debut, duree_minutes: args.duree_minutes || 60,
    lieu: args.lieu || null, description: args.description || null, participants: args.participants || [] };
  const fields = [{ label: 'Titre', value: data.titre }, { label: 'Date début', value: formatDate(data.date_debut) || '—' },
    { label: 'Durée', value: data.duree_minutes + ' min' }, { label: 'Lieu', value: data.lieu || '—' },
    { label: 'Participants', value: data.participants.length ? data.participants.join(', ') : '—' }];
  return { proposed: true, type: 'create_event', summary: 'RDV Outlook à créer', fields, data };
}

function buildProposeCreateInteraction(args) {
  const data = { type: args.type || 'Note', resume: args.resume || '', client_id: args.client_id || null,
    mandat_id: args.mandat_id || null, next_step: args.next_step || null, date_next_step: args.date_next_step || null };
  const fields = [{ label: 'Type', value: data.type }, { label: 'Résumé', value: data.resume }];
  if (data.next_step) fields.push({ label: 'Prochaine action', value: data.next_step });
  if (data.date_next_step) fields.push({ label: 'Date prochaine action', value: data.date_next_step });
  return { proposed: true, type: 'create_interaction', summary: 'Interaction à créer', fields, data };
}

function buildProposeUpdateMandat(args) {
  const data = { ...args };
  const fields = [{ label: 'ID mandat', value: data.id }];
  if (data.nom !== undefined) fields.push({ label: 'Nom', value: data.nom });
  if (data.adresse !== undefined) fields.push({ label: 'Adresse', value: data.adresse });
  if (data.ville !== undefined) fields.push({ label: 'Ville', value: data.ville });
  if (data.type !== undefined) fields.push({ label: 'Type', value: data.type });
  if (data.sous_type !== undefined) fields.push({ label: 'Sous-type', value: data.sous_type });
  if (data.prix !== undefined) fields.push({ label: 'Prix', value: formatPrix(data.prix) });
  if (data.surface !== undefined) fields.push({ label: 'Surface', value: data.surface + ' m²' });
  if (data.statut !== undefined) fields.push({ label: 'Statut', value: data.statut });
  if (data.description !== undefined) fields.push({ label: 'Description', value: data.description.length > 200 ? data.description.slice(0, 200) + '…' : data.description });
  return { proposed: true, type: 'update_mandat', summary: 'Mandat à modifier', fields, data };
}

// Le modèle ne connaît pas les chemins des PJ : le système injecte les vraies
// photos jointes à ce message (ctx.attachments). Deux sources possibles :
//   - fichiers image joints → ajoutés directement ;
//   - PHOTOS incrustées dans un PDF joint → extraites via mupdf (au mieux) puis
//     déposées dans le bucket temporaire, comme des images ordinaires.
// L'argument mandat_id sert juste à cibler le bon bien.
async function buildProposeAddPhotos(args, ctx) {
  const atts = (ctx && Array.isArray(ctx.attachments)) ? ctx.attachments : [];
  const mandatId = args.mandat_id || (ctx && ctx.entityId) || null;
  if (!mandatId) return { error: 'ID du mandat manquant.' };

  const photos = [];       // { storagePath, name, type } dans assistant-attachments
  const warnings = [];

  // 1) Fichiers image joints directement
  for (const a of atts) {
    if (a && a.storagePath && String(a.type || '').startsWith('image/')) {
      photos.push({ storagePath: a.storagePath, name: a.name || null, type: a.type });
    }
  }

  // 2) Photos incrustées dans les PDF joints → extraction (au mieux)
  const pdfs = atts.filter(a => a && a.storagePath && a.type === 'application/pdf');
  for (const pdf of pdfs) {
    try {
      const { data: blob, error: dlErr } = await supabaseAdmin.storage
        .from('assistant-attachments').download(pdf.storagePath);
      if (dlErr || !blob) { warnings.push(`« ${pdf.name || 'document'} » illisible`); continue; }
      const buf = Buffer.from(await blob.arrayBuffer());
      const imgs = await extractImagesFromPdf(buf);
      if (imgs.length === 0) { warnings.push(`aucune photo extractible dans « ${pdf.name || 'document'} »`); continue; }
      const base = String(pdf.name || 'pdf').replace(/\.pdf$/i, '');
      let n = 0;
      for (const img of imgs) {
        n++;
        const path = await uploadTempImage(img.data, 'image/png', `${n}.png`);
        if (path) photos.push({ storagePath: path, name: `${base}-photo-${n}.png`, type: 'image/png' });
      }
    } catch (e) {
      console.error('[propose_add_photos] extraction PDF:', e?.message);
      warnings.push(`extraction impossible pour « ${pdf.name || 'document'} »`);
    }
  }

  if (photos.length === 0) {
    const why = warnings.length ? ' ' + warnings.join(' ; ') + '.' : '';
    return { error: `Aucune photo à ajouter à la galerie.${why}` };
  }

  const data = { mandat_id: mandatId, photos };
  const fields = [
    { label: 'Photos', value: `${photos.length} photo(s)` },
    { label: 'Mandat ID', value: mandatId },
  ];
  const result = { proposed: true, type: 'add_photos', summary: `Ajouter ${photos.length} photo(s) à la galerie du bien`, fields, data };
  if (warnings.length) result.warnings = `À noter : ${warnings.join(' ; ')}.`;
  return result;
}

function buildProposeUpdateClient(args) {
  const data = { ...args };
  const fields = [{ label: 'ID client', value: data.id }];
  if (data.prenom !== undefined) fields.push({ label: 'Prénom', value: data.prenom });
  if (data.nom !== undefined) fields.push({ label: 'Nom', value: data.nom });
  if (data.email !== undefined) fields.push({ label: 'Email', value: data.email });
  if (data.tel !== undefined) fields.push({ label: 'Téléphone', value: data.tel });
  if (data.typologie !== undefined) fields.push({ label: 'Typologie', value: data.typologie });
  if (data.maturite !== undefined) fields.push({ label: 'Maturité', value: data.maturite });
  if (data.statut !== undefined) fields.push({ label: 'Statut', value: data.statut });
  if (data.budget_min !== undefined || data.budget_max !== undefined) fields.push({ label: 'Budget', value: `${formatPrix(data.budget_min || 0) || '0 €'} → ${formatPrix(data.budget_max || 0) || '0 €'}` });
  return { proposed: true, type: 'update_client', summary: 'Client à modifier', fields, data };
}

function buildProposeSendEmail(args) {
  const data = { to: args.to, subject: args.subject, body: args.body, client_id: args.client_id || null };
  const fields = [{ label: 'À', value: data.to }, { label: 'Objet', value: data.subject },
    { label: 'Message', value: data.body.length > 200 ? data.body.slice(0, 200) + '…' : data.body }];
  return { proposed: true, type: 'send_email', summary: 'Email à envoyer', fields, data };
}

function buildProposeSendPlaquette(args) {
  const data = { mandat_id: args.mandat_id, client_id: args.client_id, custom_message: args.custom_message || null };
  const fields = [{ label: 'Mandat ID', value: data.mandat_id }, { label: 'Client ID', value: data.client_id }];
  if (data.custom_message) fields.push({ label: 'Message', value: data.custom_message });
  return { proposed: true, type: 'send_plaquette', summary: 'Plaquette à envoyer', fields, data };
}

async function executeTool(name, args, ctx) {
  switch (name) {
    case 'search_mandats': return await executeSearchMandats(args);
    case 'search_clients': return await executeSearchClients(args);
    case 'search_interactions': return await executeSearchInteractions(args);
    case 'propose_create_mandat': return buildProposeCreateMandat(args);
    case 'propose_create_client': return buildProposeCreateClient(args);
    case 'propose_create_task': return buildProposeCreateTask(args);
    case 'propose_create_event': return buildProposeCreateEvent(args);
    case 'propose_create_interaction': return buildProposeCreateInteraction(args);
    case 'propose_update_mandat': return buildProposeUpdateMandat(args);
    case 'propose_update_client': return buildProposeUpdateClient(args);
    case 'propose_add_photos': return await buildProposeAddPhotos(args, ctx);
    case 'propose_send_email': return buildProposeSendEmail(args);
    case 'propose_send_plaquette': return buildProposeSendPlaquette(args);
    default: return { error: `Outil inconnu : ${name}` };
  }
}

// ═══════════════════════════════════════════════════════════════════
// PERSISTANCE UNIFIÉE — ai_conversations (scope, entity_id, user_id)
// ═══════════════════════════════════════════════════════════════════
async function loadConversation(scope, entityId, userId) {
  let q = supabaseAdmin.from('ai_conversations').select('messages').eq('scope', scope).eq('user_id', userId);
  q = scope === 'global' ? q.is('entity_id', null) : q.eq('entity_id', entityId);
  const { data } = await q.maybeSingle();
  return Array.isArray(data?.messages) ? data.messages : [];
}

async function saveConversation(scope, entityId, userId, messages) {
  let q = supabaseAdmin.from('ai_conversations').select('id').eq('scope', scope).eq('user_id', userId);
  q = scope === 'global' ? q.is('entity_id', null) : q.eq('entity_id', entityId);
  const { data: existing } = await q.maybeSingle();
  const now = new Date().toISOString();
  if (existing) {
    await supabaseAdmin.from('ai_conversations').update({ messages, updated_at: now }).eq('id', existing.id);
  } else {
    await supabaseAdmin.from('ai_conversations').insert({
      scope, entity_id: entityId, user_id: userId, messages,
      mandat_id: scope === 'mandat' ? entityId : null, created_at: now, updated_at: now });
  }
}

async function clearConversation(scope, entityId, userId) {
  let q = supabaseAdmin.from('ai_conversations').delete().eq('scope', scope).eq('user_id', userId);
  q = scope === 'global' ? q.is('entity_id', null) : q.eq('entity_id', entityId);
  await q;
}

// ═══════════════════════════════════════════════════════════════════
// SYSTEM PROMPT par scope
// ═══════════════════════════════════════════════════════════════════
async function buildSystemPrompt(scope, entity, tones) {
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  let contextBlock = '';
  let roleLine = '';
  if (scope === 'mandat' && entity) {
    roleLine = `Tu es l'assistant du MANDAT ci-dessous : un copilote de vente qui aide à valoriser ce bien, le décrire, trouver les bons acquéreurs et faire avancer la transaction.`;
    contextBlock = '\n\n' + buildMandatContext(entity) + (await buildMandatContacts(entity.id)) + (await buildMandatMatching(entity));
  } else if (scope === 'client' && entity) {
    roleLine = `Tu es l'assistant du CLIENT ci-dessous : un copilote qui aide à mieux servir cet acquéreur, lui recommander les bons mandats, rédiger ses emails et faire avancer la relation.`;
    contextBlock = '\n\n' + (await buildClientContext(entity)) + (await buildClientMatching(entity));
  } else {
    roleLine = `Tu es l'assistant global du CRM d'Immeubles & Patrimoine. Tu aides à naviguer, chercher, créer et modifier des données dans tout le CRM.`;
  }

  return `Tu es l'Assistant IA d'Immeubles & Patrimoine, agence patrimoniale spécialisée dans l'off-market à Paris.

Date du jour : ${today}.

${roleLine}

STYLE
- Tutoie l'utilisateur, ton professionnel et direct, en français. Pas de blabla.
- Mets en gras les noms importants (**double étoiles**).
- Ne mentionne jamais "Claude" ni "Anthropic".

ACTIONS (création / modification / envoi)
- Tu disposes d'outils propose_* pour créer/modifier/envoyer. Tu PROPOSES via ces outils : une carte de validation s'affiche, l'utilisateur clique "Valider" ou "Annuler". Tu n'exécutes JAMAIS directement.
- NE DEMANDE JAMAIS "veux-tu confirmer ?" : la carte EST la confirmation. Propose directement via l'outil.
- Si des champs manquent, ne bloque pas : propose quand même et signale après ce qui serait utile à compléter.
- Pour modifier le mandat ou le client COURANT, utilise son ID (présent dans le contexte ci-dessus) avec propose_update_mandat / propose_update_client.
- PIÈCES JOINTES : si l'utilisateur joint des PHOTOS d'un bien (pièces, façade, vues), propose de les ranger dans la galerie avec propose_add_photos (mandat courant). Si ce sont des DOCUMENTS (mandat, DPE, plan, annonce, diagnostic), extrais les informations et propose propose_update_mandat.
- CAS FICHE PDF D'UN CONFRÈRE (contient à la fois des infos ET des photos) : dans le MÊME message, appelle DEUX outils : propose_update_mandat (avec les infos extraites : surface, prix, DPE, description…) ET propose_add_photos (pour récupérer les photos incrustées dans le PDF). Deux cartes de validation s'afficheront, l'utilisateur valide chacune indépendamment. Fais-le sur ce tour-ci, car le PDF n'est disponible que sur le message où il est joint.

RÉFÉRENTIELS MÉTIER
- Statut mandat : Sourcing, Analyse, Mandat signé, Commercialisation, Offre, Promesse, Acte, Vendu par autres, Perdu.
- Marché : b2b ou b2c.
- Typologie client (liste STRICTE) : Foncières (sous-type Privées/Publiques), Marchands de biens, Particuliers, Fonds, Promoteurs, Family Office.
- Marché client déduit : Particuliers = b2c, tous les autres = b2b.
- Prix en euros : convertis "2,5 M€" en 2500000.

${STYLE_MAISON}
${buildToneBlock(tones)}
${contextBlock}`;
}

// ═══════════════════════════════════════════════════════════════════
// CHARGEMENT DE L'ENTITÉ (mandat ou client)
// ═══════════════════════════════════════════════════════════════════
async function loadEntity(scope, entityId) {
  if (scope === 'mandat') {
    const { data } = await supabaseAdmin.from('mandats').select('*').eq('id', entityId).maybeSingle();
    return data;
  }
  if (scope === 'client') {
    const { data } = await supabaseAdmin.from('clients').select('*').eq('id', entityId).maybeSingle();
    return data;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// PIÈCES JOINTES → blocs de contenu pour le modèle (vision + PDF)
// Les fichiers sont sur le bucket "assistant-attachments" (URL signée courte).
// On les télécharge côté serveur et on les envoie en base64 au modèle.
// ═══════════════════════════════════════════════════════════════════
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // limite API image
const MAX_PDF_BYTES = 32 * 1024 * 1024;    // limite API document
const MAX_ATTACHMENTS = 8;

function normalizeAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .filter(a => a && a.signedUrl && (String(a.type || '').startsWith('image/') || a.type === 'application/pdf'))
    .slice(0, MAX_ATTACHMENTS);
}

// Télécharge chaque PJ et la convertit en bloc Anthropic. Renvoie
// { blocks, skipped: [noms trop volumineux ou en erreur] }.
async function buildAttachmentBlocks(atts) {
  const blocks = [];
  const skipped = [];
  await Promise.all(atts.map(async (a) => {
    try {
      const resp = await fetch(a.signedUrl);
      if (!resp.ok) { skipped.push(a.name || 'fichier'); return; }
      const buf = Buffer.from(await resp.arrayBuffer());
      const isPdf = a.type === 'application/pdf';
      if (buf.length > (isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES)) { skipped.push(a.name || 'fichier'); return; }
      const data = buf.toString('base64');
      blocks.push(isPdf
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
        : { type: 'image', source: { type: 'base64', media_type: a.type, data } });
    } catch {
      skipped.push(a.name || 'fichier');
    }
  }));
  return { blocks, skipped };
}

// ═══════════════════════════════════════════════════════════════════
// EXTRACTION DES PHOTOS INCRUSTÉES DANS UN PDF (au mieux, via mupdf)
// Utilisé pour importer les photos d'une fiche PDF de confrère dans la
// galerie du bien. On parcourt les objets du PDF, on garde les flux image
// suffisamment grands (on ignore logos/icônes), et on les rend en PNG.
// Tout est fortement protégé : en cas d'échec, on renvoie [] (0 photo).
// ═══════════════════════════════════════════════════════════════════
const MIN_PHOTO_DIM = 300;          // px : en-dessous = logo/pictogramme → ignoré
const MAX_EXTRACTED_PHOTOS = 40;    // sécurité anti-PDF géant

async function extractImagesFromPdf(buffer) {
  let mupdf;
  try { mupdf = await import('mupdf'); } catch (e) { console.error('[extractImagesFromPdf] mupdf indisponible:', e?.message); return []; }
  let pdf;
  try {
    const doc = mupdf.Document.openDocument(buffer, 'application/pdf');
    pdf = (doc && typeof doc.asPDF === 'function') ? (doc.asPDF() || doc) : doc;
  } catch (e) { console.error('[extractImagesFromPdf] ouverture:', e?.message); return []; }

  const out = [];
  let objCount = 0;
  try { objCount = pdf.countObjects(); } catch { objCount = 0; }

  for (let i = 1; i < objCount && out.length < MAX_EXTRACTED_PHOTOS; i++) {
    let obj = null;
    try { obj = pdf.newIndirect(i, 0); }
    catch { try { obj = pdf.newIndirect(i); } catch { obj = null; } }
    if (!obj) continue;

    let resolved = obj;
    try { if (typeof obj.resolve === 'function') resolved = obj.resolve(); } catch { resolved = obj; }

    let isStream = false;
    try { isStream = typeof resolved.isStream === 'function' ? resolved.isStream() : false; } catch { isStream = false; }
    if (!isStream) continue;

    let subName = '';
    try {
      const st = (resolved.get) ? resolved.get('Subtype') : null;
      if (st) subName = (typeof st.asName === 'function') ? st.asName() : String(st);
    } catch { subName = ''; }
    if (!/Image/i.test(subName)) continue;

    try {
      const image = pdf.loadImage(resolved);
      const w = (typeof image.getWidth === 'function') ? image.getWidth() : 0;
      const h = (typeof image.getHeight === 'function') ? image.getHeight() : 0;
      if (w < MIN_PHOTO_DIM || h < MIN_PHOTO_DIM) continue;   // logo/icône → ignoré
      const pixmap = image.toPixmap();
      const png = pixmap.asPNG();
      out.push({ data: Buffer.from(png), width: w, height: h });
    } catch {
      // objet image non décodable (CMYK exotique, masque, etc.) → on saute
      continue;
    }
  }
  return out;
}

// Dépose un buffer image dans le bucket temporaire et renvoie son storagePath.
async function uploadTempImage(buffer, contentType, baseName) {
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `chat/extracted/${Date.now()}_${rand}_${baseName}`;
  const { error } = await supabaseAdmin.storage
    .from('assistant-attachments').upload(path, buffer, { contentType, upsert: false });
  if (error) { console.error('[uploadTempImage]', error.message); return null; }
  return path;
}

// ═══════════════════════════════════════════════════════════════════
// BOUCLE PRINCIPALE : streaming SSE + tool_use
// ═══════════════════════════════════════════════════════════════════
export async function POST(request) {
  try {
    const body = await request.json();
    const { token, scope = 'global', entity_id = null, message, action, mode, attachments } = body;

    if (!VALID_SCOPES.includes(scope)) {
      return jsonResponse({ ok: false, error: 'scope invalide' }, 400);
    }
    const user = await verifyToken(token);
    if (!user) return jsonResponse({ ok: false, error: 'Authentification requise' }, 401);
    if (scope !== 'global' && !entity_id) {
      return jsonResponse({ ok: false, error: 'entity_id requis pour ce scope' }, 400);
    }

    // Modes spéciaux (non-stream)
    if (mode === 'load') {
      const messages = await loadConversation(scope, entity_id, user.id);
      return jsonResponse({ ok: true, messages }, 200);
    }
    if (mode === 'clear') {
      await clearConversation(scope, entity_id, user.id);
      return jsonResponse({ ok: true }, 200);
    }

    // Charge l'entité (mandat/client) pour le contexte
    let entity = null;
    if (scope !== 'global') {
      entity = await loadEntity(scope, entity_id);
      if (!entity) return jsonResponse({ ok: false, error: `${scope} introuvable` }, 404);
    }

    // Pièces jointes valides (images / PDF) envoyées par le front
    const validAttachments = normalizeAttachments(attachments);

    // Détermine le message utilisateur (quick action, texte libre, ou PJ seules)
    let userMessage, userVisibleLabel, actionKey = null;
    if (action && QUICK_ACTIONS[action]) {
      if (!QUICK_ACTIONS[action].scopes.includes(scope)) {
        return jsonResponse({ ok: false, error: `Action "${action}" indisponible pour ce scope` }, 400);
      }
      userMessage = QUICK_ACTIONS[action].user;
      userVisibleLabel = `[Action] ${QUICK_ACTIONS[action].label}`;
      actionKey = action;
    } else if (message && message.trim()) {
      userMessage = message.trim();
      userVisibleLabel = message.trim();
    } else if (validAttachments.length > 0) {
      // PJ seules, sans texte : instruction d'analyse par défaut selon le scope
      userMessage = scope === 'mandat'
        ? `J'ai joint ${validAttachments.length} fichier(s) concernant ce bien. Regarde-les et agis selon leur NATURE :
- Si ce sont des PHOTOS du bien (pièces, façade, cour, vues) → propose de les ranger dans la galerie avec l'outil propose_add_photos (utilise l'ID du mandat courant).
- Si ce sont des DOCUMENTS (mandat, DPE, plan, annonce, diagnostic, tableau) → extrais les informations et propose de compléter la fiche avec propose_update_mandat (adresse, ville, code postal, surface, pièces/chambres/lots, étage, prix, loyers, charges, DPE, type, description). N'invente AUCUNE donnée absente.
- Si c'est une FICHE PDF de confrère (infos + photos) → dans le MÊME message, appelle propose_update_mandat (infos) ET propose_add_photos (photos du PDF) : deux cartes de validation s'afficheront.
Termine par un court récapitulatif de ce que tu as vu.`
        : `J'ai joint ${validAttachments.length} document(s)/photo(s). Analyse-les et propose l'action la plus pertinente (création ou mise à jour) avec les informations fiables que tu peux en extraire. N'invente aucune donnée absente.`;
      userVisibleLabel = '(pièces jointes uniquement)';
    } else {
      return jsonResponse({ ok: false, error: 'message ou action requis' }, 400);
    }

    // Prépare les blocs "pièces jointes" (vision / PDF) pour ce tour
    let attachmentBlocks = [];
    if (validAttachments.length > 0) {
      const built = await buildAttachmentBlocks(validAttachments);
      attachmentBlocks = built.blocks;
      if (built.skipped.length > 0) {
        userMessage += `\n\n(Note : ${built.skipped.length} fichier(s) n'ont pas pu être lus — trop volumineux ou illisibles : ${built.skipped.join(', ')}. Ne les prends pas en compte.)`;
      }
      // Trace des noms de PJ dans l'historique persistant (affichage au rechargement)
      const names = validAttachments.map(a => a.name).filter(Boolean).join(', ');
      if (names) {
        userVisibleLabel = userVisibleLabel === '(pièces jointes uniquement)'
          ? `📎 ${names}`
          : `${userVisibleLabel}\n📎 ${names}`;
      }
    }

    // Le dernier message user : texte seul, ou texte + blocs images/documents
    const lastUserContent = attachmentBlocks.length > 0
      ? [...attachmentBlocks, { type: 'text', text: userMessage }]
      : userMessage;

    // Charge l'historique et construit les messages API
    const history = await loadConversation(scope, entity_id, user.id);
    const apiMessages = [
      ...history.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.role === 'user' && m.action && QUICK_ACTIONS[m.action]
          ? QUICK_ACTIONS[m.action].user
          : m.content,
      })),
      { role: 'user', content: lastUserContent },
    ];

    const systemPrompt = await buildSystemPrompt(scope, entity, await loadTones(user.id));

    // Contexte transmis aux outils : les PJ de ce tour (pour propose_add_photos,
    // qui gère à la fois les images jointes et l'extraction des photos d'un PDF).
    const toolContext = {
      attachments: validAttachments,
      entityId: entity_id,
      scope,
    };

    // Stream SSE
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const send = (obj) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        let fullText = '';
        // Plusieurs propositions possibles dans un même tour (ex. fiche PDF de
        // confrère → carte "mise à jour fiche" + carte "ajout des photos").
        const proposedActions = [];

        try {
          const MAX_ITER = 4;
          for (let iter = 0; iter < MAX_ITER; iter++) {
            const stream = anthropic.messages.stream({
              model: MODEL, max_tokens: 2000, system: systemPrompt, tools, messages: apiMessages,
            });

            // Streame le texte au fil de l'eau
            stream.on('text', (delta) => {
              fullText += delta;
              send({ type: 'delta', text: delta });
            });

            const finalMsg = await stream.finalMessage();
            const toolUseBlocks = (finalMsg.content || []).filter(b => b.type === 'tool_use');

            if (toolUseBlocks.length > 0) {
              apiMessages.push({ role: 'assistant', content: finalMsg.content });
              const toolResults = [];
              for (const block of toolUseBlocks) {
                const result = await executeTool(block.name, block.input || {}, toolContext);
                if (result?.proposed) {
                  proposedActions.push({
                    type: result.type, summary: result.summary, fields: result.fields,
                    data: result.data, warnings: result.warnings || null, missing: result.missing || null,
                  });
                }
                toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
              }
              // Dès qu'on a au moins une proposition, on les envoie toutes et on sort.
              if (proposedActions.length > 0) {
                for (const pa of proposedActions) send({ type: 'proposed_action', action: pa });
                break;
              }
              apiMessages.push({ role: 'user', content: toolResults });
              continue;
            }
            // Pas d'outil → fin
            break;
          }

          // Sauvegarde l'historique (compat : proposed_action = 1re proposition)
          const newHistory = [
            ...history,
            { role: 'user', content: userVisibleLabel, action: actionKey, ts: new Date().toISOString() },
            { role: 'assistant', content: fullText, proposed_action: proposedActions[0] || null, proposed_actions: proposedActions, ts: new Date().toISOString() },
          ];
          await saveConversation(scope, entity_id, user.id, newHistory);

          send({ type: 'done' });
          controller.close();
        } catch (err) {
          console.error('[ai/chat stream]', err);
          send({ type: 'error', error: err.message });
          controller.close();
        }
      },
    });

    return new Response(readable, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' },
    });
  } catch (e) {
    console.error('[ai/chat] crash', e);
    return jsonResponse({ ok: false, error: 'Erreur serveur', details: e.message }, 500);
  }
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
