// ═══════════════════════════════════════════════════════════════════
// lib/pdf/templates/PlaquetteAcheteur.jsx — v13.3
// Page équipe : "Pour ce dossier" + "À votre service" (boss en haut 130px)
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

function buildTeamForPlaquette({ mandat, sender, allMembers }) {
  const BOSS_INITIALS = 'TE';
  const ownerInitials = (mandat?.ownerInitials || '').toUpperCase();
  const senderInitials = (sender?.initiales || sender?.initials || '').toUpperCase();

  const allKeys = Object.keys(allMembers || {});
  const debug = {
    bossKey: BOSS_INITIALS,
    ownerKey: ownerInitials,
    senderKey: senderInitials,
    allKeys,
    bossFound: !!allMembers[BOSS_INITIALS],
    ownerFound: !!allMembers[ownerInitials],
    senderFound: !!allMembers[senderInitials],
  };

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

  return { team, debug };
}

function TeamCard({ member, palette, size = 100 }) {
  const photoSize = size;
  const initials = (member?.name || '?')
    .split(' ')
    .map(s => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={{ alignItems: 'center', maxWidth: 180, marginHorizontal: 10, marginBottom: 12 }}>
      {member.photo ? (
        <Image
          src={member.photo}
          style={{
            width: photoSize,
            height: photoSize,
            borderRadius: photoSize / 2,
            objectFit: 'cover',
            marginBottom: 10,
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
          marginBottom: 10,
        }}>
          <Text style={{
            color: '#FFFFFF',
            fontSize: size > 110 ? 36 : 28,
            fontFamily: 'Helvetica-Bold',
          }}>
            {initials}
          </Text>
        </View>
      )}
      <Text style={{
        fontSize: size > 110 ? 13 : 11,
        fontFamily: 'Helvetica-Bold',
        textAlign: 'center',
        marginBottom: 2,
        color: palette.text || '#222',
      }}>
        {member.name || '—'}
      </Text>
      <Text style={{
        fontSize: 9,
        color: palette.muted || '#666',
        textAlign: 'center',
        marginBottom: 4,
        maxWidth: 160,
      }}>
        {member.role || ''}
      </Text>
      {member.email && (
        <Text style={{
          fontSize: 8,
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
}) {
  const isOffMarket = mandat?.is_off_market === true;
  const styles = getStyles(isOffMarket);
  const palette = isOffMarket ? COLORS.offmarket : COLORS.standard;

  const photos = normalizePhotos(mandat?.photos);
  const photoChunks = chunkPhotos(photos, 6);

  const hasMapImage = !!mandat?.map_image_url;
  const hasAerialImage = !!mandat?.aerial_image_url;
  const hasCadastreImage = !!mandat?.cadastre_image_url;
  const hasEtatLocatif = mandat?.etat_locatif && Array.isArray(mandat.etat_locatif) && mandat.etat_locatif.length > 0;
  const hasPlans = mandat?.plans && Array.isArray(mandat.plans) && mandat.plans.length > 0;
  const hasPhotos = photos.length > 0;

  const tocItems = [];
  let p = 3;
  tocItems.push({ label: 'LE BIEN', page: `P. ${p++}` });
  if (hasMapImage) tocItems.push({ label: 'SITUATION & TRANSPORTS', page: `P. ${p++}` });
  if (hasAerialImage) tocItems.push({ label: 'VUE AÉRIENNE ET SATELLITE', page: `P. ${p++}` });
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

  const teamResult = buildTeamForPlaquette({
    mandat,
    sender: conseiller,
    allMembers: teamMembers || {},
  });
  const team = teamResult.team;
  const teamDebug = teamResult.debug;

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
  if (honoraires && mandat?.honoraires_taux) {
    finRows.push({
      label: `Honoraires TTC (${mandat.honoraires_taux}%)`,
      value: formatPrix(honoraires),
    });
    finRows.push({
      label: 'Prix frais d\'agence inclus',
      value: formatPrix(prixTotal),
    });
  } else if (mandat?.honoraires_charge) {
    finRows.push({
      label: 'Honoraires',
      value: safeText(mandat.honoraires_charge, "À la charge de l'acquéreur"),
    });
  }
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
        <PageFooter pageNumber={2} isOffMarket={isOffMarket} />
      </Page>

      <Page size="A4" style={styles.page}>
        <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
        <SectionTitle title="LE BIEN" isOffMarket={isOffMarket} />
        {description && (
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
        <PageFooter pageNumber={3} isOffMarket={isOffMarket} />
      </Page>

      {hasMapImage && (
        <Page size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle
            title={"SITUATION\n& TRANSPORTS"}
            multiLine={true}
            isOffMarket={isOffMarket}
          />
          {mandat?.transport_info && (
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
          <Image src={mandat.aerial_image_url} style={{ width: '100%', height: 380, objectFit: 'contain' }} />
          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      )}

      {hasCadastreImage && (
        <Page size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle title="CADASTRE" isOffMarket={isOffMarket} />
          {mandat?.cadastre_description && (
            <Text style={[styles.descriptionText, { marginVertical: 12 }]}>
              {mandat.cadastre_description}
            </Text>
          )}
          <Image src={mandat.cadastre_image_url} style={{ width: '100%', height: 380, objectFit: 'contain', marginTop: 16 }} />
          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      )}

      {hasEtatLocatif && (
        <Page size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle title="ETAT LOCATIF" isOffMarket={isOffMarket} />
          <Text style={[styles.descriptionText, { marginTop: 16, fontSize: 10 }]}>
            Synthèse de l'état locatif au {new Date().toLocaleDateString('fr-FR')}
          </Text>
          <View style={{ marginTop: 24, marginHorizontal: 30 }}>
            {(mandat.etat_locatif || []).map((lot, i) => (
              <View key={i} style={{
                flexDirection: 'row',
                paddingVertical: 8,
                borderBottomWidth: 0.5,
                borderBottomColor: palette.muted || palette.accentLine
              }}>
                <Text style={{ flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold' }}>
                  Lot {lot.numero || (i + 1)}
                </Text>
                <Text style={{ flex: 2, fontSize: 10 }}>
                  {lot.nature || ''} {lot.surface ? `· ${lot.surface} m²` : ''}
                </Text>
                <Text style={{ flex: 1, fontSize: 10, textAlign: 'right' }}>
                  {lot.loyer ? formatPrix(lot.loyer) : '—'}
                </Text>
              </View>
            ))}
          </View>
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
          <PageFooter pageNumber={null} isOffMarket={isOffMarket} />
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

        {team.length === 0 && (
          <View style={{
            margin: 30,
            padding: 16,
            backgroundColor: '#fff3cd',
            borderWidth: 2,
            borderColor: '#856404',
            borderStyle: 'solid',
          }}>
            <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>
              ⚠️ DEBUG — Aucun membre d'équipe trouvé
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 2 }}>
              Boss key recherché : "{teamDebug.bossKey}" — trouvé : {teamDebug.bossFound ? 'OUI' : 'NON'}
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 2 }}>
              Owner key : "{teamDebug.ownerKey}" — trouvé : {teamDebug.ownerFound ? 'OUI' : 'NON'}
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 2 }}>
              Sender key : "{teamDebug.senderKey}" — trouvé : {teamDebug.senderFound ? 'OUI' : 'NON'}
            </Text>
            <Text style={{ fontSize: 9 }}>
              Clés disponibles dans teamMembers : {teamDebug.allKeys.join(', ') || '(VIDE)'}
            </Text>
          </View>
        )}

        {team.length > 0 && (
          <View style={{ marginTop: 20, paddingHorizontal: 20 }}>
            {dossier.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{
                  fontSize: 11,
                  fontFamily: 'Helvetica-Bold',
                  color: palette.accent || '#9CAF88',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  marginBottom: 16,
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
                    <TeamCard key={`d-${i}`} member={member} palette={palette} />
                  ))}
                </View>
              </View>
            )}

            {dossier.length > 0 && autres.length > 0 && (
              <View style={{
                borderBottomWidth: 0.5,
                borderBottomColor: palette.muted || '#999',
                marginVertical: 16,
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
                <View style={{ marginTop: 16 }}>
                  <Text style={{
                    fontSize: 11,
                    fontFamily: 'Helvetica-Bold',
                    color: palette.accent || '#9CAF88',
                    textTransform: 'uppercase',
                    letterSpacing: 1.5,
                    marginBottom: 16,
                    textAlign: 'center',
                  }}>
                    À votre service
                  </Text>

                  {bossEntry && (
                    <View style={{
                      flexDirection: 'row',
                      justifyContent: 'center',
                      marginBottom: autresSansBoss.length > 0 ? 20 : 0,
                    }}>
                      <TeamCard member={bossEntry} palette={palette} size={130} />
                    </View>
                  )}

                  {autresSansBoss.length > 0 && (
                    <View style={{
                      flexDirection: 'row',
                      justifyContent: 'center',
                      flexWrap: 'wrap',
                    }}>
                      {autresSansBoss.map((member, i) => (
                        <TeamCard key={`a-${i}`} member={member} palette={palette} />
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
