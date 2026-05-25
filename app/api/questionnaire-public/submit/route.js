// app/api/questionnaire-public/submit/route.js
//
// v2 (25 mai 2026) : MERGE intelligent par email pour les acquéreurs
// - Si un client existe déjà avec cet email (via la table contacts), on UPDATE intelligemment
// - Budget min/max et surface min/max sont élargis (max(max), min(min))
// - Zones et typologies recherchées sont unionées (déduplication)
// - Maturité prend la plus chaude
// - Owner et identité (prénom/nom/société) préservés
// - source_detail logge l'événement de fusion
// - Pas de fusion pour les vendeurs (chaque mandat est unique)

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

// ─── Helpers merge ─────────────────────────────────────────────────────

const MATURITE_ORDER = { 'Chaud': 3, 'Tiède': 2, 'Tiede': 2, 'Froid': 1 };

function maxMaturite(a, b) {
  const va = MATURITE_ORDER[a] || 0;
  const vb = MATURITE_ORDER[b] || 0;
  if (va === 0 && vb === 0) return a || b || 'Tiède';
  return va >= vb ? (a || 'Tiède') : (b || 'Tiède');
}

function unionArrays(a, b) {
  const set = new Set();
  (a || []).forEach(x => { if (x) set.add(x); });
  (b || []).forEach(x => { if (x) set.add(x); });
  return Array.from(set);
}

function minNonZero(a, b) {
  const va = Number(a) || 0;
  const vb = Number(b) || 0;
  if (va > 0 && vb > 0) return Math.min(va, vb);
  return va || vb || 0;
}

function maxNonZero(a, b) {
  const va = Number(a) || 0;
  const vb = Number(b) || 0;
  return Math.max(va, vb);
}

function preferNewIfLonger(oldVal, newVal) {
  if (!newVal) return oldVal;
  if (!oldVal) return newVal;
  return String(newVal).length > String(oldVal).length ? newVal : oldVal;
}

// ─── ROUTE ─────────────────────────────────────────────────────────────

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
    const submitterEmail = (reponses.email || '').trim().toLowerCase();

    let createdId = null;
    let createdType = null;
    let merged = false;
    let mergedClientLabel = null;

    // ═════════════════════════════════════════════════════════════════
    // ACQUÉREUR : MERGE intelligent par email si existant
    // ═════════════════════════════════════════════════════════════════
    if (type === 'acquereur') {
      const baseClient = answersToClient(reponses, marche);

      // Tentative de fusion par email
      let existingClient = null;
      if (submitterEmail) {
        // 1. Cherche le contact par email
        const { data: existingContact } = await supabaseAdmin
          .from('contacts')
          .select('id, email')
          .eq('email', submitterEmail)
          .maybeSingle();

        if (existingContact?.id) {
          // 2. Cherche le client lié à ce contact
          const { data: linkedClient } = await supabaseAdmin
            .from('clients')
            .select('*')
            .eq('contact_id', existingContact.id)
            .maybeSingle();

          if (linkedClient?.id) {
            existingClient = linkedClient;
          }
        }
      }

      if (existingClient) {
        // ─── MERGE ────────────────────────────────────────────────────
        merged = true;
        mergedClientLabel = `${existingClient.prenom || ''} ${existingClient.nom || ''}`.trim() || submitterEmail;

        const previousSourceDetail = existingClient.source_detail || {};
        const previousResubmissions = Array.isArray(previousSourceDetail.resubmissions)
          ? previousSourceDetail.resubmissions
          : [];

        const updateData = {
          // Budget : on élargit (min plus bas, max plus haut)
          budget_min: minNonZero(existingClient.budget_min, baseClient.budget_min || baseClient.budgetMin),
          budget_max: maxNonZero(existingClient.budget_max, baseClient.budget_max || baseClient.budgetMax),
          // Surface : pareil
          surface_min: minNonZero(existingClient.surface_min, baseClient.surface_min || baseClient.surfaceMin),
          surface_max: maxNonZero(existingClient.surface_max, baseClient.surface_max || baseClient.surfaceMax),
          // Zones : union
          zones: unionArrays(existingClient.zones, baseClient.zones),
          // Typologies recherchées : union
          typologies_recherchees: unionArrays(
            existingClient.typologies_recherchees,
            baseClient.typologies_recherchees || baseClient.typologiesRecherchees
          ),
          // Maturité : on prend la plus chaude
          maturite: maxMaturite(existingClient.maturite, baseClient.maturite),
          // Téléphone : on prend le plus long
          tel: preferNewIfLonger(existingClient.tel, reponses.tel),
          // Notes : on append le nouveau si présent
          notes: baseClient.notes
            ? `${existingClient.notes || ''}\n\n---\n[Re-soumission ${consentement_date}]\n${baseClient.notes}`.trim()
            : existingClient.notes,
          // source_detail : on logge l'événement
          source_detail: {
            ...previousSourceDetail,
            resubmissions: [
              ...previousResubmissions,
              {
                token,
                marche,
                commercial_id: commercial.id,
                submitted_at: consentement_date,
                consentement_marketing: !!consentement_marketing,
                ip
              }
            ]
          },
          updated_by: commercial.id
          // owner : INCHANGÉ (préserve le commercial historique)
          // prenom/nom/societe : INCHANGÉS (identité déjà confirmée)
        };

        const { error: errUpdate } = await supabaseAdmin
          .from('clients')
          .update(updateData)
          .eq('id', existingClient.id);

        if (errUpdate) {
          console.error('[questionnaire] Erreur merge client:', errUpdate);
          return NextResponse.json({ error: 'Erreur mise à jour: ' + errUpdate.message }, { status: 500 });
        }

        createdId = existingClient.id;
        createdType = 'client';
      } else {
        // ─── INSERT classique ─────────────────────────────────────────
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
    }

    // ═════════════════════════════════════════════════════════════════
    // VENDEUR : pas de fusion (chaque mandat est unique)
    // ═════════════════════════════════════════════════════════════════
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

    // ═════════════════════════════════════════════════════════════════
    // Trace dans questionnaires (toujours)
    // ═════════════════════════════════════════════════════════════════
    await supabaseAdmin.from('questionnaires').insert({
      type,
      nom: `${marche === 'b2c' ? 'Habitation' : 'Investissement'} ${type === 'acquereur' ? 'Acquéreur' : 'Vendeur'} - ${submitterName}${merged ? ' (fusion)' : ''}`,
      lien: `/q/${token}`,
      token,
      profile_id: commercial.id,
      statut: merged ? 'Fusionné' : 'Complété',
      reponses: { ...reponses, _marche: marche, _merged: merged },
      consentement_rgpd,
      consentement_marketing: !!consentement_marketing,
      consentement_date,
      ip_soumission: ip,
      imported_id: createdId,
      imported_type: createdType
    });

    // ═════════════════════════════════════════════════════════════════
    // Notification commercial
    // ═════════════════════════════════════════════════════════════════
    const marcheLabel = marche === 'b2c' ? 'Habitation' : 'Investissement';

    let notifTitre, notifMessage;
    if (merged) {
      notifTitre = `Re-soumission : ${mergedClientLabel}`;
      notifMessage = `${mergedClientLabel} a re-rempli le questionnaire ${marcheLabel}. Critères élargis automatiquement.`;
    } else if (type === 'acquereur') {
      notifTitre = `Lead ${marcheLabel} : ${submitterName}`;
      notifMessage = `${submitterName} cherche à acheter (${marcheLabel})`;
    } else {
      notifTitre = `Mandat ${marcheLabel} : ${submitterName}`;
      notifMessage = `${submitterName} souhaite vendre (${marcheLabel})`;
    }

    await supabaseAdmin.from('notifications').insert({
      user_id: commercial.id,
      titre: notifTitre,
      message: notifMessage,
      type: merged ? 'questionnaire_resubmit' : 'questionnaire_submit',
      lien_type: createdType,
      lien_id: createdId,
      lue: false,
      created_by: commercial.id
    });

    return NextResponse.json({
      success: true,
      type: createdType,
      merged,
      commercial: { prenom: commercial.prenom, nom: commercial.nom }
    });

  } catch (e) {
    console.error('[questionnaire] Erreur:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
