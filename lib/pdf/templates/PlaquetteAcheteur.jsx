// ═══════════════════════════════════════════════════════════════════
// lib/pdf/templates/PlaquetteAcheteur.jsx
// 
// Plaquette commerciale pour acheteurs / prospects
// Reproduction fidèle de la plaquette I&P existante
// 
// Pages :
//   1. Couverture (logo + photo principale + titre + contact)
//   2. Sommaire
//   3. Le bien (description + nous aimons)
//   4. Informations financières (prix, honoraires, copropriété)
//   5+. Photos (toutes, 6 par page)
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { Document, Page, View, Text } from '@react-pdf/renderer';
import {
  getStyles,
  LAYOUT,
} from '../styles';
import {
  PageHeader,
  PageFooter,
  CoverContent,
  TableOfContents,
  Section,
  HighlightsList,
  FinancialRow,
  PhotoGrid,
} from '../components';
import {
  formatPrix,
  formatSurface,
  formatRendement,
  normalizePhotos,
  chunkPhotos,
  safeText,
} from '../helpers';

export default function PlaquetteAcheteur({ mandat, conseiller, logoUrl }) {
  const isOffMarket = mandat?.is_off_market === true;
  const styles = getStyles(isOffMarket);

  const photos = normalizePhotos(mandat?.photos);
  const heroPhotoUrl = photos[0] || null;
  const otherPhotos = photos.slice(1);
  const photoChunks = chunkPhotos(otherPhotos, 6);

  // Pagination du sommaire
  const tocItems = [
    { label: 'Le bien', page: 1 },
    { label: 'Informations financières', page: 2 },
  ];
  if (otherPhotos.length > 0) {
    tocItems.push({ label: 'Photos', page: 3 });
  }

  // Loyers / rendement : on ne les met dans la plaquette que s'ils existent
  // (un studio à vendre peut ne pas avoir ces infos)
  const hasLoyers = mandat?.loyers_annuels && Number(mandat.loyers_annuels) > 0;
  const hasRendement = mandat?.rendement && Number(mandat.rendement) > 0;

  return (
    <Document
      title={`Plaquette - ${safeText(mandat?.nom, 'Mandat')}`}
      author="Immeubles & Patrimoine"
      subject="Plaquette commerciale acheteur"
      keywords={isOffMarket ? 'off-market, confidentiel' : 'mandat, vente'}
    >
      {/* ═══════════════════════════════════════ */}
      {/* PAGE 1 : COUVERTURE                     */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.coverPage}>
        <CoverContent
          mandat={mandat}
          conseiller={conseiller}
          logoUrl={logoUrl}
          heroPhotoUrl={heroPhotoUrl}
          isOffMarket={isOffMarket}
        />
      </Page>

      {/* ═══════════════════════════════════════ */}
      {/* PAGE 2 : SOMMAIRE                       */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <TableOfContents items={tocItems} isOffMarket={isOffMarket} />
        <PageFooter conseiller={conseiller} isOffMarket={isOffMarket} />
      </Page>

      {/* ═══════════════════════════════════════ */}
      {/* PAGE 3 : LE BIEN                        */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <PageHeader title="Le bien" pageNumber={1} isOffMarket={isOffMarket} />

        <View style={styles.twoColumns}>
          {/* Colonne gauche : description */}
          <View style={styles.column}>
            <Section label="Description" isOffMarket={isOffMarket}>
              <Text style={styles.sectionContent}>
                {safeText(mandat?.description, 'Description à venir.')}
              </Text>
            </Section>

            {/* Sous-type / type / lots — petits compléments en colonne gauche */}
            {(mandat?.type || mandat?.sous_type) && (
              <Section label="Type de bien" isOffMarket={isOffMarket}>
                <Text style={styles.sectionContent}>
                  {[mandat?.type, mandat?.sous_type].filter(Boolean).join(' — ')}
                </Text>
              </Section>
            )}
          </View>

          {/* Colonne droite : "Nous aimons" */}
          <View style={styles.column}>
            <Section label="Nous aimons" isOffMarket={isOffMarket}>
              <HighlightsList
                highlights={mandat?.highlights}
                isOffMarket={isOffMarket}
              />
            </Section>
          </View>
        </View>

        <PageFooter conseiller={conseiller} isOffMarket={isOffMarket} />
      </Page>

      {/* ═══════════════════════════════════════ */}
      {/* PAGE 4 : INFORMATIONS FINANCIÈRES       */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <PageHeader
          title="Informations financières"
          pageNumber={2}
          isOffMarket={isOffMarket}
        />

        <Section label="Informations financières" isOffMarket={isOffMarket}>
          <FinancialRow
            label="Prix de vente :"
            value={formatPrix(mandat?.prix)}
            isOffMarket={isOffMarket}
          />
          {mandat?.surface && (
            <FinancialRow
              label="Surface :"
              value={formatSurface(mandat?.surface)}
              isOffMarket={isOffMarket}
            />
          )}
          {hasLoyers && (
            <FinancialRow
              label="Loyers annuels :"
              value={formatPrix(mandat?.loyers_annuels)}
              isOffMarket={isOffMarket}
            />
          )}
          {hasRendement && (
            <FinancialRow
              label="Rendement brut :"
              value={formatRendement(mandat?.rendement)}
              isOffMarket={isOffMarket}
            />
          )}
          <FinancialRow
            label="Honoraires à charge :"
            value={safeText(mandat?.honoraires_charge, "De l'acquéreur")}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Statut :"
            value={safeText(
              mandat?.statut_copropriete,
              'Non soumis au statut de la copropriété'
            )}
            isOffMarket={isOffMarket}
          />
          {mandat?.nb_lots && (
            <FinancialRow
              label="Nombre de lots :"
              value={String(mandat.nb_lots)}
              isOffMarket={isOffMarket}
            />
          )}
        </Section>

        <PageFooter conseiller={conseiller} isOffMarket={isOffMarket} />
      </Page>

      {/* ═══════════════════════════════════════ */}
      {/* PAGES 5+ : PHOTOS                       */}
      {/* ═══════════════════════════════════════ */}
      {photoChunks.map((chunk, i) => (
        <Page key={`photos-${i}`} size="A4" style={styles.page}>
          <PageHeader
            title="Photos"
            pageNumber={3 + i}
            isOffMarket={isOffMarket}
          />
          <PhotoGrid photos={chunk} isOffMarket={isOffMarket} />
          <PageFooter conseiller={conseiller} isOffMarket={isOffMarket} />
        </Page>
      ))}
    </Document>
  );
}
