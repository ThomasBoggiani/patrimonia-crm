// ═══════════════════════════════════════════════════════════════════
// lib/pdf/templates/AvisDeValeur.jsx — v3 (charte « Turenne »)
// Avis de valeur PDF · format 16:9 (960×540 pt), design maison :
//   couverture split verte + photo pleine page, filets dorés, titres serif
//   verts, cartes chiffrées, 3 prix (carte centrale verte), pied de page.
// Lit mandat.avis_valeur (localisation, situation_locative, caracteristiques,
//   comparables, swot, methode_m2, methode_capi, reconversion, preconisation).
// Adapté au marché : BtoB ajoute capitalisation + reconversion.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { normalizePhotos } from '../helpers';

// ─── PALETTE ───────────────────────────────────────────────────────
const GREEN = '#3D4C3A';        // panneaux, barres, titres
const GOLD = '#A6864E';         // filets / eyebrows / chiffres d'accent
const INK = '#2C2C2A';
const MUTED = '#6A6A66';
const CARD = '#F1F1EC';
const CARD_ON_GREEN = '#E9EEE6';
const WHITE = '#FFFFFF';

// Couleurs SWOT (sobres)
const SWOT = {
  forces:     { bg: '#EDF3E4', bd: '#5C7A33', tx: '#243b0f', t: 'Forces' },
  opportunites:{ bg: '#E7F0F8', bd: '#2E6193', tx: '#12324f', t: 'Opportunités' },
  facteurs:   { bg: '#FAF0DD', bd: '#9A6B1E', tx: '#4a3208', t: 'Facteurs limitatifs' },
  menaces:    { bg: '#FBEBEA', bd: '#9E3B34', tx: '#4d1512', t: 'Menaces' },
};

// ─── HELPERS ───────────────────────────────────────────────────────
const safe = (v, f = '') => { if (v === null || v === undefined) return f; const s = String(v).trim(); return s || f; };
const num = (n) => { const x = parseFloat(n); return isNaN(x) ? 0 : x; };
const fmtNum = (n) => { const x = num(n); return x ? x.toLocaleString('fr-FR').replace(/[  ]/g, ' ') : ''; };
const fmtEUR = (n) => { const x = num(n); return x ? fmtNum(x) + ' €' : '—'; };
const fmtM2 = (prix, surf) => { const p = num(prix), s = num(surf); return (p && s) ? fmtNum(Math.round(p / s)) + ' €/m²' : ''; };
const lines = (t) => safe(t).split('\n').filter(x => x.trim());

// ─── CONTENU AGENCE (statique — identique sur chaque avis) ──────────
// Repris de la plaquette I&P. Facile à ajuster ici.
const AGENCE = {
  intro: "Expert immobilier indépendant spécialisé dans la vente d'actifs depuis 2010 en Île-de-France. Reconnue pour son expertise et son approche stratégique de valorisation, notre agence maximise la valeur de chaque bien et intervient à chaque étape : analyse de faisabilité, conception, pilotage des travaux, structuration juridique et financière, jusqu'à la commercialisation.",
  expertises: [
    { t: 'Promotion immobilière', d: "Opérations fondées sur la qualité du sourcing et l'étude approfondie de la faisabilité architecturale. Recherche de terrains et d'immeubles, structuration des opérations." },
    { t: 'Immeubles & hôtels', d: "Commercialisation en bloc ou par lot d'immeubles résidentiels, de bureaux ou d'hôtels, auprès d'un réseau d'investisseurs qualifiés." },
    { t: 'Habitation & patrimoine', d: "Vente de biens d'exception et accompagnement patrimonial sur-mesure, avec une lecture fine du marché et des acquéreurs." },
  ],
  valeurs: ['Discrétion', 'Exigence', 'Transparence', 'Performance'],
  strategie: [
    { t: 'Étude de faisabilité', d: "Analyse approfondie de l'actif : caractéristiques techniques, juridiques, urbaines et économiques." },
    { t: 'Évaluation', d: "Scénarios de valorisation comparés, lecture fine du marché, identification des leviers d'optimisation." },
    { t: 'Mise en valeur', d: "Préparation du bien et du dossier de vente : récit, photos, plans, sécurisation juridique." },
    { t: 'Communication', d: "Diffusion ciblée auprès d'un réseau d'acquéreurs qualifiés, en off-market ou en marché ouvert." },
  ],
  diffusion: [
    'Site internet & meilleurs portails immobiliers',
    'Mailing direct sur notre base de données qualifiée',
    'Brochure personnalisée & présentation dédiée',
    'Publicités digitales ciblées',
    'Réseau de marchands de biens & foncières',
    'CGP, fonds d\'investissement, family offices, familles fortunées',
  ],
};
// Équipe — à ajuster (constante). Bios volontairement courtes.
const EQUIPE = [
  { nom: 'Thomas Boggiani', role: 'Dirigeant', bio: "Fondateur d'Immeubles & Patrimoine. Pilote la stratégie de valorisation et l'accompagnement des mandants sur l'ensemble du projet de vente." },
  { nom: 'Philippe Korchia', role: 'Directeur commercial — Vente en bloc', bio: "Plus de vingt ans en immobilier d'entreprise (capital markets). Commercialise immeubles, hôtels et locaux auprès d'un portefeuille d'investisseurs fidèles." },
];

// ─── PRIMITIVES ────────────────────────────────────────────────────
function Footer({ adresse, date }) {
  return (
    <View fixed style={{ position: 'absolute', left: 44, right: 44, bottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <Text style={{ fontSize: 7.5, color: MUTED }}>
        <Text style={{ fontFamily: 'Helvetica-Bold', color: GREEN }}>IMMEUBLES &amp; PATRIMOINE</Text>
        {`   —   Avis de valeur · ${adresse} · ${date} · Confidentiel`}
      </Text>
      <Text style={{ fontSize: 8, color: MUTED }} render={({ pageNumber }) => `${pageNumber}`} />
    </View>
  );
}

function Header({ eyebrow, title }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 9, letterSpacing: 3, color: GOLD, fontFamily: 'Helvetica-Bold' }}>{safe(eyebrow).toUpperCase()}</Text>
      <Text style={{ fontSize: 26, fontFamily: 'Times-Bold', color: GREEN, marginTop: 5 }}>{title}</Text>
    </View>
  );
}

function Content({ adresse, date, eyebrow, title, children }) {
  return (
    <Page size={[960, 540]} style={{ paddingTop: 38, paddingHorizontal: 44, paddingBottom: 44, backgroundColor: WHITE, color: INK, fontFamily: 'Helvetica' }}>
      <Header eyebrow={eyebrow} title={title} />
      <View style={{ flex: 1 }}>{children}</View>
      <Footer adresse={adresse} date={date} />
    </Page>
  );
}

function StatRow({ figure, text }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: CARD, borderRadius: 6, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 9, alignItems: 'center' }}>
      <Text style={{ width: 150, fontSize: 19, fontFamily: 'Times-Bold', color: GREEN }}>{figure}</Text>
      <Text style={{ flex: 1, fontSize: 10, color: INK, lineHeight: 1.4 }}>{text}</Text>
    </View>
  );
}

function StatCard({ figure, text }) {
  return (
    <View style={{ width: '48.5%', backgroundColor: CARD, borderRadius: 8, padding: 16, marginBottom: 12 }}>
      <Text style={{ fontSize: 21, fontFamily: 'Times-Bold', color: GREEN, marginBottom: 7 }}>{figure}</Text>
      <Text style={{ fontSize: 9.5, color: INK, lineHeight: 1.4 }}>{text}</Text>
    </View>
  );
}

function PriceCard({ eyebrow, price, sub, text, highlight }) {
  const bg = highlight ? GREEN : CARD;
  const eb = highlight ? GOLD : MUTED;
  const pc = highlight ? WHITE : GREEN;
  const tc = highlight ? CARD_ON_GREEN : INK;
  return (
    <View style={{ width: '31.8%', backgroundColor: bg, borderRadius: 10, padding: 18, minHeight: 210 }}>
      <Text style={{ fontSize: 8.5, letterSpacing: 2, fontFamily: 'Helvetica-Bold', color: eb, marginBottom: 14 }}>{safe(eyebrow).toUpperCase()}</Text>
      <Text style={{ fontSize: 23, fontFamily: 'Times-Bold', color: pc, marginBottom: 6 }}>{price}</Text>
      {sub ? <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Oblique', color: tc, marginBottom: 14 }}>{sub}</Text> : <View style={{ height: 14 }} />}
      <Text style={{ fontSize: 9.5, color: tc, lineHeight: 1.45, marginTop: 6 }}>{text}</Text>
    </View>
  );
}

function Bullet({ children, color = INK }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 6 }}>
      <Text style={{ fontSize: 10, color: GOLD, marginRight: 6 }}>•</Text>
      <Text style={{ flex: 1, fontSize: 10, color, lineHeight: 1.4 }}>{children}</Text>
    </View>
  );
}

function Photo({ src, style }) {
  if (src) return <Image src={src} style={{ objectFit: 'cover', ...style }} />;
  return <View style={{ backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', ...style }}><Text style={{ fontSize: 9, color: MUTED, fontFamily: 'Helvetica-Oblique' }}>Photo</Text></View>;
}

// ═════════════════════════════════════════════════════════════════════
export default function AvisDeValeur({ mandat, avisData = {}, conseiller }) {
  const av = avisData || {};
  const loc = av.localisation || {};
  const carac = av.caracteristiques || {};
  const comp = av.comparables || {};
  const swot = av.swot || {};
  const m2 = av.methode_m2 || {};
  const capi = av.methode_capi || { hypotheses: [] };
  const reconv = av.reconversion || { usages: [], profils_acquereurs: [] };
  const preco = av.preconisation || {};

  const estB2C = (mandat?.marche || '') === 'b2c';
  const photos = normalizePhotos(mandat) || [];
  const surface = num(mandat?.surface);
  const adresse = [safe(mandat?.adresse), safe(mandat?.ville)].filter(Boolean).join(', ');
  const date = safe(av.date_estimation) || new Date().toLocaleDateString('fr-FR');
  const titre = safe(mandat?.nom, 'Bien à évaluer');
  const mapSrc = mandat?.map_static_image_url || mandat?.cadastre_image_url || null;

  // Fourchette (préco plancher/coup de cœur, sinon méthode m² basse/haute)
  const bas = num(preco.prix_plancher) || num(m2.valeur_basse?.valeur_totale);
  const haut = num(preco.prix_coup_de_coeur) || num(m2.valeur_haute?.valeur_totale);
  const central = num(preco.prix_marche) || num(m2.valeur_centrale?.valeur_totale);
  const fourchette = (bas && haut) ? `${fmtEUR(bas)} — ${fmtEUR(haut)}` : '';

  const consultantNom = safe(preco.consultant_nom) || safe(conseiller?.nom) || 'Immeubles & Patrimoine';

  return (
    <Document title={`Avis de valeur — ${titre}`} author="Immeubles & Patrimoine">

      {/* ─── 1. COUVERTURE (split vert + photo) ─── */}
      <Page size={[960, 540]} style={{ flexDirection: 'row', fontFamily: 'Helvetica' }}>
        <View style={{ width: '45%', backgroundColor: GREEN, paddingHorizontal: 50, paddingVertical: 46, justifyContent: 'center' }}>
          <Text style={{ fontSize: 11, letterSpacing: 4, color: GOLD, fontFamily: 'Helvetica-Bold' }}>IMMEUBLES &amp; PATRIMOINE</Text>
          <Text style={{ fontSize: 44, fontFamily: 'Times-Bold', color: WHITE, marginTop: 46, marginBottom: 22 }}>Avis de valeur</Text>
          <Text style={{ fontSize: 18, fontFamily: 'Times-Roman', color: WHITE, lineHeight: 1.35 }}>{safe(mandat?.adresse, titre)}</Text>
          {mandat?.ville ? <Text style={{ fontSize: 18, fontFamily: 'Times-Roman', color: WHITE, lineHeight: 1.35 }}>{safe(mandat?.ville)}</Text> : null}
          {carac.commentaire || carac.distribution ? (
            <Text style={{ fontSize: 10.5, fontFamily: 'Helvetica-Oblique', color: CARD_ON_GREEN, marginTop: 22, lineHeight: 1.4 }}>
              {safe(carac.commentaire || carac.distribution).slice(0, 160)}
            </Text>
          ) : null}
          <Text style={{ position: 'absolute', left: 50, bottom: 40, fontSize: 9, color: '#AEBBA8' }}>
            {date} · Document confidentiel · Établi sur pièces, avant visite
          </Text>
        </View>
        <View style={{ width: '55%', height: '100%' }}>
          <Photo src={photos[0]} style={{ width: '100%', height: '100%' }} />
        </View>
      </Page>

      {/* ─── 2. SYNTHÈSE ─── */}
      <Content adresse={adresse} date={date} eyebrow="Synthèse" title={estB2C ? 'Les chiffres clés du bien' : "Les chiffres clés de l'actif"}>
        <View style={{ flexDirection: 'row', gap: 22 }}>
          <View style={{ flex: 1 }}>
            <StatRow figure={surface ? `${fmtNum(surface)} m²` : '—'} text={safe(carac.distribution) || 'Surface du bien'} />
            <StatRow figure={num(mandat?.dpe_consommation) ? `DPE ${safe(mandat?.dpe_classe) || ''}`.trim() : 'DPE'} text={num(mandat?.dpe_consommation) ? `${fmtNum(mandat?.dpe_consommation)} kWh/m²/an` : 'Diagnostic de performance énergétique'} />
            {estB2C ? (
              <StatRow figure={num(mandat?.nb_pieces) ? `${fmtNum(mandat?.nb_pieces)} pièces` : '—'} text={num(mandat?.nb_chambres) ? `${fmtNum(mandat?.nb_chambres)} chambre(s)` : 'Distribution'} />
            ) : (
              <StatRow figure={num(mandat?.nb_lots) ? `${fmtNum(mandat?.nb_lots)} lots` : '—'} text={num(mandat?.loyers_annuels) ? `${fmtEUR(mandat?.loyers_annuels)} de revenus/an` : 'Immeuble de rapport'} />
            )}
            {fourchette ? (
              <View style={{ backgroundColor: GREEN, borderRadius: 6, paddingVertical: 12, paddingHorizontal: 16, marginTop: 6 }}>
                <Text style={{ fontSize: 11, color: WHITE }}>
                  Fourchette de valorisation proposée : <Text style={{ fontFamily: 'Times-Bold', fontSize: 13 }}>{fourchette}</Text>
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ width: '38%' }}>
            <Photo src={photos[1] || photos[0]} style={{ width: '100%', height: 330, borderRadius: 6 }} />
          </View>
        </View>
      </Content>

      {/* ─── AGENCE : AVANT-PROPOS ─── */}
      <Content adresse={adresse} date={date} eyebrow="Avant-propos" title="Un mot avant tout">
        <View style={{ flexDirection: 'row', gap: 22 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: INK, lineHeight: 1.7 }}>
              Cher mandant,{'\n\n'}
              Nous vous remercions de la confiance que vous nous accordez pour la valorisation de votre bien
              {adresse ? ` situé ${adresse}` : ''}.{'\n\n'}
              Le présent avis de valeur a pour objectif de vous éclairer sur la valeur de marché de cet actif, à l'appui de nos analyses, de comparables récents et de méthodes d'évaluation reconnues.{'\n\n'}
              Nous restons à votre entière disposition pour échanger sur les éléments de ce document.
            </Text>
            <Text style={{ fontSize: 11, fontFamily: 'Times-Italic', color: GREEN, marginTop: 18 }}>L'équipe Immeubles &amp; Patrimoine</Text>
          </View>
          <Photo src={photos[1] || photos[0]} style={{ width: '40%', height: 320, borderRadius: 6 }} />
        </View>
      </Content>

      {/* ─── AGENCE : QUI SOMMES-NOUS ─── */}
      <Content adresse={adresse} date={date} eyebrow="L'agence" title="Qui sommes-nous">
        <Text style={{ fontSize: 12, color: INK, lineHeight: 1.7, marginBottom: 20 }}>{AGENCE.intro}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {AGENCE.expertises.map((e, i) => (
            <View key={i} style={{ width: '31.5%', backgroundColor: CARD, borderRadius: 8, padding: 16 }}>
              <Text style={{ fontSize: 12.5, fontFamily: 'Times-Bold', color: GREEN, marginBottom: 8 }}>{e.t}</Text>
              <Text style={{ fontSize: 9.5, color: INK, lineHeight: 1.45 }}>{e.d}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          {AGENCE.valeurs.map((v, i) => (
            <Text key={i} style={{ fontSize: 9, letterSpacing: 2, fontFamily: 'Helvetica-Bold', color: GOLD, backgroundColor: '#F6F1E8', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 4 }}>{v.toUpperCase()}</Text>
          ))}
        </View>
      </Content>

      {/* ─── AGENCE : NOTRE STRATÉGIE ─── */}
      <Content adresse={adresse} date={date} eyebrow="Méthode" title="Notre stratégie de valorisation">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {AGENCE.strategie.map((s, i) => (
            <View key={i} style={{ width: '48.5%', flexDirection: 'row', marginBottom: 16 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 12, fontFamily: 'Times-Bold', color: WHITE }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: GREEN, marginBottom: 3 }}>{s.t}</Text>
                <Text style={{ fontSize: 10, color: INK, lineHeight: 1.45 }}>{s.d}</Text>
              </View>
            </View>
          ))}
        </View>
      </Content>

      {/* ─── AGENCE : COMMUNICATION & DIFFUSION ─── */}
      <Content adresse={adresse} date={date} eyebrow="Commercialisation" title="Une diffusion ciblée & maîtrisée">
        <View style={{ flexDirection: 'row', gap: 22 }}>
          <View style={{ flex: 1 }}>
            {AGENCE.diffusion.map((d, i) => <Bullet key={i}>{d}</Bullet>)}
          </View>
          <View style={{ width: '40%', backgroundColor: GREEN, borderRadius: 8, padding: 20, justifyContent: 'center' }}>
            <Text style={{ fontSize: 10, letterSpacing: 2, color: GOLD, fontFamily: 'Helvetica-Bold', marginBottom: 10 }}>OFF-MARKET</Text>
            <Text style={{ fontSize: 12, color: WHITE, lineHeight: 1.5 }}>
              Pour les biens d'exception, une approche confidentielle auprès d'un cercle restreint d'acquéreurs qualifiés, sans exposition publique.
            </Text>
          </View>
        </View>
      </Content>

      {/* ─── AGENCE : NOTRE ÉQUIPE ─── */}
      <Content adresse={adresse} date={date} eyebrow="L'agence" title="Vos interlocuteurs">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          {EQUIPE.map((m, i) => (
            <View key={i} style={{ width: '48.5%', backgroundColor: CARD, borderRadius: 8, padding: 20 }}>
              <Text style={{ fontSize: 15, fontFamily: 'Times-Bold', color: GREEN }}>{m.nom}</Text>
              <Text style={{ fontSize: 9, letterSpacing: 1.5, color: GOLD, fontFamily: 'Helvetica-Bold', marginTop: 3, marginBottom: 10 }}>{m.role.toUpperCase()}</Text>
              <Text style={{ fontSize: 10, color: INK, lineHeight: 1.5 }}>{m.bio}</Text>
            </View>
          ))}
        </View>
      </Content>

      {/* ─── 3. CARACTÉRISTIQUES & ATOUTS ─── */}
      {(Array.isArray(carac.atouts_distinctifs) && carac.atouts_distinctifs.length) || carac.distribution || carac.annee_construction ? (
        <Content adresse={adresse} date={date} eyebrow="Le bien" title="Caractéristiques & atouts">
          <View style={{ flexDirection: 'row', gap: 22 }}>
            <Photo src={photos[2] || photos[1]} style={{ width: '42%', height: 350, borderRadius: 6 }} />
            <View style={{ flex: 1 }}>
              {carac.annee_construction ? <Text style={{ fontSize: 11, color: INK, marginBottom: 6 }}><Text style={{ fontFamily: 'Helvetica-Bold', color: GREEN }}>Année : </Text>{safe(carac.annee_construction)}{carac.architecte ? ` · ${safe(carac.architecte)}` : ''}</Text> : null}
              {carac.distribution ? <Text style={{ fontSize: 10, color: INK, lineHeight: 1.5, marginBottom: 12 }}>{safe(carac.distribution)}</Text> : null}
              {(carac.atouts_distinctifs || []).slice(0, 8).map((a, i) => <Bullet key={i}>{safe(a)}</Bullet>)}
              {carac.commentaire ? <Text style={{ fontSize: 10, color: MUTED, fontFamily: 'Helvetica-Oblique', lineHeight: 1.5, marginTop: 10 }}>{safe(carac.commentaire)}</Text> : null}
            </View>
          </View>
        </Content>
      ) : null}

      {/* ─── 4. LOCALISATION ─── */}
      {mapSrc || loc.transports || loc.commentaire ? (
        <Content adresse={adresse} date={date} eyebrow="Localisation & accessibilité" title="Un emplacement, un contexte">
          <View style={{ flexDirection: 'row', gap: 22 }}>
            <Photo src={mapSrc} style={{ width: '55%', height: 350, borderRadius: 6 }} />
            <View style={{ flex: 1 }}>
              {loc.commentaire ? <Text style={{ fontSize: 10.5, color: INK, lineHeight: 1.55, marginBottom: 14 }}>{safe(loc.commentaire)}</Text> : null}
              {loc.transports ? (
                <>
                  <Text style={{ fontSize: 9, letterSpacing: 2, color: GOLD, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>TRANSPORTS</Text>
                  {lines(loc.transports).slice(0, 8).map((l, i) => <Bullet key={i}>{l}</Bullet>)}
                </>
              ) : null}
            </View>
          </View>
        </Content>
      ) : null}

      {/* ─── 5. ANALYSE DE MARCHÉ (comparables) ─── */}
      <Content adresse={adresse} date={date} eyebrow="Analyse de marché" title={estB2C ? 'Le prix au m² du secteur' : 'Le marché du secteur'}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <StatCard figure={comp.prix_zone_min || comp.prix_zone_max ? `${fmtNum(comp.prix_zone_min)} – ${fmtNum(comp.prix_zone_max)} €/m²` : '—'} text="Fourchette de prix au m² observée sur le secteur (ventes réelles DVF)." />
          <StatCard figure={safe(comp.commentaire) ? '' : '—'} text={safe(comp.commentaire) || 'Commentaire de marché.'} />
          {!estB2C && (comp.rendement_zone_min || comp.rendement_zone_max) ? (
            <StatCard figure={`${fmtNum(comp.rendement_zone_min)} – ${fmtNum(comp.rendement_zone_max)} %`} text="Rendement brut de la zone (immeubles de rapport)." />
          ) : null}
        </View>
        {comp.transactions_recentes ? (
          <View style={{ marginTop: 6 }}>
            <Text style={{ fontSize: 9, letterSpacing: 2, color: GOLD, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>VENTES DE RÉFÉRENCE (DVF)</Text>
            {lines(comp.transactions_recentes).slice(0, 9).map((l, i) => (
              <Text key={i} style={{ fontSize: 9, color: INK, lineHeight: 1.5 }}>{l}</Text>
            ))}
          </View>
        ) : null}
      </Content>

      {/* ─── 6. VALORISATION — 3 PRIX ─── */}
      {(bas || central || haut) ? (
        <Content adresse={adresse} date={date} eyebrow="Valorisation" title="Notre préconisation de prix">
          {preco.recommandation ? <Text style={{ fontSize: 10.5, fontFamily: 'Helvetica-Oblique', color: MUTED, marginBottom: 16, lineHeight: 1.45 }}>{safe(preco.recommandation).slice(0, 220)}</Text> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <PriceCard eyebrow="Prudent" price={fmtEUR(bas)} sub={fmtM2(bas, surface)} text="Base de négociation — positionnement plancher, liquidité rapide." />
            <PriceCard eyebrow="Valeur centrale" price={fmtEUR(central)} sub={fmtM2(central, surface)} text="Prix de marché recommandé, cohérent avec les comparables." highlight />
            <PriceCard eyebrow="Présentation" price={fmtEUR(haut)} sub={fmtM2(haut, surface)} text="Prix d'affichage — acquéreur convaincu, bien d'exception." />
          </View>
          <Text style={{ fontSize: 9, color: MUTED, marginTop: 16 }}>
            Prix nets vendeur. Honoraires d'agence : {preco.honoraires_pct ? `${safe(preco.honoraires_pct)} %` : 'selon barème'} — le prix FAI est mis en avant à la commercialisation.
          </Text>
        </Content>
      ) : null}

      {/* ─── 7. (BtoB) CAPITALISATION ─── */}
      {!estB2C && (num(capi.ca_base) || (capi.hypotheses || []).length) ? (
        <Content adresse={adresse} date={date} eyebrow="Valorisation" title="Approche par capitalisation">
          {num(capi.ca_base) ? <Text style={{ fontSize: 11, marginBottom: 14 }}><Text style={{ fontFamily: 'Helvetica-Bold', color: GREEN }}>Revenus de référence : </Text>{fmtEUR(capi.ca_base)} / an</Text> : null}
          {(capi.hypotheses || []).map((h, i) => (
            <View key={i} style={{ flexDirection: 'row', backgroundColor: CARD, borderRadius: 6, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 8, alignItems: 'center' }}>
              <Text style={{ width: 70, fontSize: 15, fontFamily: 'Times-Bold', color: GREEN }}>{fmtNum(h.rendement_pct)} %</Text>
              <Text style={{ width: 150, fontSize: 12, fontFamily: 'Helvetica-Bold', color: INK }}>{fmtEUR(h.valeur_acte)}</Text>
              <Text style={{ flex: 1, fontSize: 9.5, color: MUTED }}>{safe(h.lecture)}</Text>
            </View>
          ))}
          {capi.zone_atterrissage ? <Text style={{ fontSize: 10, color: INK, fontFamily: 'Helvetica-Oblique', marginTop: 10, lineHeight: 1.45 }}>{safe(capi.zone_atterrissage)}</Text> : null}
        </Content>
      ) : null}

      {/* ─── 8. (BtoB) RECONVERSION ─── */}
      {!estB2C && ((reconv.usages || []).length || reconv.bilan_financier) ? (
        <Content adresse={adresse} date={date} eyebrow="Potentiel" title="Scénarios de reconversion">
          {(reconv.usages || []).slice(0, 3).map((u, i) => (
            <View key={i} style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: GREEN, marginBottom: 3 }}>{safe(u.titre)}</Text>
              <Text style={{ fontSize: 10, color: INK, lineHeight: 1.45 }}>{safe(u.description)}</Text>
            </View>
          ))}
          {reconv.bilan_financier ? <Text style={{ fontSize: 9.5, color: MUTED, fontFamily: 'Helvetica-Oblique', lineHeight: 1.5, marginTop: 6 }}>{safe(reconv.bilan_financier)}</Text> : null}
        </Content>
      ) : null}

      {/* ─── 9. SWOT / POINTS DE VIGILANCE ─── */}
      {['forces', 'opportunites', 'facteurs_limitatifs', 'menaces'].some(k => (swot[k] || []).length) ? (
        <Content adresse={adresse} date={date} eyebrow="Analyse" title="Forces, opportunités & vigilance">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {[['forces', SWOT.forces], ['opportunites', SWOT.opportunites], ['facteurs_limitatifs', SWOT.facteurs], ['menaces', SWOT.menaces]].map(([key, cfg]) => (
              <View key={key} style={{ width: '48.5%', backgroundColor: cfg.bg, borderLeftWidth: 3, borderLeftColor: cfg.bd, borderRadius: 6, padding: 12, marginBottom: 12, minHeight: 120 }}>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: cfg.tx, marginBottom: 6 }}>{cfg.t}</Text>
                {(swot[key] || []).slice(0, 5).map((it, i) => (
                  <View key={i} style={{ flexDirection: 'row', marginBottom: 3 }}>
                    <Text style={{ fontSize: 9, color: cfg.bd, marginRight: 4 }}>•</Text>
                    <Text style={{ flex: 1, fontSize: 9, color: cfg.tx, lineHeight: 1.35 }}>{safe(it)}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </Content>
      ) : null}

      {/* ─── 10. CONCLUSION (miroir couverture) ─── */}
      <Page size={[960, 540]} style={{ flexDirection: 'row', fontFamily: 'Helvetica' }}>
        <View style={{ width: '55%', height: '100%' }}>
          <Photo src={photos[3] || photos[0]} style={{ width: '100%', height: '100%' }} />
        </View>
        <View style={{ width: '45%', backgroundColor: GREEN, paddingHorizontal: 46, paddingVertical: 44, justifyContent: 'center' }}>
          <Text style={{ fontSize: 10, letterSpacing: 3, color: GOLD, fontFamily: 'Helvetica-Bold', marginBottom: 20 }}>CONCLUSION</Text>
          {fourchette ? (
            <Text style={{ fontSize: 15, fontFamily: 'Times-Roman', color: WHITE, lineHeight: 1.4, marginBottom: 18 }}>
              Fourchette de valorisation proposée :{'\n'}<Text style={{ fontFamily: 'Times-Bold' }}>{fourchette}</Text>
            </Text>
          ) : null}
          {preco.recommandation ? <Text style={{ fontSize: 10.5, color: CARD_ON_GREEN, lineHeight: 1.5, marginBottom: 22 }}>{safe(preco.recommandation).slice(0, 320)}</Text> : null}
          <Text style={{ fontSize: 15, fontFamily: 'Times-Bold', color: WHITE, marginTop: 10 }}>IMMEUBLES &amp; PATRIMOINE</Text>
          <Text style={{ fontSize: 9.5, color: '#AEBBA8', marginTop: 3 }}>{consultantNom} · {date} · Confidentiel</Text>
        </View>
      </Page>

    </Document>
  );
}
