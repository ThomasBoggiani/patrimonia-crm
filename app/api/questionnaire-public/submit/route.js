// app/api/questionnaire-public/submit/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Service role (bypass RLS car on insère depuis un formulaire public)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, type, reponses, consentement_rgpd, consentement_marketing } = body;

    // Validations basiques
    if (!token || !type || !reponses) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 });
    }
    if (!['acquereur', 'vendeur'].includes(type)) {
      return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
    }
    if (!consentement_rgpd) {
      return NextResponse.json({ error: 'Consentement RGPD requis' }, { status: 400 });
    }

    // Résoudre le token vers le commercial
    const { data: commercial, error: errProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, prenom, nom, email')
      .eq('questionnaire_token', token)
      .maybeSingle();

    if (errProfile || !commercial) {
      return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });
    }

    // Récupérer l'IP pour preuve RGPD
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown';
    const consentement_date = new Date().toISOString();

    // Extraire les champs communs (présents dans les 2 templates)
    const prenom = (reponses.prenom || '').trim();
    const nom = (reponses.nom || '').trim();
    const email = (reponses.email || '').trim().toLowerCase();
    const telephone = (reponses.telephone || '').trim();

    if (!prenom || !nom || !email) {
      return NextResponse.json({ error: 'Prénom, nom et email obligatoires' }, { status: 400 });
    }

    let createdId = null;
    let createdType = null;

    // ─────────────────────────────────────────
    // Branche ACHETER → créer un client
    // ─────────────────────────────────────────
    if (type === 'acquereur') {
      const clientData = {
        prenom,
        nom,
        email,
        tel: telephone || null,
        societe: reponses.societe || null,
        statut: reponses.statut_personne || null,
        commerce_responsable: commercial.id,
        pourvoyeur_id: commercial.id,
        typologie: reponses.typologie || null,
        budget_min: reponses.budget_min ? parseInt(reponses.budget_min) : null,
        budget_max: reponses.budget_max ? parseInt(reponses.budget_max) : null,
        rendement_min: reponses.rendement_min ? parseFloat(reponses.rendement_min) : null,
        zones: reponses.zones || null,
        criteres_specifiques: reponses.criteres_specifiques || null,
        notes: `Lead via questionnaire public le ${new Date().toLocaleString('fr-FR')}`,
        actif: true
      };

      const { data: newClient, error: errClient } = await supabaseAdmin
        .from('clients')
        .insert(clientData)
        .select('id')
        .single();

      if (errClient) {
        console.error('[questionnaire] Erreur création client:', errClient);
        return NextResponse.json({ error: 'Erreur enregistrement: ' + errClient.message }, { status: 500 });
      }
      createdId = newClient.id;
      createdType = 'client';
    }

    // ─────────────────────────────────────────
    // Branche VENDRE → créer un mandat
    // ─────────────────────────────────────────
    if (type === 'vendeur') {
      const mandatData = {
        type_actif: reponses.type_actif || 'Immeuble',
        adresse: reponses.adresse || '',
        ville: reponses.ville || null,
        code_postal: reponses.code_postal || null,
        prix_demande: reponses.prix_demande ? parseInt(reponses.prix_demande) : null,
        loyers_annuels: reponses.loyers_annuels ? parseInt(reponses.loyers_annuels) : null,
        surface: reponses.surface ? parseFloat(reponses.surface) : null,
        nb_lots: reponses.nb_lots ? parseInt(reponses.nb_lots) : null,
        statut: 'Sourcing',
        commerce_responsable: commercial.id,
        pourvoyeur_id: commercial.id,
        mandant_nom: nom,
        mandant_prenom: prenom,
        mandant_email: email,
        mandant_tel: telephone || null,
        notes: `Mandat via questionnaire public le ${new Date().toLocaleString('fr-FR')}\n\nDescription mandant : ${reponses.description || ''}`
      };

      const { data: newMandat, error: errMandat } = await supabaseAdmin
        .from('mandats')
        .insert(mandatData)
        .select('id')
        .single();

      if (errMandat) {
        console.error('[questionnaire] Erreur création mandat:', errMandat);
        return NextResponse.json({ error: 'Erreur enregistrement: ' + errMandat.message }, { status: 500 });
      }
      createdId = newMandat.id;
      createdType = 'mandat';
    }

    // ─────────────────────────────────────────
    // Audit dans la table questionnaires
    // ─────────────────────────────────────────
    await supabaseAdmin
      .from('questionnaires')
      .insert({
        type,
        token,
        commerce_responsable: commercial.id,
        statut: 'Complété',
        reponses,
        consentement_rgpd,
        consentement_marketing: !!consentement_marketing,
        consentement_date,
        ip_soumission: ip,
        imported_id: createdId,
        imported_type: createdType
      });

    // ─────────────────────────────────────────
    // Notification au commercial
    // ─────────────────────────────────────────
    const notifTitre = type === 'acquereur'
      ? `Nouveau lead acquéreur : ${prenom} ${nom}`
      : `Nouveau mandat à étudier : ${prenom} ${nom}`;
    const notifMessage = type === 'acquereur'
      ? `${prenom} ${nom} a rempli ton questionnaire et cherche à acheter (${reponses.typologie || 'sans précision'})`
      : `${prenom} ${nom} a rempli ton questionnaire pour vendre un bien (${reponses.type_actif || 'à analyser'})`;

    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: commercial.id,
        titre: notifTitre,
        message: notifMessage,
        type: 'questionnaire_submit',
        lien_type: createdType,
        lien_id: createdId,
        lue: false
      });

    return NextResponse.json({
      success: true,
      type: createdType,
      commercial: { prenom: commercial.prenom, nom: commercial.nom }
    });

  } catch (e) {
    console.error('[questionnaire] Erreur:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
