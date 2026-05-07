// lib/matching.js
// Algorithme de matching client ↔ mandat.
// Score 0-100 + raisons textuelles. Critères éliminatoires + critères souples.

// ─────────────────────────────────────────────────────────
// Constantes de pondération
// ─────────────────────────────────────────────────────────
const WEIGHTS = {
  budget: 30,        // Budget (éliminatoire si hors fourchette)
  type: 25,          // Type d'actif (éliminatoire si non recherché)
  zone: 20,          // Zone géographique (éliminatoire si non recherchée)
  rendement: 15,     // Rendement (souple)
  strategie: 10      // Stratégie / nature (souple)
};

// Statuts de mandats considérés comme "actifs / proposables"
const ACTIVE_MANDAT_STATUTS = ['Sourcing', 'Analyse', 'Commercialisation'];

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

// Normalise une string pour comparaison (lowercase, sans accent)
function norm(s) {
  if (!s) return '';
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// ─────────────────────────────────────────────────────────
// Critère 1 : Budget
// Le prix du mandat est-il dans la fourchette budget du client ?
// ─────────────────────────────────────────────────────────
function checkBudget(mandat, client) {
  const prix = num(mandat.prix);
  const min = num(client.budget_min);
  const max = num(client.budget_max);

  if (!prix) return { score: 0, ok: false, raison: 'Prix mandat inconnu' };
  if (!min && !max) return { score: WEIGHTS.budget, ok: true, raison: null }; // Pas de critère = OK

  if (min && prix < min) return { score: 0, ok: false, raison: `Prix trop bas (${(prix/1e6).toFixed(1)}M€ < ${(min/1e6).toFixed(1)}M€)` };
  if (max && prix > max) return { score: 0, ok: false, raison: `Prix trop élevé (${(prix/1e6).toFixed(1)}M€ > ${(max/1e6).toFixed(1)}M€)` };

  return { score: WEIGHTS.budget, ok: true, raison: `Budget OK (${(prix/1e6).toFixed(1)}M€)` };
}

// ─────────────────────────────────────────────────────────
// Critère 2 : Type d'actif
// Le type du mandat est-il dans les types recherchés par le client ?
// ─────────────────────────────────────────────────────────
function checkType(mandat, client) {
  const mandatType = mandat.type;
  const clientTypes = arr(client.typologies_recherchees);

  if (!mandatType) return { score: 0, ok: false, raison: 'Type mandat inconnu' };
  if (clientTypes.length === 0) return { score: WEIGHTS.type, ok: true, raison: null };

  const mandatNorm = norm(mandatType);
  const found = clientTypes.some(t => norm(t).includes(mandatNorm) || mandatNorm.includes(norm(t)));

  if (!found) return { score: 0, ok: false, raison: `Type "${mandatType}" non recherché` };
  return { score: WEIGHTS.type, ok: true, raison: `Type "${mandatType}" recherché` };
}

// ─────────────────────────────────────────────────────────
// Critère 3 : Zone géographique
// La ville/quartier du mandat est-elle dans les zones recherchées ?
// ─────────────────────────────────────────────────────────
function checkZone(mandat, client) {
  const clientZones = arr(client.zones);
  if (clientZones.length === 0) return { score: WEIGHTS.zone, ok: true, raison: null };

  // Construit un blob localisation depuis tous les champs possibles du mandat
  const mandatLoc = norm(
    [mandat.adresse, mandat.ville, mandat.quartier, mandat.arrondissement, mandat.cp, mandat.code_postal]
      .filter(Boolean).join(' ')
  );

  if (!mandatLoc) return { score: 0, ok: false, raison: 'Localisation mandat inconnue' };

  // Match si une zone du client apparaît dans la loc du mandat
  // ou si la zone est "Paris" et l'adresse contient "75"
  const matched = clientZones.find(z => {
    const zNorm = norm(z);
    if (mandatLoc.includes(zNorm)) return true;
    // Cas spéciaux Paris / IDF
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
// Le rendement du mandat atteint-il le rendement minimum du client ?
// ─────────────────────────────────────────────────────────
function checkRendement(mandat, client) {
  const rdt = num(mandat.rendement);
  const min = num(client.rendement_min);

  if (!min) return { score: WEIGHTS.rendement, ok: true, raison: null };
  if (!rdt) return { score: 0, ok: true, raison: 'Rendement mandat inconnu' }; // Pas éliminatoire mais pas de points

  if (rdt < min) {
    // Pénalité dégradée selon l'écart
    const ratio = rdt / min;
    return { score: Math.max(0, Math.round(WEIGHTS.rendement * ratio)), ok: true, raison: `Rendement ${rdt}% < min ${min}%` };
  }

  // Bonus si le rendement dépasse largement le min
  const bonus = rdt > min * 1.2 ? ' (bonus)' : '';
  return { score: WEIGHTS.rendement, ok: true, raison: `Rendement ${rdt}% atteint${bonus}` };
}

// ─────────────────────────────────────────────────────────
// Score total + verdict
// ─────────────────────────────────────────────────────────
function computeMatch(mandat, client) {
  const checks = {
    budget: checkBudget(mandat, client),
    type: checkType(mandat, client),
    zone: checkZone(mandat, client),
    rendement: checkRendement(mandat, client)
  };

  // Si un critère éliminatoire échoue → score 0
  const eliminatoires = ['budget', 'type', 'zone'];
  const failed = eliminatoires.filter(k => !checks[k].ok);

  if (failed.length > 0) {
    return {
      score: 0,
      eligible: false,
      raisons: failed.map(k => checks[k].raison).filter(Boolean)
    };
  }

  // Sinon score = somme pondérée
  const totalWeight = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  const totalScore = Object.values(checks).reduce((acc, c) => acc + (c.score || 0), 0);
  const score = Math.round((totalScore / totalWeight) * 100);

  return {
    score,
    eligible: true,
    raisons: Object.values(checks).map(c => c.raison).filter(Boolean)
  };
}

// ─────────────────────────────────────────────────────────
// EXPORTS PRINCIPAUX
// ─────────────────────────────────────────────────────────

/**
 * Renvoie les mandats actifs qui matchent les critères du client, triés par score desc.
 * @param {Object} client - Une fiche client
 * @param {Array} mandats - Tous les mandats (sera filtré sur les statuts actifs)
 * @returns {Array} [{mandat, score, raisons}, ...]
 */
export function matchMandatsForClient(client, mandats) {
  if (!client || !mandats || !Array.isArray(mandats)) return [];

  const actifs = mandats.filter(m => ACTIVE_MANDAT_STATUTS.includes(m.statut));
  const results = [];

  for (const mandat of actifs) {
    const match = computeMatch(mandat, client);
    if (match.eligible) {
      results.push({ mandat, score: match.score, raisons: match.raisons });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Renvoie les clients qui matchent un mandat donné, triés par score desc.
 * @param {Object} mandat - Une fiche mandat
 * @param {Array} clients - Tous les clients
 * @returns {Array} [{client, score, raisons}, ...]
 */
export function matchClientsForMandat(mandat, clients) {
  if (!mandat || !clients || !Array.isArray(clients)) return [];

  const results = [];
  for (const client of clients) {
    // On ignore les clients qui ne sont pas acquéreurs (typologie acquéreur ou typologie générale)
    // et les clients en statut inactif
    if (client.statut && ['Inactif', 'Perdu'].includes(client.statut)) continue;

    const match = computeMatch(mandat, client);
    if (match.eligible) {
      results.push({ client, score: match.score, raisons: match.raisons });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Pour debug : renvoie le détail d'un match (raisons éliminatoires inclus).
 */
export function debugMatch(mandat, client) {
  return computeMatch(mandat, client);
}
