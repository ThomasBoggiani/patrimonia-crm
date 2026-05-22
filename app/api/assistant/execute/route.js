// app/api/assistant/execute/route.js
//
// Exécute une action APRÈS confirmation utilisateur.
// Tous les types d'actions : create_*, update_*, send_*

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function getUserInitials(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('prenom, nom')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    const initials = [data.prenom?.[0], data.nom?.[0]].filter(Boolean).join('').toUpperCase();
    return initials || null;
  } catch (e) {
    console.error('[assistant/execute] getUserInitials error:', e);
    return null;
  }
}

async function getUserSignature(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('email_signature')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    return data.email_signature || null;
  } catch (e) {
    console.error('[assistant/execute] getUserSignature error:', e);
    return null;
  }
}

// ==========================================================================
// CRÉATION MANDAT
// ==========================================================================

async function executeCreateMandat(data, userId, userInitials) {
  const row = {
    nom: data.nom || 'Sans nom',
    adresse: data.adresse || null,
    ville: data.ville || null,
    type: data.type || 'Immeubles',
    sous_type: data.sous_type || null,
    prix: typeof data.prix === 'number' ? data.prix : 0,
    surface: typeof data.surface === 'number' ? data.surface : 0,
    nb_lots: typeof data.nb_lots === 'number' ? data.nb_lots : 1,
    nb_pieces: typeof data.nb_pieces === 'number' ? data.nb_pieces : null,
    nb_chambres: typeof data.nb_chambres === 'number' ? data.nb_chambres : null,
    etage: typeof data.etage === 'number' ? data.etage : null,
    loyers_annuels: typeof data.loyers_annuels === 'number' ? data.loyers_annuels : 0,
    statut: data.statut || 'Sourcing',
    commercialisation: data.commercialisation || 'Off-market',
    marche: data.marche || null,
    description: data.description || null,
    contact: data.contact || null,
    tel: data.tel || null,
    owner: data.owner || userInitials || 'JD',
    created_by: userId || null
  };
  const { data: inserted, error } = await supabaseAdmin
    .from('mandats').insert(row).select('id, nom').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, result: { id: inserted.id, label: inserted.nom, type: 'mandat' } };
}

// ==========================================================================
// CRÉATION CLIENT
// ==========================================================================

async function executeCreateClient(data, userId, userInitials) {
  const row = {
    prenom: data.prenom || null,
    nom: data.nom || 'Sans nom',
    societe: data.societe || null,
    email: data.email || null,
    tel: data.tel || null,
    typologie: data.typologie || 'Particuliers',
    sous_typologie: data.sous_typologie || null,
    marche: data.marche || null,
    maturite: data.maturite || 'Moyen',
    statut: data.statut || 'Actif',
    origine: data.origine || 'Apporteur',
    budget_min: typeof data.budget_min === 'number' ? data.budget_min : 0,
    budget_max: typeof data.budget_max === 'number' ? data.budget_max : 0,
    rendement_min: typeof data.rendement_min === 'number' ? data.rendement_min : 0,
    details_recherche: data.details_recherche || null,
    owner: data.owner || userInitials || 'JD',
    created_by: userId || null
  };
  const { data: inserted, error } = await supabaseAdmin
    .from('clients').insert(row).select('id, prenom, nom, societe').single();
  if (error) return { ok: false, error: error.message };
  const label = [inserted.prenom, inserted.nom].filter(Boolean).join(' ') || inserted.societe || 'Nouveau client';
  return { ok: true, result: { id: inserted.id, label, type: 'client' } };
}

// ==========================================================================
// CRÉATION TÂCHE
// ==========================================================================

async function executeCreateTask(data, userId, userInitials) {
  const row = {
    titre: data.titre || 'Sans titre',
    echeance: data.echeance || null,
    priorite: data.priorite || 'Normale',
    statut: data.statut || 'À faire',
    lien_type: data.lien_type || null,
    lien_id: data.lien_id || null,
    assignee: userInitials || null,
    assigned_to_user_id: userId || null,
    created_by: userId || null
  };
  const { data: inserted, error } = await supabaseAdmin
    .from('todos').insert(row).select('id, titre').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, result: { id: inserted.id, label: inserted.titre, type: 'task' } };
}

// ==========================================================================
// CRÉATION ÉVÉNEMENT OUTLOOK
// ==========================================================================

async function executeCreateEvent(data, userId, userInitials, token) {
  if (!data.titre || !data.date_debut) {
    return { ok: false, error: 'Titre et date_debut requis' };
  }
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://patrimonia-crm.vercel.app';
    const dureeMs = (data.duree_minutes || 60) * 60 * 1000;
    const dateFin = new Date(new Date(data.date_debut).getTime() + dureeMs).toISOString();

    // Appel à l'endpoint Microsoft Graph existant (créer event)
    const res = await fetch(`${baseUrl}/api/microsoft/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        subject: data.titre,
        start: data.date_debut,
        end: dateFin,
        location: data.lieu || '',
        body: data.description || '',
        attendees: (data.participants || []).map(email => ({ emailAddress: { address: email, name: email } }))
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Erreur création RDV : ${errText}` };
    }
    const result = await res.json();
    return { ok: true, result: { id: result.id || null, label: data.titre, type: 'event' } };
  } catch (e) {
    console.error('[assistant/execute] create_event error:', e);
    return { ok: false, error: e.message };
  }
}

// ==========================================================================
// CRÉATION INTERACTION
// ==========================================================================

async function executeCreateInteraction(data, userId, userInitials) {
  if (!data.client_id && !data.mandat_id) {
    return { ok: false, error: 'client_id ou mandat_id requis' };
  }
  const row = {
    type: data.type || 'Note',
    resume: data.resume || '',
    client_id: data.client_id || null,
    mandat_id: data.mandat_id || null,
    next_step: data.next_step || null,
    date_next_step: data.date_next_step || null,
    date: new Date().toISOString(),
    created_by: userId || null
  };
  const { data: inserted, error } = await supabaseAdmin
    .from('interactions').insert(row).select('id, type, resume').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, result: { id: inserted.id, label: `${inserted.type} — ${inserted.resume.slice(0, 50)}`, type: 'interaction' } };
}

// ==========================================================================
// MODIFICATION MANDAT
// ==========================================================================

async function executeUpdateMandat(data, userId) {
  if (!data.id) return { ok: false, error: 'id requis' };
  const { id, ...updates } = data;
  // Filtre les undefined
  const cleanUpdates = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined && v !== null) cleanUpdates[k] = v;
  }
  if (Object.keys(cleanUpdates).length === 0) {
    return { ok: false, error: 'Aucun champ à modifier' };
  }
  cleanUpdates.updated_by = userId || null;
  cleanUpdates.updated_at = new Date().toISOString();
  const { data: updated, error } = await supabaseAdmin
    .from('mandats').update(cleanUpdates).eq('id', id).select('id, nom').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, result: { id: updated.id, label: updated.nom, type: 'mandat' } };
}

// ==========================================================================
// MODIFICATION CLIENT
// ==========================================================================

async function executeUpdateClient(data, userId) {
  if (!data.id) return { ok: false, error: 'id requis' };
  const { id, ...updates } = data;
  const cleanUpdates = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined && v !== null) cleanUpdates[k] = v;
  }
  if (Object.keys(cleanUpdates).length === 0) {
    return { ok: false, error: 'Aucun champ à modifier' };
  }
  cleanUpdates.updated_by = userId || null;
  cleanUpdates.updated_at = new Date().toISOString();
  const { data: updated, error } = await supabaseAdmin
    .from('clients').update(cleanUpdates).eq('id', id).select('id, prenom, nom, societe').single();
  if (error) return { ok: false, error: error.message };
  const label = [updated.prenom, updated.nom].filter(Boolean).join(' ') || updated.societe || 'Client modifié';
  return { ok: true, result: { id: updated.id, label, type: 'client' } };
}

// ==========================================================================
// ENVOI EMAIL
// ==========================================================================

async function executeSendEmail(data, userId, userInitials, token) {
  if (!data.to || !data.subject || !data.body) {
    return { ok: false, error: 'to, subject et body requis' };
  }
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://patrimonia-crm.vercel.app';
    // Convertit le body texte en HTML basique
    const bodyHtml = data.body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

    // Récupère et ajoute la signature
    const signature = await getUserSignature(userId);
    const finalHtml = signature ? `${bodyHtml}<br><br>${signature}` : bodyHtml;

    const res = await fetch(`${baseUrl}/api/microsoft/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        to: data.to,
        subject: data.subject,
        content: finalHtml,
        clientId: data.client_id || null
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Erreur envoi email : ${errText}` };
    }
    return { ok: true, result: { id: null, label: `Email à ${data.to}`, type: 'email' } };
  } catch (e) {
    console.error('[assistant/execute] send_email error:', e);
    return { ok: false, error: e.message };
  }
}

// ==========================================================================
// ENVOI PLAQUETTE
// ==========================================================================

async function executeSendPlaquette(data, userId, userInitials, token) {
  if (!data.mandat_id || !data.client_id) {
    return { ok: false, error: 'mandat_id et client_id requis' };
  }
  try {
    // Récupère l'email du client + son nom + le nom du mandat
    const [clientRes, mandatRes] = await Promise.all([
      supabaseAdmin.from('clients').select('email, prenom, nom, societe').eq('id', data.client_id).single(),
      supabaseAdmin.from('mandats').select('nom, adresse, ville').eq('id', data.mandat_id).single()
    ]);
    if (clientRes.error || !clientRes.data) return { ok: false, error: 'Client introuvable' };
    if (mandatRes.error || !mandatRes.data) return { ok: false, error: 'Mandat introuvable' };
    const client = clientRes.data;
    const mandat = mandatRes.data;
    if (!client.email) return { ok: false, error: 'Le client n\'a pas d\'email renseigné' };

    const nomClient = [client.prenom, client.nom].filter(Boolean).join(' ') || client.societe || '';
    const subject = `Opportunité off-market : ${mandat.nom}`;

    // Corps HTML (template simple + custom_message si fourni)
    const customLine = data.custom_message ? `<p>${data.custom_message.replace(/\n/g, '<br>')}</p>` : '';
    // Récupère la signature utilisateur
    const signature = await getUserSignature(userId);

    const baseHtmlBody = `<p>Bonjour${nomClient ? ' ' + nomClient : ''},</p>
${customLine}
<p>Je vous fais suivre la plaquette de notre dernière opportunité off-market :</p>
<p><strong>${mandat.nom}</strong>${mandat.adresse ? '<br>' + mandat.adresse : ''}${mandat.ville ? ' — ' + mandat.ville : ''}</p>
<p>Restant à votre disposition pour échanger.</p>`;

    // Append signature si elle existe, sinon fallback texte
    const htmlBody = signature
      ? `${baseHtmlBody}<br>${signature}`
      : `${baseHtmlBody}<p>Cordialement,<br>Immeubles &amp; Patrimoine</p>`;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://patrimonia-crm.vercel.app';
    const res = await fetch(`${baseUrl}/api/email-drafts/send-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        mandatId: data.mandat_id,
        attachPlaquette: true,
        emails: [{
          clientId: data.client_id,
          to: client.email,
          subject,
          htmlBody
        }]
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Erreur envoi plaquette : ${errText}` };
    }
    const result = await res.json();
    if (result.sentCount === 0) {
      return { ok: false, error: `Envoi échoué : ${(result.errors || []).join(', ') || 'raison inconnue'}` };
    }
    return { ok: true, result: { id: null, label: `Plaquette envoyée à ${client.email}`, type: 'plaquette' } };
  } catch (e) {
    console.error('[assistant/execute] send_plaquette error:', e);
    return { ok: false, error: e.message };
  }
}

// ==========================================================================
// HANDLER
// ==========================================================================

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, token } = body;

    if (!action || !action.type || !action.data) {
      return NextResponse.json({ ok: false, error: 'action invalide' }, { status: 400 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Authentification requise' }, { status: 401 });
    }

    const userInitials = await getUserInitials(user.id);

    let result;
    switch (action.type) {
      case 'create_mandat': result = await executeCreateMandat(action.data, user.id, userInitials); break;
      case 'create_client': result = await executeCreateClient(action.data, user.id, userInitials); break;
      case 'create_task': result = await executeCreateTask(action.data, user.id, userInitials); break;
      case 'create_event': result = await executeCreateEvent(action.data, user.id, userInitials, token); break;
      case 'create_interaction': result = await executeCreateInteraction(action.data, user.id, userInitials); break;
      case 'update_mandat': result = await executeUpdateMandat(action.data, user.id); break;
      case 'update_client': result = await executeUpdateClient(action.data, user.id); break;
      case 'send_email': result = await executeSendEmail(action.data, user.id, userInitials, token); break;
      case 'send_plaquette': result = await executeSendPlaquette(action.data, user.id, userInitials, token); break;
      default:
        return NextResponse.json({ ok: false, error: `Type d'action inconnu : ${action.type}` }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch (e) {
    console.error('[assistant/execute] Erreur:', e);
    return NextResponse.json({ ok: false, error: 'Erreur serveur', detail: e.message }, { status: 500 });
  }
}
