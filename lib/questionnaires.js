// lib/questionnaires.js
// Templates de questionnaires avec branche B2B / B2C

import {
  TYPES_ACTIF_B2B_TREE,
  TYPES_ACTIF_B2B_FAMILLES,
  TYPES_HABITATION_B2C,
  TYPOLOGIES_CLIENT_TREE,
  TYPOLOGIES_CLIENT,
  NB_PIECES
} from './crm-constants';

// ─────────────────────────────────────────────────────────
// Listes
// ─────────────────────────────────────────────────────────
export const ZONES = [
  'Paris',
  '1ère couronne',
  '2ème couronne',
  'Île-de-France',
  'Province',
  'France entière'
];

export const ZONES_B2C = [
  'Paris 1er-7e',
  'Paris 8e-12e',
  'Paris 13e-17e',
  'Paris 18e-20e',
  'Hauts-de-Seine (92)',
  'Yvelines (78)',
  'Autre Île-de-France',
  'Province'
];

export const TYPOLOGIES_INVESTISSEUR = TYPOLOGIES_CLIENT;

export const TYPES_ACTIF = TYPES_ACTIF_B2B_FAMILLES;

export const NATURES_JURIDIQUES = ['Privée', 'SCI', 'SAS', 'SA', 'SARL', 'SCPI', 'OPCI', 'Autre'];

export const STRATEGIES = ['Core', 'Value-add', 'Opportuniste'];

export const FINANCEMENTS = ['Cash', 'Crédit', 'Mixte', 'À étudier'];

export const HORIZONS = ['Immédiat (< 3 mois)', '3-6 mois', '6-12 mois', '+12 mois', 'Opportuniste'];

export const TIMINGS_VENTE = ['Immédiat', '< 3 mois', '3-6 mois', '6-12 mois', '+12 mois'];

export const ETATS_GENERAL = ['Neuf / refait à neuf', 'Très bon état', 'Bon état', 'État correct', 'Travaux à prévoir', 'Gros travaux'];

export const TYPES_COMMERCIALISATION = ['Mandat exclusif', 'Mandat simple', 'Off-market'];

export const EXTERIEURS = ['Balcon', 'Terrasse', 'Jardin', 'Cour', 'Aucun'];

export const PARKINGS = ['Place de parking', 'Garage', 'Box', 'Sans'];

// ─────────────────────────────────────────────────────────
// TEMPLATE ACQUÉREUR B2B (Investissement)
// ─────────────────────────────────────────────────────────
export const QUESTIONNAIRE_ACQUEREUR_B2B = {
  type: 'acquereur',
  marche: 'b2b',
  nom: 'Investissement immobilier',
  description: 'Vous êtes investisseur et souhaitez acquérir un actif',
  sections: [
    {
      id: 'identite',
      titre: 'Identité',
      description: 'Vos coordonnées',
      questions: [
        { id: 'societe', label: 'Société', type: 'text', required: false },
        { id: 'prenom', label: 'Prénom', type: 'text', required: true },
        { id: 'nom', label: 'Nom', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'email', required: true },
        { id: 'tel', label: 'Téléphone', type: 'tel', required: false },
        { id: 'typologie', label: 'Type d\'investisseur', type: 'cascade', required: true,
          tree: TYPOLOGIES_CLIENT_TREE,
          sousTypeId: 'sous_typologie',
          labelFamille: 'Type', labelSousType: 'Précision' }
      ]
    },
    {
      id: 'criteres',
      titre: 'Critères d\'investissement',
      description: 'Définissez votre cible',
      questions: [
        { id: 'familles_recherchees', label: 'Familles d\'actifs recherchés', type: 'multiselect',
          required: true, options: TYPES_ACTIF_B2B_FAMILLES,
          hint: 'Sélectionnez tout ce qui vous intéresse' },

        // Sous-types Immeubles
        { id: 'sous_types_immeubles', label: 'Précisions Immeubles', type: 'multiselect',
          required: false, options: TYPES_ACTIF_B2B_TREE['Immeubles'],
          showIf: (a) => (a.familles_recherchees || []).includes('Immeubles') },

        // Sous-types Hôtels
        { id: 'sous_types_hotels', label: 'Précisions Hôtels', type: 'multiselect',
          required: false, options: TYPES_ACTIF_B2B_TREE['Hôtels'],
          showIf: (a) => (a.familles_recherchees || []).includes('Hôtels') },

        // Sous-types Locaux commerciaux
        { id: 'sous_types_locaux', label: 'Précisions Locaux commerciaux', type: 'multiselect',
          required: false, options: TYPES_ACTIF_B2B_TREE['Locaux commerciaux'],
          showIf: (a) => (a.familles_recherchees || []).includes('Locaux commerciaux') },

        { id: 'budget_min', label: 'Budget minimum (€)', type: 'number', required: true,
          placeholder: '1 000 000', unit: '€' },
        { id: 'budget_max', label: 'Budget maximum (€)', type: 'number', required: true,
          placeholder: '10 000 000', unit: '€' },
        { id: 'rendement_min', label: 'Rendement minimum (%)', type: 'number', required: false,
          placeholder: '5', unit: '%', step: '0.1' },
        { id: 'zones', label: 'Zones géographiques', type: 'multiselect', required: true,
          options: ZONES, hint: 'Sélectionnez toutes les zones qui vous intéressent' },
        { id: 'strategie', label: 'Stratégie', type: 'select', required: false, options: STRATEGIES }
      ]
    },
    {
      id: 'maturite',
      titre: 'Maturité & process',
      questions: [
        { id: 'horizon', label: 'Horizon de décision', type: 'select', required: true, options: HORIZONS },
        { id: 'financement', label: 'Type de financement', type: 'select', required: false, options: FINANCEMENTS },
        { id: 'historique', label: 'Historique d\'acquisitions', type: 'textarea', required: false, rows: 3 },
        { id: 'commentaires', label: 'Commentaires libres', type: 'textarea', required: false, rows: 3 }
      ]
    }
  ]
};

// ─────────────────────────────────────────────────────────
// TEMPLATE ACQUÉREUR B2C (Habitation)
// ─────────────────────────────────────────────────────────
export const QUESTIONNAIRE_ACQUEREUR_B2C = {
  type: 'acquereur',
  marche: 'b2c',
  nom: 'Recherche d\'habitation',
  description: 'Vous cherchez un appartement, une maison ou un hôtel particulier',
  sections: [
    {
      id: 'identite',
      titre: 'Identité',
      description: 'Vos coordonnées',
      questions: [
        { id: 'prenom', label: 'Prénom', type: 'text', required: true },
        { id: 'nom', label: 'Nom', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'email', required: true },
        { id: 'tel', label: 'Téléphone', type: 'tel', required: true }
      ]
    },
    {
      id: 'recherche',
      titre: 'Votre recherche',
      questions: [
        { id: 'types_habitation', label: 'Type de bien recherché', type: 'multiselect', required: true,
          options: TYPES_HABITATION_B2C, hint: 'Choix multiple possible' },
        { id: 'nb_pieces', label: 'Nombre de pièces', type: 'multiselect', required: true,
          options: NB_PIECES, hint: 'Cochez toutes les tailles qui vous conviennent' },
        { id: 'surface_min', label: 'Surface minimum', type: 'number', required: true,
          unit: 'm²', placeholder: '50' },
        { id: 'budget_min', label: 'Budget minimum (€)', type: 'number', required: true,
          placeholder: '500 000', unit: '€' },
        { id: 'budget_max', label: 'Budget maximum (€)', type: 'number', required: true,
          placeholder: '2 000 000', unit: '€' },
        { id: 'zones', label: 'Zones géographiques', type: 'multiselect', required: true,
          options: ZONES_B2C },
        { id: 'exterieur', label: 'Extérieur souhaité', type: 'multiselect', required: false,
          options: EXTERIEURS, hint: 'Optionnel' },
        { id: 'parking', label: 'Stationnement', type: 'select', required: false, options: PARKINGS },
        { id: 'etage_min', label: 'Étage minimum', type: 'number', required: false,
          placeholder: '0 = RDC accepté' },
        { id: 'horizon', label: 'Horizon d\'achat', type: 'select', required: true, options: HORIZONS },
        { id: 'financement', label: 'Type de financement', type: 'select', required: false, options: FINANCEMENTS },
        { id: 'commentaires', label: 'Critères additionnels', type: 'textarea', required: false, rows: 4,
          placeholder: 'Charme ancien, vue, calme, proximité écoles...' }
      ]
    }
  ]
};

// ─────────────────────────────────────────────────────────
// TEMPLATE VENDEUR B2B (Investissement)
// ─────────────────────────────────────────────────────────
export const QUESTIONNAIRE_VENDEUR_B2B = {
  type: 'vendeur',
  marche: 'b2b',
  nom: 'Vente d\'un actif d\'investissement',
  description: 'Vous souhaitez céder un immeuble, un hôtel, des locaux commerciaux...',
  sections: [
    {
      id: 'contact',
      titre: 'Vos coordonnées',
      questions: [
        { id: 'societe', label: 'Société (si applicable)', type: 'text', required: false },
        { id: 'prenom', label: 'Prénom', type: 'text', required: true },
        { id: 'nom', label: 'Nom', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'email', required: true },
        { id: 'tel', label: 'Téléphone', type: 'tel', required: true }
      ]
    },
    {
      id: 'bien',
      titre: 'Le bien',
      questions: [
        { id: 'type_bien', label: 'Type de bien', type: 'cascade', required: true,
          tree: TYPES_ACTIF_B2B_TREE,
          sousTypeId: 'sous_type_bien',
          labelFamille: 'Famille', labelSousType: 'Sous-type' },
        { id: 'adresse', label: 'Adresse complète', type: 'text', required: true,
          placeholder: '12 rue de Rivoli, 75001 Paris' },
        { id: 'surface', label: 'Surface totale (m²)', type: 'number', required: true,
          unit: 'm²', placeholder: '450' },
        { id: 'composition', label: 'Composition / lots', type: 'textarea', rows: 3, required: false,
          placeholder: '8 appartements + 1 commerce en RDC...' },
        { id: 'etat_general', label: 'État général', type: 'select', required: true, options: ETATS_GENERAL },
        { id: 'travaux', label: 'Travaux récents ou à prévoir', type: 'textarea', rows: 3, required: false },
        { id: 'occupation', label: 'Occupation', type: 'select', required: false,
          options: ['Libre', 'Loué (résidence principale)', 'Loué (commercial)', 'Mixte', 'Vacant'] }
      ]
    },
    {
      id: 'financier',
      titre: 'Données financières',
      questions: [
        { id: 'prix_souhaite', label: 'Prix de vente souhaité (€)', type: 'number', required: true,
          unit: '€', placeholder: '3 500 000' },
        { id: 'loyers_annuels', label: 'Loyers annuels HC (€)', type: 'number', required: false, unit: '€' },
        { id: 'taxe_fonciere', label: 'Taxe foncière annuelle (€)', type: 'number', required: false, unit: '€' },
        { id: 'charges_annuelles', label: 'Charges annuelles totales (€)', type: 'number', required: false, unit: '€' }
      ]
    },
    {
      id: 'attentes',
      titre: 'Attentes & timing',
      questions: [
        { id: 'commercialisation', label: 'Type de mandat souhaité', type: 'select',
          required: false, options: TYPES_COMMERCIALISATION },
        { id: 'timing', label: 'Timing de vente souhaité', type: 'select', required: true, options: TIMINGS_VENTE },
        { id: 'contraintes', label: 'Contraintes particulières', type: 'textarea', rows: 3, required: false },
        { id: 'commentaires', label: 'Commentaires libres', type: 'textarea', rows: 3, required: false }
      ]
    }
  ]
};

// ─────────────────────────────────────────────────────────
// TEMPLATE VENDEUR B2C (Habitation)
// ─────────────────────────────────────────────────────────
export const QUESTIONNAIRE_VENDEUR_B2C = {
  type: 'vendeur',
  marche: 'b2c',
  nom: 'Vente d\'un bien d\'habitation',
  description: 'Vous souhaitez vendre un appartement, une maison ou un hôtel particulier',
  sections: [
    {
      id: 'contact',
      titre: 'Vos coordonnées',
      questions: [
        { id: 'prenom', label: 'Prénom', type: 'text', required: true },
        { id: 'nom', label: 'Nom', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'email', required: true },
        { id: 'tel', label: 'Téléphone', type: 'tel', required: true }
      ]
    },
    {
      id: 'bien',
      titre: 'Le bien à vendre',
      questions: [
        { id: 'type_bien', label: 'Type de bien', type: 'select', required: true,
          options: TYPES_HABITATION_B2C },
        { id: 'adresse', label: 'Adresse complète', type: 'text', required: true,
          placeholder: '12 rue de Rivoli, 75001 Paris' },
        { id: 'surface', label: 'Surface (m²)', type: 'number', required: true, unit: 'm²' },
        { id: 'nb_pieces', label: 'Nombre de pièces', type: 'select', required: true, options: NB_PIECES },
        { id: 'nb_chambres', label: 'Nombre de chambres', type: 'number', required: false },
        { id: 'etage', label: 'Étage', type: 'text', required: false,
          placeholder: 'RDC, 3e, dernier étage...',
          showIf: (a) => a.type_bien === 'Appartement' },
        { id: 'exterieur', label: 'Extérieur', type: 'multiselect', required: false, options: EXTERIEURS },
        { id: 'parking', label: 'Stationnement', type: 'select', required: false, options: PARKINGS },
        { id: 'etat_general', label: 'État général', type: 'select', required: true, options: ETATS_GENERAL },
        { id: 'travaux', label: 'Travaux récents ou à prévoir', type: 'textarea', rows: 2, required: false },
        { id: 'occupation', label: 'Occupation', type: 'select', required: false,
          options: ['Libre', 'Loué (résidence principale)', 'Vacant'] }
      ]
    },
    {
      id: 'financier',
      titre: 'Prix et finances',
      questions: [
        { id: 'prix_souhaite', label: 'Prix de vente souhaité (€)', type: 'number', required: true, unit: '€' },
        { id: 'taxe_fonciere', label: 'Taxe foncière annuelle (€)', type: 'number', required: false, unit: '€' },
        { id: 'charges_annuelles', label: 'Charges de copro annuelles (€)', type: 'number', required: false, unit: '€' }
      ]
    },
    {
      id: 'attentes',
      titre: 'Vos attentes',
      questions: [
        { id: 'timing', label: 'Timing de vente souhaité', type: 'select', required: true, options: TIMINGS_VENTE },
        { id: 'commentaires', label: 'Commentaires libres', type: 'textarea', rows: 3, required: false }
      ]
    }
  ]
};

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
export function getQuestionnaire(type, marche) {
  if (type === 'acquereur' && marche === 'b2b') return QUESTIONNAIRE_ACQUEREUR_B2B;
  if (type === 'acquereur' && marche === 'b2c') return QUESTIONNAIRE_ACQUEREUR_B2C;
  if (type === 'vendeur' && marche === 'b2b') return QUESTIONNAIRE_VENDEUR_B2B;
  if (type === 'vendeur' && marche === 'b2c') return QUESTIONNAIRE_VENDEUR_B2C;
  return null;
}

// Backward compat (utilisé par l'ancienne page)
export function getQuestionnaireByType(type) {
  if (type === 'acquereur') return QUESTIONNAIRE_ACQUEREUR_B2B;
  if (type === 'vendeur') return QUESTIONNAIRE_VENDEUR_B2B;
  return null;
}

export function getInitialAnswers(template) {
  const init = {};
  for (const section of template.sections) {
    for (const q of section.questions) {
      if (q.type === 'multiselect') init[q.id] = [];
      else if (q.type === 'cascade') {
        init[q.id] = '';
        if (q.sousTypeId) init[q.sousTypeId] = '';
      }
      else init[q.id] = '';
    }
  }
  return init;
}

export function validateAnswers(template, answers) {
  const errors = [];
  for (const section of template.sections) {
    for (const q of section.questions) {
      if (typeof q.showIf === 'function' && !q.showIf(answers)) continue;
      if (!q.required) continue;
      const v = answers[q.id];
      if (q.type === 'multiselect') {
        if (!v || v.length === 0) errors.push({ field: q.id, label: q.label, message: 'Champ requis' });
      } else if (q.type === 'cascade') {
        if (!v || (typeof v === 'string' && !v.trim())) {
          errors.push({ field: q.id, label: q.label, message: 'Famille requise' });
        }
      } else {
        if (!v || (typeof v === 'string' && !v.trim())) {
          errors.push({ field: q.id, label: q.label, message: 'Champ requis' });
        }
      }
      if (q.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        errors.push({ field: q.id, label: q.label, message: 'Email invalide' });
      }
    }
  }
  return errors;
}

// ─────────────────────────────────────────────────────────
// Helpers d'import CRM
// ─────────────────────────────────────────────────────────
export function answersToClient(answers, marche) {
  const isB2C = marche === 'b2c';
  const familles = isB2C ? answers.types_habitation : answers.familles_recherchees;

  return {
    prenom: answers.prenom || '',
    nom: answers.nom || '',
    societe: answers.societe || null,
    email: (answers.email || '').toLowerCase().trim(),
    tel: answers.tel || null,
    typologie: isB2C ? 'Particuliers' : (answers.typologie || null),
    sous_typologie: answers.sous_typologie || null,
    nature: 'Privée',
    budget_min: parseFloat(answers.budget_min) || 0,
    budget_max: parseFloat(answers.budget_max) || 0,
    rendement_min: parseFloat(answers.rendement_min) || 0,
    zones: answers.zones || [],
    typologies_recherchees: familles || [],
    statut: 'Actif',
    maturite: 'Moyen',
    origine: isB2C ? 'Questionnaire B2C' : 'Questionnaire B2B',
    
    details_recherche: [
      isB2C && answers.types_habitation?.length ? `Types : ${answers.types_habitation.join(', ')}` : null,
      isB2C && answers.nb_pieces?.length ? `Nb pièces : ${answers.nb_pieces.join(', ')}` : null,
      isB2C && answers.surface_min ? `Surface min : ${answers.surface_min} m²` : null,
      isB2C && answers.exterieur?.length ? `Extérieur : ${answers.exterieur.join(', ')}` : null,
      isB2C && answers.parking ? `Parking : ${answers.parking}` : null,
      isB2C && answers.etage_min !== '' && answers.etage_min !== null && answers.etage_min !== undefined ? `Étage min : ${answers.etage_min}` : null,
      !isB2C && answers.sous_types_immeubles?.length ? `Immeubles : ${answers.sous_types_immeubles.join(', ')}` : null,
      !isB2C && answers.sous_types_hotels?.length ? `Hôtels : ${answers.sous_types_hotels.join(', ')}` : null,
      !isB2C && answers.sous_types_locaux?.length ? `Locaux : ${answers.sous_types_locaux.join(', ')}` : null,
      answers.strategie ? `Stratégie : ${answers.strategie}` : null,
      answers.horizon ? `Horizon : ${answers.horizon}` : null,
      answers.financement ? `Financement : ${answers.financement}` : null,
      answers.historique ? `Historique : ${answers.historique}` : null,
      answers.commentaires ? `Commentaires : ${answers.commentaires}` : null
    ].filter(Boolean).join('\n\n')
  };
}

export function answersToMandat(answers, marche) {
  const isB2C = marche === 'b2c';
  return {
    nom: `${answers.type_bien || 'Bien'}${answers.sous_type_bien ? ' - ' + answers.sous_type_bien : ''} - ${answers.adresse || 'Sans adresse'}`,
    type: answers.type_bien || null,
    sous_type: answers.sous_type_bien || null,
    adresse: answers.adresse || null,
    surface: parseFloat(answers.surface) || null,
    nb_pieces: answers.nb_pieces ? (typeof answers.nb_pieces === 'string' ? answers.nb_pieces : null) : null,
    nb_chambres: parseInt(answers.nb_chambres) || null,
    etage: answers.etage ? parseInt(answers.etage) || null : null,
    prix: parseFloat(answers.prix_souhaite) || null,
    loyersAnnuels: parseFloat(answers.loyers_annuels) || null,
    taxeFonciere: parseFloat(answers.taxe_fonciere) || null,
    chargesAnnuelles: parseFloat(answers.charges_annuelles) || null,
    statut: 'Sourcing',
    commercialisation: answers.commercialisation || 'Mandat simple',
    
    description: [
      answers.composition ? `Composition : ${answers.composition}` : null,
      answers.etat_general ? `État général : ${answers.etat_general}` : null,
      answers.travaux ? `Travaux : ${answers.travaux}` : null,
      answers.occupation ? `Occupation : ${answers.occupation}` : null,
      answers.exterieur?.length ? `Extérieur : ${answers.exterieur.join(', ')}` : null,
      answers.parking ? `Parking : ${answers.parking}` : null,
      answers.timing ? `Timing souhaité : ${answers.timing}` : null,
      answers.contraintes ? `Contraintes : ${answers.contraintes}` : null,
      answers.commentaires ? `Commentaires vendeur : ${answers.commentaires}` : null,
      isB2C ? `(Habitation B2C)` : `(Investissement B2B)`
    ].filter(Boolean).join('\n\n'),
    mandant_info: {
      prenom: answers.prenom,
      nom: answers.nom,
      email: answers.email,
      tel: answers.tel,
      societe: answers.societe || null
    }
  };
}
