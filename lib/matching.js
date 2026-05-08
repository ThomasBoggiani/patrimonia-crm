// lib/matching.js
// Algorithme de matching client ↔ mandat.
// Score 0-100 + raisons textuelles. Critères éliminatoires + critères souples.

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
// Helper : déduit le marché (b2b/b2c) d'un mandat ou client
// ─────────────────────────────────────────────────────────
function inferMarcheFromMandat(mandat) {
  if (mandat.marche) return mandat.marche;
  // Pas de marché défini → on déduit du type
  if (B2C_TYPES.includes(mandat.type)) return 'b2c';
  if (B2B_FAMILLES.includes(mandat.type) || B2B_SOUS_TYPES.includes(mandat.type)) return 'b2b';
  return null; // Marché indéterminé
}

function inferMarcheFromClient(client) {
  if (client.marche) return client.marche;
  // Si typologie = "Particuliers" et types_recherchees contient B2C → b2c
  const typesCherches = arr(client.typologies_recherchees);
  const hasB2C = typesCherches.some(t => B2C_TYPES.includes(t));
  const hasB2B = typesCherches.some(t => B2B_FAMILLES.includes(t) || B2B_SOUS_TYPES.includes(t));
  if (hasB2C && !hasB2B) return 'b2c';
  if (hasB2B && !hasB2C) return 'b2b';
  // Indéterminé → on accepte les 2
  return null;
}

// ─────────────────────────────────────────────────────────
// Critère 0 : Marché B2B/B2C (éliminatoire)
// Un client B2C ne peut pas matcher un mandat B2B (et vice-versa)
// ─────────────────────────────────────────────────────────
function checkMarche(mandat, client) {
  const mandatMarche = inferMarcheFromMandat(mandat);
  const clientMarche = inferMarcheFromClient(client);

  // Si l'un des deux est indéterminé → on accepte (compatibilité)
  if (!mandatMarche || !clientMarche) {
    return { score: 0, ok: true, raison: null };
  }

  // Conflit explicite : B2B vs B2C
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
  const min = num(client.budget_min);
  const max = num(client.budget_max);

  if (!prix) return { score: 0, ok: false, raison: 'Prix mandat inconnu' };
  if (!min && !max) return { score: WEIGHTS.budget, ok: true, raison: null };

  if (min && prix < min) return { score: 0, ok: false, raison: `Prix trop bas (${(prix/1e6).toFixed(1)}M€ < ${(min/1e6).toFixed(1)}M€)` };
  if (max && prix > max) return { score: 0, ok: false, raison: `Prix trop élevé (${(prix/1e6).toFixed(1)}M€ > ${(max/1e6).toFixed(1)}M€)` };

  return { score: WEIGHTS.budget, ok: true, raison: `Budget OK (${(prix/1e6).toFixed(1)}M€)` };
}

// ─────────────────────────────────────────────────────────
// Critère 2 : Type d'actif
// Compare le type ET le sous-type du mandat aux typologies recherchées du client
// ─────────────────────────────────────────────────────────
function checkType(mandat, client) {
  const mandatType = mandat.type;
  const mandatSousType = mandat.sous_type || mandat.sousType;
  const clientTypes = arr(client.typologies_recherchees);

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

  // Cas spécial : si le client cherche "France entière", tout match
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
  const rdt = num(mandat.rendement);
  const min = num(client.rendement_min);

  if (!min) return { score: WEIGHTS.rendement, ok: true, raison: null };
  if (!rdt) return { score: 0, ok: true, raison: 'Rendement mandat inconnu' };

  if (rdt < min) {
    const ratio = rdt / min;
    return { score: Math.max(0, Math.round(WEIGHTS.rendement * ratio)), ok: true, raison: `Rendement ${rdt}% < min ${min}%` };
  }

  const bonus = rdt > min * 1.2 ? ' (bonus)' : '';
  return { score: WEIGHTS.rendement, ok: true, raison: `Rendement ${rdt}% atteint${bonus}` };
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

  // Si un critère éliminatoire échoue → score 0
  const eliminatoires = ['marche', 'budget', 'type', 'zone'];
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
  const score = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;

  return {
    score,
    eligible: true,
    raisons: Object.values(checks).map(c => c.raison).filter(Boolean)
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
      results.push({ mandat, score: match.score, raisons: match.raisons });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

export function matchClientsForMandat(mandat, clients) {
  if (!mandat || !clients || !Array.isArray(clients)) return [];

  const results = [];
  for (const client of clients) {
    if (client.statut && ['Inactif', 'Perdu'].includes(client.statut)) continue;

    const match = computeMatch(mandat, client);
    if (match.eligible) {
      results.push({ client, score: match.score, raisons: match.raisons });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

export function debugMatch(mandat, client) {
  return computeMatch(mandat, client);
}

// Exports utiles pour d'autres modules
export { inferMarcheFromMandat, inferMarcheFromClient };
