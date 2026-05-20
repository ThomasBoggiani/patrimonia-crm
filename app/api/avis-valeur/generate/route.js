// ═══════════════════════════════════════════════════════════════════
// app/api/avis-valeur/generate/route.js
// Génère un PPTX à partir du template stocké dans Supabase Storage,
// en remplaçant les placeholders par les données du mandat + avis_valeur.
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

// Service role pour accéder au bucket privé "templates"
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─── Helpers de formatage ─────────────────────────────────────────────
const fmtPrix = (n) => {
  const num = parseFloat(n);
  if (!num || num === 0) return '';
  return num.toLocaleString('fr-FR') + ' €';
};

const fmtPrixFAI = (n) => {
  const num = parseFloat(n);
  if (!num || num === 0) return '';
  return num.toLocaleString('fr-FR') + ' € FAI';
};

const fmtPrixM2 = (prix, surface) => {
  const p = parseFloat(prix);
  const s = parseFloat(surface);
  if (!p || !s || s === 0) return '';
  return Math.round(p / s).toLocaleString('fr-FR');
};

const fmtNumber = (n) => {
  const num = parseFloat(n);
  if (!num || num === 0) return '';
  return num.toLocaleString('fr-FR');
};

const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return iso;
  }
};

function deduireQuartier(adresse) {
  if (!adresse) return '';
  const m = adresse.match(/\b(\d{5})\b/);
  if (m) {
    const cp = m[1];
    if (cp.startsWith('75')) {
      const arr = parseInt(cp.slice(3, 5), 10);
      return `Paris ${arr}e`;
    }
  }
  return adresse;
}

function buildContext(mandat, avis) {
  const a = avis || {};
  const adresse = mandat?.adresse || '';
  const surface = parseFloat(mandat?.surface) || 0;

  const loc = a.localisation || {};
  const sit_loc = a.situation_locative || {};
  const carac = a.caracteristiques || {};
  const comp = a.comparables || {};
  const swot = a.swot || {};
  const m2 = a.methode_m2 || {};
  const capi = a.methode_capi || {};
  const reconv = a.reconversion || {};
  const preco = a.preconisation || {};

  return {
    mandat_adresse: adresse,
    mandat_titre_court: mandat?.nom || adresse,
    mandat_type_libelle: mandat?.sousType || mandat?.type || 'Bien immobilier',
    mandat_quartier: deduireQuartier(adresse),
    mandat_type_long: (mandat?.sousType || mandat?.type || 'bien').toLowerCase(),
    mandat_statut_occupation: '',
    mandat_surface_totale: fmtNumber(surface),

    loc_transports: loc.transports || '',
    loc_commentaire: loc.commentaire || '',

    carac_annee: carac.annee_construction || '',
    carac_architecte: carac.architecte || '',
    carac_distribution: carac.distribution || '',
    carac_atouts: Array.isArray(carac.atouts_distinctifs) 
      ? carac.atouts_distinctifs.map(x => '• ' + x).join('\n') 
      : '',
    carac_commentaire: carac.commentaire || '',

    locatif_commentaire: sit_loc.commentaire || '',
    locatif_ca_actuel_ht: fmtPrix(
      (Array.isArray(mandat?.etat_locatif) ? mandat.etat_locatif : []).reduce(
        (s, l) => s + (parseFloat(l.loyer) || 0) * 12, 0)
    ),
    locatif_ca_potentiel_ht: fmtPrix(
      (Array.isArray(mandat?.etat_locatif) ? mandat.etat_locatif : []).reduce(
        (s, l) => {
          const p = parseFloat(l.loyer_potentiel) || 0;
          return s + (p > 0 ? p : (parseFloat(l.loyer) || 0)) * 12;
        }, 0)
    ),

    marche_prix_zone_min: fmtNumber(comp.prix_zone_min),
    marche_prix_zone_max: fmtNumber(comp.prix_zone_max),
    marche_rdt_zone_min: comp.rendement_zone_min ? `${comp.rendement_zone_min} %` : '',
    marche_rdt_zone_max: comp.rendement_zone_max ? `${comp.rendement_zone_max} %` : '',
    marche_commentaire: comp.commentaire || '',
    transactions_recentes_texte: comp.transactions_recentes || '',

    val_basse_prix_m2: fmtNumber(m2.valeur_basse?.prix_m2),
    val_basse_total: fmtPrix(m2.valeur_basse?.valeur_totale),
    val_basse_commentaire: m2.valeur_basse?.commentaire || '',
    val_centrale_prix_m2: fmtNumber(m2.valeur_centrale?.prix_m2),
    val_centrale_total: fmtPrix(m2.valeur_centrale?.valeur_totale),
    val_centrale_commentaire: m2.valeur_centrale?.commentaire || '',
    val_haute_prix_m2: fmtNumber(m2.valeur_haute?.prix_m2),
    val_haute_total: fmtPrix(m2.valeur_haute?.valeur_totale),
    val_haute_commentaire: m2.valeur_haute?.commentaire || '',

    capi_ca_base: fmtPrix(capi.ca_base),
    capi_zone_atterrissage: capi.zone_atterrissage || '',
    capi_hypotheses_table: Array.isArray(capi.hypotheses) 
      ? capi.hypotheses.map(h => 
          `${h.rendement_pct} % → ${fmtPrix(h.valeur_acte)} — ${h.lecture || ''}`
        ).join('\n')
      : '',

    reconv_usages: Array.isArray(reconv.usages)
      ? reconv.usages.map(u => `${u.titre || ''}\n${u.description || ''}`).join('\n\n')
      : '',
    reconv_bilan: reconv.bilan_financier || '',
    reconv_profils_acquereurs: Array.isArray(reconv.profils_acquereurs)
      ? reconv.profils_acquereurs.map(p => '• ' + p).join('\n')
      : '',

    preco_prix_coup_de_coeur: fmtPrixFAI(preco.prix_coup_de_coeur),
    preco_prix_coup_de_coeur_m2: fmtPrixM2(preco.prix_coup_de_coeur, surface),
    preco_prix_marche: fmtPrixFAI(preco.prix_marche),
    preco_prix_marche_m2: fmtPrixM2(preco.prix_marche, surface),
    preco_prix_plancher: fmtPrixFAI(preco.prix_plancher),
    preco_recommandation: preco.recommandation || '',
    preco_avis_client: preco.avis_client || '',
    consultant_nom: preco.consultant_nom || '',
    consultant_email: preco.consultant_email || '',
    consultant_tel: preco.consultant_tel || '',
    consultant_titre: 'Directeur commercial',
    honoraires_pct: preco.honoraires_pct ? `${preco.honoraires_pct}` : '5',

    date_estimation: fmtDate(a.date_estimation),
    validite_mois: a.validite_mois || '1',

    swot_forces: Array.isArray(swot.forces) ? swot.forces.map(x => '• ' + x).join('\n') : '',
    swot_opportunites: Array.isArray(swot.opportunites) ? swot.opportunites.map(x => '• ' + x).join('\n') : '',
    swot_facteurs_limitatifs: Array.isArray(swot.facteurs_limitatifs) ? swot.facteurs_limitatifs.map(x => '• ' + x).join('\n') : '',
    swot_menaces: Array.isArray(swot.menaces) ? swot.menaces.map(x => '• ' + x).join('\n') : '',
  };
}

export async function POST(req) {
  try {
    const { mandatId } = await req.json();
    if (!mandatId) {
      return NextResponse.json({ error: 'mandatId requis' }, { status: 400 });
    }

    const { data: mandatData, error: mErr } = await supabaseAdmin
      .from('mandats')
      .select('*')
      .eq('id', mandatId)
      .single();

    if (mErr || !mandatData) {
      return NextResponse.json({ 
        error: 'Mandat introuvable', 
        details: mErr?.message 
      }, { status: 404 });
    }

    const avis = mandatData.avis_valeur;
    if (!avis) {
      return NextResponse.json({ 
        error: 'Aucun avis de valeur saisi pour ce mandat' 
      }, { status: 400 });
    }

    const { data: templateBlob, error: tErr } = await supabaseAdmin.storage
      .from('avis_valeur_generique.pptx')
      .download('templates.pptx');

    if (tErr || !templateBlob) {
      return NextResponse.json({ 
        error: 'Template introuvable dans le bucket templates',
        details: tErr?.message 
      }, { status: 500 });
    }

    const templateBuffer = Buffer.from(await templateBlob.arrayBuffer());
    const zip = new PizZip(templateBuffer);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{', end: '}' },
      nullGetter: () => '',
    });

    const context = buildContext(mandatData, avis);
    doc.render(context);

    const outputBuffer = doc.getZip().generate({
      type: 'nodebuffer',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });

    const adresse = (mandatData.adresse || 'avis').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
    const filename = `Avis_de_valeur_${adresse}.pptx`;

    return new NextResponse(outputBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': outputBuffer.length.toString(),
      },
    });

  } catch (e) {
    console.error('[avis-valeur/generate] Erreur:', e);
    return NextResponse.json({ 
      error: 'Erreur lors de la génération du PPTX',
      details: e?.message || String(e),
      properties: e?.properties ? JSON.stringify(e.properties).slice(0, 500) : undefined
    }, { status: 500 });
  }
}
