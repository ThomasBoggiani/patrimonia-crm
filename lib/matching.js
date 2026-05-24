// lib/matching.js
// Algorithme de matching client ↔ mandat.
// Score 0-100 + raisons textuelles. Critères éliminatoires + critères souples.
// Helpers d'éligibilité : posture, qualité, statut.

// ─────────────────────────────────────────────────────────
// Constantes de pondération
// ─────────────────────────────────────────────────────────
const WEIGHTS = {
  marche: 0,         // Filtre éliminatoire (pas de points, juste éligibilité)
  budget: 30,        // Budget (éliminatoire si hors fourchette)
  type: 25,          // Type d'actif (éliminatoire si non recherché)
  zone: 20,          // Zone géographique (éliminatoire si non recherchée)
  rendement: 15,     // Rendement (souple)
  strategie: 10      // Stratégie / nature (souple)
};

// Statuts de mandats considérés comme "actifs / proposables"
const ACTIVE_MANDAT_STATUTS = ['Sourcing', 'Analyse', 'Commercialisation'];

// Statuts de clients considérés comme "actifs / matchables"
// Note : on garde 'Mandant' car un vendeur d'aujourd'hui est un acheteur de demain (off-market)
const INACTIVE_CLIENT_STATUTS = ['Inactif', 'Perdu'];

// Qualités de contact considérées comme "matchables"
// Note : on exclut 'mauvais' (les salauds ne reçoivent plus rien)
const BLOCKED_CONTACT_QUALITES = ['mauvais'];

// Familles B2B (issues de TYPES_ACTIF_B2B_TREE)
const B2B_FAMILLES = ['Immeubles', 'Hôtels', 'Terrains', 'Parking', 'Locaux commerciaux'];
const B2B_SOUS_TYPES = [
  'Immeuble d\'habitation', 'Mixte', 'Commercial',
  'Hébergements hôteliers', 'Hôtels classiques', 'Sociaux',
  'Bureaux', 'Boutiques', 'Retails Park'
];
const B2C_TYPES = ['Appartement', 'Maison', 'Hôtel particulier'];

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function arr(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

function norm(s) {
  if (!s) return '';
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// ─────────────────────────────────────────────────────────
// HELPERS D'ÉLIGIBILITÉ (postures, qualité, statut)
// ─────────────────────────────────────────────────────────

/**
 * Détermine si un contact est éligible au matching côté achat.
 * Retourne { eligible: bool, raison: string | null }
 *
 * Critères :
 *  - posture inclut 'acheteur' (ou pas de postures = compat rétro)
 *  - qualité du contact n'est pas 'mauvais'
 *  - statut du client n'est pas 'Inactif' ou 'Perdu'
 *
 * @param {object} contact - Objet contacts (avec postures, qualite)
 * @param {object} client  - Objet clients lié (avec statut)
 */
export function isContactEligibleForBuying(contact, client) {
  // Posture : si postures défini et n'inclut pas 'acheteur' → KO
  if (contact && Array.isArray(contact.postures) && contact.postures.length > 0) {
    if (!contact.postures.includes('acheteur')) {
      return { eligible: false, raison: 'Pas de posture acheteur' };
    }
  }

  // Qualité : 'mauvais' → KO
  if (contact && BLOCKED_CONTACT_QUALITES.includes(contact.qualite)) {
    return { eligible: false, raison: 'Contact marqué mauvais' };
  }

  // Statut client : Inactif / Perdu → KO
  if (client && INACTIVE_CLIENT_STATUTS.includes(client.statut)) {
    return { eligible: false, raison: `Client ${client.statut}` };
  }

  return { eligible: true, raison: null };
}

/**
 * Filtre une liste de clients enrichis (avec leur contact) pour ne garder que les acheteurs éligibles.
 * Chaque entrée doit avoir { ...clientFields, contact: {...} } OU le contact à plat sur le client.
 *
 * @param {Array} clients - Liste de clients (chacun avec contact embedé ou champs contact à plat)
 * @returns {Array} Liste filtrée
 */
export function filterAcheteurs(clients) {
  if (!Array.isArray(clients)) return [];
  return clients.filter(c => {
    // Le contact peut être embarqué dans c.contact ou ses champs à plat sur c
    const contact = c.contact || c;
    const { eligible } = isContactEligibleForBuying(contact, c);
    return eligible;
  });
}

/**
 * Détermine si un client a au moins un critère renseigné (pour pénalité de score).
 * Un client sans aucun critère reste matchable mais avec un score réduit.
 */
function hasAnyCriteria(client) {
  if (!client) return false;
  const hasBudget = num(client.budget_min) || num(client.budget_max) || num(client.budgetMin) || num(client.budgetMax);
  const hasTypes = arr(client.typologies_recherchees).length > 0 || arr(client.typologiesRecherchees).length > 0;
  const hasZones = arr(client.zones).length > 0;
  return !!(hasBudget || hasTypes || hasZones);
}

// ─────────────────────────────────────────────────────────
// Helper : déduit le marché (b2b/b2c) d'un mandat ou client
// ─────────────────────────────────────────────────────────
function inferMarcheFromMandat(mandat) {
  if (mandat.marche) return mandat.marche;
  if (B2C_TYPES.includes(mandat.type)) return 'b2c';
  if (B2B_FAMILLES.includes(mandat.type) || B2B_SOUS_TYPES.includes(mandat.type)) return 'b2b';
  return null;
}

function inferMarcheFromClient(client) {
  if (client.marche) return client.marche;
  const typesCherches = arr(client.typologies_recherchees).length > 0
    ? arr(client.typologies_recherchees)
    : arr(client.typologiesRecherchees);
  const hasB2C = typesCherches.some(t => B2C_TYPES.includes(t));
  const hasB2B = typesCherches.some(t => B2B_FAMILLES.includes(t) || B2B_SOUS_TYPES.includes(t));
  if (hasB2C && !hasB2B) return 'b2c';
  if (hasB2B && !hasB2C) return 'b2b';
  return null;
}

// ─────────────────────────────────────────────────────────
// Critère 0 : Marché B2B/B2C (éliminatoire)
// ─────────────────────────────────────────────────────────
function checkMarche(mandat, client) {
  const mandatMarche = inferMarcheFromMandat(mandat);
  const clientMarche = inferMarcheFromClient(client);

  if (!mandatMarche || !clientMarche) {
    return { score: 0, ok: true, raison: null };
  }

  if (mandatMarche !== clientMarche) {
    const labels = { b2b: 'Investissement', b2c: 'Habitation' };
    return {
      score: 0,
      ok: false,
      raison: `Marché ${labels[mandatMarche]} (mandat) vs ${labels[clientMarche]} (client)`
    };
  }

  return { score: 0, ok: true, raison: null };
}

// ─────────────────────────────────────────────────────────
// Critère 1 : Budget
// ─────────────────────────────────────────────────────────
function checkBudget(mandat, client) {
  const prix = num(mandat.prix);
  const min = num(client.budget_min) || num(client.budgetMin);
  const max = num(client.budget_max) || num(client.budgetMax);

  if (!prix) return { score: 0, ok: false, raison: 'Prix mandat inconnu' };
  if (!min && !max) return { score: WEIGHTS.budget, ok: true, raison: null };

  if (min && prix < min) return { score: 0, ok: false, raison: `Prix trop bas (${(prix/1e6).toFixed(1)}M€ < ${(min/1e6).toFixed(1)}M€)` };
  if (max && prix > max) return { score: 0, ok: false, raison: `Prix trop élevé (${(prix/1e6).toFixed(1)}M€ > ${(max/1e6).toFixed(1)}M€)` };

  return { score: WEIGHTS.budget, ok: true, raison: `Budget OK (${(prix/1e6).toFixed(1)}M€)` };
}

// ─────────────────────────────────────────────────────────
// Critère 2 : Type d'actif
// ─────────────────────────────────────────────────────────
function checkType(mandat, client) {
  const mandatType = mandat.type;
  const mandatSousType = mandat.sous_type || mandat.sousType;
  const clientTypes = arr(client.typologies_recherchees).length > 0
    ? arr(client.typologies_recherchees)
    : arr(client.typologiesRecherchees);

  if (!mandatType) return { score: 0, ok: false, raison: 'Type mandat inconnu' };
  if (clientTypes.length === 0) return { score: WEIGHTS.type, ok: true, raison: null };

  const candidates = [norm(mandatType)];
  if (mandatSousType) candidates.push(norm(mandatSousType));

  const matchedClient = clientTypes.find(t => {
    const tNorm = norm(t);
    return candidates.some(c => c.includes(tNorm) || tNorm.includes(c));
  });

  if (!matchedClient) {
    const display = mandatSousType ? `${mandatType} · ${mandatSousType}` : mandatType;
    return { score: 0, ok: false, raison: `Type "${display}" non recherché` };
  }
  return { score: WEIGHTS.type, ok: true, raison: `Type "${matchedClient}" recherché` };
}

// ─────────────────────────────────────────────────────────
// Critère 3 : Zone géographique
// ─────────────────────────────────────────────────────────
function checkZone(mandat, client) {
  const clientZones = arr(client.zones);
  if (clientZones.length === 0) return { score: WEIGHTS.zone, ok: true, raison: null };

  const mandatLoc = norm(
    [mandat.adresse, mandat.ville, mandat.quartier, mandat.arrondissement, mandat.cp, mandat.code_postal]
      .filter(Boolean).join(' ')
  );

  if (!mandatLoc) return { score: 0, ok: false, raison: 'Localisation mandat inconnue' };

  if (clientZones.some(z => norm(z).includes('france entiere'))) {
    return { score: WEIGHTS.zone, ok: true, raison: 'France entière' };
  }

  const matched = clientZones.find(z => {
    const zNorm = norm(z);
    if (mandatLoc.includes(zNorm)) return true;
    if (zNorm === 'paris' && /\b75\d{3}\b/.test(mandatLoc)) return true;
    if (zNorm.includes('ile-de-france') || zNorm.includes('idf')) {
      if (/\b(75|77|78|91|92|93|94|95)\d{3}\b/.test(mandatLoc)) return true;
    }
    return false;
  });

  if (!matched) return { score: 0, ok: false, raison: `Localisation hors zones (${clientZones.join(', ')})` };
  return { score: WEIGHTS.zone, ok: true, raison: `Zone "${matched}" recherchée` };
}

// ─────────────────────────────────────────────────────────
// Critère 4 : Rendement (souple)
// ─────────────────────────────────────────────────────────
function checkRendement(mandat, client) {
  const rdtPresent = num(mandat.rendement);
  const rdtOptimise = num(mandat.rendement_optimise || mandat.rendementOptimise);
  const min = num(client.rendement_min) || num(client.rendementMin);

  if (!min) return { score: WEIGHTS.rendement, ok: true, raison: null };

  if (!rdtPresent && !rdtOptimise) return { score: 0, ok: true, raison: 'Rendement mandat inconnu' };

  const rdtMax = Math.max(rdtPresent || 0, rdtOptimise || 0);

  if (rdtMax < min) {
    const ratio = rdtMax / min;
    return { score: Math.max(0, Math.round(WEIGHTS.rendement * ratio)), ok: true, raison: `Rendement max ${rdtMax}% < min ${min}%` };
  }

  const bonus = rdtMax > min * 1.2 ? ' (bonus)' : '';
  const which = rdtOptimise > rdtPresent && rdtOptimise >= min ? ' (optimisé)' : (rdtPresent >= min ? ' (présent)' : '');
  return { score: WEIGHTS.rendement, ok: true, raison: `Rendement ${rdtMax}% atteint${which}${bonus}` };
}

// ─────────────────────────────────────────────────────────
// Score total + verdict
// ─────────────────────────────────────────────────────────
function computeMatch(mandat, client) {
  const checks = {
    marche: checkMarche(mandat, client),
    budget: checkBudget(mandat, client),
    type: checkType(mandat, client),
    zone: checkZone(mandat, client),
    rendement: checkRendement(mandat, client)
  };

  // Critères éliminatoires
  const eliminatoires = ['marche', 'budget', 'type', 'zone'];
  const failed = eliminatoires.filter(k => !checks[k].ok);

  if (failed.length > 0) {
    return {
      score: 0,
      eligible: false,
      raisons: failed.map(k => checks[k].raison).filter(Boolean)
    };
  }

  // Score = somme pondérée
  const totalWeight = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  const totalScore = Object.values(checks).reduce((acc, c) => acc + (c.score || 0), 0);
  let score = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;

  // Pénalité : fiche client sans aucun critère renseigné → score divisé par 2
  // (le client reste éligible mais visiblement à qualifier)
  const aQualifier = !hasAnyCriteria(client);
  const raisons = Object.values(checks).map(c => c.raison).filter(Boolean);
  if (aQualifier) {
    score = Math.round(score / 2);
    raisons.unshift('⚠️ Fiche à qualifier (pas de critère)');
  }

  return {
    score,
    eligible: true,
    aQualifier,
    raisons
  };
}

// ─────────────────────────────────────────────────────────
// EXPORTS PRINCIPAUX
// ─────────────────────────────────────────────────────────

export function matchMandatsForClient(client, mandats) {
  if (!client || !mandats || !Array.isArray(mandats)) return [];

  const actifs = mandats.filter(m => ACTIVE_MANDAT_STATUTS.includes(m.statut));
  const results = [];

  for (const mandat of actifs) {
    const match = computeMatch(mandat, client);
    if (match.eligible) {
      results.push({ mandat, score: match.score, raisons: match.raisons, aQualifier: match.aQualifier });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Cherche les acheteurs compatibles pour un mandat.
 * NOTE : pour le filtrage par posture/qualité, le caller doit fournir
 * des clients enrichis avec leur `contact` (ou champs contact à plat),
 * et appliquer filterAcheteurs() AVANT d'appeler cette fonction.
 * Cette fonction ne filtre que le statut Inactif/Perdu.
 */
export function matchClientsForMandat(mandat, clients) {
  if (!mandat || !clients || !Array.isArray(clients)) return [];

  const results = [];
  for (const client of clients) {
    if (client.statut && INACTIVE_CLIENT_STATUTS.includes(client.statut)) continue;

    const match = computeMatch(mandat, client);
    if (match.eligible) {
      results.push({ client, score: match.score, raisons: match.raisons, aQualifier: match.aQualifier });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

export function debugMatch(mandat, client) {
  return computeMatch(mandat, client);
}

// Exports utiles pour d'autres modules
export { inferMarcheFromMandat, inferMarcheFromClient };
