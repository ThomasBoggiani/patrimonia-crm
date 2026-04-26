// ═══════════════════════════════════════════════════════════════════
// lib/pdf/templates/FicheInterne.jsx
// 
// Fiche interne complète pour archivage / équipe I&P
// 
// Contenu : TOUT
//   - Toutes les infos commerciales (publiques)
//   - Owner, profile_id, contact vendeur, tel
//   - Highlights, description longue
//   - Toutes les photos
//   - Statut, commercialisation, dates
//   - Mandat type, signature, mise à jour
// 
// Pas de sucre design : dense, lisible, facile à archiver / imprimer
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { Document, Page, View, Text } from '@react-pdf/renderer';
import { getStyles, LAYOUT } from '../styles';
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
  buildTitleCommercial,
  normalizePhotos,
  chunkPhotos,
  safeText,
} from '../helpers';

export default function FicheInterne({ mandat, conseiller, logoUrl }) {
  const isOffMarket = mandat?.is_off_market === true;
  const styles = getStyles(isOffMarket);

  const photos = normalizePhotos(mandat?.photos);
  const photoChunks = chunkPhotos(photos, 6);

  return (
    <Document
      title={`Fiche interne - ${safeText(mandat?.nom, 'Mandat')}`}
      author="Immeubles & Patrimoine"
      subject="Fiche interne mandat"
      keywords="interne, archive, confidentiel"
    >
      {/* ═══════════════════════════════════════ */}
      {/* PAGE 1 : EN-TÊTE + IDENTIFICATION       */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <PageHeader title="Fiche interne mandat" pageNumber={1} isOffMarket={isOffMarket} />

        {/* Bandeau identification */}
        <View
          style={{
            paddingVertical: 16,
            paddingHorizontal: 18,
            backgroundColor: isOffMarket
              ? styles.kpiCard.backgroundColor
              : '#EBE9E2',
            marginBottom: 20,
            borderLeftWidth: 4,
            borderLeftColor: isOffMarket
              ? styles.kpiCard.borderLeftColor
              : '#94A084',
          }}
        >
          <Text style={{ fontSize: 9, color: styles.kpiLabel.color, letterSpacing: 1 }}>
            RÉFÉRENCE INTERNE · {safeText(mandat?.id?.slice(0, 8), '—').toUpperCase()}
          </Text>
          <Text
            style={{
              fontSize: 16,
              fontFamily: 'Helvetica-Bold',
              color: isOffMarket
                ? styles.coverContactLine.color
                : '#2D2D2A',
              marginTop: 6,
            }}
          >
            {safeText(mandat?.nom, 'Bien sans nom')}
          </Text>
          <Text style={{ fontSize: 10, color: styles.kpiLabel.color, marginTop: 4 }}>
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
                fontSize: 9,
                color: styles.coverContactLabel.color,
                marginTop: 8,
                letterSpacing: 1.5,
                fontFamily: 'Helvetica-Bold',
              }}
            >
              ⊘ OFF-MARKET
            </Text>
          )}
        </View>

        {/* Localisation */}
        <Section label="Localisation" isOffMarket={isOffMarket}>
          <FinancialRow
            label="Adresse :"
            value={safeText(mandat?.adresse, '—')}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Ville :"
            value={safeText(mandat?.ville, '—')}
            isOffMarket={isOffMarket}
          />
        </Section>

        {/* Caractéristiques */}
        <Section label="Caractéristiques" isOffMarket={isOffMarket}>
          <FinancialRow
            label="Type :"
            value={safeText(mandat?.type, '—')}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Sous-type :"
            value={safeText(mandat?.sous_type, '—')}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Surface :"
            value={formatSurface(mandat?.surface)}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Nombre de lots :"
            value={mandat?.nb_lots ? String(mandat.nb_lots) : '—'}
            isOffMarket={isOffMarket}
          />
        </Section>

        {/* Données financières */}
        <Section label="Données financières" isOffMarket={isOffMarket}>
          <FinancialRow
            label="Prix FAI :"
            value={formatPrix(mandat?.prix)}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Prix au m² :"
            value={
              mandat?.prix_m2
                ? formatPrix(mandat.prix_m2, { suffix: '/m²' })
                : formatPrixM2(mandat?.prix, mandat?.surface)
            }
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Loyers annuels :"
            value={mandat?.loyers_annuels ? formatPrix(mandat.loyers_annuels) : '—'}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Rendement brut :"
            value={formatRendement(mandat?.rendement)}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Honoraires à charge :"
            value={safeText(mandat?.honoraires_charge, "De l'acquéreur")}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Statut copropriété :"
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
        <PageHeader title="Mandat & contacts" pageNumber={2} isOffMarket={isOffMarket} />

        <Section label="Suivi du mandat" isOffMarket={isOffMarket}>
          <FinancialRow
            label="Type de mandat :"
            value={safeText(mandat?.commercialisation, '—')}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Statut commercial :"
            value={safeText(mandat?.statut, '—')}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Date de signature :"
            value={formatDate(mandat?.date_signature)}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Date de création :"
            value={formatDate(mandat?.created_at)}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Dernière mise à jour :"
            value={formatDate(mandat?.updated_at)}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Off-market :"
            value={isOffMarket ? 'Oui' : 'Non'}
            isOffMarket={isOffMarket}
          />
        </Section>

        <Section label="Conseiller en charge" isOffMarket={isOffMarket}>
          <FinancialRow
            label="Initiales :"
            value={safeText(mandat?.owner, '—')}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Profile lié :"
            value={
              mandat?.profile_id
                ? mandat.profile_id.slice(0, 8) + '…'
                : '(non lié)'
            }
            isOffMarket={isOffMarket}
          />
          {conseiller?.full_name && (
            <FinancialRow
              label="Nom :"
              value={conseiller.full_name}
              isOffMarket={isOffMarket}
            />
          )}
          {conseiller?.email && (
            <FinancialRow
              label="Email :"
              value={conseiller.email}
              isOffMarket={isOffMarket}
            />
          )}
          {conseiller?.tel && (
            <FinancialRow
              label="Téléphone :"
              value={conseiller.tel}
              isOffMarket={isOffMarket}
            />
          )}
        </Section>

        <Section label="Contact vendeur (côté apporteur)" isOffMarket={isOffMarket}>
          <FinancialRow
            label="Contact :"
            value={safeText(mandat?.contact, '—')}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Téléphone :"
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
        <PageHeader title="Description & atouts" pageNumber={3} isOffMarket={isOffMarket} />

        <Section label="Description commerciale" isOffMarket={isOffMarket}>
          <Text style={styles.sectionContent}>
            {safeText(mandat?.description, '(Aucune description renseignée)')}
          </Text>
        </Section>

        <Section label="Points forts (Nous aimons)" isOffMarket={isOffMarket}>
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
