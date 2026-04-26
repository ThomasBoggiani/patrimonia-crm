// ═══════════════════════════════════════════════════════════════════
// lib/pdf/templates/PlaquetteAcheteur.jsx — REFONTE Direction 1 v12.3
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { Document, Page, View, Text } from '@react-pdf/renderer';
import { getStyles, LAYOUT } from '../styles';
import {
  PageHeader,
  PageFooter,
  CoverContent,
  TableOfContents,
  Section,
  HighlightsList,
  FinancialRow,
  PhotoGrid,
  PhotoFull,
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
  
  // Première page photos : 1 photo en grand + 4 en grille
  // Pages suivantes : 6 photos par page en grille
  const firstPagePhotos = otherPhotos.slice(0, 5);  // 1 grande + 4 en bas
  const remainingPhotos = otherPhotos.slice(5);
  const additionalChunks = chunkPhotos(remainingPhotos, 6);

  const tocItems = [
    { label: 'Le bien', page: 'p. 04' },
    { label: 'Informations financières', page: 'p. 06' },
  ];
  if (otherPhotos.length > 0) {
    tocItems.push({ label: 'Galerie photos', page: 'p. 08' });
  }

  const hasLoyers = mandat?.loyers_annuels && Number(mandat.loyers_annuels) > 0;
  const hasRendement = mandat?.rendement && Number(mandat.rendement) > 0;

  return (
    <Document
      title={`Plaquette — ${safeText(mandat?.nom, 'Mandat')}`}
      author="Immeubles & Patrimoine"
      subject="Plaquette commerciale acheteur"
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
        <View style={{ paddingTop: 80 }}>
          <TableOfContents items={tocItems} isOffMarket={isOffMarket} />
        </View>
        <PageFooter conseiller={conseiller} isOffMarket={isOffMarket} />
      </Page>

      {/* ═══════════════════════════════════════ */}
      {/* PAGE 3 : LE BIEN                        */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <PageHeader 
          eyebrow="Chapitre I"
          title="Le bien" 
          pageNumber={1} 
          isOffMarket={isOffMarket} 
        />

        <View style={styles.twoColumns}>
          <View style={styles.column}>
            <Section eyebrow="Présentation" isOffMarket={isOffMarket}>
              <Text style={styles.sectionContent}>
                {safeText(mandat?.description, 'Description à venir.')}
              </Text>
            </Section>

            {(mandat?.type || mandat?.sous_type) && (
              <Section eyebrow="Caractère du bien" isOffMarket={isOffMarket}>
                <Text style={styles.sectionContent}>
                  {[mandat?.type, mandat?.sous_type].filter(Boolean).join(' · ')}
                </Text>
                {mandat?.surface && (
                  <Text style={{ ...styles.sectionContent, marginTop: 8 }}>
                    Surface : {formatSurface(mandat.surface)}
                    {mandat?.nb_lots ? ` · ${mandat.nb_lots} lot${mandat.nb_lots > 1 ? 's' : ''}` : ''}
                  </Text>
                )}
              </Section>
            )}
          </View>

          <View style={styles.column}>
            <Section eyebrow="Nous aimons" isOffMarket={isOffMarket}>
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
          eyebrow="Chapitre II"
          title="Informations financières"
          pageNumber={2}
          isOffMarket={isOffMarket}
        />

        <Section eyebrow="Conditions de vente" isOffMarket={isOffMarket}>
          <FinancialRow
            label="Prix de vente"
            value={formatPrix(mandat?.prix)}
            big={true}
            isOffMarket={isOffMarket}
          />
          {mandat?.surface && (
            <FinancialRow
              label="Surface"
              value={formatSurface(mandat?.surface)}
              isOffMarket={isOffMarket}
            />
          )}
          {hasLoyers && (
            <FinancialRow
              label="Loyers annuels"
              value={formatPrix(mandat?.loyers_annuels)}
              isOffMarket={isOffMarket}
            />
          )}
          {hasRendement && (
            <FinancialRow
              label="Rendement brut"
              value={formatRendement(mandat?.rendement)}
              isOffMarket={isOffMarket}
            />
          )}
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
          {mandat?.nb_lots && (
            <FinancialRow
              label="Nombre de lots"
              value={String(mandat.nb_lots)}
              isOffMarket={isOffMarket}
            />
          )}
        </Section>

        <PageFooter conseiller={conseiller} isOffMarket={isOffMarket} />
      </Page>

      {/* ═══════════════════════════════════════ */}
      {/* PAGE 5 (optionnelle) : Première page photos */}
      {/* 1 grande photo + 4 photos en grille     */}
      {/* ═══════════════════════════════════════ */}
      {firstPagePhotos.length > 0 && (
        <Page size="A4" style={styles.page}>
          <PageHeader
            eyebrow="Chapitre III"
            title="Galerie photos"
            pageNumber={3}
            isOffMarket={isOffMarket}
          />
          
          {/* Première photo en grand */}
          <PhotoFull photo={firstPagePhotos[0]} isOffMarket={isOffMarket} />
          
          {/* Reste en grille */}
          {firstPagePhotos.length > 1 && (
            <PhotoGrid 
              photos={firstPagePhotos.slice(1)} 
              isOffMarket={isOffMarket} 
            />
          )}
          
          <PageFooter conseiller={conseiller} isOffMarket={isOffMarket} />
        </Page>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* PAGES SUIVANTES : Photos en grille      */}
      {/* ═══════════════════════════════════════ */}
      {additionalChunks.map((chunk, i) => (
        <Page key={`photos-${i}`} size="A4" style={styles.page}>
          <PageHeader
            eyebrow="Chapitre III"
            title="Galerie photos"
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
