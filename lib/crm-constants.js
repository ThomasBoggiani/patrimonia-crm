// lib/crm-constants.js
// Constantes et helpers partagés du CRM
// VERSION : Taxonomie unifiée (Lot D)

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
  if (profile.role === 'Admin' || profile.role === 'directeur') return true;
  if (profile.prenom === 'Thomas' && (profile.nom === 'Ezquerra' || profile.nom === 'Boggiani')) return true;
  return false;
}

// ─────────────────────────────────────────────────────────
// Détection des viewers (accès consultation seule)
// ─────────────────────────────────────────────────────────
export function isViewer(profile) {
  if (!profile) return false;
  return profile.role === 'Viewer';
}

// ─────────────────────────────────────────────────────────
// Helper central : l'utilisateur peut-il créer/modifier ?
// À utiliser PARTOUT à la place de checks role manuels
// ─────────────────────────────────────────────────────────
export function canEdit(profile) {
  if (!profile) return false;
  return !isViewer(profile);
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
// TAXONOMIE UNIFIÉE - Famille → [sous-types]
// Une seule arborescence pour B2B et B2C
// "Résidentiel" est la famille B2C, les autres sont B2B
// ─────────────────────────────────────────────────────────
export const TYPES_ACTIF_TREE = {
  'Immeubles': ['Mixte', 'Commercial', 'Habitation'],
  'Hôtels': ['Hébergements hôteliers', 'Hôtels classiques', 'Sociaux'],
  'Résidentiel': ['Appartements', 'Maison', 'Hôtels particuliers'],
  'Terrains': [],
  'Parking': [],
  'Locaux commerciaux': ['Bureaux', 'Boutiques', 'Retails Park']
};
export const TYPES_ACTIF_FAMILLES = Object.keys(TYPES_ACTIF_TREE);

// Alias rétrocompatibilité (l'ancien nom est encore utilisé dans certains imports)
export const TYPES_ACTIF_B2B_TREE = TYPES_ACTIF_TREE;
export const TYPES_ACTIF_B2B_FAMILLES = TYPES_ACTIF_FAMILLES;

// Familles considérées comme B2C (déduction auto du marché)
export const FAMILLES_B2C = ['Résidentiel'];

// Helper : déduit le marché depuis la famille
export function getMarcheFromFamille(famille) {
  if (!famille) return null;
  return FAMILLES_B2C.includes(famille) ? 'b2c' : 'b2b';
}

// ─────────────────────────────────────────────────────────
// Rétrocompat : ancienne liste plate B2C
// ─────────────────────────────────────────────────────────
export const TYPES_HABITATION_B2C = TYPES_ACTIF_TREE['Résidentiel'];

// ─────────────────────────────────────────────────────────
// LISTE PLATE - rétrocompatibilité avec données existantes en BDD
// ─────────────────────────────────────────────────────────
export const TYPES_ACTIF = [
  ...TYPES_ACTIF_FAMILLES,
  ...Object.values(TYPES_ACTIF_TREE).flat()
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
    // En B2C, les "types" sont les sous-types de la famille Résidentiel
    const sousResidentiel = TYPES_ACTIF_TREE['Résidentiel'];
    const types = items.filter(t => sousResidentiel.includes(t));
    const pieces = items.filter(t => ['Studio / T1', 'T2', 'T3', 'T4', 'T5', 'T6+'].includes(t));
    return { types, groupes: [], pieces };
  }

  // B2B : on regroupe par famille (sauf Résidentiel qui est B2C)
  const familles = TYPES_ACTIF_FAMILLES.filter(f => !FAMILLES_B2C.includes(f));
  const groupes = [];
  for (const fam of familles) {
    if (items.includes(fam)) {
      const sousTypes = (TYPES_ACTIF_TREE[fam] || []).filter(st => items.includes(st));
      groupes.push({ famille: fam, sousTypes });
    }
  }
  // Items qui ne sont ni famille ni sous-type connu (legacy)
  const allKnown = familles.flatMap(f => [f, ...(TYPES_ACTIF_TREE[f] || [])]);
  const legacy = items.filter(t => !allKnown.includes(t));
  return { types: legacy, groupes, pieces: [] };
}

// ─────────────────────────────────────────────────────────
// NB PIÈCES (multiselect possible)
// ─────────────────────────────────────────────────────────
export const NB_PIECES = ['Studio / T1', 'T2', 'T3', 'T4', 'T5', 'T6+'];

// ─────────────────────────────────────────────────────────
// Helpers cascade
// Signature : (tree, famille) OU (famille) avec tree par défaut
// On accepte les 2 ordres d'arguments pour rétrocompatibilité
// ─────────────────────────────────────────────────────────
export function getSousTypesForFamille(treeOrFamille, familleMaybe) {
  // Si premier arg est un objet (tree), 2e arg est la famille
  if (treeOrFamille && typeof treeOrFamille === 'object' && !Array.isArray(treeOrFamille)) {
    const famille = familleMaybe;
    if (!famille || !treeOrFamille[famille]) return [];
    return treeOrFamille[famille];
  }
  // Sinon, premier arg est la famille, on utilise le tree par défaut
  const famille = treeOrFamille;
  if (!famille || !TYPES_ACTIF_TREE[famille]) return [];
  return TYPES_ACTIF_TREE[famille];
}

export function familleHasSousTypes(treeOrFamille, familleMaybe) {
  if (treeOrFamille && typeof treeOrFamille === 'object' && !Array.isArray(treeOrFamille)) {
    const famille = familleMaybe;
    return Array.isArray(treeOrFamille[famille]) && treeOrFamille[famille].length > 0;
  }
  const famille = treeOrFamille;
  return Array.isArray(TYPES_ACTIF_TREE[famille]) && TYPES_ACTIF_TREE[famille].length > 0;
}

// ─────────────────────────────────────────────────────────
// LABEL d'affichage du type d'un mandat
// Renvoie le sous-type si présent, sinon famille ou '—'
// Gère le cas spécial Appartement + nb_pieces=1 → "Studio"
// ─────────────────────────────────────────────────────────
export function getTypeLabel(mandat) {
  if (!mandat) return '—';
  const sousType = mandat.sousType || mandat.sous_type;
  const famille = mandat.type;
  const nbPieces = parseInt(mandat.nbPieces || mandat.nb_pieces) || 0;

  // Cas spécial : Appartement(s) + 1 pièce → Studio
  if (sousType === 'Appartements' && nbPieces === 1) return 'Studio';

  if (sousType) return sousType;
  // Si famille sans sous-type (Terrains, Parking)
  if (famille && (!TYPES_ACTIF_TREE[famille] || TYPES_ACTIF_TREE[famille].length === 0)) {
    return famille;
  }
  return '—';
}

// ─────────────────────────────────────────────────────────
// CATÉGORIES CONTACT (nature du contact, indépendamment du rôle)
// Aligné sur la contrainte CHECK BDD : contacts.categorie
// ─────────────────────────────────────────────────────────
export const CATEGORIES_CONTACT = [
  { value: 'particulier',   label: 'Particulier',           desc: 'Personne physique' },
  { value: 'agence',        label: 'Agence immobilière',    desc: 'Partenaire en mandat de recherche ou apport' },
  { value: 'notaire',       label: 'Notaire',               desc: 'Office notarial' },
  { value: 'family_office', label: 'Family Office',         desc: 'Gestionnaire de patrimoine familial' },
  { value: 'fonciere',      label: 'Foncière',              desc: 'Société d\'investissement immobilier' },
  { value: 'mdb',           label: 'Marchand de biens',     desc: 'Achat-revente professionnel' },
  { value: 'apporteur',     label: 'Apporteur d\'affaires', desc: 'Indépendant ou consultant' },
  { value: 'autre',         label: 'Autre',                 desc: '' },
];

// Helper d'affichage : retourne le label depuis la value
export function getCategorieLabel(value) {
  const found = CATEGORIES_CONTACT.find(c => c.value === value);
  return found ? found.label : value || '—';
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
// ─────────────────────────────────────────────────────────

export function getPhotos(mandat) {
  if (!mandat) return [];
  if (Array.isArray(mandat.medias) && mandat.medias.length > 0) {
    return mandat.medias
      .filter(m => m && m.type === 'photo')
      .sort((a, b) => {
        if (a.cover && !b.cover) return -1;
        if (b.cover && !a.cover) return 1;
        return (a.ordre || 0) - (b.ordre || 0);
      });
  }
  if (Array.isArray(mandat.photos)) {
    return mandat.photos.map(p => (typeof p === 'string' ? { url: p } : p)).filter(p => p && p.url);
  }
  return [];
}

export function getCoverPhoto(mandat) {
  const photos = getPhotos(mandat);
  if (photos.length === 0) return null;
  const cover = photos.find(p => p.cover);
  return (cover || photos[0]).url || null;
}

export function getPlans(mandat) {
  if (!mandat || !Array.isArray(mandat.medias)) return [];
  return mandat.medias.filter(m => m && m.type === 'plan');
}

export function getVideos(mandat) {
  if (!mandat || !Array.isArray(mandat.medias)) return [];
  return mandat.medias.filter(m => m && m.type === 'video');
}

export function getVisitesVirtuelles(mandat) {
  if (!mandat || !Array.isArray(mandat.medias)) return [];
  return mandat.medias.filter(m => m && (m.type === 'virtual_tour' || m.type === 'visite_virtuelle'));
}

export function buildMediasArray({ photos = [], plans = [], videos = [], visitesVirtuelles = [] } = {}) {
  const out = [];
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
