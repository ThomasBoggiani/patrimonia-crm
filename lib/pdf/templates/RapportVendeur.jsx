// ═══════════════════════════════════════════════════════════════════
// lib/pdf/templates/RapportVendeur.jsx — v1.1
// Template I&P + couverture resserrée + signature complète avec photo
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
} from '../components';
import {
  formatPrix,
  formatSurface,
  safeText,
  normalizePhotos,
} from '../helpers';
import { LOGO_IP_BASE64 } from '../logo-base64';

function formatDateFR(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function SignatureBlock({ conseiller, palette }) {
  if (!conseiller) return null;

  const name = conseiller.full_name || conseiller.name ||
    `${conseiller.prenom || ''} ${conseiller.nom || ''}`.trim() ||
    'Votre interlocuteur';
  const fonction = conseiller.fonction || conseiller.role || 'Conseiller';
  const email = conseiller.email || null;
  const tel = conseiller.telephone || conseiller.phone || null;
  const photo = conseiller.photo || null;

  const initials = name
    .split(' ')
    .map(s => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 40,
      paddingHorizontal: 30,
      paddingVertical: 16,
      backgroundColor: palette.bgSoft || '#F5F2EC',
      borderLeftWidth: 3,
      borderLeftColor: palette.accent || '#9CAF88',
    }}>
      {photo ? (
        <Image
          src={photo}
          style={{
            width: 70,
            height: 70,
            borderRadius: 35,
            objectFit: 'cover',
            marginRight: 16,
          }}
        />
      ) : (
        <View style={{
          width: 70,
          height: 70,
          borderRadius: 35,
          backgroundColor: palette.accent || '#9CAF88',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 16,
        }}>
          <Text style={{ color: '#FFFFFF', fontSize: 22, fontFamily: 'Helvetica-Bold' }}>
            {initials}
          </Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 9, color: palette.muted || '#666', marginBottom: 2 }}>
          Bien cordialement,
        </Text>
        <Text style={{
          fontSize: 13,
          fontFamily: 'Helvetica-Bold',
          color: palette.text || '#222',
          marginBottom: 2,
        }}>
          {name}
        </Text>
        <Text style={{
          fontSize: 10,
          color: palette.accent || '#9CAF88',
          fontFamily: 'Helvetica-Oblique',
          marginBottom: 6,
        }}>
          {fonction}
        </Text>
        {email && (
          <Text style={{ fontSize: 9, color: palette.text || '#444' }}>
            {email}
          </Text>
        )}
        {tel && (
          <Text style={{ fontSize: 9, color: palette.text || '#444' }}>
            {tel}
          </Text>
        )}
        <Text style={{ fontSize: 8, color: palette.muted || '#666', marginTop: 4, fontStyle: 'italic' }}>
          Immeubles & Patrimoine — 7 rue de Penthièvre 75008 Paris
        </Text>
      </View>
    </View>
  );
}

export default function RapportVendeur({
  mandat,
  conseiller,
  logoUrl,
  period,
  stats,
  events,
}) {
  const isOffMarket = mandat?.is_off_market === true;
  const styles = getStyles(isOffMarket);
  const palette = isOffMarket ? COLORS.offmarket : COLORS.standard;

  const photos = normalizePhotos(mandat?.photos);
  const heroPhoto = photos[0] || null;

  const periodStart = formatDateFR(period?.start);
  const periodEnd = formatDateFR(period?.end);
  const today = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const kpis = [
    { number: stats?.nb_contacts ?? 0, label: 'Contacts' },
    { number: stats?.nb_visites ?? 0, label: 'Visites' },
    { number: stats?.nb_offres ?? 0, label: 'Offres' },
    { number: stats?.nb_vues ?? 0, label: 'Vues' },
  ];

  const hasEvents = Array.isArray(events) && events.length > 0;

  return (
    <Document
      title={`Rapport d'activité — ${safeText(mandat?.nom, 'Mandat')}`}
      author="Immeubles & Patrimoine"
      subject="Rapport d'activité au mandant"
    >
      {/* PAGE 1 : COUVERTURE — resserrée */}
      <Page size="A4" style={styles.coverPage}>
        <Image src={LOGO_IP_BASE64} style={styles.coverLogoLarge} />

        {heroPhoto ? (
          <Image src={heroPhoto} style={styles.coverPhoto} />
        ) : (
          <View style={styles.coverPhotoPlaceholder}>
            <Text style={{ fontSize: 12, color: palette.muted, fontFamily: 'Helvetica-Oblique' }}>
              Photo principale du bien
            </Text>
          </View>
        )}

        <View style={[styles.coverTitleBlock, { marginTop: 12, paddingHorizontal: 30 }]}>
          <Text style={[styles.coverTitle, { fontSize: 22 }]}>
            RAPPORT D'ACTIVITÉ
          </Text>
          <Text style={[styles.coverCity, { marginTop: 4 }]}>
            {safeText(mandat?.nom, 'BIEN').toUpperCase()}
          </Text>
          <Text style={[styles.coverSubInfo, { marginTop: 6 }]}>
            {periodStart && periodEnd
              ? `Période du ${periodStart} au ${periodEnd}`
              : `Édité le ${today}`}
          </Text>
        </View>

        <Text style={[styles.coverWebsite, { position: 'absolute', bottom: 30, left: 0, right: 0, textAlign: 'center' }]}>
          www.immeubles-patrimoine.fr
        </Text>
      </Page>

      {/* PAGE 2 : SYNTHÈSE */}
      <Page size="A4" style={styles.page}>
        <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
        <SectionTitle title="SYNTHÈSE DE L'ACTIVITÉ" isOffMarket={isOffMarket} />

        <View style={[styles.descriptionBlock, { marginTop: 8 }]}>
          <Text style={styles.descriptionText}>
            Cher mandant,{'\n\n'}
            Voici la synthèse de l'activité menée sur votre bien
            {mandat?.nom ? ` « ${mandat.nom} »` : ''} sur la période
            {periodStart && periodEnd ? ` du ${periodStart} au ${periodEnd}` : ' écoulée'}.
            {'\n\n'}
            Notre équipe reste mobilisée à vos côtés pour mener cette transaction
            dans les meilleures conditions.
          </Text>
        </View>

        <View style={{ marginTop: 24 }}>
          <CardsRow isOffMarket={isOffMarket}>
            {kpis.map((k, i) => (
              <Card
                key={i}
                number={k.number}
                label={k.label}
                isOffMarket={isOffMarket}
              />
            ))}
          </CardsRow>
        </View>

        <PageFooter isOffMarket={isOffMarket} />
      </Page>

      {/* PAGE 3 : ACTIONS RÉALISÉES */}
      {hasEvents && (
        <Page size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle title="ACTIONS RÉALISÉES" isOffMarket={isOffMarket} />

          <Text style={[styles.descriptionText, { marginTop: 16, marginBottom: 16, fontSize: 10 }]}>
            Détail chronologique des actions menées sur la période.
          </Text>

          <View style={{ marginHorizontal: 30 }}>
            {events.map((ev, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  paddingVertical: 8,
                  borderBottomWidth: 0.5,
                  borderBottomColor: palette.muted || '#999',
                }}
              >
                <Text style={{
                  width: 70,
                  fontSize: 9,
                  fontFamily: 'Helvetica-Bold',
                  color: palette.accent || '#9CAF88',
                }}>
                  {formatDateShort(ev.date)}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>
                    {ev.label || ev.type || 'Action'}
                  </Text>
                  {ev.description && (
                    <Text style={{ fontSize: 9, color: palette.text || '#444' }}>
                      {ev.description}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>

          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      )}

      {/* PAGE 4 : RETOURS DU MARCHÉ */}
      <Page size="A4" style={styles.page}>
        <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
        <SectionTitle title="RETOURS DU MARCHÉ" isOffMarket={isOffMarket} />

        <View style={[styles.descriptionBlock, { marginTop: 8 }]}>
          <Text style={styles.descriptionText}>
            Notre approche off-market et la qualification de notre fichier acheteurs
            permettent de cibler des prospects sérieux et alignés avec le standing
            de votre bien.{'\n\n'}
            Les retours qualitatifs recueillis lors des visites et échanges nous
            permettent d'affiner en continu notre stratégie de présentation et
            de négociation.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', marginTop: 24, paddingHorizontal: 20 }}>
          <View style={{
            flex: 1,
            marginRight: 8,
            padding: 14,
            backgroundColor: palette.bgSoft || '#F5F2EC',
            borderLeftWidth: 3,
            borderLeftColor: palette.accent || '#9CAF88',
          }}>
            <Text style={{
              fontSize: 10,
              fontFamily: 'Helvetica-Bold',
              color: palette.accent || '#9CAF88',
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              marginBottom: 8,
            }}>
              Points appréciés
            </Text>
            <Text style={{ fontSize: 9, color: palette.text || '#444', lineHeight: 1.5 }}>
              Synthèse des éléments mis en avant par les acheteurs lors des visites
              (à compléter par votre conseiller).
            </Text>
          </View>

          <View style={{
            flex: 1,
            marginLeft: 8,
            padding: 14,
            backgroundColor: palette.bgSoft || '#F5F2EC',
            borderLeftWidth: 3,
            borderLeftColor: palette.muted || '#999',
          }}>
            <Text style={{
              fontSize: 10,
              fontFamily: 'Helvetica-Bold',
              color: palette.muted || '#666',
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              marginBottom: 8,
            }}>
              Points de vigilance
            </Text>
            <Text style={{ fontSize: 9, color: palette.text || '#444', lineHeight: 1.5 }}>
              Synthèse des objections rencontrées ou questions récurrentes
              (à compléter par votre conseiller).
            </Text>
          </View>
        </View>

        <PageFooter isOffMarket={isOffMarket} />
      </Page>

      {/* PAGE 5 : CONCLUSION & SIGNATURE */}
      <Page size="A4" style={styles.page}>
        <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
        <SectionTitle title="NOS PROCHAINES ÉTAPES" isOffMarket={isOffMarket} />

        <View style={[styles.descriptionBlock, { marginTop: 8 }]}>
          <Text style={styles.descriptionText}>
            Sur la période à venir, nous poursuivrons activement la commercialisation
            de votre bien en orientant nos efforts sur :{'\n\n'}
            •  La diffusion ciblée auprès de notre fichier qualifié de prospects
            patrimoniaux.{'\n'}
            •  L'organisation de visites avec les acheteurs pré-qualifiés.{'\n'}
            •  Le retour régulier d'informations vous concernant l'évolution du dossier.
            {'\n\n'}
            Nous restons à votre entière disposition pour échanger sur ce rapport
            et préciser toute information complémentaire.
          </Text>
        </View>

        <SignatureBlock conseiller={conseiller} palette={palette} />

        <PageFooter isOffMarket={isOffMarket} />
      </Page>
    </Document>
  );
}
