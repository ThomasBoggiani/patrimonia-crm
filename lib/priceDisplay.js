// ═══════════════════════════════════════════════════════════════════
// lib/priceDisplay.js
// Helpers pour gestion de l'affichage des prix mandats (TTC vs Net Vendeur)
//
// Convention BDD :
//  - `prix`              = prix TTC honoraires inclus (= prix annoncé/affiché)
//  - `prix_net_vendeur`  = prix net vendeur (peut être null/0 si non renseigné)
//  - `honoraires_montant`= montant des honoraires en €
//
// Modes d'affichage :
//  - 'TTC' : prix annoncé (par défaut, vue commerciale)
//  - 'NV'  : net vendeur (vue interne)
//
// Pour les mandats sans `prix_net_vendeur` ni `honoraires_montant` saisis,
// on estime le NV à TTC ÷ 1.05 (commission moyenne 5%).
// ═══════════════════════════════════════════════════════════════════

'use client';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'crm_price_mode';
const DEFAULT_MODE = 'TTC';
const COMMISSION_FALLBACK = 0.05; // 5% si honoraires non renseignés

/**
 * Retourne le prix TTC d'un mandat (= prix annoncé honoraires inclus).
 * @param {object} m - Mandat
 * @returns {number}
 */
export function getPriceTTC(m) {
  return parseFloat(m?.prix) || 0;
}

/**
 * Retourne le prix net vendeur d'un mandat.
 * Priorité 1 : champ `prix_net_vendeur` si rempli
 * Priorité 2 : TTC - honoraires_montant si honoraires connus
 * Priorité 3 : TTC ÷ 1.05 (estimation 5% par défaut)
 * @param {object} m - Mandat
 * @returns {number}
 */
export function getPriceNV(m) {
  if (!m) return 0;
  const stored = parseFloat(m.prix_net_vendeur);
  if (stored && stored > 0) return stored;

  const ttc = getPriceTTC(m);
  if (ttc === 0) return 0;

  const honoraires = parseFloat(m.honoraires_montant);
  if (honoraires && honoraires > 0) return Math.max(0, ttc - honoraires);

  // Fallback : estimation à 5%
  return Math.round(ttc / (1 + COMMISSION_FALLBACK));
}

/**
 * Retourne true si le NV affiché est une estimation (pas une donnée saisie).
 * Utile pour afficher un indicateur "(estimé)" dans l'UI.
 */
export function isNVEstimated(m) {
  if (!m) return false;
  const stored = parseFloat(m.prix_net_vendeur);
  if (stored && stored > 0) return false;
  const honoraires = parseFloat(m.honoraires_montant);
  if (honoraires && honoraires > 0) return false;
  return getPriceTTC(m) > 0; // estimé si on a un TTC mais ni NV ni honoraires
}

/**
 * Retourne le prix à afficher selon le mode actif.
 * @param {object} m - Mandat
 * @param {'TTC'|'NV'} mode
 * @returns {number}
 */
export function getDisplayPrice(m, mode = DEFAULT_MODE) {
  return mode === 'NV' ? getPriceNV(m) : getPriceTTC(m);
}

/**
 * Retourne le label du mode (utile pour les tooltips).
 */
export function getPriceModeLabel(mode) {
  return mode === 'NV' ? 'Net vendeur' : 'TTC honoraires inclus';
}

/**
 * Hook React pour gérer le mode d'affichage de prix avec persistance localStorage.
 * Usage : const [mode, setMode] = usePriceMode();
 */
export function usePriceMode() {
  // SSR-safe init
  const [mode, setMode] = useState(DEFAULT_MODE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'TTC' || saved === 'NV') {
        setMode(saved);
      }
    } catch (e) {
      // localStorage indisponible (mode privé Safari, etc.) → on garde DEFAULT_MODE
    }
    setHydrated(true);
  }, []);

  const updateMode = (m) => {
    if (m !== 'TTC' && m !== 'NV') return;
    setMode(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch (e) {
      // ignore : le state local est mis à jour de toute façon
    }
  };

  return [mode, updateMode, hydrated];
}
