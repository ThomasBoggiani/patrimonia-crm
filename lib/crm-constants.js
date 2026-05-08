// lib/crm-constants.js
// Constantes et helpers partagés du CRM
// Extraits de components/CRM.jsx (mai 2026) pour réduire la taille du fichier principal

// ─────────────────────────────────────────────────────────
// Helpers de formatage prix (€)
// ─────────────────────────────────────────────────────────
export const eurFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export function formatPrix(n) {
  const num = parseFloat(n);
  if (!Number.isFinite(num) || num === 0) return '—';
  return eurFormatter.format(num);
}

export function formatPrixCompact(n) {
  const num = parseFloat(n);
  if (!Number.isFinite(num) || num === 0) return '—';
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace('.', ',') + ' M€';
  }
  if (num >= 1_000) {
    return Math.round(num / 1_000) + ' k€';
  }
  return eurFormatter.format(num);
}

// ─────────────────────────────────────────────────────────
// Conversion snake_case ↔ camelCase pour Supabase
// ─────────────────────────────────────────────────────────
export const toCamel = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamel);
  const result = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result;
};

export const toSnake = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toSnake);
  const result = {};
  for (const key in obj) {
    if (key === 'id') { result.id = obj.id; continue; }
    const snakeKey = key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
    result[snakeKey] = obj[key];
  }
  return result;
};

// ─────────────────────────────────────────────────────────
// Détection des managers (TE / TB)
// ─────────────────────────────────────────────────────────
export function isManager(profile) {
  if (!profile) return false;
  if (profile.role === 'admin' || profile.role === 'directeur') return true;
  if (profile.prenom === 'Thomas' && (profile.nom === 'Ezquerra' || profile.nom === 'Boggiani')) return true;
  return false;
}

// ─────────────────────────────────────────────────────────
// Helpers DPE
// ─────────────────────────────────────────────────────────
export function getDPEClass(conso) {
  if (!conso) return null;
  const c = parseFloat(conso);
  if (c <= 70) return 'A';
  if (c <= 110) return 'B';
  if (c <= 180) return 'C';
  if (c <= 250) return 'D';
  if (c <= 330) return 'E';
  if (c <= 420) return 'F';
  return 'G';
}

export function getDPEColor(conso) {
  const cls = getDPEClass(conso);
  return {
    'A': '#00A651', 'B': '#52B847', 'C': '#A6CE39', 'D': '#F9C20B',
    'E': '#F58220', 'F': '#E94E1B', 'G': '#C8102E',
  }[cls] || '#9CA3AF';
}

// ─────────────────────────────────────────────────────────
// CONSTANTES MÉTIER
// ─────────────────────────────────────────────────────────
export const STATUTS_MANDAT = ['Sourcing', 'Analyse', 'Mandat signé', 'Commercialisation', 'Offre', 'Promesse', 'Acte', 'Vendu par autres', 'Perdu'];

export const STATUTS_DEAL = ['À proposer', 'Envoyé', 'En étude', 'Visite', 'Offre', 'Refusé', 'Gagné', 'Perdu'];

export const TYPES_ACTIF = [
  "Immeuble d'habitation", 'Immeuble mixte', 'Immeuble tertiaire',
  'Local commercial', "Local d'activité",
  'Hôtel', 'Hébergement hôtelier',
  'Appartement', 'Maison', 'Studio',
  'Terrain', 'Bureau', 'Promotion immobilière'
];

export const TYPOLOGIES_CLIENT = ['Foncières', 'Marchands de biens', 'Particuliers', 'Fonds', 'Promoteurs', 'Family Office'];

export const ZONES = [
  'Paris 3e', 'Paris 4e', 'Paris 8e', 'Paris 9e', 'Paris 10e',
  'Paris 11e', 'Paris 13e', 'Paris 15e', 'Paris 16e', 'Paris 17e',
  'Paris 18e', 'Paris 19e', 'Paris 20e',
  'Hauts-de-Seine (92)', 'Seine-Saint-Denis (93)', 'Val-de-Marne (94)', "Val-d'Oise (95)",
  'Yvelines (78)', 'Seine-et-Marne (77)', 'Essonne (91)',
  'Province',
  'France entière'
];

export const PORTAILS = ['seloger', 'leboncoin', 'bienici', 'figaro'];

export const STATUTS_PORTAIL = ['En ligne', 'En attente', 'À corriger', 'Non diffusé'];
