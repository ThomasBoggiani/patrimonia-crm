// lib/questionnaires.js
// Templates de questionnaires avec branche B2B / B2C
// v3 (25 mai 2026) :
// - B2B Acquéreur : titre "3 minutes" + section finale "Affinez vos critères librement" (pitch libre + PJ)
// - answersToClient enrichi avec pitch_libre et pieces_jointes

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

// ─── LISTES B2B v2 ─────────────────────────────────────────

export const ORIGINES_CONTACT = [
  'Recommandation',
  'Site internet',
  'LinkedIn',
  'Salon / Événement',
  'Apporteur d\'affaires',
  'Presse / Article',
  'Réseau personnel',
  'Autre'
];

export const VEHICULES_ACQUISITION = [
  'En direct (personne physique)',
  'SCI existante',
  'SAS / SARL existante',
  'Fonds d\'investissement existant',
  'SCPI / OPCI',
  'Holding patrimoniale',
  'Vehicule à créer',
  'Selon dossier'
];

export const POUVOIRS_SIGNATURE = [
  'Décideur unique',
  'Comité d\'investissement interne',
  'Validation associés / actionnaires',
  'Validation famille',
  'Autre process'
];

export const CAPACITES_SIGNATURE = [
  'Signature immédiate en cash',
  'Signature immédiate avec crédit pré-accordé',
  'Crédit à structurer (4-8 semaines)',
  'Levée de fonds à organiser',
  'À étudier au cas par cas'
];

export const POSITIONS_ESG = [
  'Important (critère bloquant)',
  'Préférence forte mais non bloquant',
  'Apprécié mais secondaire',
  'Pas un sujet pour cette acquisition'
];

export const POSITIONS_EXCLUSIVITE = [
  'Oui par principe',
  'Oui selon dossier',
  'Plutôt non',
  'Non par principe'
];

export const FREQUENCES_ACQUISITION = [
  'Plusieurs par an',
  '1 acquisition par an',
  'Tous les 2-3 ans',
  'Opportuniste (sans rythme fixe)',
  'Première acquisition'
];

// ─────────────────────────────────────────────────────────
// TEMPLATE ACQUÉREUR B2B (Investissement) — v3
// ─────────────────────────────────────────────────────────
export const QUESTIONNAIRE_ACQUEREUR_B2B = {
  type: 'acquereur',
  marche: 'b2b',
  nom: 'Investissement immobilier',
  description: 'Définissez votre projet d\'acquisition',
  duree_estimee: '3 minutes',
  sections: [
    // ─── SECTION 1 : VOUS ─────────────────────────────────
    {
      id: 'identite',
      titre: 'Vous',
      description: 'Pour mieux vous connaître et adapter notre approche',
      icon: '👤',
      questions: [
        { id: 'societe', label: 'Société', type: 'text', required: false,
          placeholder: 'Pictet & Cie, Fonds X, ou laisser vide si en direct' },
        { id: 'prenom', label: 'Prénom', type: 'text', required: true },
        { id: 'nom', label: 'Nom', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'email', required: true,
          placeholder: 'votre@email.com' },
        { id: 'tel', label: 'Téléphone', type: 'tel', required: true,
          placeholder: '+33 6 12 34 56 78',
          hint: 'Pour vous rappeler rapidement' },
        { id: 'typologie', label: 'Profil investisseur', type: 'cascade', required: true,
          tree: TYPOLOGIES_CLIENT_TREE,
          sousTypeId: 'sous_typologie',
          labelFamille: 'Type d\'acteur', labelSousType: 'Précision' },
        { id: 'origine_contact', label: 'Comment avez-vous découvert Immeubles & Patrimoine ?',
          type: 'select', required: false, options: ORIGINES_CONTACT,
          hint: 'Optionnel — nous aide à mieux vous accompagner' }
      ]
    },

    // ─── SECTION 2 : PROJET D'ACQUISITION ─────────────────
    {
      id: 'projet',
      titre: 'Votre projet d\'acquisition',
      description: 'Définissez votre cible idéale',
      icon: '🎯',
      questions: [
        // Sélecteur catégories + sous-types (UI custom dans page.jsx)
        { id: 'familles_recherchees', label: 'Types d\'actifs recherchés',
          type: 'families_with_subs', required: true,
          tree: TYPES_ACTIF_B2B_TREE,
          subKeys: {
            'Immeubles': 'sous_types_immeubles',
            'Hôtels': 'sous_types_hotels',
            'Locaux commerciaux': 'sous_types_locaux'
          },
          hint: 'Cochez la famille, puis précisez les sous-types souhaités' },

        { id: 'budget_min', label: 'Budget minimum', type: 'money', required: true,
          placeholder: '5 000 000', unit: '€' },
        { id: 'budget_max', label: 'Budget maximum', type: 'money', required: true,
          placeholder: '15 000 000', unit: '€' },
        { id: 'rendement_min', label: 'Rendement minimum visé', type: 'number', required: false,
          placeholder: '5', unit: '%', step: '0.1',
          hint: 'Optionnel — appliqué au rendement potentiel optimisé du bien' },

        { id: 'zones', label: 'Zones géographiques', type: 'multiselect', required: true,
          options: ZONES, hint: 'Plus de zones = plus d\'opportunités' },

        { id: 'strategie', label: 'Stratégie d\'investissement', type: 'select',
          required: false, options: STRATEGIES,
          hint: 'Core = patrimonial / Value-add = travaux + amélioration / Opportuniste = forte décote' },

        { id: 'position_esg', label: 'Position sur les critères ESG / RSE',
          type: 'select', required: false, options: POSITIONS_ESG,
          hint: 'Performance énergétique, certifications, mixité d\'usages...' }
      ]
    },

    // ─── SECTION 3 : CAPACITÉ ─────────────────────────────
    {
      id: 'capacite',
      titre: 'Capacité d\'acquisition',
      description: 'Pour qualifier rapidement les opportunités à vous proposer',
      icon: '💼',
      questions: [
        { id: 'vehicule_acquisition', label: 'Véhicule d\'acquisition envisagé',
          type: 'select', required: true, options: VEHICULES_ACQUISITION,
          hint: 'Structure juridique qui portera l\'actif' },

        { id: 'pouvoir_signature', label: 'Pouvoir de décision',
          type: 'select', required: true, options: POUVOIRS_SIGNATURE,
          hint: 'Important pour adapter le tempo de présentation des dossiers' },

        { id: 'financement', label: 'Type de financement envisagé',
          type: 'select', required: true, options: FINANCEMENTS },

        { id: 'capacite_signature', label: 'Capacité de signature',
          type: 'select', required: true, options: CAPACITES_SIGNATURE,
          hint: 'Pour vous proposer des dossiers compatibles avec votre timing' }
      ]
    },

    // ─── SECTION 4 : PROCESS ──────────────────────────────
    {
      id: 'process',
      titre: 'Votre process',
      description: 'Comment travaillez-vous habituellement',
      icon: '⚙️',
      questions: [
        { id: 'horizon', label: 'Horizon de décision',
          type: 'select', required: true, options: HORIZONS },

        { id: 'position_exclusivite', label: 'Position sur un mandat exclusif',
          type: 'select', required: false, options: POSITIONS_EXCLUSIVITE,
          hint: 'L\'exclusivité nous permet de vous proposer en avant-première' },

        { id: 'notaire_habituel', label: 'Notaire habituel', type: 'text', required: false,
          placeholder: 'Ex : Étude Cheuvreux, Étude Lacourte... — optionnel',
          hint: 'Pour fluidifier les transactions' },

        { id: 'apporteurs_habituels', label: 'Apporteurs habituels',
          type: 'textarea', rows: 2, required: false,
          placeholder: 'Optionnel — pour identifier d\'éventuels apporteurs communs' }
      ]
    },

    // ─── SECTION 5 : MIEUX VOUS CONNAÎTRE ─────────────────
    {
      id: 'experience',
      titre: 'Mieux vous connaître',
      description: 'Pour calibrer la qualité des opportunités à vous présenter',
      icon: '📊',
      questions: [
        { id: 'frequence_acquisition', label: 'Fréquence d\'acquisition',
          type: 'select', required: false, options: FREQUENCES_ACQUISITION },

        { id: 'ticket_moyen', label: 'Ticket moyen historique', type: 'money',
          required: false, placeholder: '8 000 000', unit: '€',
          hint: 'Optionnel — pour calibrer notre offre' },

        { id: 'historique', label: 'Historique d\'acquisitions', type: 'textarea',
          required: false, rows: 3,
          placeholder: 'Quelques exemples d\'actifs déjà acquis (ville, type, montant approximatif)...' }
      ]
    },

    // ─── SECTION 6 (NOUVELLE) : PITCH LIBRE + PJ ──────────
    {
      id: 'libre',
      titre: 'Affinez vos critères librement',
      description: 'Tout ce qui n\'a pas pu être dit ci-dessus',
      icon: '✍️',
      questions: [
        { id: 'pitch_libre', label: 'Votre pitch ou critères spécifiques',
          type: 'textarea', rows: 5, required: false,
          placeholder: 'Ex : Family office actif depuis 12 ans, cherche des immeubles parisiens 5-15M€ avec potentiel de revalorisation. Privilégions Paris 16e, 17e, Neuilly. Décision en comité tous les 2 mois...',
          hint: 'Décrivez votre recherche dans vos propres mots — c\'est précieux pour calibrer notre approche' },
        { id: 'piece_jointe', label: 'Joindre un document',
          type: 'file', required: false,
          accept: '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx',
          hint: 'Note d\'opportunité, mandat précédent, présentation de votre stratégie... — PDF, image ou Word' }
      ]
    }
  ]
};

// ─────────────────────────────────────────────────────────
// TEMPLATE ACQUÉREUR B2C — inchangé
// ─────────────────────────────────────────────────────────
export const QUESTIONNAIRE_ACQUEREUR_B2C = {
  type: 'acquereur',
  marche: 'b2c',
  nom: 'Recherche d\'habitation',
  description: 'Vous cherchez un appartement, une maison ou un hôtel particulier',
  duree_estimee: '3 minutes',
  sections: [
    {
      id: 'identite',
      titre: 'Identité',
      description: 'Vos coordonnées',
      icon: '👤',
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
      icon: '🔍',
      questions: [
        { id: 'types_habitation', label: 'Type de bien recherché', type: 'multiselect', required: true,
          options: TYPES_HABITATION_B2C, hint: 'Choix multiple possible' },
        { id: 'nb_pieces', label: 'Nombre de pièces', type: 'multiselect', required: true,
          options: NB_PIECES, hint: 'Cochez toutes les tailles qui vous conviennent' },
        { id: 'surface_min', label: 'Surface minimum', type: 'number', required: true,
          unit: 'm²', placeholder: '50' },
        { id: 'budget_min', label: 'Budget minimum (€)', type: 'money', required: true,
          placeholder: '500 000', unit: '€' },
        { id: 'budget_max', label: 'Budget maximum (€)', type: 'money', required: true,
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
// TEMPLATE VENDEUR B2B — inchangé (Phase 3)
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
      icon: '👤',
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
      icon: '🏢',
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
      icon: '💶',
      questions: [
        { id: 'prix_souhaite', label: 'Prix de vente souhaité (€)', type: 'money', required: true,
          unit: '€', placeholder: '3 500 000' },
        { id: 'loyers_annuels', label: 'Loyers annuels HC (€)', type: 'money', required: false, unit: '€' },
        { id: 'taxe_fonciere', label: 'Taxe foncière annuelle (€)', type: 'number', required: false, unit: '€' },
        { id: 'charges_annuelles', label: 'Charges annuelles totales (€)', type: 'number', required: false, unit: '€' }
      ]
    },
    {
      id: 'attentes',
      titre: 'Attentes & timing',
      icon: '📅',
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
// TEMPLATE VENDEUR B2C — inchangé
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
      icon: '👤',
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
      icon: '🏠',
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
      icon: '💶',
      questions: [
        { id: 'prix_souhaite', label: 'Prix de vente souhaité (€)', type: 'money', required: true, unit: '€' },
        { id: 'taxe_fonciere', label: 'Taxe foncière annuelle (€)', type: 'number', required: false, unit: '€' },
        { id: 'charges_annuelles', label: 'Charges de copro annuelles (€)', type: 'number', required: false, unit: '€' }
      ]
    },
    {
      id: 'attentes',
      titre: 'Vos attentes',
      icon: '📅',
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

export function getQuestionnaireByType(type) {
  if (type === 'acquereur') return QUESTIONNAIRE_ACQUEREUR_B2B;
  if (type === 'vendeur') return QUESTIONNAIRE_VENDEUR_B2B;
  return null;
}

export function getInitialAnswers(template) {
  const init = {};
  for (const section of template.sections) {
    for (const q of section.questions) {
      if (q.type === 'multiselect' || q.type === 'families_with_subs') init[q.id] = [];
      else if (q.type === 'cascade') {
        init[q.id] = '';
        if (q.sousTypeId) init[q.sousTypeId] = '';
      }
      else if (q.type === 'file') init[q.id] = null;
      else init[q.id] = '';

      // Initialise les subKeys de families_with_subs
      if (q.type === 'families_with_subs' && q.subKeys) {
        for (const subKey of Object.values(q.subKeys)) {
          init[subKey] = [];
        }
      }
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
      if (q.type === 'multiselect' || q.type === 'families_with_subs') {
        if (!v || v.length === 0) errors.push({ field: q.id, label: q.label, message: 'Champ requis' });
      } else if (q.type === 'cascade') {
        if (!v || (typeof v === 'string' && !v.trim())) {
          errors.push({ field: q.id, label: q.label, message: 'Famille requise' });
        }
      } else if (q.type === 'file') {
        // file n'est jamais required (toujours optionnel pour cette V1)
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
// Helpers d'import CRM — v3 avec pitch libre + PJ
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
      // B2C
      isB2C && answers.types_habitation?.length ? `Types : ${answers.types_habitation.join(', ')}` : null,
      isB2C && answers.nb_pieces?.length ? `Nb pièces : ${answers.nb_pieces.join(', ')}` : null,
      isB2C && answers.surface_min ? `Surface min : ${answers.surface_min} m²` : null,
      isB2C && answers.exterieur?.length ? `Extérieur : ${answers.exterieur.join(', ')}` : null,
      isB2C && answers.parking ? `Parking : ${answers.parking}` : null,
      isB2C && answers.etage_min !== '' && answers.etage_min !== null && answers.etage_min !== undefined
        ? `Étage min : ${answers.etage_min}` : null,
      // B2B — sous-types par famille
      !isB2C && answers.sous_types_immeubles?.length ? `Immeubles : ${answers.sous_types_immeubles.join(', ')}` : null,
      !isB2C && answers.sous_types_hotels?.length ? `Hôtels : ${answers.sous_types_hotels.join(', ')}` : null,
      !isB2C && answers.sous_types_locaux?.length ? `Locaux : ${answers.sous_types_locaux.join(', ')}` : null,
      // Communs
      answers.strategie ? `Stratégie : ${answers.strategie}` : null,
      answers.horizon ? `Horizon : ${answers.horizon}` : null,
      answers.financement ? `Financement : ${answers.financement}` : null,
      // B2B — questions stratégiques
      !isB2C && answers.origine_contact ? `Origine du contact : ${answers.origine_contact}` : null,
      !isB2C && answers.position_esg ? `Position ESG : ${answers.position_esg}` : null,
      !isB2C && answers.vehicule_acquisition ? `Vehicule d'acquisition : ${answers.vehicule_acquisition}` : null,
      !isB2C && answers.pouvoir_signature ? `Pouvoir de signature : ${answers.pouvoir_signature}` : null,
      !isB2C && answers.capacite_signature ? `Capacité de signature : ${answers.capacite_signature}` : null,
      !isB2C && answers.position_exclusivite ? `Position exclusivité : ${answers.position_exclusivite}` : null,
      !isB2C && answers.notaire_habituel ? `Notaire habituel : ${answers.notaire_habituel}` : null,
      !isB2C && answers.apporteurs_habituels ? `Apporteurs habituels : ${answers.apporteurs_habituels}` : null,
      !isB2C && answers.frequence_acquisition ? `Fréquence d'acquisition : ${answers.frequence_acquisition}` : null,
      !isB2C && answers.ticket_moyen ? `Ticket moyen historique : ${parseInt(answers.ticket_moyen).toLocaleString('fr-FR')} €` : null,
      // Historique + pitch libre
      answers.historique ? `Historique :\n${answers.historique}` : null,
      answers.commentaires ? `Commentaires : ${answers.commentaires}` : null,
      // PITCH LIBRE (mis en évidence - dernière section du questionnaire)
      answers.pitch_libre ? `\n━━━ PITCH LIBRE DU PROSPECT ━━━\n${answers.pitch_libre}` : null
    ].filter(Boolean).join('\n\n'),

    // Pièce jointe : on stocke l'URL signée + nom de fichier
    pieces_jointes: answers.piece_jointe ? [answers.piece_jointe] : []
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
    loyers_annuels: parseFloat(answers.loyers_annuels) || null,
    taxe_fonciere: parseFloat(answers.taxe_fonciere) || null,
    charges_annuelles: parseFloat(answers.charges_annuelles) || null,
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
