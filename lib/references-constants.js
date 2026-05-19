// ═══════════════════════════════════════════════════════════════════
// lib/references-constants.js
// Constantes pour la bibliothèque de références de ventes
// ═══════════════════════════════════════════════════════════════════

// 8 typologies (multi-select : un bien peut être à la fois mixte + tertiaire)
export const TYPOLOGIES_REFERENCE = [
  { value: 'habitation',       label: "Immeuble d'habitation",        icon: '🏠' },
  { value: 'mixte',            label: 'Immeuble mixte',                icon: '🏢' },
  { value: 'tertiaire',        label: 'Immeuble tertiaire (bureaux)',  icon: '🏬' },
  { value: 'commercial',       label: 'Immeuble commercial',           icon: '🏪' },
  { value: 'hotel',            label: 'Hôtel',                          icon: '🏨' },
  { value: 'hotel_particulier',label: 'Hôtel particulier',             icon: '🏛️' },
  { value: 'appartement',      label: 'Appartement (B2C)',             icon: '🚪' },
  { value: 'maison',           label: 'Maison (B2C)',                  icon: '🏡' },
];

// 5 tranches de prix
export const TRANCHES_PRIX_REFERENCE = [
  { value: '<1M',    label: 'Moins de 1 M€',  min: 0,         max: 1000000 },
  { value: '1-3M',   label: '1 à 3 M€',        min: 1000000,   max: 3000000 },
  { value: '3-10M',  label: '3 à 10 M€',       min: 3000000,   max: 10000000 },
  { value: '10-30M', label: '10 à 30 M€',      min: 10000000,  max: 30000000 },
  { value: '>30M',   label: 'Plus de 30 M€',  min: 30000000,  max: Infinity },
];

// Helper : déduire automatiquement la tranche de prix depuis un montant
export function getTrancheFromPrix(prix) {
  if (!prix || prix <= 0) return null;
  for (const t of TRANCHES_PRIX_REFERENCE) {
    if (prix >= t.min && prix < t.max) return t.value;
  }
  return '>30M';
}

// Helper : récupérer le label d'une typologie
export function getTypologieLabel(value) {
  return TYPOLOGIES_REFERENCE.find(t => t.value === value)?.label || value;
}

// Helper : récupérer le label d'une tranche
export function getTrancheLabel(value) {
  return TRANCHES_PRIX_REFERENCE.find(t => t.value === value)?.label || value;
}

// Helper : icône typologie
export function getTypologieIcon(value) {
  return TYPOLOGIES_REFERENCE.find(t => t.value === value)?.icon || '📍';
}

// Types d'acquéreur (suggestions auto-complétion)
export const TYPES_ACQUEREUR_SUGGESTIONS = [
  'Family office',
  'Promoteur',
  'Marchand de biens',
  'Investisseur privé',
  'Investisseur institutionnel',
  'Foncière',
  'Fonds d\'investissement',
  'Particulier',
  'Hôtelier',
  'Exploitant commercial',
  'SCPI',
  'Étranger non-résident',
];
