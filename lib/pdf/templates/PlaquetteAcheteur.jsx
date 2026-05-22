// ═══════════════════════════════════════════════════════════════════
// lib/pdf/templates/PlaquetteAcheteur.jsx — v13.5
// + Page Transports à proximité avec badges colorés (lignes RATP/IDFM)
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

// Couleurs officielles des lignes de transport Île-de-France (RATP/IDFM)
const LINE_COLORS = {
  // Métro
  '1': '#FFCE00', '2': '#0064B0', '3': '#9F9825', '3bis': '#98D4E2',
  '4': '#C04191', '5': '#F28E42', '6': '#83C491', '7': '#F3A4BA',
  '7bis': '#83C491', '8': '#CEADD2', '9': '#D5C900', '10': '#E3B32A',
  '11': '#8D5E2A', '12': '#00814F', '13': '#98D4E2', '14': '#662483',
  // RER
  'A': '#E2231A', 'B': '#7BA3DC', 'C': '#FFCE00', 'D': '#00A88F', 'E': '#BE418D',
  'RER A': '#E2231A', 'RER B': '#7BA3DC', 'RER C': '#FFCE00', 'RER D': '#00A88F', 'RER E': '#BE418D',
  // Tram
  'T1': '#0055B7', 'T2': '#B7DA4D', 'T3a': '#FF5A00', 'T3b': '#7B388C',
  'T4': '#E5004C', 'T5': '#662F8F', 'T6': '#E5004B', 'T7': '#FBA60D',
  'T8': '#5A0F47', 'T9': '#BB1D58', 'T10': '#6BCBA0', 'T11': '#FFCD00',
  'T12': '#185CAB', 'T13': '#FF5A00',
};

const LINE_TEXT_COLORS = {
  '1': '#000', '8': '#000',
};

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
    <View style={{
      backgroundColor: bgColor,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 3,
      marginRight: 3,
      marginBottom: 2,
    }}>
      <Text style={{
        color: textColor,
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
      }}>
        {line}
      </Text>
    </View>
  );
}

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

  if (boss) {
    team.push({ ...boss, position: 'center', isBoss: true });
    seen.add(BOSS_INITIALS);
  }
  if (owner && !seen.has(ownerInitials)) {
    team.push({ ...owner, position: 'left', isBoss: false });
    seen.add(ownerInitials);
  }
  if (sndr && !seen.has(senderInitials)) {
    team.push({ ...sndr, position: 'right', isBoss: false });
    seen.add(senderInitials);
  }

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
  const initials = (member?.name || '?')
    .split(' ')
    .map(s => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={{ alignItems: 'center', maxWidth: 200, marginHorizontal: 16, marginBottom: marginBottomCard }}>
      {member.photo ? (
        <Image
          src={member.photo}
          style={{
            width: photoSize,
            height: photoSize,
            borderRadius: photoSize / 2,
            objectFit: 'cover',
            marginBottom: marginBottomPhoto,
          }}
        />
      ) : (
        <View style={{
          width: photoSize,
          height: photoSize,
          borderRadius: photoSize / 2,
          backgroundColor: palette.accent || '#9CAF88',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: marginBottomPhoto,
        }}>
          <Text style={{
            color: '#FFFFFF',
            fontSize: photoSize > 110 ? 36 : (photoSize > 90 ? 28 : 22),
            fontFamily: 'Helvetica-Bold',
          }}>
            {initials}
          </Text>
        </View>
      )}
      <Text style={{
        fontSize: compact ? 10 : 11,
        fontFamily: 'Helvetica-Bold',
        textAlign: 'center',
        marginBottom: 2,
        color: palette.text || '#222',
      }}>
        {member.name || '—'}
      </Text>
      <Text style={{
        fontSize: compact ? 8 : 9,
        color: palette.muted || '#666',
        textAlign: 'center',
        marginBottom: compact ? 2 : 4,
        maxWidth: 190,
      }}>
        {member.role || ''}
      </Text>
      {!!member.email && (
        <Text style={{
          fontSize: compact ? 7 : 8,
          color: palette.text || '#333',
          textAlign: 'center',
        }}>
          {member.email}
        </Text>
      )}
    </View>
  );
}

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

  const aerialSrc = mandat?.aerial_image_url || locationImages?.satellite || null;
  const cadastreSrc = mandat?.cadastre_image_url || locationImages?.cadastre || null;

  const hasMapImage = !!mandat?.map_image_url;
  const hasAerialImage = !!aerialSrc;
  const hasCadastreImage = !!cadastreSrc;
  const hasEtatLocatif = mandat?.etat_locatif && Array.isArray(mandat.etat_locatif) && mandat.etat_locatif.length > 0;
  const hasPlans = mandat?.plans && Array.isArray(mandat.plans) && mandat.plans.length > 0;
  const hasPhotos = photos.length > 0;

  const transports = locationImages?.transports || null;
  const hasTransports = transports && (
    (transports.metro?.length || 0) +
    (transports.rer?.length || 0) +
    (transports.tram?.length || 0) +
    (transports.bus?.length || 0)
  ) > 0;

  const tocItems = [];
  let p = 3;
  tocItems.push({ label: 'LE BIEN', page: `P. ${p++}` });
  if (hasMapImage) tocItems.push({ label: 'SITUATION & TRANSPORTS', page: `P. ${p++}` });
  if (hasAerialImage) tocItems.push({ label: 'VUE AÉRIENNE ET SATELLITE', page: `P. ${p++}` });
  if (hasTransports) tocItems.push({ label: 'TRANSPORTS À PROXIMITÉ', page: `P. ${p++}` });
  if (hasCadastreImage) tocItems.push({ label: 'CADASTRE', page: `P. ${p++}` });
  if (hasEtatLocatif) tocItems.push({ label: 'ETAT LOCATIF', page: `P. ${p++}` });
  tocItems.push({ label: 'INFORMATIONS FINANCIÈRES', page: `P. ${p++}` });
  if (hasPhotos) {
    tocItems.push({ label: 'PHOTOS', page: `P. ${p}` });
    p += photoChunks.length;
  }
  if (hasPlans) {
    tocItems.push({ label: 'PLANS', page: `P. ${p}` });
    p += mandat.plans.length;
  }
  tocItems.push({ label: 'NOTRE EQUIPE', page: `P. ${p++}` });

  const team = buildTeamForPlaquette({
    mandat,
    sender: conseiller,
    allMembers: teamMembers || {},
  });

  const dossier = team.filter(m => m.position === 'left' || m.position === 'right' || m.position === 'fallback');
  const dossierKeys = new Set(dossier.map(m => `${m.name}-${m.email}`));
  const autres = Object.values(teamMembers || {}).filter(m => {
    const key = `${m.name}-${m.email}`;
    return !dossierKeys.has(key);
  });

  const cards = [];
  if (mandat?.surface && parseFloat(mandat.surface) > 0) {
    cards.push({
      number: parseFloat(mandat.surface).toLocaleString('fr-FR').replace(/[\u00A0\u202F]/g, ' '),
      label: 'Surface (m²)'
    });
  }
  if (mandat?.type) {
    const typeShort = mandat.type.length > 12
      ? mandat.type.toUpperCase().substring(0, 12)
      : mandat.type.toUpperCase();
    cards.push({ number: typeShort, label: 'Type de bien' });
  }
  if (mandat?.rendement && parseFloat(mandat.rendement) > 0) {
    cards.push({
      number: `${parseFloat(mandat.rendement).toFixed(1).replace('.', ',')}%`,
      label: 'Rendement'
    });
  } else if (mandat?.surface && parseFloat(mandat.surface) > 0 && mandat?.prix) {
    const prixM2 = Math.round(parseFloat(mandat.prix) / parseFloat(mandat.surface));
    cards.push({
      number: prixM2.toLocaleString('fr-FR').replace(/[\u00A0\u202F]/g, ' ') + ' €',
      label: 'Prix au m²'
    });
  } else if (mandat?.nb_lots && parseInt(mandat.nb_lots) >= 2) {
    cards.push({ number: mandat.nb_lots, label: 'Lots' });
  }

  const honoraires = mandat?.honoraires_charge && mandat?.honoraires_montant
    ? mandat.honoraires_montant
    : null;
  const prixNet = mandat?.prix || 0;
  const prixTotal = honoraires ? prixNet + parseFloat(honoraires) : prixNet;

  const finRows = [
    { label: 'Prix net vendeur', value: formatPrix(prixNet) },
  ];
  if (mandat?.surface && prixNet > 0) {
    finRows.push({ label: 'Prix au m²', value: formatPrixM2(prixNet, mandat.surface) });
  }
  if (mandat?.loyersAnnuels || mandat?.loyers_annuels) {
    const loyers = mandat.loyersAnnuels || mandat.loyers_annuels;
    finRows.push({ label: 'Loyers annuels HT/HC', value: formatPrix(loyers) });
  }

  const description = safeText(mandat?.description, '');

  return (
    <Document
      title={`Plaquette acheteur — ${safeText(mandat?.nom, 'Mandat')}`}
      author="Immeubles & Patrimoine"
      subject="Plaquette de présentation"
    >
      <Page size="A4" style={styles.coverPage}>
        <Image src={LOGO_IP_BASE64} style={styles.coverLogoLarge} />
        {photos[0] ? (
          <Image src={photos[0]} style={styles.coverPhoto} />
        ) : (
          <View style={styles.coverPhotoPlaceholder}>
            <Text style={{ fontSize: 12, color: palette.muted, fontFamily: 'Helvetica-Oblique' }}>
              Photo principale du bien
            </Text>
          </View>
        )}
        <View style={styles.coverTitleBlock}>
          <Text style={styles.coverTitle}>
            {safeText(mandat?.nom, 'BIEN À DÉCOUVRIR').toUpperCase()}
          </Text>
          <Text style={styles.coverCity}>
            {safeText(mandat?.ville, '').toUpperCase()}
          </Text>
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

      <Page size="A4" style={styles.page}>
        <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
        <SectionTitle title="SOMMAIRE" isOffMarket={isOffMarket} />
        <View style={{ marginTop: 30 }}>
          <TableOfContents items={tocItems} isOffMarket={isOffMarket} />
        </View>
        <PageFooter isOffMarket={isOffMarket} />
      </Page>

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

      {hasMapImage && (
        <Page size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle
            title={"SITUATION\n& TRANSPORTS"}
            multiLine={true}
            isOffMarket={isOffMarket}
          />
          {!!mandat?.transport_info && (
            <View style={styles.descriptionBlock}>
              <Text style={styles.descriptionText}>{mandat.transport_info}</Text>
            </View>
          )}
          <Image src={mandat.map_image_url} style={{ width: '100%', height: 350, objectFit: 'contain', marginTop: 20 }} />
          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      )}

      {hasAerialImage && (
        <Page size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle
            title={"VUE AÉRIENNE\n& SATELLITE"}
            multiLine={true}
            isOffMarket={isOffMarket}
          />
          <Text style={[styles.descriptionText, { marginVertical: 12 }]}>
            Ce bien est situé au{'\n'}
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>
              {safeText(mandat?.adresse, '')}
            </Text>
            {'\n'}{safeText(mandat?.ville, '')}
          </Text>
          <Image src={aerialSrc} style={{ width: '100%', height: 380, objectFit: 'contain' }} />
          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      )}

      {hasTransports && (
        <Page size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle
            title={"TRANSPORTS\nÀ PROXIMITÉ"}
            multiLine={true}
            isOffMarket={isOffMarket}
          />
          <Text style={[styles.descriptionText, { marginVertical: 12, fontSize: 10 }]}>
            Stations de transport en commun dans un rayon de 500 mètres autour du bien.
          </Text>
          <View style={{ marginTop: 16, marginHorizontal: 30 }}>
            {transports?.metro?.length > 0 && (
              <TransportSection
                title="Métro"
                items={transports.metro}
                palette={palette}
                mode="metro"
              />
            )}
            {transports?.rer?.length > 0 && (
              <TransportSection
                title="RER / Train"
                items={transports.rer}
                palette={palette}
                mode="rer"
              />
            )}
            {transports?.tram?.length > 0 && (
              <TransportSection
                title="Tramway"
                items={transports.tram}
                palette={palette}
                mode="tram"
              />
            )}
            {transports?.bus?.length > 0 && (
              <TransportSection
                title="Bus"
                items={transports.bus}
                palette={palette}
                mode="bus"
              />
            )}
          </View>
          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      )}

      {hasCadastreImage && (
        <Page size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle title="CADASTRE" isOffMarket={isOffMarket} />
          {!!mandat?.cadastre_description && (
            <Text style={[styles.descriptionText, { marginVertical: 12 }]}>
              {mandat.cadastre_description}
            </Text>
          )}

          {locationImages?.parcelle && (
            <View style={{ marginTop: 16, marginHorizontal: 30, padding: 12, borderWidth: 0.5, borderColor: palette.muted || '#999', borderRadius: 4 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: palette.accent || '#9CAF88', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                Référence cadastrale
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {locationImages.parcelle.commune && (
                  <ParcelleField label="Commune" value={locationImages.parcelle.commune} />
                )}
                {locationImages.parcelle.section && (
                  <ParcelleField label="Section" value={locationImages.parcelle.section} />
                )}
                {locationImages.parcelle.numero && (
                  <ParcelleField label="N° parcelle" value={locationImages.parcelle.numero} />
                )}
                {locationImages.parcelle.contenance && (
                  <ParcelleField label="Contenance" value={`${locationImages.parcelle.contenance.toLocaleString('fr-FR')} m²`} />
                )}
              </View>
            </View>
          )}

          <Image src={cadastreSrc} style={{ width: '100%', height: 340, objectFit: 'contain', marginTop: 16 }} />
          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      )}

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
            const prixNet = parseFloat(mandat?.prix_net_vendeur || mandat?.prix || 0);
            const rdtActuel = prixNet > 0 && totalLoyer > 0
              ? Math.round((totalLoyer * 12 / prixNet) * 1000) / 10
              : null;
            const rdtOptimise = prixNet > 0 && totalLoyerOpt > 0
              ? Math.round((totalLoyerOpt * 12 / prixNet) * 1000) / 10
              : null;
            return (
              <>
                <Text style={[styles.descriptionText, { marginTop: 16, fontSize: 10 }]}>
                  Synthèse de l'état locatif au {new Date().toLocaleDateString('fr-FR')} — {lots.length} lot{lots.length > 1 ? 's' : ''}
                  {nbLoues > 0 && ` · ${nbLoues} loué${nbLoues > 1 ? 's' : ''}`}
                  {nbLibres > 0 && ` · ${nbLibres} libre${nbLibres > 1 ? 's' : ''}`}
                </Text>

                {(rdtActuel != null || rdtOptimise != null) && (
                  <View style={{ flexDirection: 'row', marginTop: 12, marginHorizontal: 30, gap: 16 }}>
                    {rdtActuel != null && (
                      <View style={{ flex: 1, padding: 10, backgroundColor: '#F5F5F0', borderRadius: 4 }}>
                        <Text style={{ fontSize: 8, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>Rendement présent</Text>
                        <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: palette.accent || '#9CAF88', marginTop: 4 }}>
                          {rdtActuel.toString().replace('.', ',')}%
                        </Text>
                      </View>
                    )}
                    {rdtOptimise != null && (
                      <View style={{ flex: 1, padding: 10, backgroundColor: '#F5F5F0', borderRadius: 4 }}>
                        <Text style={{ fontSize: 8, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>Rendement optimisé</Text>
                        <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#B8860B', marginTop: 4 }}>
                          {rdtOptimise.toString().replace('.', ',')}%
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={{ marginTop: 20, marginHorizontal: 30 }}>
                  {/* Header */}
                  <View style={{
                    flexDirection: 'row',
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: palette.accent || '#9CAF88',
                    backgroundColor: '#FAFAF7',
                  }}>
                    <Text style={{ flex: 0.7, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#666', textTransform: 'uppercase', paddingHorizontal: 4 }}>Lot</Text>
                    <Text style={{ flex: 2.3, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#666', textTransform: 'uppercase', paddingHorizontal: 4 }}>Type / Description</Text>
                    <Text style={{ flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#666', textTransform: 'uppercase', paddingHorizontal: 4, textAlign: 'right' }}>Surface</Text>
                    <Text style={{ flex: 1.2, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#666', textTransform: 'uppercase', paddingHorizontal: 4, textAlign: 'right' }}>Loyer/mois</Text>
                    <Text style={{ flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#666', textTransform: 'uppercase', paddingHorizontal: 4, textAlign: 'center' }}>Statut</Text>
                  </View>
                  {/* Rows */}
                  {lots.map((lot, i) => {
                    const isLoue = lot.statut === 'loué' || lot.statut === 'loue';
                    return (
                      <View key={i} style={{
                        flexDirection: 'row',
                        paddingVertical: 7,
                        borderBottomWidth: 0.5,
                        borderBottomColor: '#E5E5DD',
                      }}>
                        <Text style={{ flex: 0.7, fontSize: 10, fontFamily: 'Helvetica-Bold', paddingHorizontal: 4 }}>
                          {lot.numero || (i + 1)}
                        </Text>
                        <Text style={{ flex: 2.3, fontSize: 10, paddingHorizontal: 4 }}>
                          {lot.type || lot.nature || '—'}
                        </Text>
                        <Text style={{ flex: 1, fontSize: 10, paddingHorizontal: 4, textAlign: 'right' }}>
                          {lot.surface ? `${lot.surface} m²` : '—'}
                        </Text>
                        <Text style={{ flex: 1.2, fontSize: 10, paddingHorizontal: 4, textAlign: 'right' }}>
                          {lot.loyer ? formatPrix(lot.loyer) : '—'}
                        </Text>
                        <View style={{ flex: 1, paddingHorizontal: 4, alignItems: 'center' }}>
                          <View style={{
                            backgroundColor: isLoue ? '#D4EDDA' : '#FFF3CD',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 3,
                          }}>
                            <Text style={{
                              fontSize: 8,
                              fontFamily: 'Helvetica-Bold',
                              color: isLoue ? '#155724' : '#856404',
                              textTransform: 'uppercase',
                            }}>
                              {isLoue ? 'Loué' : 'Libre'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                  {/* TOTAL row */}
                  <View style={{
                    flexDirection: 'row',
                    paddingVertical: 10,
                    borderTopWidth: 1,
                    borderTopColor: palette.accent || '#9CAF88',
                    backgroundColor: '#FAFAF7',
                    marginTop: 4,
                  }}>
                    <Text style={{ flex: 3, fontSize: 10, fontFamily: 'Helvetica-Bold', paddingHorizontal: 4, textTransform: 'uppercase' }}>
                      TOTAL
                    </Text>
                    <Text style={{ flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold', paddingHorizontal: 4, textAlign: 'right' }}>
                      {totalSurf > 0 ? `${totalSurf} m²` : '—'}
                    </Text>
                    <Text style={{ flex: 1.2, fontSize: 10, fontFamily: 'Helvetica-Bold', paddingHorizontal: 4, textAlign: 'right' }}>
                      {totalLoyer > 0 ? formatPrix(totalLoyer) : '—'}
                    </Text>
                    <Text style={{ flex: 1, fontSize: 8, paddingHorizontal: 4, textAlign: 'center', color: '#666' }}>
                      {nbLoues}/{lots.length}
                    </Text>
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

      <Page size="A4" style={styles.page}>
        <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
        <SectionTitle
          title={"INFORMATIONS\nFINANCIÈRES"}
          multiLine={true}
          isOffMarket={isOffMarket}
        />
        <FinancialTable rows={finRows} isOffMarket={isOffMarket} />
        <PageFooter isOffMarket={isOffMarket} />
      </Page>

      {photoChunks.map((chunk, pageIndex) => (
        <Page key={`photos-${pageIndex}`} size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle title="PHOTOS" isOffMarket={isOffMarket} />
          <View style={{ marginTop: 16 }}>
            <PhotoGrid
              photos={chunk.map(url => ({ url }))}
              isOffMarket={isOffMarket}
            />
          </View>
          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      ))}

      {hasPlans && mandat.plans.map((plan, i) => (
        <Page key={`plan-${i}`} size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle title="PLANS" isOffMarket={isOffMarket} />
          <Image
            src={plan.url || plan}
            style={{ width: '100%', height: 500, objectFit: 'contain', marginTop: 24 }}
          />
          {plan.caption && (
            <Text style={[styles.descriptionText, { marginTop: 12, fontSize: 10 }]}>
              {plan.caption}
            </Text>
          )}
          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      ))}

      <Page size="A4" style={styles.page}>
        <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
        <SectionTitle title="NOTRE ÉQUIPE" isOffMarket={isOffMarket} />

        {team.length > 0 && (
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 30 }}>
            {dossier.length > 0 && (
              <View style={{ marginBottom: 30 }}>
                <Text style={{
                  fontSize: 10,
                  fontFamily: 'Helvetica-Bold',
                  color: palette.accent || '#9CAF88',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  marginBottom: 10,
                  textAlign: 'center',
                }}>
                  Pour ce dossier
                </Text>
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}>
                  {dossier.map((member, i) => (
                    <TeamCard key={`d-${i}`} member={member} palette={palette} compact />
                  ))}
                </View>
              </View>
            )}

            {dossier.length > 0 && autres.length > 0 && (
              <View style={{
                borderBottomWidth: 0.5,
                borderBottomColor: palette.muted || '#999',
                marginVertical: 24,
                marginHorizontal: 60,
              }} />
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
                  <Text style={{
                    fontSize: 10,
                    fontFamily: 'Helvetica-Bold',
                    color: palette.accent || '#9CAF88',
                    textTransform: 'uppercase',
                    letterSpacing: 1.5,
                    marginBottom: 10,
                    textAlign: 'center',
                  }}>
                    À votre service
                  </Text>

                  {bossEntry && (
                    <View style={{
                      flexDirection: 'row',
                      justifyContent: 'center',
                      marginBottom: autresSansBoss.length > 0 ? 28 : 0,
                    }}>
                      <TeamCard member={bossEntry} palette={palette} compact />
                    </View>
                  )}

                  {autresSansBoss.length > 0 && (
                    <View style={{
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                    }}>
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

// Petit composant pour afficher un label/valeur de la parcelle cadastrale
function ParcelleField({ label, value }) {
  return (
    <View style={{ width: '50%', marginBottom: 6 }}>
      <Text style={{ fontSize: 8, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

function TransportSection({ title, items, palette, mode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        color: palette.accent || '#9CAF88',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
      }}>
        {title}
      </Text>
      {items.map((item, i) => {
        const lines = item.lines
          ? String(item.lines).split(/[;,/]/).map(s => s.trim()).filter(Boolean)
          : [];
        return (
          <View key={i} style={{
            flexDirection: 'row',
            paddingVertical: 6,
            borderBottomWidth: 0.5,
            borderBottomColor: palette.muted || '#ddd',
            alignItems: 'center',
          }}>
            <Text style={{ flex: 3, fontSize: 10 }}>{item.name}</Text>
            <View style={{ flex: 2, flexDirection: 'row', flexWrap: 'wrap' }}>
              {lines.map((line, j) => (
                <LineBadge key={j} line={line} mode={mode} />
              ))}
            </View>
            <Text style={{ flex: 1, fontSize: 10, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>
              {item.distance} m
            </Text>
          </View>
        );
      })}
    </View>
  );
}
