// app/api/assistant/chat/route.js
//
// Assistant Patrimonia - Phase 4 complète (tous les outils propose_*)
// - search_mandats, search_clients : lecture
// - propose_create_mandat, propose_create_client, propose_create_task, propose_create_event, propose_create_interaction
// - propose_update_mandat, propose_update_client
// - propose_send_email, propose_send_plaquette

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ==========================================================================
// SYSTEM PROMPT
// ==========================================================================

async function buildSystemPrompt(context, pdfTexts) {   
  const recentInteractions = await loadRecentInteractions(context);
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  let contextBlock = '';
  if (context?.type === 'mandat' && context.data) {
    const m = context.data;
    contextBlock = `

CONTEXTE COURANT
L'utilisateur est sur la fiche du mandat suivant :
- ID : ${m.id}
- Nom : ${m.nom || '(sans nom)'}
- Adresse : ${m.adresse || '(non renseignée)'}
- Ville : ${m.ville || '(non renseignée)'}
- Type : ${m.type || '(non renseigné)'}${m.sous_type ? ' / ' + m.sous_type : ''}
- Statut : ${m.statut || '(non renseigné)'}
- Prix : ${m.prix ? m.prix + ' €' : '(non renseigné)'}
- Surface : ${m.surface ? m.surface + ' m²' : '(non renseignée)'}
- Owner : ${m.owner || '(non renseigné)'}

Si l'utilisateur pose une question vague ou demande de modifier/envoyer, il parle de CE mandat sauf indication contraire. Utilise son ID pour propose_update_mandat ou propose_send_plaquette.`;
  } else if (context?.type === 'client' && context.data) {
    const c = context.data;
    const nom = [c.prenom, c.nom].filter(Boolean).join(' ') || c.societe || '(anonyme)';
    contextBlock = `

CONTEXTE COURANT
L'utilisateur est sur la fiche du client suivant :
- ID : ${c.id}
- Nom : ${nom}
- Société : ${c.societe || '(aucune)'}
- Email : ${c.email || '(non renseigné)'}
- Typologie : ${c.typologie || '(non renseignée)'}
- Marché : ${c.marche || '(non renseigné)'}
- Maturité : ${c.maturite || '(non renseignée)'}
- Statut : ${c.statut || '(non renseigné)'}
- Budget : ${c.budget_min || 0} - ${c.budget_max || 0} €
- Owner : ${c.owner || '(non renseigné)'}

Si l'utilisateur pose une question vague ou demande de modifier, il parle de CE client sauf indication contraire. Utilise son ID pour propose_update_client.`;
  }

  // Bloc interactions récentes
  let interactionsBlock = '';
  if (recentInteractions && recentInteractions.length > 0) {
    interactionsBlock = `

10 DERNIÈRES INTERACTIONS (du plus récent au plus ancien)
${recentInteractions.map((i, idx) => {
  const date = i.date ? new Date(i.date).toLocaleDateString('fr-FR') : '—';
  const from = i.metadata?.from_name ? ` (de ${i.metadata.from_name})` : '';
  return `${idx + 1}. [${date}] ${i.type}${from} : ${(i.resume || '').slice(0, 200)}`;
}).join('\n')}`;
  }
  let pdfBlock = '';
  if (pdfTexts && pdfTexts.length > 0) {
    pdfBlock = '\n\nPIÈCES JOINTES PDF\n';
    pdfTexts.forEach((p, i) => {
      pdfBlock += `\n=== PDF ${i + 1} : ${p.name} ===\n${p.text}\n=== FIN PDF ${i + 1} ===\n`;
    });
  }

  return `Tu es l'Assistant Patrimonia, l'IA intégrée au CRM d'Immeubles & Patrimoine (off-market patrimonial Paris).

Date du jour : ${today}.

RÔLE
Tu aides Thomas (le fondateur) à naviguer dans son CRM, créer/modifier des données, envoyer des emails et plaquettes, et analyser des documents.

CAPACITÉS ACTUELLES (Phase 4)
LECTURE
- search_mandats : chercher dans les mandats
- search_clients : chercher dans les clients
CRÉATION (avec confirmation utilisateur obligatoire)
- propose_create_mandat : créer un mandat
- propose_create_client : créer un client (acquéreur)
- propose_create_task : créer une tâche (todo)
- propose_create_event : créer un RDV Outlook
- propose_create_interaction : créer une note (interaction) sur un client ou mandat
MODIFICATION (avec confirmation utilisateur obligatoire)
- propose_update_mandat : modifier un mandat existant (besoin de l'id)
- propose_update_client : modifier un client existant (besoin de l'id)
ENVOI (avec confirmation utilisateur obligatoire)
- propose_send_email : envoyer un email simple
- propose_send_plaquette : envoyer la plaquette PDF d'un mandat à un client
PJ
- Analyse de PDF et d'images joints

⚠️ Pour toute action de création/modification/envoi, tu PROPOSES via propose_* — Thomas confirme ensuite. Tu ne fais JAMAIS d'action directe.

STYLE
- Tutoie Thomas.
- Court et direct, jamais bavard.
- En français.
- Mets en gras les noms importants (**double étoiles**).
- Si tu trouves plusieurs résultats, liste-les de façon concise (1 ligne par item).

CONTEXTE MÉTIER
- "Mandat" = un bien immobilier en vente.
- "Client" = un acquéreur potentiel.
- Statut mandat : "Sourcing", "Analyse", "Mandat signé", "Commercialisation", "Offre", "Promesse", "Acte", "Vendu par autres", "Perdu".
- Type mandat : "Immeubles", "Appartements", "Locaux commerciaux", "Maisons", etc.
- Commercialisation : "Off-market" (défaut) ou "Public".
- Marché : "B2B" ou "B2C".
- Typologie client : "Foncières", "Family Office", "Particuliers", "Marchand de Biens", etc.
- Maturité client : "Faible", "Moyen", "Élevé".
- Statut client : "Actif", "Inactif".
- Origine client : "Apporteur", "Site", "Recommandation", etc.
- Owner : initiales du commercial.
- Type interaction : "Appel", "Email", "RDV", "Note", "WhatsApp", "SMS".
- Statut tâche : "À faire", "En cours", "Fait".
- Priorité tâche : "Faible", "Normale", "Haute", "Urgente".
- Les prix sont en euros. Convertis "2,5 M€" en 2500000.

UTILISATION DES OUTILS
- Pour rechercher : PRIVILÉGIE query_text (recherche large sur nom + adresse + ville) plutôt que des filtres précis comme ville='Paris 17e'. Les villes peuvent être stockées de plusieurs façons ("PARIS", "Paris", "Paris 17e", etc.).
- Si une recherche ne donne rien, RETENTE avec une requête PLUS LARGE (juste un mot-clé important comme "Acacias" au lieu de "rue des Acacias Paris 17"), PUIS sans filtre du tout pour voir tous les mandats avant d'abandonner.
- Si Thomas demande de "créer un X" : utilise propose_create_*. Mets des défauts sensés si manque d'info.
- Si Thomas demande de "modifier" et qu'on est dans un contexte : utilise propose_update_* avec l'id du contexte.
- Pour modifier sans contexte : d'abord search pour trouver l'id, puis propose_update_*.
- Pour envoyer plaquette : d'abord search_mandats pour trouver le mandat, et search_clients pour trouver le destinataire, puis propose_send_plaquette avec les ids.
- N'hésite pas à appeler plusieurs outils en cascade.
- Si l'utilisateur demande de faire 2-3 choses en cascade (créer un client PUIS envoyer plaquette), enchaîne les outils. Si une étape nécessite confirmation, propose-la ; Thomas la validera, et au tour suivant tu pourras enchaîner le reste.${contextBlock}${interactionsBlock}${pdfBlock}`;
}

// ==========================================================================
// OUTILS — Définitions
// ==========================================================================

const tools = [
  // LECTURE
  {
    type: 'function',
    function: {
      name: 'search_mandats',
      description: 'Cherche dans la table des mandats. Sans filtre, retourne les plus récents.',
      parameters: {
        type: 'object',
        properties: {
          query_text: { type: 'string' },
          ville: { type: 'string' },
          statut: { type: 'string' },
          type: { type: 'string' },
          prix_min: { type: 'number' },
          prix_max: { type: 'number' },
          owner: { type: 'string' },
          limit: { type: 'integer' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_clients',
      description: 'Cherche dans la table des clients. Sans filtre, retourne les plus récents.',
      parameters: {
        type: 'object',
        properties: {
          query_text: { type: 'string' },
          typologie: { type: 'string' },
          marche: { type: 'string' },
          maturite: { type: 'string' },
          statut: { type: 'string' },
          owner: { type: 'string' },
          budget_min: { type: 'number' },
          budget_max: { type: 'number' },
          limit: { type: 'integer' }
        },
        required: []
      }
    }
  },
  },
  {
    type: 'function',
    function: {
      name: 'search_interactions',
      description: 'Cherche dans l\'historique des interactions (emails, appels, RDV, notes). Filtrable par client ou mandat.',
      parameters: {
        type: 'object',
        properties: {
          client_id: { type: 'string', description: 'UUID du client pour filtrer ses interactions.' },
          mandat_id: { type: 'string', description: 'UUID du mandat pour filtrer ses interactions.' },
          type: { type: 'string', description: 'Type : "Appel", "Email", "RDV", "Note", "email_entrant", "email_sortant"...' },
          since_days: { type: 'integer', description: 'Limiter aux X derniers jours (ex: 14 pour 2 semaines).' },
          limit: { type: 'integer', description: 'Nombre max de résultats. Défaut 20.' }
        },
        required: []
      }
    }
  },
  // CRÉATION
  {
    type: 'function',
    function: {
      name: 'propose_create_mandat',
  {
    type: 'function',
    function: {
      name: 'propose_create_mandat',
      description: 'PROPOSE la création d\'un mandat. Ne crée RIEN, Thomas valide avant exécution.',
      parameters: {
        type: 'object',
        properties: {
          nom: { type: 'string', description: 'Titre du mandat. OBLIGATOIRE.' },
          adresse: { type: 'string' },
          ville: { type: 'string' },
          type: { type: 'string', description: 'Défaut "Immeubles".' },
          sous_type: { type: 'string' },
          prix: { type: 'number' },
          surface: { type: 'number' },
          nb_lots: { type: 'integer' },
          nb_pieces: { type: 'integer' },
          nb_chambres: { type: 'integer' },
          etage: { type: 'integer' },
          loyers_annuels: { type: 'number' },
          statut: { type: 'string', description: 'Défaut "Sourcing".' },
          commercialisation: { type: 'string', description: 'Défaut "Off-market".' },
          marche: { type: 'string' },
          description: { type: 'string' },
          contact: { type: 'string' },
          tel: { type: 'string' }
        },
        required: ['nom']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'propose_create_client',
      description: 'PROPOSE la création d\'un client. Ne crée RIEN, Thomas valide avant exécution.',
      parameters: {
        type: 'object',
        properties: {
          prenom: { type: 'string' },
          nom: { type: 'string', description: 'OBLIGATOIRE.' },
          societe: { type: 'string' },
          email: { type: 'string' },
          tel: { type: 'string' },
          typologie: { type: 'string', description: 'Ex: "Foncières", "Family Office", "Particuliers". Défaut "Particuliers".' },
          sous_typologie: { type: 'string' },
          marche: { type: 'string', description: '"B2B" ou "B2C".' },
          maturite: { type: 'string', description: 'Défaut "Moyen".' },
          statut: { type: 'string', description: 'Défaut "Actif".' },
          origine: { type: 'string', description: 'Défaut "Apporteur".' },
          budget_min: { type: 'number' },
          budget_max: { type: 'number' },
          rendement_min: { type: 'number' },
          details_recherche: { type: 'string', description: 'Texte libre décrivant ce que le client cherche.' }
        },
        required: ['nom']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'propose_create_task',
      description: 'PROPOSE la création d\'une tâche todo. Ne crée RIEN, Thomas valide avant exécution.',
      parameters: {
        type: 'object',
        properties: {
          titre: { type: 'string', description: 'OBLIGATOIRE.' },
          echeance: { type: 'string', description: 'Date au format YYYY-MM-DD. Optionnel.' },
          priorite: { type: 'string', description: 'Défaut "Normale".' },
          statut: { type: 'string', description: 'Défaut "À faire".' },
          lien_type: { type: 'string', description: '"mandat" ou "client" si la tâche est liée à un mandat ou client.' },
          lien_id: { type: 'string', description: 'UUID du mandat ou client lié.' }
        },
        required: ['titre']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'propose_create_event',
      description: 'PROPOSE la création d\'un RDV dans Outlook. Ne crée RIEN, Thomas valide avant exécution.',
      parameters: {
        type: 'object',
        properties: {
          titre: { type: 'string', description: 'Sujet du RDV. OBLIGATOIRE.' },
          date_debut: { type: 'string', description: 'Date+heure ISO format (ex: 2026-05-23T14:00:00). OBLIGATOIRE.' },
          duree_minutes: { type: 'integer', description: 'Durée en minutes. Défaut 60.' },
          lieu: { type: 'string' },
          description: { type: 'string' },
          participants: { type: 'array', items: { type: 'string' }, description: 'Liste d\'emails des participants.' }
        },
        required: ['titre', 'date_debut']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'propose_create_interaction',
      description: 'PROPOSE la création d\'une note/interaction dans l\'historique d\'un client ou mandat. Ne crée RIEN, Thomas valide.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Type : "Appel", "Email", "RDV", "Note", "WhatsApp", "SMS". OBLIGATOIRE.' },
          resume: { type: 'string', description: 'Résumé de l\'interaction. OBLIGATOIRE.' },
          client_id: { type: 'string', description: 'UUID du client concerné (au moins client_id OU mandat_id).' },
          mandat_id: { type: 'string', description: 'UUID du mandat concerné (au moins client_id OU mandat_id).' },
          next_step: { type: 'string', description: 'Prochaine action si applicable.' },
          date_next_step: { type: 'string', description: 'Date prochaine action YYYY-MM-DD.' }
        },
        required: ['type', 'resume']
      }
    }
  },
  // MODIFICATION
  {
    type: 'function',
    function: {
      name: 'propose_update_mandat',
      description: 'PROPOSE la modification d\'un mandat existant. Ne modifie RIEN, Thomas valide.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'UUID du mandat à modifier. OBLIGATOIRE.' },
          nom: { type: 'string' },
          adresse: { type: 'string' },
          ville: { type: 'string' },
          type: { type: 'string' },
          sous_type: { type: 'string' },
          prix: { type: 'number' },
          surface: { type: 'number' },
          statut: { type: 'string' },
          commercialisation: { type: 'string' },
          marche: { type: 'string' },
          description: { type: 'string' }
        },
        required: ['id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'propose_update_client',
      description: 'PROPOSE la modification d\'un client existant. Ne modifie RIEN, Thomas valide.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'UUID du client à modifier. OBLIGATOIRE.' },
          prenom: { type: 'string' },
          nom: { type: 'string' },
          societe: { type: 'string' },
          email: { type: 'string' },
          tel: { type: 'string' },
          typologie: { type: 'string' },
          marche: { type: 'string' },
          maturite: { type: 'string' },
          statut: { type: 'string' },
          budget_min: { type: 'number' },
          budget_max: { type: 'number' }
        },
        required: ['id']
      }
    }
  },
  // ENVOI
  {
    type: 'function',
    function: {
      name: 'propose_send_email',
      description: 'PROPOSE l\'envoi d\'un email simple. Ne fait RIEN, Thomas valide avant envoi.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Email du destinataire. OBLIGATOIRE.' },
          subject: { type: 'string', description: 'Objet. OBLIGATOIRE.' },
          body: { type: 'string', description: 'Corps de l\'email. OBLIGATOIRE.' },
          client_id: { type: 'string', description: 'UUID du client destinataire (optionnel mais recommandé pour traçabilité).' }
        },
        required: ['to', 'subject', 'body']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'propose_send_plaquette',
      description: 'PROPOSE l\'envoi d\'une plaquette PDF d\'un mandat à un client. Ne fait RIEN, Thomas valide.',
      parameters: {
        type: 'object',
        properties: {
          mandat_id: { type: 'string', description: 'UUID du mandat dont envoyer la plaquette. OBLIGATOIRE.' },
          client_id: { type: 'string', description: 'UUID du client destinataire. OBLIGATOIRE.' },
          custom_message: { type: 'string', description: 'Message personnalisé optionnel à ajouter au mail.' }
        },
        required: ['mandat_id', 'client_id']
      }
    }
  }
];

// ==========================================================================
// EXÉCUTION OUTILS LECTURE
// ==========================================================================

// Charge les N dernières interactions pour un contexte client ou mandat
async function loadRecentInteractions(context) {
  if (!context || !context.data?.id) return [];
  const filterCol = context.type === 'mandat' ? 'mandat_id' : context.type === 'client' ? 'client_id' : null;
  if (!filterCol) return [];
  const { data } = await supabaseAdmin
    .from('interactions')
    .select('type, resume, date, metadata')
    .eq(filterCol, context.data.id)
    .order('date', { ascending: false })
    .limit(10);
  return data || [];
}
async function executeSearchMandats(args) {
  const { query_text, ville, statut, type, prix_min, prix_max, owner, limit = 10 } = args;
  let query = supabaseAdmin
    .from('mandats')
    .select('id, nom, adresse, ville, statut, prix, surface, type, sous_type, owner, marche, commercialisation, created_at')
    .limit(Math.min(limit, 20));
  if (query_text && query_text.trim()) {
    const q = `%${query_text.trim()}%`;
    const safe = q.replace(/[,()]/g, '');     
    query = query.or(`nom.ilike.${safe},adresse.ilike.${safe},ville.ilike.${safe}`);
  }
  if (ville) query = query.ilike('ville', `%${ville}%`);
  if (statut) query = query.eq('statut', statut);
  if (type) query = query.eq('type', type);
  if (owner) query = query.eq('owner', owner);
  if (typeof prix_min === 'number') query = query.gte('prix', prix_min);
  if (typeof prix_max === 'number') query = query.lte('prix', prix_max);
  query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) return { error: error.message, results: [] };
  return { count: data?.length || 0, results: data || [] };
}

async function executeSearchInteractions(args) {
  const { client_id, mandat_id, type, since_days, limit = 20 } = args;
  let query = supabaseAdmin
    .from('interactions')
    .select('id, type, resume, date, client_id, mandat_id, next_step, date_next_step, metadata, created_at')
    .limit(Math.min(limit, 50));
  if (client_id) query = query.eq('client_id', client_id);
  if (mandat_id) query = query.eq('mandat_id', mandat_id);
  if (type) query = query.eq('type', type);
  if (typeof since_days === 'number' && since_days > 0) {
    const date = new Date();
    date.setDate(date.getDate() - since_days);
    query = query.gte('date', date.toISOString().split('T')[0]);
  }
  query = query.order('date', { ascending: false });
  const { data, error } = await query;
  if (error) return { error: error.message, results: [] };
  // Enrichit avec from_name pour les emails
  const enriched = (data || []).map(i => {
    const out = { ...i };
    if (i.metadata && (i.type === 'email_entrant' || i.type === 'email_sortant')) {
      out.from_name = i.metadata.from_name || null;
      out.from_address = i.metadata.from_address || null;
      out.web_link = i.metadata.web_link || null;
    }
    return out;
  });
  return { count: enriched.length, results: enriched };
}
async function executeSearchClients(args) {
  const { query_text, typologie, marche, maturite, statut, owner, budget_min, budget_max, limit = 10 } = args;
  let query = supabaseAdmin
    .from('clients')
    .select('id, prenom, nom, societe, email, tel, typologie, sous_typologie, marche, maturite, statut, budget_min, budget_max, rendement_min, zones, typologies_recherchees, owner, created_at')
    .limit(Math.min(limit, 20));
  if (query_text && query_text.trim()) {
    const q = `%${query_text.trim()}%`;
    const safe = q.replace(/[,()]/g, '');
    query = query.or(`prenom.ilike.${safe},nom.ilike.${safe},societe.ilike.${safe},email.ilike.${safe}`);
  }
  if (typologie) query = query.eq('typologie', typologie);
  if (marche) query = query.eq('marche', marche);
  if (maturite) query = query.eq('maturite', maturite);
  if (statut) query = query.eq('statut', statut);
  if (owner) query = query.eq('owner', owner);
  if (typeof budget_min === 'number') query = query.gte('budget_min', budget_min);
  if (typeof budget_max === 'number') query = query.lte('budget_max', budget_max);
  query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) return { error: error.message, results: [] };
  return {
    count: data?.length || 0,
    results: (data || []).map(c => ({
      ...c,
      nom_complet: [c.prenom, c.nom].filter(Boolean).join(' ') || c.societe || '(anonyme)'
    }))
  };
}

// ==========================================================================
// BUILDERS DE PROPOSITION (ne créent RIEN, retournent juste la structure)
// ==========================================================================

const formatPrix = (p) => typeof p === 'number' ? new Intl.NumberFormat('fr-FR').format(p) + ' €' : null;
const formatDate = (d) => {
  if (!d) return null;
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch (e) { return d; }
};

function buildProposeCreateMandat(args) {
  const data = {
    nom: args.nom || 'Sans nom',
    adresse: args.adresse || null,
    ville: args.ville || null,
    type: args.type || 'Immeubles',
    sous_type: args.sous_type || null,
    prix: args.prix || 0,
    surface: args.surface || 0,
    nb_lots: args.nb_lots || 1,
    nb_pieces: args.nb_pieces || null,
    nb_chambres: args.nb_chambres || null,
    etage: args.etage || null,
    loyers_annuels: args.loyers_annuels || 0,
    statut: args.statut || 'Sourcing',
    commercialisation: args.commercialisation || 'Off-market',
    marche: args.marche || null,
    description: args.description || null,
    contact: args.contact || null,
    tel: args.tel || null
  };
  const fields = [
    { label: 'Nom', value: data.nom },
    { label: 'Adresse', value: data.adresse || '—' },
    { label: 'Ville', value: data.ville || '—' },
    { label: 'Type', value: data.type + (data.sous_type ? ' / ' + data.sous_type : '') },
    { label: 'Prix', value: formatPrix(data.prix) || '—' },
    { label: 'Surface', value: data.surface ? data.surface + ' m²' : '—' },
    { label: 'Statut', value: data.statut },
    { label: 'Commercialisation', value: data.commercialisation }
  ];
  if (data.contact) fields.push({ label: 'Contact', value: data.contact });
  if (data.tel) fields.push({ label: 'Téléphone', value: data.tel });
  return { proposed: true, type: 'create_mandat', summary: 'Mandat à créer', fields, data };
}

function buildProposeCreateClient(args) {
  const data = {
    prenom: args.prenom || null,
    nom: args.nom || 'Sans nom',
    societe: args.societe || null,
    email: args.email || null,
    tel: args.tel || null,
    typologie: args.typologie || 'Particuliers',
    sous_typologie: args.sous_typologie || null,
    marche: args.marche || null,
    maturite: args.maturite || 'Moyen',
    statut: args.statut || 'Actif',
    origine: args.origine || 'Apporteur',
    budget_min: args.budget_min || 0,
    budget_max: args.budget_max || 0,
    rendement_min: args.rendement_min || 0,
    details_recherche: args.details_recherche || null
  };
  const fields = [
    { label: 'Nom', value: [data.prenom, data.nom].filter(Boolean).join(' ') || '—' },
    { label: 'Société', value: data.societe || '—' },
    { label: 'Email', value: data.email || '—' },
    { label: 'Téléphone', value: data.tel || '—' },
    { label: 'Typologie', value: data.typologie },
    { label: 'Maturité', value: data.maturite },
    { label: 'Statut', value: data.statut },
    { label: 'Budget', value: (data.budget_min || data.budget_max) ? `${formatPrix(data.budget_min)} → ${formatPrix(data.budget_max)}` : '—' }
  ];
  return { proposed: true, type: 'create_client', summary: 'Client à créer', fields, data };
}

function buildProposeCreateTask(args) {
  const data = {
    titre: args.titre || 'Nouvelle tâche',
    echeance: args.echeance || null,
    priorite: args.priorite || 'Normale',
    statut: args.statut || 'À faire',
    lien_type: args.lien_type || null,
    lien_id: args.lien_id || null
  };
  const fields = [
    { label: 'Titre', value: data.titre },
    { label: 'Échéance', value: data.echeance || '—' },
    { label: 'Priorité', value: data.priorite },
    { label: 'Statut', value: data.statut }
  ];
  if (data.lien_type) fields.push({ label: 'Lié à', value: `${data.lien_type} ${data.lien_id || ''}` });
  return { proposed: true, type: 'create_task', summary: 'Tâche à créer', fields, data };
}

function buildProposeCreateEvent(args) {
  const data = {
    titre: args.titre || 'Nouveau RDV',
    date_debut: args.date_debut,
    duree_minutes: args.duree_minutes || 60,
    lieu: args.lieu || null,
    description: args.description || null,
    participants: args.participants || []
  };
  const fields = [
    { label: 'Titre', value: data.titre },
    { label: 'Date début', value: formatDate(data.date_debut) || '—' },
    { label: 'Durée', value: data.duree_minutes + ' min' },
    { label: 'Lieu', value: data.lieu || '—' },
    { label: 'Participants', value: data.participants.length ? data.participants.join(', ') : '—' }
  ];
  return { proposed: true, type: 'create_event', summary: 'RDV Outlook à créer', fields, data };
}

function buildProposeCreateInteraction(args) {
  const data = {
    type: args.type || 'Note',
    resume: args.resume || '',
    client_id: args.client_id || null,
    mandat_id: args.mandat_id || null,
    next_step: args.next_step || null,
    date_next_step: args.date_next_step || null
  };
  const fields = [
    { label: 'Type', value: data.type },
    { label: 'Résumé', value: data.resume }
  ];
  if (data.next_step) fields.push({ label: 'Prochaine action', value: data.next_step });
  if (data.date_next_step) fields.push({ label: 'Date prochaine action', value: data.date_next_step });
  return { proposed: true, type: 'create_interaction', summary: 'Interaction à créer', fields, data };
}

function buildProposeUpdateMandat(args) {
  const data = { ...args };
  const fields = [{ label: 'ID mandat', value: data.id }];
  if (data.nom !== undefined) fields.push({ label: 'Nom', value: data.nom });
  if (data.adresse !== undefined) fields.push({ label: 'Adresse', value: data.adresse });
  if (data.ville !== undefined) fields.push({ label: 'Ville', value: data.ville });
  if (data.prix !== undefined) fields.push({ label: 'Prix', value: formatPrix(data.prix) });
  if (data.surface !== undefined) fields.push({ label: 'Surface', value: data.surface + ' m²' });
  if (data.statut !== undefined) fields.push({ label: 'Statut', value: data.statut });
  if (data.description !== undefined) fields.push({ label: 'Description', value: data.description });
  return { proposed: true, type: 'update_mandat', summary: 'Mandat à modifier', fields, data };
}

function buildProposeUpdateClient(args) {
  const data = { ...args };
  const fields = [{ label: 'ID client', value: data.id }];
  if (data.prenom !== undefined) fields.push({ label: 'Prénom', value: data.prenom });
  if (data.nom !== undefined) fields.push({ label: 'Nom', value: data.nom });
  if (data.email !== undefined) fields.push({ label: 'Email', value: data.email });
  if (data.tel !== undefined) fields.push({ label: 'Téléphone', value: data.tel });
  if (data.typologie !== undefined) fields.push({ label: 'Typologie', value: data.typologie });
  if (data.maturite !== undefined) fields.push({ label: 'Maturité', value: data.maturite });
  if (data.budget_min !== undefined || data.budget_max !== undefined) {
    fields.push({ label: 'Budget', value: `${formatPrix(data.budget_min || 0)} → ${formatPrix(data.budget_max || 0)}` });
  }
  return { proposed: true, type: 'update_client', summary: 'Client à modifier', fields, data };
}

function buildProposeSendEmail(args) {
  const data = {
    to: args.to,
    subject: args.subject,
    body: args.body,
    client_id: args.client_id || null
  };
  const fields = [
    { label: 'À', value: data.to },
    { label: 'Objet', value: data.subject },
    { label: 'Message', value: data.body.length > 200 ? data.body.slice(0, 200) + '…' : data.body }
  ];
  return { proposed: true, type: 'send_email', summary: 'Email à envoyer', fields, data };
}

function buildProposeSendPlaquette(args) {
  const data = {
    mandat_id: args.mandat_id,
    client_id: args.client_id,
    custom_message: args.custom_message || null
  };
  const fields = [
    { label: 'Mandat ID', value: data.mandat_id },
    { label: 'Client ID', value: data.client_id }
  ];
  if (data.custom_message) fields.push({ label: 'Message', value: data.custom_message });
  return { proposed: true, type: 'send_plaquette', summary: 'Plaquette à envoyer', fields, data };
}

async function executeTool(name, args) {
  switch (name) {
    case 'search_mandats': return await executeSearchMandats(args);
    case 'search_clients': return await executeSearchClients(args);     
    case 'search_interactions': return await executeSearchInteractions(args);
    case 'propose_create_mandat': return buildProposeCreateMandat(args);
    case 'propose_create_client': return buildProposeCreateClient(args);
    case 'propose_create_task': return buildProposeCreateTask(args);
    case 'propose_create_event': return buildProposeCreateEvent(args);
    case 'propose_create_interaction': return buildProposeCreateInteraction(args);
    case 'propose_update_mandat': return buildProposeUpdateMandat(args);
    case 'propose_update_client': return buildProposeUpdateClient(args);
    case 'propose_send_email': return buildProposeSendEmail(args);
    case 'propose_send_plaquette': return buildProposeSendPlaquette(args);
    default: return { error: `Outil inconnu : ${name}` };
  }
}

// ==========================================================================
// PJ
// ==========================================================================

async function downloadFromSignedUrl(signedUrl) {
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error(`Téléchargement échoué : ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function extractPdfTextFromBuffer(buffer) {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (e) {
    console.error('[assistant/chat] PDF extract error:', e);
    return '';
  }
}

function bufferToDataUrl(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

// ==========================================================================
// BOUCLE PRINCIPALE
// ==========================================================================

export async function POST(req) {
  try {
    const body = await req.json();
    const userMessages = Array.isArray(body?.messages) ? body.messages : [];
    const context = body?.context || null;
    const attachments = Array.isArray(body?.attachments) ? body.attachments : [];

    if (!userMessages.length) {
      return NextResponse.json({ error: 'messages requis' }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY manquante' }, { status: 500 });
    }

    const pdfTexts = [];
    const imageAttachments = [];
    for (const att of attachments) {
      if (!att?.type || !att?.signedUrl) continue;
      try {
        const buffer = await downloadFromSignedUrl(att.signedUrl);
        if (att.type === 'application/pdf') {
          const text = await extractPdfTextFromBuffer(buffer);
          if (text) pdfTexts.push({ name: att.name || 'document.pdf', text: text.slice(0, 50000) });
        } else if (att.type.startsWith('image/')) {
          imageAttachments.push({
            type: 'image_url',
            image_url: { url: bufferToDataUrl(buffer, att.type) }
          });
        }
      } catch (e) {
        console.error('[assistant/chat] Download attachment error:', att.name, e);
      }
    }

    const systemPromptText = await buildSystemPrompt(context, pdfTexts);
    const conversation = [
      { role: 'system', content: systemPromptText },
      ...userMessages
    ];

    if (imageAttachments.length > 0) {
      const lastUserIdx = conversation.length - 1;
      const lastMsg = conversation[lastUserIdx];
      if (lastMsg && lastMsg.role === 'user') {
        const textContent = typeof lastMsg.content === 'string' ? lastMsg.content : '';
        conversation[lastUserIdx] = {
          role: 'user',
          content: [
            { type: 'text', text: textContent || 'Analyse cette/ces image(s).' },
            ...imageAttachments
          ]
        };
      }
    }

    const MAX_ITERATIONS = 8;
    let finalMessage = null;
    let proposedAction = null;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: conversation,
          tools,
          tool_choice: 'auto',
          temperature: 0.3
        })
      });

      if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        console.error('[assistant/chat] OpenAI error:', errText);
        return NextResponse.json({ error: 'Erreur OpenAI', detail: errText }, { status: 500 });
      }

      const openaiData = await openaiRes.json();
      const msg = openaiData?.choices?.[0]?.message;
      if (!msg) return NextResponse.json({ error: 'Réponse OpenAI vide' }, { status: 500 });

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        conversation.push(msg);
        for (const toolCall of msg.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs = {};
          try { toolArgs = JSON.parse(toolCall.function.arguments || '{}'); }
          catch (e) { console.error('[assistant/chat] JSON parse args error:', e); }

          console.log(`[assistant/chat] Tool call: ${toolName}`, toolArgs);
          const toolResult = await executeTool(toolName, toolArgs);

          if (toolResult?.proposed) {
            proposedAction = {
              type: toolResult.type,
              summary: toolResult.summary,
              fields: toolResult.fields,
              data: toolResult.data
            };
          }

          conversation.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        }
        continue;
      }

      finalMessage = msg.content || '';
      break;
    }

    if (finalMessage === null) {
      return NextResponse.json({ error: 'Limite d\'itérations atteinte' }, { status: 500 });
    }

    const response = { message: finalMessage, role: 'assistant' };
    if (proposedAction) response.proposed_action = proposedAction;

    return NextResponse.json(response);

  } catch (e) {
    console.error('[assistant/chat] Erreur:', e);
    return NextResponse.json({ error: 'Erreur serveur', detail: e.message }, { status: 500 });
  }
}
