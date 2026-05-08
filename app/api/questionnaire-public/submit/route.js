// app/api/questionnaire-public/submit/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, type, reponses, consentement_rgpd, consentement_marketing } = body;

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

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown';
    const consentement_date = new Date().toISOString();

    // Champs communs
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
      const ownerName = `${commercial.prenom} ${commercial.nom}`.trim();

      // Construire les arrays jsonb
      const zonesArray = reponses.zones
        ? reponses.zones.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const typologiesRecherchees = reponses.typologie
        ? [reponses.typologie]
        : [];

      const clientData = {
        prenom,
        nom,
        email,
        tel: telephone || null,
        societe: reponses.societe || null,
        nature: reponses.statut_personne || null,
        typologie: reponses.typologie || null,
        budget_min: reponses.budget_min ? parseInt(reponses.budget_min) : null,
        budget_max: reponses.budget_max ? parseInt(reponses.budget_max) : null,
        rendement_min: reponses.rendement_min ? parseFloat(reponses.rendement_min) : null,
        zones: zonesArray,
        typologies_recherchees: typologiesRecherchees,
        details_recherche: reponses.criteres_specifiques || null,
        owner: ownerName,
        statut: 'À qualifier',
        maturite: 'À qualifier',
        origine: 'Questionnaire public',
        source: 'questionnaire_public',
        source_detail: {
          token,
          commercial_id: commercial.id,
          submitted_at: consentement_date
        },
        created_by: commercial.id
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
      const ownerName = `${commercial.prenom} ${commercial.nom}`.trim();

      const mandatData = {
        nom: `${reponses.type_actif || 'Bien'} - ${reponses.adresse || 'sans adresse'}`,
        type: reponses.type_actif || 'Immeuble',
        adresse: reponses.adresse || '',
        ville: reponses.ville || null,
        prix: reponses.prix_demande ? parseInt(reponses.prix_demande) : null,
        loyers_annuels: reponses.loyers_annuels ? parseInt(reponses.loyers_annuels) : null,
        surface: reponses.surface ? parseFloat(reponses.surface) : null,
        nb_lots: reponses.nb_lots ? parseInt(reponses.nb_lots) : null,
        statut: 'Sourcing',
        owner: ownerName,
        profile_id: commercial.id,
        pourvoyeur_id: commercial.id,
        contact: `${prenom} ${nom}`,
        tel: telephone || null,
        description: reponses.description || null,
        mandant_info: {
          prenom,
          nom,
          email,
          telephone: telephone || null,
          societe: reponses.societe || null,
          code_postal: reponses.code_postal || null,
          source: 'questionnaire_public',
          token,
          submitted_at: consentement_date
        },
        created_by: commercial.id
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
    const submitterName = `${prenom} ${nom}`.trim();
    await supabaseAdmin
      .from('questionnaires')
      .insert({
        type,
        nom: `${type === 'acquereur' ? 'Acquéreur' : 'Vendeur'} - ${submitterName}`,
        lien: `/q/${token}`,
        token,
        profile_id: commercial.id,
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
        lue: false,
        created_by: commercial.id
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
