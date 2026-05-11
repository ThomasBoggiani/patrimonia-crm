// lib/crm-constants.js
// Constantes et helpers partagés du CRM

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

// ─────────────────────────────────────────────────────────
// MARCHÉS (B2B vs B2C)
// ─────────────────────────────────────────────────────────
export const MARCHES = ['Investissement (B2B)', 'Habitation (B2C)'];

// ─────────────────────────────────────────────────────────
// ARBORESCENCE B2B - INVESTISSEMENT (mandats pro)
// Famille -> [sous-types] (vide = pas de sous-type)
// ─────────────────────────────────────────────────────────
export const TYPES_ACTIF_B2B_TREE = {
  'Immeubles': ['Immeuble d\'habitation', 'Mixte', 'Commercial'],
  'Hôtels': ['Hébergements hôteliers', 'Hôtels classiques', 'Sociaux'],
  'Terrains': [],
  'Parking': [],
  'Locaux commerciaux': ['Bureaux', 'Boutiques', 'Retails Park']
};
export const TYPES_ACTIF_B2B_FAMILLES = Object.keys(TYPES_ACTIF_B2B_TREE);

// ─────────────────────────────────────────────────────────
// ARBORESCENCE B2C - HABITATION (achat/vente résidentiel particulier)
// Pas de cascade : juste une liste de types
// ─────────────────────────────────────────────────────────
export const TYPES_HABITATION_B2C = ['Appartement', 'Maison', 'Hôtel particulier'];

// ─────────────────────────────────────────────────────────
// LISTE PLATE - rétrocompatibilité avec données existantes en BDD
// ─────────────────────────────────────────────────────────
export const TYPES_ACTIF = [
  ...TYPES_ACTIF_B2B_FAMILLES,
  ...Object.values(TYPES_ACTIF_B2B_TREE).flat(),
  ...TYPES_HABITATION_B2C
];

// ─────────────────────────────────────────────────────────
// ARBORESCENCE TYPOLOGIES CLIENTS (investisseur)
// ─────────────────────────────────────────────────────────
export const TYPOLOGIES_CLIENT_TREE = {
  'Foncières': ['Privées', 'Publiques'],
  'Marchands de biens': [],
  'Particuliers': [],
  'Fonds': [],
  'Promoteurs': [],
  'Family Office': []
};
export const TYPOLOGIES_CLIENT = Object.keys(TYPOLOGIES_CLIENT_TREE);

// ─────────────────────────────────────────────────────────
// SOUS-TYPOLOGIES CLIENT (B2B uniquement)
// Quand la typologie principale a des sous-catégories
// ─────────────────────────────────────────────────────────
export const SOUS_TYPOLOGIES_CLIENT = {
  'Foncières': ['Privées', 'Publiques'],
};

export function clientHasSousTypologie(typologie) {
  return Array.isArray(SOUS_TYPOLOGIES_CLIENT[typologie]) && SOUS_TYPOLOGIES_CLIENT[typologie].length > 0;
}

export function getSousTypologiesForClient(typologie) {
  return SOUS_TYPOLOGIES_CLIENT[typologie] || [];
}

// ─────────────────────────────────────────────────────────
// MARCHÉ CLIENT (B2B / B2C) déduit de la typologie
// ─────────────────────────────────────────────────────────
const TYPOLOGIES_B2C = ['Particuliers'];
const TYPOLOGIES_B2B = ['Foncières', 'Marchands de biens', 'Fonds', 'Promoteurs', 'Family Office'];

export function getMarcheFromTypologieClient(typologie) {
  if (!typologie) return null;
  if (TYPOLOGIES_B2C.includes(typologie)) return 'b2c';
  if (TYPOLOGIES_B2B.includes(typologie)) return 'b2b';
  return null;
}

// ─────────────────────────────────────────────────────────
// Helpers d'affichage : sépare les typologies_recherchees
// (text[] à plat) en groupes lisibles selon le marché
// ─────────────────────────────────────────────────────────
export function groupTypologiesRecherchees(typologiesArray, marche) {
  const items = Array.isArray(typologiesArray) ? typologiesArray : [];
  if (items.length === 0) return { types: [], groupes: [], pieces: [] };

  if (marche === 'b2c') {
    const types = items.filter(t => ['Appartement', 'Maison', 'Hôtel particulier'].includes(t));
    const pieces = items.filter(t => ['Studio / T1', 'T2', 'T3', 'T4', 'T5', 'T6+'].includes(t));
    return { types, groupes: [], pieces };
  }

  // B2B : on regroupe par famille
  const familles = Object.keys(TYPES_ACTIF_B2B_TREE);
  const groupes = [];
  for (const fam of familles) {
    if (items.includes(fam)) {
      const sousTypes = getSousTypesForFamille(TYPES_ACTIF_B2B_TREE, fam).filter(st => items.includes(st));
      groupes.push({ famille: fam, sousTypes });
    }
  }
  // Items qui ne sont ni famille ni sous-type connu (legacy)
  const allKnown = familles.flatMap(f => [f, ...getSousTypesForFamille(TYPES_ACTIF_B2B_TREE, f)]);
  const legacy = items.filter(t => !allKnown.includes(t));
  return { types: legacy, groupes, pieces: [] };
}

// ─────────────────────────────────────────────────────────
// NB PIÈCES (multiselect possible)
// ─────────────────────────────────────────────────────────
export const NB_PIECES = ['Studio / T1', 'T2', 'T3', 'T4', 'T5', 'T6+'];

// ─────────────────────────────────────────────────────────
// Helpers cascade
// ─────────────────────────────────────────────────────────
export function getSousTypesForFamille(famille, tree = TYPES_ACTIF_B2B_TREE) {
  if (!famille || !tree[famille]) return [];
  return tree[famille];
}

export function familleHasSousTypes(famille, tree = TYPES_ACTIF_B2B_TREE) {
  return Array.isArray(tree[famille]) && tree[famille].length > 0;
}

// ─────────────────────────────────────────────────────────
// AUTRES CONSTANTES
// ─────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────
// HELPERS MÉDIAS — Compat legacy (photos → medias)
// 
// Permet à tout le code existant de fonctionner avec ou sans
// la migration vers le nouveau format `medias` (jsonb).
// 
// Format `medias` : tableau d'objets typés
//   { type: 'photo' | 'plan' | 'video' | 'visite_virtuelle',
//     url: string, ordre?: number, cover?: boolean, nom?: string }
// ─────────────────────────────────────────────────────────

/**
 * Retourne les photos d'un mandat, triées (cover en premier, puis par ordre).
 * Lit depuis `medias` si disponible, fallback sur `photos` legacy.
 */
export function getPhotos(mandat) {
  if (!mandat) return [];
  // Nouveau système : on lit depuis medias
  if (Array.isArray(mandat.medias) && mandat.medias.length > 0) {
    return mandat.medias
      .filter(m => m && m.type === 'photo')
      .sort((a, b) => {
        if (a.cover && !b.cover) return -1;
        if (b.cover && !a.cover) return 1;
        return (a.ordre || 0) - (b.ordre || 0);
      });
  }
  // Fallback legacy : on lit depuis photos
  if (Array.isArray(mandat.photos)) {
    return mandat.photos.map(p => (typeof p === 'string' ? { url: p } : p)).filter(p => p && p.url);
  }
  return [];
}

/**
 * Retourne l'URL de la photo de couverture (ou null).
 */
export function getCoverPhoto(mandat) {
  const photos = getPhotos(mandat);
  if (photos.length === 0) return null;
  const cover = photos.find(p => p.cover);
  return (cover || photos[0]).url || null;
}

/**
 * Retourne les plans (uniquement depuis medias).
 */
export function getPlans(mandat) {
  if (!mandat || !Array.isArray(mandat.medias)) return [];
  return mandat.medias.filter(m => m && m.type === 'plan');
}

/**
 * Retourne les vidéos (uniquement depuis medias).
 */
export function getVideos(mandat) {
  if (!mandat || !Array.isArray(mandat.medias)) return [];
  return mandat.medias.filter(m => m && m.type === 'video');
}

/**
 * Retourne les liens de visites virtuelles (uniquement depuis medias).
 */
export function getVisitesVirtuelles(mandat) {
  if (!mandat || !Array.isArray(mandat.medias)) return [];
  return mandat.medias.filter(m => m && m.type === 'visite_virtuelle');
}

/**
 * Construit le tableau medias à partir des helpers (utilisé à la sauvegarde).
 * Ré-écrit les `ordre` et garantit qu'il n'y a qu'une seule `cover`.
 */
export function buildMediasArray({ photos = [], plans = [], videos = [], visitesVirtuelles = [] } = {}) {
  const out = [];

  // Photos : on garantit qu'il y a une cover (la première si aucune)
  let hasCover = photos.some(p => p && p.cover);
  photos.forEach((p, i) => {
    if (!p || !p.url) return;
    out.push({
      type: 'photo',
      url: p.url,
      ordre: i,
      cover: hasCover ? !!p.cover : i === 0,
      ...(p.nom ? { nom: p.nom } : {}),
    });
    if (!hasCover && i === 0) hasCover = true;
  });

  plans.forEach((p, i) => {
    if (!p || !p.url) return;
    out.push({ type: 'plan', url: p.url, ordre: i, ...(p.nom ? { nom: p.nom } : {}) });
  });

  videos.forEach((v, i) => {
    if (!v || !v.url) return;
    out.push({ type: 'video', url: v.url, ordre: i, ...(v.nom ? { nom: v.nom } : {}) });
  });

  visitesVirtuelles.forEach((v, i) => {
    if (!v || !v.url) return;
    out.push({ type: 'visite_virtuelle', url: v.url, ordre: i, ...(v.nom ? { nom: v.nom } : {}) });
  });

  return out;
}
