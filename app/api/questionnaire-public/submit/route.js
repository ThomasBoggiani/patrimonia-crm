// app/api/questionnaire-public/submit/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getQuestionnaire,
  validateAnswers,
  answersToClient,
  answersToMandat
} from '@/lib/questionnaires';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, type, marche, reponses, consentement_rgpd, consentement_marketing } = body;

    if (!token || !type || !marche || !reponses) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 });
    }
    if (!['acquereur', 'vendeur'].includes(type)) {
      return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
    }
    if (!['b2b', 'b2c'].includes(marche)) {
      return NextResponse.json({ error: 'Marché invalide' }, { status: 400 });
    }
    if (!consentement_rgpd) {
      return NextResponse.json({ error: 'Consentement RGPD requis' }, { status: 400 });
    }

    const template = getQuestionnaire(type, marche);
    if (!template) {
      return NextResponse.json({ error: 'Questionnaire introuvable' }, { status: 400 });
    }
    const errors = validateAnswers(template, reponses);
    if (errors.length > 0) {
      return NextResponse.json({
        error: 'Champs manquants',
        details: errors.map(e => e.label).join(', ')
      }, { status: 400 });
    }

    const { data: commercial, error: errProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, prenom, nom, email')
      .eq('questionnaire_token', token)
      .maybeSingle();

    if (errProfile || !commercial) {
      return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip') || 'unknown';
    const consentement_date = new Date().toISOString();
    const ownerName = `${commercial.prenom} ${commercial.nom}`.trim();
    const submitterName = `${reponses.prenom || ''} ${reponses.nom || ''}`.trim() || 'Sans nom';

    let createdId = null;
    let createdType = null;

    if (type === 'acquereur') {
      const baseClient = answersToClient(reponses, marche);
      const clientData = {
        ...baseClient,
        owner: ownerName,
        origine: marche === 'b2c' ? 'Questionnaire B2C' : 'Questionnaire B2B',
        source: 'questionnaire_public',
        source_detail: {
          token, marche, commercial_id: commercial.id,
          submitted_at: consentement_date,
          consentement_marketing: !!consentement_marketing
        },
        created_by: commercial.id
      };
      const { data: newClient, error: errClient } = await supabaseAdmin
        .from('clients').insert(clientData).select('id').single();
      if (errClient) {
        console.error('[questionnaire] Erreur client:', errClient);
        return NextResponse.json({ error: 'Erreur enregistrement: ' + errClient.message }, { status: 500 });
      }
      createdId = newClient.id;
      createdType = 'client';
    }

    if (type === 'vendeur') {
      const baseMandat = answersToMandat(reponses, marche);
      const mandatData = {
        nom: baseMandat.nom,
        type: baseMandat.type,
        sous_type: baseMandat.sous_type,
        adresse: baseMandat.adresse,
        surface: baseMandat.surface,
        nb_pieces: baseMandat.nb_pieces,
        nb_chambres: baseMandat.nb_chambres,
        etage: baseMandat.etage,
        prix: baseMandat.prix,
        loyers_annuels: baseMandat.loyersAnnuels,
        taxe_fonciere: baseMandat.taxeFonciere,
        charges_annuelles: baseMandat.chargesAnnuelles,
        statut: 'Sourcing',
        commercialisation: baseMandat.commercialisation,
        owner: ownerName,
        profile_id: commercial.id,
        pourvoyeur_id: commercial.id,
        contact: submitterName,
        tel: reponses.tel || null,
        description: baseMandat.description,
        mandant_info: {
          ...baseMandat.mandant_info,
          source: 'questionnaire_public',
          marche, token,
          submitted_at: consentement_date,
          consentement_marketing: !!consentement_marketing
        },
        created_by: commercial.id
      };
      const { data: newMandat, error: errMandat } = await supabaseAdmin
        .from('mandats').insert(mandatData).select('id').single();
      if (errMandat) {
        console.error('[questionnaire] Erreur mandat:', errMandat);
        return NextResponse.json({ error: 'Erreur enregistrement: ' + errMandat.message }, { status: 500 });
      }
      createdId = newMandat.id;
      createdType = 'mandat';
    }

    await supabaseAdmin.from('questionnaires').insert({
      type,
      nom: `${marche === 'b2c' ? 'Habitation' : 'Investissement'} ${type === 'acquereur' ? 'Acquéreur' : 'Vendeur'} - ${submitterName}`,
      lien: `/q/${token}`,
      token,
      profile_id: commercial.id,
      statut: 'Complété',
      reponses: { ...reponses, _marche: marche },
      consentement_rgpd,
      consentement_marketing: !!consentement_marketing,
      consentement_date,
      ip_soumission: ip,
      imported_id: createdId,
      imported_type: createdType
    });

    const marcheLabel = marche === 'b2c' ? 'Habitation' : 'Investissement';
    const notifTitre = type === 'acquereur'
      ? `Lead ${marcheLabel} : ${submitterName}`
      : `Mandat ${marcheLabel} : ${submitterName}`;
    const notifMessage = type === 'acquereur'
      ? `${submitterName} cherche à acheter (${marcheLabel})`
      : `${submitterName} souhaite vendre (${marcheLabel})`;

    await supabaseAdmin.from('notifications').insert({
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
