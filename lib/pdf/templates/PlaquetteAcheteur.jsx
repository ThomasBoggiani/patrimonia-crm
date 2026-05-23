// ═══════════════════════════════════════════════════════════════════
// lib/pdf/templates/PlaquetteAcheteur.jsx — v14
// Nouvelle structure :
//  1. Couverture
//  2. Sommaire
//  3. Le bien (description + cards)
//  4. Le bien en images (FUSION : Street View + Vue aérienne)
//  5. Localisation & accessibilité (FUSION : Plan situation + compteurs + stations)
//  6. Le quartier au quotidien (commodités)
//  7. Cadastre & parcelle
//  8. Photos
//  9. Plans
// 10. État locatif
// 11. Informations financières
// 12. Risques naturels (mention légale)
// 13. Notre équipe
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { getStyles, COLORS, LAYOUT } from '../styles';
import {
  PageLogo,
  SectionTitle,
  PageFooter,
  Card,
  CardsRow,
  FinancialTable,
  PhotoGrid,
  TableOfContents,
} from '../components';
import {
  formatPrix,
  formatPrixM2,
  formatSurface,
  formatRendement,
  safeText,
  normalizePhotos,
  chunkPhotos,
  ensureAbsoluteUrl,
} from '../helpers';
import { LOGO_IP_BASE64 } from '../logo-base64';

// ─── Couleurs lignes RATP/IDFM ─────────────────────────────────────
const LINE_COLORS = {
  '1': '#FFCE00', '2': '#0064B0', '3': '#9F9825', '3bis': '#98D4E2',
  '4': '#C04191', '5': '#F28E42', '6': '#83C491', '7': '#F3A4BA',
  '7bis': '#83C491', '8': '#CEADD2', '9': '#D5C900', '10': '#E3B32A',
  '11': '#8D5E2A', '12': '#00814F', '13': '#98D4E2', '14': '#662483',
  '15': '#B90845', '16': '#F3A4BA', '17': '#D5C900', '18': '#00A88F',
  'A': '#E2231A', 'B': '#7BA3DC', 'C': '#FFCE00', 'D': '#00A88F', 'E': '#BE418D',
  'RER A': '#E2231A', 'RER B': '#7BA3DC', 'RER C': '#FFCE00', 'RER D': '#00A88F', 'RER E': '#BE418D',
  'T1': '#0055B7', 'T2': '#B7DA4D', 'T3a': '#FF5A00', 'T3b': '#7B388C',
  'T4': '#E5004C', 'T5': '#662F8F', 'T6': '#E5004B', 'T7': '#FBA60D',
  'T8': '#5A0F47', 'T9': '#BB1D58', 'T10': '#6BCBA0', 'T11': '#FFCD00',
  'T12': '#185CAB', 'T13': '#FF5A00',
};

const LINE_TEXT_COLORS = { '1': '#000', '8': '#000', '9': '#000', '6': '#000' };

function getLineColor(line, mode) {
  if (!line) return null;
  const clean = String(line).trim().toUpperCase();
  if (LINE_COLORS[clean]) return LINE_COLORS[clean];
  const lower = String(line).trim();
  if (LINE_COLORS[lower]) return LINE_COLORS[lower];
  if (mode === 'bus') return '#5A4A8A';
  return null;
}

function LineBadge({ line, mode }) {
  const bgColor = getLineColor(line, mode) || '#888';
  const textColor = LINE_TEXT_COLORS[String(line).trim()] || '#FFF';
  return (
    <View style={{ backgroundColor: bgColor, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, marginRight: 3, marginBottom: 2 }}>
      <Text style={{ color: textColor, fontSize: 8, fontFamily: 'Helvetica-Bold' }}>{line}</Text>
    </View>
  );
}

function walkingTime(meters) {
  const m = parseInt(meters);
  if (!m) return '';
  const min = Math.round(m / 80);
  if (min < 1) return '< 1 min';
  return `${min} min`;
}

// ─── Couleurs catégories quartier ──────────────────────────────────
const AMENITY_DEFS = {
  commerces: { label: 'Commerces' },
  restaurants: { label: 'Restaurants & cafés' },
  ecoles: { label: 'Écoles & enseignement' },
  sante: { label: 'Santé' },
  culture: { label: 'Culture & loisirs' },
  parcs: { label: 'Espaces verts' },
};

// ─── Équipe ────────────────────────────────────────────────────────
function buildTeamForPlaquette({ mandat, sender, allMembers }) {
  const BOSS_INITIALS = 'TE';
  const ownerInitials = (mandat?.ownerInitials || '').toUpperCase();
  const senderInitials = (sender?.initiales || sender?.initials || '').toUpperCase();

  const allKeys = Object.keys(allMembers || {});
  const boss = allMembers[BOSS_INITIALS];
  const owner = allMembers[ownerInitials];
  const sndr = allMembers[senderInitials];

  const seen = new Set();
  const team = [];

  if (boss) { team.push({ ...boss, position: 'center', isBoss: true }); seen.add(BOSS_INITIALS); }
  if (owner && !seen.has(ownerInitials)) { team.push({ ...owner, position: 'left', isBoss: false }); seen.add(ownerInitials); }
  if (sndr && !seen.has(senderInitials)) { team.push({ ...sndr, position: 'right', isBoss: false }); seen.add(senderInitials); }

  if (team.length === 0 && allKeys.length > 0) {
    for (let i = 0; i < Math.min(3, allKeys.length); i++) {
      const k = allKeys[i];
      team.push({ ...allMembers[k], position: 'fallback', isBoss: i === 0 });
    }
  }

  return team;
}

function TeamCard({ member, palette, size = 100, compact = false }) {
  const photoSize = compact ? 80 : size;
  const marginBottomCard = compact ? 6 : 12;
  const marginBottomPhoto = compact ? 6 : 10;
  const initials = (member?.name || '?').split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  return (
    <View style={{ alignItems: 'center', maxWidth: 200, marginHorizontal: 16, marginBottom: marginBottomCard }}>
      {member.photo ? (
        <Image src={member.photo} style={{ width: photoSize, height: photoSize, borderRadius: photoSize / 2, objectFit: 'cover', marginBottom: marginBottomPhoto }} />
      ) : (
        <View style={{ width: photoSize, height: photoSize, borderRadius: photoSize / 2, backgroundColor: palette.accent || '#9CAF88', alignItems: 'center', justifyContent: 'center', marginBottom: marginBottomPhoto }}>
          <Text style={{ color: '#FFFFFF', fontSize: photoSize > 110 ? 36 : (photoSize > 90 ? 28 : 22), fontFamily: 'Helvetica-Bold' }}>{initials}</Text>
        </View>
      )}
      <Text style={{ fontSize: compact ? 10 : 11, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 2, color: palette.text || '#222' }}>{member.name || '—'}</Text>
      <Text style={{ fontSize: compact ? 8 : 9, color: palette.muted || '#666', textAlign: 'center', marginBottom: compact ? 2 : 4, maxWidth: 190 }}>{member.role || ''}</Text>
      {!!member.email && (
        <Text style={{ fontSize: compact ? 7 : 8, color: palette.text || '#333', textAlign: 'center' }}>{member.email}</Text>
      )}
    </View>
  );
}

// ─── Risques naturels : helpers ────────────────────────────────────
function parseRisques(risques) {
  if (!risques || typeof risques !== 'object') return [];
  const items = [];

  if (Array.isArray(risques.inondations) && risques.inondations.length > 0) {
    items.push({ label: 'Inondations', detail: `${risques.inondations.length} zone(s) référencée(s)`, severity: 'warn', tag: 'PRÉSENT' });
  } else if (risques.inondation || risques.risquesNaturels?.inondation) {
    items.push({ label: 'Inondation', detail: 'Risque référencé', severity: 'warn', tag: 'PRÉSENT' });
  } else {
    items.push({ label: 'Inondation', detail: 'Aucun risque référencé', severity: 'ok', tag: 'NÉANT' });
  }

  const zoneSismique = risques.sismicite?.zone || risques.zonage_sismique?.zone;
  if (zoneSismique) {
    const z = parseInt(zoneSismique);
    items.push({
      label: 'Sismicité',
      detail: `Zone ${zoneSismique}`,
      severity: z >= 3 ? 'warn' : 'ok',
      tag: z >= 4 ? 'FORT' : z >= 3 ? 'MOYEN' : 'FAIBLE',
    });
  }

  const argilesNiv = risques.argiles?.niveau || risques.retrait_gonflement_argile?.niveau || risques.retraitGonflementArgile?.niveau;
  if (argilesNiv) {
    const sev = String(argilesNiv).toLowerCase();
    items.push({
      label: 'Retrait-gonflement argiles',
      detail: `Niveau ${argilesNiv}`,
      severity: sev.includes('fort') ? 'warn' : sev.includes('moyen') ? 'warn' : 'ok',
      tag: sev.includes('fort') ? 'FORT' : sev.includes('moyen') ? 'MOYEN' : 'FAIBLE',
    });
  }

  const radonCat = risques.radon?.categorie || risques.potentielRadon?.categorie;
  if (radonCat) {
    const cat = parseInt(radonCat);
    items.push({
      label: 'Radon',
      detail: `Catégorie ${radonCat}`,
      severity: cat >= 3 ? 'warn' : 'ok',
      tag: cat >= 3 ? 'ÉLEVÉ' : 'FAIBLE',
    });
  }

  if (Array.isArray(risques.icpe) && risques.icpe.length > 0) {
    items.push({
      label: 'ICPE',
      detail: `${risques.icpe.length} installation(s) à proximité`,
      severity: 'warn',
      tag: 'PRÉSENT',
    });
  }

  return items;
}

// ═════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═════════════════════════════════════════════════════════════════════
export default function PlaquetteAcheteur({
  mandat,
  conseiller,
  logoUrl,
  teamMembers,
  locationImages,
}) {
  const isOffMarket = mandat?.is_off_market === true;
  const styles = getStyles(isOffMarket);
  const palette = isOffMarket ? COLORS.offmarket : COLORS.standard;

  const photos = normalizePhotos(mandat);
  const photoChunks = chunkPhotos(photos, 9);

  // ─── Assets : ordre de priorité : mandat (BDD) → locationImages (live) ───
  const aerialSrc = mandat?.satellite_image_url || locationImages?.satellite || null;
  const cadastreSrc = mandat?.cadastre_image_url || locationImages?.cadastre || null;
  const streetViewSrc = mandat?.street_view_image_url || locationImages?.street_view || null;
  const mapStaticSrc = mandat?.map_static_image_url || locationImages?.map_static || null;
  const parcelle = mandat?.parcelle_data || locationImages?.parcelle || null;
  const transports = mandat?.transports_data || locationImages?.transports || null;
  const quartier = mandat?.quartier_data || locationImages?.quartier || null;
  const risques = mandat?.risques_data || locationImages?.risques || null;

  // ─── Booléens présence ───
  const hasAerial = !!aerialSrc;
  const hasCadastre = !!cadastreSrc;
  const hasStreetView = !!streetViewSrc;
  const hasMapStatic = !!mapStaticSrc;
  const hasEtatLocatif = mandat?.etat_locatif && Array.isArray(mandat.etat_locatif) && mandat.etat_locatif.length > 0;
  const hasPlans = mandat?.plans && Array.isArray(mandat.plans) && mandat.plans.length > 0;
  const hasPhotos = photos.length > 0;
  const hasTransports = transports && ((transports.metro?.length || 0) + (transports.rer?.length || 0) + (transports.tram?.length || 0) + (transports.bus?.length || 0)) > 0;
  const hasQuartier = quartier && Object.values(quartier).some(arr => Array.isArray(arr) && arr.length > 0);
  const hasRisques = risques && parseRisques(risques).length > 0;

  // ─── Pages "Le bien en images" (fusion) ───
  const hasBienImages = hasStreetView || hasAerial;
  const hasLocalisation = hasMapStatic || hasTransports;

  // ─── Sommaire ───
  const tocItems = [];
  let p = 3;
  tocItems.push({ label: 'LE BIEN', page: `P. ${p++}` });
  if (hasBienImages) tocItems.push({ label: 'LE BIEN EN IMAGES', page: `P. ${p++}` });
  if (hasLocalisation) tocItems.push({ label: 'LOCALISATION & ACCESSIBILITÉ', page: `P. ${p++}` });
  if (hasQuartier) tocItems.push({ label: 'LE QUARTIER AU QUOTIDIEN', page: `P. ${p++}` });
  if (hasCadastre) tocItems.push({ label: 'CADASTRE & PARCELLE', page: `P. ${p++}` });
  if (hasPhotos) { tocItems.push({ label: 'PHOTOS', page: `P. ${p}` }); p += photoChunks.length; }
  if (hasPlans) { tocItems.push({ label: 'PLANS', page: `P. ${p}` }); p += mandat.plans.length; }
  if (hasEtatLocatif) tocItems.push({ label: 'ETAT LOCATIF', page: `P. ${p++}` });
  tocItems.push({ label: 'INFORMATIONS FINANCIÈRES', page: `P. ${p++}` });
  if (hasRisques) tocItems.push({ label: 'RISQUES NATURELS', page: `P. ${p++}` });
  tocItems.push({ label: 'NOTRE EQUIPE', page: `P. ${p++}` });

  // ─── Équipe ───
  const team = buildTeamForPlaquette({ mandat, sender: conseiller, allMembers: teamMembers || {} });
  const dossier = team.filter(m => m.position === 'left' || m.position === 'right' || m.position === 'fallback');
  const dossierKeys = new Set(dossier.map(m => `${m.name}-${m.email}`));
  const autres = Object.values(teamMembers || {}).filter(m => {
    const key = `${m.name}-${m.email}`;
    return !dossierKeys.has(key);
  });

  // ─── Cards (page Le bien) ───
  const cards = [];
  if (mandat?.surface && parseFloat(mandat.surface) > 0) {
    cards.push({ number: parseFloat(mandat.surface).toLocaleString('fr-FR').replace(/[\u00A0\u202F]/g, ' '), label: 'Surface (m²)' });
  }
  if (mandat?.type) {
    const typeShort = mandat.type.length > 12 ? mandat.type.toUpperCase().substring(0, 12) : mandat.type.toUpperCase();
    cards.push({ number: typeShort, label: 'Type de bien' });
  }
  if (mandat?.rendement && parseFloat(mandat.rendement) > 0) {
    cards.push({ number: `${parseFloat(mandat.rendement).toFixed(1).replace('.', ',')}%`, label: 'Rendement' });
  } else if (mandat?.surface && parseFloat(mandat.surface) > 0 && mandat?.prix) {
    const prixM2 = Math.round(parseFloat(mandat.prix) / parseFloat(mandat.surface));
    cards.push({ number: prixM2.toLocaleString('fr-FR').replace(/[\u00A0\u202F]/g, ' ') + ' €', label: 'Prix au m²' });
  } else if (mandat?.nb_lots && parseInt(mandat.nb_lots) >= 2) {
    cards.push({ number: mandat.nb_lots, label: 'Lots' });
  }

  // ─── Financier ───
  const honoraires = mandat?.honoraires_charge && mandat?.honoraires_montant ? mandat.honoraires_montant : null;
  const prixNet = mandat?.prix || 0;
  const prixTotal = honoraires ? prixNet + parseFloat(honoraires) : prixNet;

  const finRows = [{ label: 'Prix net vendeur', value: formatPrix(prixNet) }];
  if (mandat?.surface && prixNet > 0) {
    finRows.push({ label: 'Prix au m²', value: formatPrixM2(prixNet, mandat.surface) });
  }
  if (mandat?.loyersAnnuels || mandat?.loyers_annuels) {
    const loyers = mandat.loyersAnnuels || mandat.loyers_annuels;
    finRows.push({ label: 'Loyers annuels HT/HC', value: formatPrix(loyers) });
  }

  const description = safeText(mandat?.description, '');

  // ─── Compteurs transports ───
  const transportCounts = transports ? {
    metro: transports.metro?.length || 0,
    rer: transports.rer?.length || 0,
    tram: transports.tram?.length || 0,
    bus: transports.bus?.length || 0,
  } : { metro: 0, rer: 0, tram: 0, bus: 0 };

  // ─── Top stations transports (pour fusion) ───
  const topStations = transports ? (() => {
    const all = [];
    (transports.metro || []).forEach(s => all.push({ ...s, mode: 'metro' }));
    (transports.rer || []).forEach(s => all.push({ ...s, mode: 'rer' }));
    (transports.tram || []).forEach(s => all.push({ ...s, mode: 'tram' }));
    (transports.bus || []).forEach(s => all.push({ ...s, mode: 'bus' }));
    return all.sort((a, b) => a.distance - b.distance).slice(0, 8);
  })() : [];

  // ─── Risques parsés ───
  const risquesItems = parseRisques(risques);

  return (
    <Document
      title={`Plaquette acheteur — ${safeText(mandat?.nom, 'Mandat')}`}
      author="Immeubles & Patrimoine"
      subject="Plaquette de présentation"
    >
      {/* ─── PAGE 1 : COUVERTURE ─── */}
      <Page size="A4" style={styles.coverPage}>
        <Image src={LOGO_IP_BASE64} style={styles.coverLogoLarge} />
        {photos[0] ? (
          <Image src={photos[0]} style={styles.coverPhoto} />
        ) : (
          <View style={styles.coverPhotoPlaceholder}>
            <Text style={{ fontSize: 12, color: palette.muted, fontFamily: 'Helvetica-Oblique' }}>Photo principale du bien</Text>
          </View>
        )}
        <View style={styles.coverTitleBlock}>
          <Text style={styles.coverTitle}>{safeText(mandat?.nom, 'BIEN À DÉCOUVRIR').toUpperCase()}</Text>
          <Text style={styles.coverCity}>{safeText(mandat?.ville, '').toUpperCase()}</Text>
          <Text style={styles.coverSubInfo}>
            {[
              mandat?.type ? mandat.type.toUpperCase() : '',
              mandat?.surface ? `${formatSurface(mandat.surface)}` : '',
              prixNet > 0 ? formatPrix(prixTotal) + ' HAI' : '',
            ].filter(Boolean).join('  │  ')}
          </Text>
        </View>
        <Text style={styles.coverWebsite}>www.immeubles-patrimoine.fr</Text>
      </Page>

      {/* ─── PAGE 2 : SOMMAIRE ─── */}
      <Page size="A4" style={styles.page}>
        <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
        <SectionTitle title="SOMMAIRE" isOffMarket={isOffMarket} />
        <View style={{ marginTop: 30 }}>
          <TableOfContents items={tocItems} isOffMarket={isOffMarket} />
        </View>
        <PageFooter isOffMarket={isOffMarket} />
      </Page>

      {/* ─── PAGE 3 : LE BIEN ─── */}
      <Page size="A4" style={styles.page}>
        <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
        <SectionTitle title="LE BIEN" isOffMarket={isOffMarket} />
        {!!description && (
          <View style={styles.descriptionBlock}>
            <Text style={styles.descriptionText}>{description}</Text>
          </View>
        )}
        {cards.length > 0 && (
          <CardsRow isOffMarket={isOffMarket}>
            {cards.map((c, i) => (
              <Card key={i} number={c.number} label={c.label} isOffMarket={isOffMarket} />
            ))}
          </CardsRow>
        )}
        <PageFooter isOffMarket={isOffMarket} />
      </Page>

      {/* ─── PAGE 4 : LE BIEN EN IMAGES (fusion Street View + Aérien) ─── */}
      {hasBienImages && (
        <Page size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle title={"LE BIEN\nEN IMAGES"} multiLine={true} isOffMarket={isOffMarket} />

          <Text style={[styles.descriptionText, { marginTop: 10, marginBottom: 14, fontSize: 10 }]}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{safeText(mandat?.adresse, '')}</Text>
            {mandat?.ville ? ` — ${safeText(mandat.ville, '')}` : ''}
          </Text>

          {hasStreetView && (
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 8, color: palette.accent || '#9CAF88', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontFamily: 'Helvetica-Bold' }}>
                Façade depuis la rue
              </Text>
              <Image src={streetViewSrc} style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 2 }} />
            </View>
          )}

          {hasAerial && (
            <View>
              <Text style={{ fontSize: 8, color: palette.accent || '#9CAF88', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontFamily: 'Helvetica-Bold' }}>
                Vue aérienne
              </Text>
              <View style={{ position: 'relative' }}>
                <Image src={aerialSrc} style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 2 }} />
                {/* Marker rouge centré */}
                <View style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -8, marginTop: -20 }}>
                  <View style={{ width: 16, height: 16, backgroundColor: '#DC2626', borderWidth: 2, borderColor: '#fff', borderRadius: 8 }} />
                </View>
              </View>
            </View>
          )}

          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      )}

      {/* ─── PAGE 5 : LOCALISATION & ACCESSIBILITÉ (fusion Plan + Transports) ─── */}
      {hasLocalisation && (
        <Page size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle title={"LOCALISATION\n& ACCESSIBILITÉ"} multiLine={true} isOffMarket={isOffMarket} />

          {hasMapStatic && (
            <View style={{ marginTop: 10, marginBottom: 12 }}>
              <Image src={mapStaticSrc} style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 2 }} />
            </View>
          )}

          {hasTransports && (
            <>
              {/* Compteurs en haut */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {transportCounts.metro > 0 && (
                  <View style={{ flex: 1, padding: 8, backgroundColor: '#FAFAF7', borderRadius: 3, alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: palette.accent || '#5d6e5d' }}>{transportCounts.metro}</Text>
                    <Text style={{ fontSize: 7, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Métro</Text>
                  </View>
                )}
                {transportCounts.rer > 0 && (
                  <View style={{ flex: 1, padding: 8, backgroundColor: '#FAFAF7', borderRadius: 3, alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: palette.accent || '#5d6e5d' }}>{transportCounts.rer}</Text>
                    <Text style={{ fontSize: 7, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>RER</Text>
                  </View>
                )}
                {transportCounts.tram > 0 && (
                  <View style={{ flex: 1, padding: 8, backgroundColor: '#FAFAF7', borderRadius: 3, alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: palette.accent || '#5d6e5d' }}>{transportCounts.tram}</Text>
                    <Text style={{ fontSize: 7, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Tram</Text>
                  </View>
                )}
                {transportCounts.bus > 0 && (
                  <View style={{ flex: 1, padding: 8, backgroundColor: '#FAFAF7', borderRadius: 3, alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: palette.accent || '#5d6e5d' }}>{transportCounts.bus}</Text>
                    <Text style={{ fontSize: 7, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Bus</Text>
                  </View>
                )}
              </View>

              {/* Liste stations les plus proches */}
              <Text style={{ fontSize: 8, color: palette.accent || '#9CAF88', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontFamily: 'Helvetica-Bold' }}>
                Stations les plus proches
              </Text>
              <View>
                {topStations.map((s, i) => {
                  const lines = s.lines ? String(s.lines).split(/[;,/]/).map(x => x.trim()).filter(Boolean) : [];
                  return (
                    <View key={i} style={{ flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: '#E5E5DD', alignItems: 'center' }}>
                      <View style={{ flex: 0.5, flexDirection: 'row', flexWrap: 'wrap' }}>
                        {lines.length > 0 ? lines.slice(0, 3).map((l, j) => (
                          <LineBadge key={j} line={l} mode={s.mode} />
                        )) : (
                          <View style={{ backgroundColor: '#888', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3 }}>
                            <Text style={{ color: '#fff', fontSize: 8, fontFamily: 'Helvetica-Bold' }}>
                              {s.mode === 'metro' ? 'M' : s.mode === 'rer' ? 'RER' : s.mode === 'tram' ? 'T' : 'BUS'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ flex: 2, fontSize: 9 }}>{s.name}</Text>
                      <Text style={{ flex: 1, fontSize: 8, color: '#666', textAlign: 'right' }}>
                        {s.distance}m · {walkingTime(s.distance)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      )}

      {/* ─── PAGE 6 : LE QUARTIER AU QUOTIDIEN ─── */}
      {hasQuartier && (
        <Page size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle title={"LE QUARTIER\nAU QUOTIDIEN"} multiLine={true} isOffMarket={isOffMarket} />

          <Text style={[styles.descriptionText, { marginTop: 8, marginBottom: 12, fontSize: 9, fontStyle: 'italic', color: '#888' }]}>
            Commodités dans un rayon de 500 mètres autour du bien. Source : OpenStreetMap.
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(AMENITY_DEFS).map(([k, meta]) => {
              const items = quartier[k] || [];
              if (items.length === 0) return null;
              return (
                <View key={k} style={{ width: '48%', backgroundColor: '#FAFAF7', padding: 10, borderRadius: 3, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: palette.accent || '#5d6e5d', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      {meta.label}
                    </Text>
                    <Text style={{ fontSize: 9, color: '#888' }}>{items.length}</Text>
                  </View>
                  {items.slice(0, 4).map((item, i) => (
                    <View key={i} style={{ flexDirection: 'row', marginBottom: 2 }}>
                      <Text style={{ flex: 1, fontSize: 8, color: '#444' }}>{item.name || item.type || '—'}</Text>
                      <Text style={{ fontSize: 7, color: '#888' }}>{item.distance}m</Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>

          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      )}

      {/* ─── PAGE 7 : CADASTRE & PARCELLE ─── */}
      {hasCadastre && (
        <Page size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle title={"CADASTRE\n& PARCELLE"} multiLine={true} isOffMarket={isOffMarket} />

          {!!mandat?.cadastre_description && (
            <Text style={[styles.descriptionText, { marginVertical: 12 }]}>{mandat.cadastre_description}</Text>
          )}

          {parcelle && (
            <View style={{ marginTop: 14, marginHorizontal: 30, padding: 12, borderWidth: 0.5, borderColor: palette.muted || '#999', borderRadius: 4 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: palette.accent || '#9CAF88', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                Référence cadastrale
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {parcelle.commune && <ParcelleField label="Commune" value={parcelle.commune} />}
                {parcelle.section && <ParcelleField label="Section" value={parcelle.section} />}
                {parcelle.numero && <ParcelleField label="N° parcelle" value={parcelle.numero} />}
                {parcelle.contenance && <ParcelleField label="Contenance" value={`${parcelle.contenance.toLocaleString('fr-FR')} m²`} />}
              </View>
            </View>
          )}

          <Image src={cadastreSrc} style={{ width: '100%', height: 320, objectFit: 'contain', marginTop: 16 }} />
          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      )}

      {/* ─── PHOTOS ─── */}
      {photoChunks.map((chunk, pageIndex) => (
        <Page key={`photos-${pageIndex}`} size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle title="PHOTOS" isOffMarket={isOffMarket} />
          <View style={{ marginTop: 16 }}>
            <PhotoGrid photos={chunk.map(url => ({ url }))} isOffMarket={isOffMarket} />
          </View>
          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      ))}

      {/* ─── PLANS ─── */}
      {hasPlans && mandat.plans.map((plan, i) => (
        <Page key={`plan-${i}`} size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle title="PLANS" isOffMarket={isOffMarket} />
          <Image src={plan.url || plan} style={{ width: '100%', height: 500, objectFit: 'contain', marginTop: 24 }} />
          {plan.caption && <Text style={[styles.descriptionText, { marginTop: 12, fontSize: 10 }]}>{plan.caption}</Text>}
          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      ))}

      {/* ─── ÉTAT LOCATIF ─── */}
      {hasEtatLocatif && (
        <Page size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle title="ETAT LOCATIF" isOffMarket={isOffMarket} />
          {(() => {
            const lots = mandat.etat_locatif || [];
            const totalSurf = lots.reduce((s, l) => s + (parseFloat(l.surface) || 0), 0);
            const totalLoyer = lots.reduce((s, l) => s + (parseFloat(l.loyer) || 0), 0);
            const totalLoyerOpt = lots.reduce((s, l) => {
              const opt = parseFloat(l.loyer_optimise || 0);
              return s + (opt > 0 ? opt : (parseFloat(l.loyer) || 0));
            }, 0);
            const nbLoues = lots.filter(l => l.statut === 'loué' || l.statut === 'loue').length;
            const nbLibres = lots.length - nbLoues;
            const prixN = parseFloat(mandat?.prix_net_vendeur || mandat?.prix || 0);
            const rdtActuel = prixN > 0 && totalLoyer > 0 ? Math.round((totalLoyer * 12 / prixN) * 1000) / 10 : null;
            const rdtOpt = prixN > 0 && totalLoyerOpt > 0 ? Math.round((totalLoyerOpt * 12 / prixN) * 1000) / 10 : null;

            return (
              <>
                <Text style={[styles.descriptionText, { marginTop: 16, fontSize: 10 }]}>
                  Synthèse au {new Date().toLocaleDateString('fr-FR')} — {lots.length} lot{lots.length > 1 ? 's' : ''}
                  {nbLoues > 0 && ` · ${nbLoues} loué${nbLoues > 1 ? 's' : ''}`}
                  {nbLibres > 0 && ` · ${nbLibres} libre${nbLibres > 1 ? 's' : ''}`}
                </Text>

                {(rdtActuel != null || rdtOpt != null) && (
                  <View style={{ flexDirection: 'row', marginTop: 12, marginHorizontal: 30, gap: 16 }}>
                    {rdtActuel != null && (
                      <View style={{ flex: 1, padding: 10, backgroundColor: '#F5F5F0', borderRadius: 4 }}>
                        <Text style={{ fontSize: 8, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>Rendement présent</Text>
                        <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: palette.accent || '#9CAF88', marginTop: 4 }}>{rdtActuel.toString().replace('.', ',')}%</Text>
                      </View>
                    )}
                    {rdtOpt != null && (
                      <View style={{ flex: 1, padding: 10, backgroundColor: '#F5F5F0', borderRadius: 4 }}>
                        <Text style={{ fontSize: 8, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>Rendement optimisé</Text>
                        <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#B8860B', marginTop: 4 }}>{rdtOpt.toString().replace('.', ',')}%</Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={{ marginTop: 20, marginHorizontal: 30 }}>
                  <View style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.accent || '#9CAF88', backgroundColor: '#FAFAF7' }}>
                    <Text style={{ flex: 0.7, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#666', textTransform: 'uppercase', paddingHorizontal: 4 }}>Lot</Text>
                    <Text style={{ flex: 2.3, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#666', textTransform: 'uppercase', paddingHorizontal: 4 }}>Type / Description</Text>
                    <Text style={{ flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#666', textTransform: 'uppercase', paddingHorizontal: 4, textAlign: 'right' }}>Surface</Text>
                    <Text style={{ flex: 1.2, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#666', textTransform: 'uppercase', paddingHorizontal: 4, textAlign: 'right' }}>Loyer/mois</Text>
                    <Text style={{ flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#666', textTransform: 'uppercase', paddingHorizontal: 4, textAlign: 'center' }}>Statut</Text>
                  </View>
                  {lots.map((lot, i) => {
                    const isLoue = lot.statut === 'loué' || lot.statut === 'loue';
                    return (
                      <View key={i} style={{ flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: '#E5E5DD' }}>
                        <Text style={{ flex: 0.7, fontSize: 10, fontFamily: 'Helvetica-Bold', paddingHorizontal: 4 }}>{lot.numero || (i + 1)}</Text>
                        <Text style={{ flex: 2.3, fontSize: 10, paddingHorizontal: 4 }}>{lot.type || lot.nature || '—'}</Text>
                        <Text style={{ flex: 1, fontSize: 10, paddingHorizontal: 4, textAlign: 'right' }}>{lot.surface ? `${lot.surface} m²` : '—'}</Text>
                        <Text style={{ flex: 1.2, fontSize: 10, paddingHorizontal: 4, textAlign: 'right' }}>{lot.loyer ? formatPrix(lot.loyer) : '—'}</Text>
                        <View style={{ flex: 1, paddingHorizontal: 4, alignItems: 'center' }}>
                          <View style={{ backgroundColor: isLoue ? '#D4EDDA' : '#FFF3CD', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 }}>
                            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: isLoue ? '#155724' : '#856404', textTransform: 'uppercase' }}>
                              {isLoue ? 'Loué' : 'Libre'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                  <View style={{ flexDirection: 'row', paddingVertical: 10, borderTopWidth: 1, borderTopColor: palette.accent || '#9CAF88', backgroundColor: '#FAFAF7', marginTop: 4 }}>
                    <Text style={{ flex: 3, fontSize: 10, fontFamily: 'Helvetica-Bold', paddingHorizontal: 4, textTransform: 'uppercase' }}>TOTAL</Text>
                    <Text style={{ flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold', paddingHorizontal: 4, textAlign: 'right' }}>{totalSurf > 0 ? `${totalSurf} m²` : '—'}</Text>
                    <Text style={{ flex: 1.2, fontSize: 10, fontFamily: 'Helvetica-Bold', paddingHorizontal: 4, textAlign: 'right' }}>{totalLoyer > 0 ? formatPrix(totalLoyer) : '—'}</Text>
                    <Text style={{ flex: 1, fontSize: 8, paddingHorizontal: 4, textAlign: 'center', color: '#666' }}>{nbLoues}/{lots.length}</Text>
                  </View>
                </View>

                <Text style={{ fontSize: 8, fontStyle: 'italic', color: '#888', marginTop: 16, marginHorizontal: 30 }}>
                  Loyers exprimés HT/HC. Rendements calculés sur la base du prix net vendeur.
                </Text>
              </>
            );
          })()}
          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      )}

      {/* ─── INFORMATIONS FINANCIÈRES ─── */}
      <Page size="A4" style={styles.page}>
        <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
        <SectionTitle title={"INFORMATIONS\nFINANCIÈRES"} multiLine={true} isOffMarket={isOffMarket} />
        <FinancialTable rows={finRows} isOffMarket={isOffMarket} />
        <PageFooter isOffMarket={isOffMarket} />
      </Page>

      {/* ─── RISQUES NATURELS ─── */}
      {hasRisques && (
        <Page size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle title={"RISQUES\nNATURELS"} multiLine={true} isOffMarket={isOffMarket} />

          <Text style={[styles.descriptionText, { marginTop: 8, marginBottom: 14, fontSize: 9, fontStyle: 'italic', color: '#888' }]}>
            Source : Géorisques (gouv.fr) — Information non contractuelle, en application de l'article L125-5 du code de l'environnement.
          </Text>

          <View style={{ marginHorizontal: 20 }}>
            {risquesItems.map((item, i) => {
              const isWarn = item.severity === 'warn';
              return (
                <View key={i} style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 10,
                  marginBottom: 6,
                  backgroundColor: isWarn ? '#FAEEDA' : '#FAFAF7',
                  borderLeftWidth: 3,
                  borderLeftColor: isWarn ? '#BA7517' : (palette.accent || '#5d6e5d'),
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: isWarn ? '#412402' : '#2c2c2a' }}>
                      {item.label}
                    </Text>
                    <Text style={{ fontSize: 9, color: isWarn ? '#854F0B' : '#666', marginTop: 2 }}>
                      {item.detail}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: isWarn ? '#854F0B' : '#1D9E75', letterSpacing: 0.5 }}>
                    {item.tag}
                  </Text>
                </View>
              );
            })}
          </View>

          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      )}

      {/* ─── NOTRE ÉQUIPE ─── */}
      <Page size="A4" style={styles.page}>
        <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
        <SectionTitle title="NOTRE ÉQUIPE" isOffMarket={isOffMarket} />

        {team.length > 0 && (
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 30 }}>
            {dossier.length > 0 && (
              <View style={{ marginBottom: 30 }}>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: palette.accent || '#9CAF88', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, textAlign: 'center' }}>
                  Pour ce dossier
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {dossier.map((member, i) => (
                    <TeamCard key={`d-${i}`} member={member} palette={palette} compact />
                  ))}
                </View>
              </View>
            )}

            {dossier.length > 0 && autres.length > 0 && (
              <View style={{ borderBottomWidth: 0.5, borderBottomColor: palette.muted || '#999', marginVertical: 24, marginHorizontal: 60 }} />
            )}

            {autres.length > 0 && (() => {
              const isBossInAutres = (m) => {
                const initials = (m?.name || '').split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                return initials === 'TE';
              };
              const bossEntry = autres.find(isBossInAutres);
              const autresSansBoss = autres.filter(m => !isBossInAutres(m));

              return (
                <View style={{ marginTop: 24 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: palette.accent || '#9CAF88', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, textAlign: 'center' }}>
                    À votre service
                  </Text>

                  {bossEntry && (
                    <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: autresSansBoss.length > 0 ? 28 : 0 }}>
                      <TeamCard member={bossEntry} palette={palette} compact />
                    </View>
                  )}

                  {autresSansBoss.length > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      {autresSansBoss.map((member, i) => (
                        <TeamCard key={`a-${i}`} member={member} palette={palette} compact />
                      ))}
                    </View>
                  )}
                </View>
              );
            })()}
          </View>
        )}

        <PageFooter isOffMarket={isOffMarket} />
      </Page>
    </Document>
  );
}

// ─── Helper : champ parcelle ───
function ParcelleField({ label, value }) {
  return (
    <View style={{ width: '50%', marginBottom: 6 }}>
      <Text style={{ fontSize: 8, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 2 }}>{value}</Text>
    </View>
  );
}
