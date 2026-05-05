// ═══════════════════════════════════════════════════════════════════
// lib/priceDisplay.js
// Helpers pour gestion des prix mandats
//
// Convention BDD :
//  - `prix`              = prix TTC honoraires inclus (= prix annoncé/affiché)
//  - `prix_net_vendeur`  = prix net vendeur (peut être null/0 si non renseigné)
//  - `honoraires_montant`= montant des honoraires en €
//
// Pour les mandats sans `prix_net_vendeur` ni `honoraires_montant` saisis,
// on estime à TTC ÷ 1.05 (commission moyenne 5%).
// ═══════════════════════════════════════════════════════════════════

const COMMISSION_FALLBACK = 0.05; // 5% si honoraires non renseignés

/**
 * Retourne le prix TTC d'un mandat (= prix annoncé honoraires inclus).
 */
export function getPriceTTC(m) {
  return parseFloat(m?.prix) || 0;
}

/**
 * Retourne le prix net vendeur.
 * Priorité : champ `prix_net_vendeur` > calcul TTC - honoraires_montant > estimation 5%
 */
export function getPriceNV(m) {
  if (!m) return 0;
  const stored = parseFloat(m.prix_net_vendeur);
  if (stored && stored > 0) return stored;

  const ttc = getPriceTTC(m);
  if (ttc === 0) return 0;

  const honoraires = parseFloat(m.honoraires_montant);
  if (honoraires && honoraires > 0) return Math.max(0, ttc - honoraires);

  return Math.round(ttc / (1 + COMMISSION_FALLBACK));
}

/**
 * Retourne true si le NV affiché est une estimation (pas une donnée saisie).
 */
export function isNVEstimated(m) {
  if (!m) return false;
  const stored = parseFloat(m.prix_net_vendeur);
  if (stored && stored > 0) return false;
  const honoraires = parseFloat(m.honoraires_montant);
  if (honoraires && honoraires > 0) return false;
  return getPriceTTC(m) > 0;
}

/**
 * Retourne la commission agence d'un mandat.
 * Cascade : honoraires_montant saisi > prix - prix_net_vendeur > estimation 5% TTC
 */
export function getCommission(m) {
  if (!m) return 0;
  const stored = parseFloat(m.honoraires_montant);
  if (stored && stored > 0) return stored;

  const ttc = getPriceTTC(m);
  if (ttc === 0) return 0;

  const nv = parseFloat(m.prix_net_vendeur);
  if (nv && nv > 0 && nv < ttc) return Math.max(0, ttc - nv);

  return Math.round(ttc * COMMISSION_FALLBACK / (1 + COMMISSION_FALLBACK));
}

/**
 * Retourne true si la commission affichée est une estimation.
 */
export function isCommissionEstimated(m) {
  if (!m) return false;
  const stored = parseFloat(m.honoraires_montant);
  if (stored && stored > 0) return false;
  const nv = parseFloat(m.prix_net_vendeur);
  const ttc = getPriceTTC(m);
  if (nv && nv > 0 && nv < ttc) return false;
  return ttc > 0;
}
