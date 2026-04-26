// ═══════════════════════════════════════════════════════════════════
// lib/pdf/templates/FicheInterne.jsx — REFONTE Direction 1 v12.3
// 
// Fiche interne complète pour archivage / équipe I&P
// Style : Maison de prestige (Times-Roman, sage/crème)
// 
// Pages :
//   1. Identification + Localisation + Caractéristiques + Données financières
//   2. Mandat + Conseiller + Contact vendeur
//   3. Description + Points forts
//   4+. Photos
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { Document, Page, View, Text } from '@react-pdf/renderer';
import { getStyles, COLORS, LAYOUT } from '../styles';
import {
  PageHeader,
  PageFooter,
  Section,
  FinancialRow,
  HighlightsList,
  PhotoGrid,
} from '../components';
import {
  formatPrix,
  formatPrixM2,
  formatSurface,
  formatRendement,
  formatDate,
  normalizePhotos,
  chunkPhotos,
  safeText,
} from '../helpers';

export default function FicheInterne({ mandat, conseiller, logoUrl }) {
  const isOffMarket = mandat?.is_off_market === true;
  const styles = getStyles(isOffMarket);
  const palette = isOffMarket ? COLORS.offmarket : COLORS.standard;

  const photos = normalizePhotos(mandat?.photos);
  const photoChunks = chunkPhotos(photos, 6);

  return (
    <Document
      title={`Fiche interne — ${safeText(mandat?.nom, 'Mandat')}`}
      author="Immeubles & Patrimoine"
      subject="Fiche interne mandat"
      keywords="interne, archive, confidentiel"
    >
      {/* ═══════════════════════════════════════ */}
      {/* PAGE 1 : EN-TÊTE + IDENTIFICATION       */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <PageHeader
          eyebrow="Document interne"
          title="Fiche mandat"
          pageNumber={1}
          isOffMarket={isOffMarket}
        />

        {/* Bandeau identification */}
        <View
          style={{
            paddingVertical: 20,
            paddingHorizontal: 22,
            backgroundColor: isOffMarket
              ? COLORS.offmarket.bgDeep
              : COLORS.standard.creamWarm,
            marginBottom: 28,
            borderLeftWidth: 3,
            borderLeftColor: isOffMarket
              ? COLORS.offmarket.gold
              : COLORS.standard.sageDark,
          }}
        >
          <Text
            style={{
              fontSize: LAYOUT.font.tiny,
              fontFamily: 'Times-Bold',
              color: palette.muted,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Référence interne · {safeText(mandat?.id?.slice(0, 8), '—').toUpperCase()}
          </Text>
          <Text
            style={{
              fontSize: LAYOUT.font.title,
              fontFamily: 'Times-Bold',
              color: isOffMarket ? COLORS.offmarket.cream : COLORS.standard.ink,
              marginTop: 8,
            }}
          >
            {safeText(mandat?.nom, 'Bien sans nom')}
          </Text>
          <Text
            style={{
              fontSize: LAYOUT.font.small,
              fontFamily: 'Times-Italic',
              color: palette.muted,
              marginTop: 6,
            }}
          >
            {[
              mandat?.type,
              mandat?.sous_type,
              mandat?.commercialisation,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {isOffMarket && (
            <Text
              style={{
                fontSize: LAYOUT.font.tiny,
                fontFamily: 'Times-Bold',
                color: COLORS.offmarket.gold,
                marginTop: 12,
                letterSpacing: 2,
              }}
            >
              ⊘ OFF-MARKET
            </Text>
          )}
        </View>

        {/* Localisation */}
        <Section eyebrow="Localisation" isOffMarket={isOffMarket}>
          <FinancialRow
            label="Adresse"
            value={safeText(mandat?.adresse, '—')}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Ville"
            value={safeText(mandat?.ville, '—')}
            isOffMarket={isOffMarket}
          />
        </Section>

        {/* Caractéristiques */}
        <Section eyebrow="Caractéristiques" isOffMarket={isOffMarket}>
          <FinancialRow
            label="Type"
            value={safeText(mandat?.type, '—')}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Sous-type"
            value={safeText(mandat?.sous_type, '—')}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Surface"
            value={formatSurface(mandat?.surface)}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Nombre de lots"
            value={mandat?.nb_lots ? String(mandat.nb_lots) : '—'}
            isOffMarket={isOffMarket}
          />
        </Section>

        {/* Données financières */}
        <Section eyebrow="Données financières" isOffMarket={isOffMarket}>
          <FinancialRow
            label="Prix FAI"
            value={formatPrix(mandat?.prix)}
            big={true}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Prix au m²"
            value={
              mandat?.prix_m2
                ? formatPrix(mandat.prix_m2, { suffix: '/m²' })
                : formatPrixM2(mandat?.prix, mandat?.surface)
            }
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Loyers annuels"
            value={mandat?.loyers_annuels ? formatPrix(mandat.loyers_annuels) : '—'}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Rendement brut"
            value={formatRendement(mandat?.rendement)}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Honoraires à charge"
            value={safeText(mandat?.honoraires_charge, "De l'acquéreur")}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Statut copropriété"
            value={safeText(
              mandat?.statut_copropriete,
              'Non soumis au statut de la copropriété'
            )}
            isOffMarket={isOffMarket}
          />
        </Section>

        <PageFooter conseiller={conseiller} isOffMarket={isOffMarket} />
      </Page>

      {/* ═══════════════════════════════════════ */}
      {/* PAGE 2 : MANDAT + CONTACTS              */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <PageHeader
          eyebrow="Document interne"
          title="Mandat & contacts"
          pageNumber={2}
          isOffMarket={isOffMarket}
        />

        <Section eyebrow="Suivi du mandat" isOffMarket={isOffMarket}>
          <FinancialRow
            label="Type de mandat"
            value={safeText(mandat?.commercialisation, '—')}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Statut commercial"
            value={safeText(mandat?.statut, '—')}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Date de signature"
            value={formatDate(mandat?.date_signature)}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Date de création"
            value={formatDate(mandat?.created_at)}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Dernière mise à jour"
            value={formatDate(mandat?.updated_at)}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Off-market"
            value={isOffMarket ? 'Oui' : 'Non'}
            isOffMarket={isOffMarket}
          />
        </Section>

        <Section eyebrow="Conseiller en charge" isOffMarket={isOffMarket}>
          <FinancialRow
            label="Initiales"
            value={safeText(mandat?.owner, '—')}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Profile lié"
            value={
              mandat?.profile_id
                ? mandat.profile_id.slice(0, 8) + '…'
                : '(non lié)'
            }
            isOffMarket={isOffMarket}
          />
          {conseiller?.full_name && (
            <FinancialRow
              label="Nom"
              value={conseiller.full_name}
              isOffMarket={isOffMarket}
            />
          )}
          {conseiller?.email && (
            <FinancialRow
              label="Email"
              value={conseiller.email}
              isOffMarket={isOffMarket}
            />
          )}
          {conseiller?.tel && (
            <FinancialRow
              label="Téléphone"
              value={conseiller.tel}
              isOffMarket={isOffMarket}
            />
          )}
        </Section>

        <Section eyebrow="Contact vendeur" isOffMarket={isOffMarket}>
          <FinancialRow
            label="Contact"
            value={safeText(mandat?.contact, '—')}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Téléphone"
            value={safeText(mandat?.tel, '—')}
            isOffMarket={isOffMarket}
          />
        </Section>

        <PageFooter conseiller={conseiller} isOffMarket={isOffMarket} />
      </Page>

      {/* ═══════════════════════════════════════ */}
      {/* PAGE 3 : DESCRIPTION & POINTS FORTS     */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <PageHeader
          eyebrow="Document interne"
          title="Description & atouts"
          pageNumber={3}
          isOffMarket={isOffMarket}
        />

        <Section eyebrow="Description commerciale" isOffMarket={isOffMarket}>
          <Text style={styles.sectionContent}>
            {safeText(mandat?.description, '(Aucune description renseignée)')}
          </Text>
        </Section>

        <Section eyebrow="Points forts" isOffMarket={isOffMarket}>
          <HighlightsList
            highlights={mandat?.highlights}
            isOffMarket={isOffMarket}
          />
        </Section>

        <PageFooter conseiller={conseiller} isOffMarket={isOffMarket} />
      </Page>

      {/* ═══════════════════════════════════════ */}
      {/* PAGES 4+ : PHOTOS                       */}
      {/* ═══════════════════════════════════════ */}
      {photoChunks.map((chunk, i) => (
        <Page key={`photos-${i}`} size="A4" style={styles.page}>
          <PageHeader
            eyebrow="Document interne"
            title="Photos"
            pageNumber={4 + i}
            isOffMarket={isOffMarket}
          />
          <PhotoGrid photos={chunk} isOffMarket={isOffMarket} />
          <PageFooter conseiller={conseiller} isOffMarket={isOffMarket} />
        </Page>
      ))}
    </Document>
  );
}
