// ═══════════════════════════════════════════════════════════════════
// lib/rendements.js
// Helper de calcul des rendements (actuel + optimisé) avec override
// ═══════════════════════════════════════════════════════════════════

/**
 * Calcule le rendement actuel et optimisé d'un mandat
 * 
 * Priorité :
 * 1. Si rendement_*_override est défini → utilise l'override (saisie manuelle agent)
 * 2. Sinon → calcule depuis etat_locatif (somme loyers × 12 / prix_net × 100)
 * 3. Sinon → fallback sur mandat.rendement / mandat.rendementOptimise (legacy)
 * 
 * @param {Object} mandat - L'objet mandat (camelCase ou snake_case)
 * @returns {{ actuel: number|null, optimise: number|null, hasLots: boolean }}
 */
export function computeRendements(mandat) {
  if (!mandat) return { actuel: null, optimise: null, hasLots: false };

  // Compatibilité camelCase / snake_case
  const lots = mandat.etat_locatif || mandat.etatLocatif || [];
  const hasLots = Array.isArray(lots) && lots.length > 0;

  // Prix net vendeur (priorité au champ explicite, fallback sur calcul depuis honoraires)
  const prixNet = parseFloat(
    mandat.prix_net_vendeur || mandat.prixNetVendeur || mandat.prix || 0
  );

  // ─── Calcul depuis les lots ───
  let calcActuel = null;
  let calcOptimise = null;

  if (hasLots && prixNet > 0) {
    let totalLoyer = 0;
    let totalLoyerOpt = 0;
    let hasLoyer = false;
    let hasLoyerOpt = false;

    for (const lot of lots) {
      const loyer = parseFloat(lot.loyer || 0);
      const loyerOpt = parseFloat(lot.loyer_potentiel || lot.loyerPotentiel || lot.loyer_optimise || lot.loyerOptimise || 0);

      if (loyer > 0) {
        totalLoyer += loyer;
        hasLoyer = true;
      }
      // Pour le potentiel : si lot a un loyer_optimisé → on prend, sinon on prend le loyer actuel
      if (loyerOpt > 0) {
        totalLoyerOpt += loyerOpt;
        hasLoyerOpt = true;
      } else if (loyer > 0) {
        totalLoyerOpt += loyer;
        hasLoyerOpt = true;
      }
    }

    // Lots = loyers MENSUELS → ×12 pour annuel
    if (hasLoyer) calcActuel = Math.round((totalLoyer * 12 / prixNet) * 1000) / 10;
    if (hasLoyerOpt) calcOptimise = Math.round((totalLoyerOpt * 12 / prixNet) * 1000) / 10;
  }

  // ─── Override prioritaire ───
  const overrideActuel = mandat.rendement_actuel_override ?? mandat.rendementActuelOverride;
  const overrideOptimise = mandat.rendement_optimise_override ?? mandat.rendementOptimiseOverride;

  // ─── Fallback legacy (champs rendement existants) ───
  const legacyActuel = parseFloat(mandat.rendement || 0) || null;
  const legacyOptimise = parseFloat(mandat.rendement_optimise || mandat.rendementOptimise || 0) || null;

  // Sélection finale : override > calc lots > legacy
  const actuel = overrideActuel != null && overrideActuel !== ''
    ? parseFloat(overrideActuel)
    : (calcActuel != null ? calcActuel : legacyActuel);

  const optimise = overrideOptimise != null && overrideOptimise !== ''
    ? parseFloat(overrideOptimise)
    : (calcOptimise != null ? calcOptimise : legacyOptimise);

  return { actuel, optimise, hasLots };
}

/**
 * Calcule juste les valeurs auto (sans override) pour pré-remplir les placeholders du formulaire
 * @param {Object} mandat
 * @returns {{ actuel: number|null, optimise: number|null }}
 */
export function computeRendementsAuto(mandat) {
  if (!mandat) return { actuel: null, optimise: null };

  const lots = mandat.etat_locatif || mandat.etatLocatif || [];
  if (!Array.isArray(lots) || lots.length === 0) return { actuel: null, optimise: null };

  const prixNet = parseFloat(mandat.prix_net_vendeur || mandat.prixNetVendeur || mandat.prix || 0);
  if (prixNet <= 0) return { actuel: null, optimise: null };

  let totalLoyer = 0;
  let totalLoyerOpt = 0;
  let hasLoyer = false;
  let hasLoyerOpt = false;

  for (const lot of lots) {
    const loyer = parseFloat(lot.loyer || 0);
    const loyerOpt = parseFloat(lot.loyer_potentiel || lot.loyerPotentiel || lot.loyer_optimise || lot.loyerOptimise || 0);
    if (loyer > 0) { totalLoyer += loyer; hasLoyer = true; }
    if (loyerOpt > 0) { totalLoyerOpt += loyerOpt; hasLoyerOpt = true; }
    else if (loyer > 0) { totalLoyerOpt += loyer; hasLoyerOpt = true; }
  }

  return {
    actuel: hasLoyer ? Math.round((totalLoyer * 12 / prixNet) * 1000) / 10 : null,
    optimise: hasLoyerOpt ? Math.round((totalLoyerOpt * 12 / prixNet) * 1000) / 10 : null,
  };
}

/**
 * Calcule le total des loyers mensuels (actuels) à partir des lots
 */
export function totalLoyerMensuel(lots) {
  if (!Array.isArray(lots)) return 0;
  return lots.reduce((sum, lot) => sum + (parseFloat(lot.loyer) || 0), 0);
}

/**
 * Calcule le total des loyers mensuels optimisés
 */
export function totalLoyerMensuelOptimise(lots) {
  if (!Array.isArray(lots)) return 0;
  return lots.reduce((sum, lot) => {
    const opt = parseFloat(lot.loyer_optimise || lot.loyerOptimise || 0);
    return sum + (opt > 0 ? opt : (parseFloat(lot.loyer) || 0));
  }, 0);
}

/**
 * Calcule le total des surfaces
 */
export function totalSurface(lots) {
  if (!Array.isArray(lots)) return 0;
  return lots.reduce((sum, lot) => sum + (parseFloat(lot.surface) || 0), 0);
}

/**
 * Nombre de lots loués / libres
 */
export function comptageStatuts(lots) {
  if (!Array.isArray(lots)) return { loues: 0, libres: 0, total: 0 };
  const total = lots.length;
  const loues = lots.filter(l => l.statut === 'loué' || l.statut === 'loue').length;
  const libres = total - loues;
  return { loues, libres, total };
}
