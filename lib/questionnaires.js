// lib/questionnaires.js
// Templates de questionnaires typés.
// Importe les arborescences depuis crm-constants pour cohérence avec le CRM

import {
  TYPES_ACTIF_TREE,
  TYPES_ACTIF_FAMILLES,
  TYPOLOGIES_CLIENT_TREE,
  TYPOLOGIES_CLIENT
} from './crm-constants';

// ─────────────────────────────────────────────────────────
// Listes partagées (réexport pour compatibilité)
// ─────────────────────────────────────────────────────────
export const ZONES = [
  'Paris',
  '1ère couronne',
  '2ème couronne',
  'Île-de-France',
  'Province',
  'France entière'
];

export const TYPOLOGIES_INVESTISSEUR = TYPOLOGIES_CLIENT;

export const TYPES_ACTIF = TYPES_ACTIF_FAMILLES;

export const NATURES_JURIDIQUES = ['Privée', 'SCI', 'SAS', 'SA', 'SARL', 'SCPI', 'OPCI', 'Autre'];

export const STRATEGIES = ['Core', 'Value-add', 'Opportuniste'];

export const FINANCEMENTS = ['Cash', 'Crédit', 'Mixte', 'À étudier'];

export const HORIZONS = ['Immédiat (< 3 mois)', '3-6 mois', '6-12 mois', '+12 mois', 'Opportuniste'];

export const TIMINGS_VENTE = ['Immédiat', '< 3 mois', '3-6 mois', '6-12 mois', '+12 mois'];

export const ETATS_GENERAL = ['Très bon état', 'Bon état', 'État correct', 'Travaux à prévoir', 'Gros travaux'];

export const TYPES_COMMERCIALISATION = ['Mandat exclusif', 'Mandat simple', 'Off-market'];

export const NB_PIECES = ['Studio / T1', 'T2', 'T3', 'T4', 'T5', 'T6+'];

// ─────────────────────────────────────────────────────────
// TEMPLATE ACQUÉREUR
// ─────────────────────────────────────────────────────────
export const QUESTIONNAIRE_ACQUEREUR = {
  type: 'acquereur',
  nom: 'Questionnaire Acquéreur',
  description: 'Profil investisseur et critères d\'acquisition',
  color: 'emerald',
  sections: [
    {
      id: 'identite',
      titre: 'Identité',
      description: 'Vos coordonnées pour reprendre contact',
      questions: [
        { id: 'societe', label: 'Société', type: 'text', placeholder: 'Optionnel', required: false },
        { id: 'prenom', label: 'Prénom', type: 'text', required: true },
        { id: 'nom', label: 'Nom', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'email', required: true },
        { id: 'tel', label: 'Téléphone', type: 'tel', required: false },
        { id: 'date_naissance', label: 'Date de naissance', type: 'date', required: false },
        // Cascade typologie investisseur
        { id: 'typologie', label: 'Type d\'investisseur', type: 'cascade', required: true,
          tree: TYPOLOGIES_CLIENT_TREE,
          sousTypeId: 'sous_typologie',
          labelSousType: 'Précision' }
      ]
    },
    {
      id: 'criteres',
      titre: 'Critères d\'investissement',
      description: 'Définissez votre cible idéale',
      questions: [
        { id: 'typologies_recherchees', label: 'Familles d\'actifs recherchés', type: 'multiselect',
          required: true, options: TYPES_ACTIF_FAMILLES,
          hint: 'Sélectionnez toutes les familles qui vous intéressent' },
        // Section habitation conditionnelle
        { id: 'habitation_sous_types', label: 'Précisions habitation/résidentiel', type: 'multiselect',
          required: false,
          options: ['Appartements', 'Maison', 'Hôtels particuliers', 'Habitation (immeuble)', 'Mixte (immeuble)'],
          hint: 'À cocher si vous cherchez un bien d\'habitation',
          showIf: (answers) => {
            const recherchees = answers.typologies_recherchees || [];
            return recherchees.includes('Résidentiel') || recherchees.includes('Immeubles');
          }},
        { id: 'nb_pieces_min', label: 'Nombre de pièces minimum', type: 'select', required: false,
          options: NB_PIECES,
          hint: 'Si vous cherchez un appartement ou une maison',
          showIf: (answers) => {
            const recherchees = answers.typologies_recherchees || [];
            return recherchees.includes('Résidentiel');
          }},
        { id: 'surface_min', label: 'Surface minimum (m²)', type: 'number',
          unit: 'm²', required: false, placeholder: '50' },
        { id: 'budget_min', label: 'Budget minimum (€)', type: 'number', required: true,
          placeholder: '1 000 000', unit: '€' },
        { id: 'budget_max', label: 'Budget maximum (€)', type: 'number', required: true,
          placeholder: '10 000 000', unit: '€' },
        { id: 'rendement_min', label: 'Rendement minimum (%)', type: 'number', required: false,
          placeholder: '5', unit: '%', step: '0.1' },
        { id: 'zones', label: 'Zones géographiques', type: 'multiselect', required: true,
          options: ZONES, hint: 'Sélectionnez toutes les zones qui vous intéressent' },
        { id: 'strategie', label: 'Stratégie', type: 'select', required: false,
          options: STRATEGIES, hint: 'Profil de risque/rendement recherché' }
      ]
    },
    {
      id: 'maturite',
      titre: 'Maturité & process',
      description: 'Pour mieux vous accompagner',
      questions: [
        { id: 'horizon', label: 'Horizon de décision', type: 'select', required: true,
          options: HORIZONS },
        { id: 'financement', label: 'Type de financement', type: 'select', required: false,
          options: FINANCEMENTS },
        { id: 'historique', label: 'Historique d\'acquisitions', type: 'textarea',
          placeholder: 'Quelques opérations récentes ou volume traité', required: false, rows: 3 },
        { id: 'equipe', label: 'Équipe & décisionnaires', type: 'textarea',
          placeholder: 'Qui décide ? Combien de personnes impliquées ?', required: false, rows: 2 },
        { id: 'commentaires', label: 'Commentaires libres', type: 'textarea',
          placeholder: 'Tout ce que vous voulez nous partager', required: false, rows: 4 }
      ]
    }
  ]
};

// ─────────────────────────────────────────────────────────
// TEMPLATE VENDEUR
// ─────────────────────────────────────────────────────────
export const QUESTIONNAIRE_VENDEUR = {
  type: 'vendeur',
  nom: 'Questionnaire Vendeur',
  description: 'Qualification du bien et des attentes',
  color: 'amber',
  sections: [
    {
      id: 'contact',
      titre: 'Vos coordonnées',
      description: 'Pour reprendre contact rapidement',
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
      description: 'Caractéristiques principales',
      questions: [
        // Cascade type de bien
        { id: 'type_bien', label: 'Type de bien', type: 'cascade', required: true,
          tree: TYPES_ACTIF_TREE,
          sousTypeId: 'sous_type_bien',
          labelFamille: 'Famille',
          labelSousType: 'Sous-type' },
        { id: 'adresse', label: 'Adresse complète', type: 'text', required: true,
          placeholder: '12 rue de Rivoli, 75001 Paris' },
        { id: 'surface', label: 'Surface totale (m²)', type: 'number', required: true,
          unit: 'm²', placeholder: '450' },
        // Sections habitation conditionnelles
        { id: 'nb_pieces', label: 'Nombre de pièces', type: 'select', required: false,
          options: NB_PIECES,
          showIf: (answers) => {
            return answers.type_bien === 'Résidentiel'
                || (answers.type_bien === 'Immeubles' && (answers.sous_type_bien === 'Habitation' || answers.sous_type_bien === 'Mixte'));
          }},
        { id: 'nb_chambres', label: 'Nombre de chambres', type: 'number', required: false,
          showIf: (answers) => answers.type_bien === 'Résidentiel' },
        { id: 'etage', label: 'Étage', type: 'text', required: false,
          placeholder: 'RDC, 3e, dernier étage...',
          showIf: (answers) => answers.type_bien === 'Résidentiel' && answers.sous_type_bien === 'Appartements' },
        { id: 'exterieur', label: 'Extérieur', type: 'multiselect', required: false,
          options: ['Balcon', 'Terrasse', 'Jardin', 'Cour', 'Aucun'],
          showIf: (answers) => answers.type_bien === 'Résidentiel' },
        { id: 'parking', label: 'Stationnement', type: 'select', required: false,
          options: ['Place de parking', 'Garage', 'Box', 'Sans'],
          showIf: (answers) => answers.type_bien === 'Résidentiel' },
        { id: 'composition', label: 'Composition / lots',
          type: 'textarea', rows: 3, required: false,
          placeholder: '8 appartements + 1 commerce en RDC, parties communes rénovées' },
        { id: 'etat_general', label: 'État général', type: 'select', required: true,
          options: ETATS_GENERAL },
        { id: 'travaux', label: 'Travaux récents ou à prévoir', type: 'textarea', rows: 3,
          required: false, placeholder: 'Toiture refaite en 2022, façade à ravaler...' },
        { id: 'occupation', label: 'Occupation', type: 'select', required: false,
          options: ['Libre', 'Loué (résidence principale)', 'Loué (commercial)', 'Mixte', 'Vacant'] }
      ]
    },
    {
      id: 'financier',
      titre: 'Données financières',
      description: 'Pour analyser le potentiel investissement',
      questions: [
        { id: 'prix_souhaite', label: 'Prix de vente souhaité (€)', type: 'number', required: true,
          unit: '€', placeholder: '3 500 000' },
        { id: 'loyers_annuels', label: 'Loyers annuels HC (€)', type: 'number', required: false,
          unit: '€', placeholder: '180 000' },
        { id: 'taxe_fonciere', label: 'Taxe foncière annuelle (€)', type: 'number', required: false,
          unit: '€' },
        { id: 'charges_annuelles', label: 'Charges annuelles totales (€)', type: 'number', required: false,
          unit: '€' }
      ]
    },
    {
      id: 'attentes',
      titre: 'Attentes & timing',
      description: 'Pour adapter notre approche',
      questions: [
        { id: 'commercialisation', label: 'Type de mandat souhaité', type: 'select',
          required: false, options: TYPES_COMMERCIALISATION,
          hint: 'Mandat exclusif = meilleure mise en avant' },
        { id: 'timing', label: 'Timing de vente souhaité', type: 'select', required: true,
          options: TIMINGS_VENTE },
        { id: 'contraintes', label: 'Contraintes particulières', type: 'textarea', rows: 3,
          required: false,
          placeholder: 'Locataires en place, indivision, droit de préemption, financement à dénouer...' },
        { id: 'commentaires', label: 'Commentaires libres', type: 'textarea', rows: 4,
          required: false }
      ]
    }
  ]
};

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
export function getQuestionnaireByType(type) {
  if (type === 'acquereur') return QUESTIONNAIRE_ACQUEREUR;
  if (type === 'vendeur') return QUESTIONNAIRE_VENDEUR;
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
      else if (q.type === 'number') init[q.id] = '';
      else init[q.id] = '';
    }
  }
  return init;
}

export function validateAnswers(template, answers) {
  const errors = [];
  for (const section of template.sections) {
    for (const q of section.questions) {
      // Skip si la question est masquée (showIf)
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
export function answersToClient(answers) {
  return {
    prenom: answers.prenom || '',
    nom: answers.nom || '',
    societe: answers.societe || null,
    email: (answers.email || '').toLowerCase().trim(),
    tel: answers.tel || null,
    typologie: answers.typologie || null,
    sous_typologie: answers.sous_typologie || null,
    nature: answers.nature || 'Privée',
    budget_min: parseFloat(answers.budget_min) || 0,
    budget_max: parseFloat(answers.budget_max) || 0,
    rendement_min: parseFloat(answers.rendement_min) || 0,
    zones: answers.zones || [],
    typologies_recherchees: answers.typologies_recherchees || [],
    statut: 'Actif',
    maturite: 'Moyen',
    origine: 'Questionnaire',
    owner: 'TB',
    details_recherche: [
      answers.habitation_sous_types?.length ? `Habitation : ${answers.habitation_sous_types.join(', ')}` : null,
      answers.nb_pieces_min ? `Nb pièces min : ${answers.nb_pieces_min}` : null,
      answers.surface_min ? `Surface min : ${answers.surface_min} m²` : null,
      answers.strategie ? `Stratégie : ${answers.strategie}` : null,
      answers.horizon ? `Horizon : ${answers.horizon}` : null,
      answers.financement ? `Financement : ${answers.financement}` : null,
      answers.historique ? `Historique : ${answers.historique}` : null,
      answers.equipe ? `Équipe : ${answers.equipe}` : null,
      answers.commentaires ? `Commentaires : ${answers.commentaires}` : null
    ].filter(Boolean).join('\n\n')
  };
}

export function answersToMandat(answers) {
  return {
    nom: `${answers.type_bien || 'Bien'}${answers.sous_type_bien ? ' - ' + answers.sous_type_bien : ''} - ${answers.adresse || 'Sans adresse'}`,
    type: answers.type_bien || null,
    sous_type: answers.sous_type_bien || null,
    adresse: answers.adresse || null,
    surface: parseFloat(answers.surface) || null,
    nb_pieces: parseInt(answers.nb_pieces) || null,
    nb_chambres: parseInt(answers.nb_chambres) || null,
    etage: answers.etage ? parseInt(answers.etage) || null : null,
    prix: parseFloat(answers.prix_souhaite) || null,
    loyersAnnuels: parseFloat(answers.loyers_annuels) || null,
    taxeFonciere: parseFloat(answers.taxe_fonciere) || null,
    chargesAnnuelles: parseFloat(answers.charges_annuelles) || null,
    statut: 'Sourcing',
    commercialisation: answers.commercialisation || 'Mandat simple',
    owner: 'TB',
    description: [
      answers.composition ? `Composition : ${answers.composition}` : null,
      answers.etat_general ? `État général : ${answers.etat_general}` : null,
      answers.travaux ? `Travaux : ${answers.travaux}` : null,
      answers.occupation ? `Occupation : ${answers.occupation}` : null,
      answers.exterieur?.length ? `Extérieur : ${answers.exterieur.join(', ')}` : null,
      answers.parking ? `Parking : ${answers.parking}` : null,
      answers.timing ? `Timing souhaité : ${answers.timing}` : null,
      answers.contraintes ? `Contraintes : ${answers.contraintes}` : null,
      answers.commentaires ? `Commentaires vendeur : ${answers.commentaires}` : null
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
