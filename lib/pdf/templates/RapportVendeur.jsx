// ═══════════════════════════════════════════════════════════════════
// lib/pdf/templates/RapportVendeur.jsx — REFONTE Direction 1 v12.3
// 
// Rapport périodique pour le vendeur (propriétaire).
// Style : Maison de prestige (Times-Roman, sage/crème)
// 
// Pages :
//   1. Couverture sobre (logo + titre + période + date édition)
//   2. Sommaire
//   3. Synthèse activité (KPIs + analyse)
//   4. Détail des événements
//   5. Le bien & avancement
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { getStyles, COLORS, LAYOUT } from '../styles';
import {
  PageHeader,
  PageFooter,
  TableOfContents,
  Section,
  KpiCard,
  FinancialRow,
} from '../components';
import {
  formatPrix,
  formatSurface,
  formatDate,
  formatPeriodLabel,
  safeText,
  ensureAbsoluteUrl,
} from '../helpers';

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
  const periodLabel = formatPeriodLabel(period?.start, period?.end);

  const s = stats || {};
  const safeStats = {
    nb_visites: s.nb_visites ?? 0,
    nb_contacts: s.nb_contacts ?? 0,
    nb_offres: s.nb_offres ?? 0,
    nb_vues: s.nb_vues ?? 0,
  };

  const tocItems = [
    { label: "Synthèse de l'activité", page: 'p. 03' },
    { label: "Détail des événements", page: 'p. 04' },
    { label: 'Le bien & avancement', page: 'p. 05' },
  ];

  return (
    <Document
      title={`Rapport vendeur — ${safeText(mandat?.nom, 'Mandat')}`}
      author="Immeubles & Patrimoine"
      subject="Rapport périodique vendeur"
    >
      {/* ═══════════════════════════════════════ */}
      {/* PAGE 1 : COUVERTURE SOBRE               */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.coverPage}>
        {/* Top bar : logo seul */}
        <View style={styles.coverTopBar}>
          {logoUrl ? (
            <Image src={logoUrl} style={styles.coverLogo} />
          ) : (
            <View style={{ width: 50, height: 50 }} />
          )}
          <View />
        </View>

        {/* Bloc central : titre + période */}
        <View
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 60,
            paddingTop: 100,
            paddingBottom: 40,
          }}
        >
          <Text
            style={{
              fontSize: LAYOUT.font.tiny,
              fontFamily: 'Times-Bold',
              color: palette.muted || palette.sageDeep,
              letterSpacing: 4,
              textTransform: 'uppercase',
              marginBottom: 32,
            }}
          >
            Rapport mandat vendeur
          </Text>

          <Text
            style={{
              fontSize: LAYOUT.font.huge,
              fontFamily: 'Times-Bold',
              color: isOffMarket ? COLORS.offmarket.cream : COLORS.standard.ink,
              textAlign: 'center',
              marginBottom: 12,
              lineHeight: 1.1,
            }}
          >
            {safeText(mandat?.nom, 'Bien à renseigner')}
          </Text>

          <Text
            style={{
              fontSize: LAYOUT.font.label,
              fontFamily: 'Times-Italic',
              color: isOffMarket ? COLORS.offmarket.muted : COLORS.standard.muted,
              marginBottom: 60,
              letterSpacing: 1,
            }}
          >
            {[mandat?.type, mandat?.ville].filter(Boolean).join(' · ')}
          </Text>

          {periodLabel && (
            <View
              style={{
                paddingVertical: 24,
                paddingHorizontal: 36,
                borderTopWidth: 0.5,
                borderBottomWidth: 0.5,
                borderColor: isOffMarket ? COLORS.offmarket.gold : COLORS.standard.sageDark,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: LAYOUT.font.micro,
                  fontFamily: 'Times-Bold',
                  color: isOffMarket ? COLORS.offmarket.muted : COLORS.standard.muted,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Période couverte
              </Text>
              <Text
                style={{
                  fontSize: LAYOUT.font.label,
                  fontFamily: 'Times-Roman',
                  color: isOffMarket ? COLORS.offmarket.cream : COLORS.standard.ink,
                }}
              >
                {periodLabel}
              </Text>
            </View>
          )}

          <Text
            style={{
              fontSize: LAYOUT.font.small,
              fontFamily: 'Times-Italic',
              color: isOffMarket ? COLORS.offmarket.muted : COLORS.standard.muted,
              marginTop: 80,
            }}
          >
            Édité le {formatDate(new Date().toISOString())}
          </Text>
        </View>

        <PageFooter conseiller={conseiller} isOffMarket={isOffMarket} />
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
      {/* PAGE 3 : SYNTHÈSE D'ACTIVITÉ            */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <PageHeader
          eyebrow="Chapitre I"
          title="Synthèse de l'activité"
          pageNumber={1}
          isOffMarket={isOffMarket}
        />

        {periodLabel && (
          <Text
            style={{
              fontSize: LAYOUT.font.small,
              fontFamily: 'Times-Italic',
              color: palette.muted,
              marginBottom: 24,
            }}
          >
            Période : {periodLabel}
          </Text>
        )}

        {/* KPIs */}
        <View style={styles.kpiRow}>
          <KpiCard
            label="Visites organisées"
            value={String(safeStats.nb_visites)}
            isOffMarket={isOffMarket}
          />
          <KpiCard
            label="Contacts qualifiés"
            value={String(safeStats.nb_contacts)}
            isOffMarket={isOffMarket}
          />
        </View>
        <View style={styles.kpiRow}>
          <KpiCard
            label="Offres reçues"
            value={String(safeStats.nb_offres)}
            isOffMarket={isOffMarket}
          />
          <KpiCard
            label="Vues / sollicitations"
            value={String(safeStats.nb_vues)}
            isOffMarket={isOffMarket}
          />
        </View>

        <Section eyebrow="Notre analyse" isOffMarket={isOffMarket}>
          <Text style={styles.sectionContent}>
            {generateAnalysisText(safeStats, mandat)}
          </Text>
        </Section>

        <PageFooter conseiller={conseiller} isOffMarket={isOffMarket} />
      </Page>

      {/* ═══════════════════════════════════════ */}
      {/* PAGE 4 : DÉTAIL DES ÉVÉNEMENTS          */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <PageHeader
          eyebrow="Chapitre II"
          title="Détail des événements"
          pageNumber={2}
          isOffMarket={isOffMarket}
        />

        <Section eyebrow="Activité de la période" isOffMarket={isOffMarket}>
          {events && events.length > 0 ? (
            events.map((event, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  paddingVertical: 12,
                  borderBottomWidth: 0.5,
                  borderBottomColor: palette.borderLight || palette.accentLine,
                }}
              >
                <Text
                  style={{
                    width: 110,
                    fontSize: LAYOUT.font.small,
                    fontFamily: 'Times-Italic',
                    color: palette.muted,
                  }}
                >
                  {formatDate(event.date)}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: LAYOUT.font.body,
                      fontFamily: 'Times-Bold',
                      color: isOffMarket ? COLORS.offmarket.cream : COLORS.standard.ink,
                    }}
                  >
                    {event.type || 'Événement'}
                  </Text>
                  <Text
                    style={{
                      fontSize: LAYOUT.font.small,
                      fontFamily: 'Times-Roman',
                      color: palette.muted,
                      marginTop: 4,
                    }}
                  >
                    {event.description || '—'}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={{ ...styles.sectionContent, fontFamily: 'Times-Italic' }}>
              Aucun événement enregistré sur cette période.
            </Text>
          )}
        </Section>

        <PageFooter conseiller={conseiller} isOffMarket={isOffMarket} />
      </Page>

      {/* ═══════════════════════════════════════ */}
      {/* PAGE 5 : LE BIEN & AVANCEMENT           */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <PageHeader
          eyebrow="Chapitre III"
          title="Le bien & avancement"
          pageNumber={3}
          isOffMarket={isOffMarket}
        />

        <Section eyebrow="Caractéristiques principales" isOffMarket={isOffMarket}>
          <FinancialRow
            label="Bien"
            value={safeText(mandat?.nom, '—')}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Type"
            value={[mandat?.type, mandat?.sous_type].filter(Boolean).join(' · ') || '—'}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Adresse"
            value={[mandat?.adresse, mandat?.ville].filter(Boolean).join(', ') || '—'}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Surface"
            value={formatSurface(mandat?.surface)}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Prix de présentation"
            value={formatPrix(mandat?.prix)}
            big={true}
            isOffMarket={isOffMarket}
          />
        </Section>

        <Section eyebrow="Avancement du mandat" isOffMarket={isOffMarket}>
          <FinancialRow
            label="Statut actuel"
            value={safeText(mandat?.statut, 'En cours de commercialisation')}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Type de mandat"
            value={safeText(mandat?.commercialisation, '—')}
            isOffMarket={isOffMarket}
          />
          {mandat?.date_signature && (
            <FinancialRow
              label="Date de signature"
              value={formatDate(mandat?.date_signature)}
              isOffMarket={isOffMarket}
            />
          )}
        </Section>

        <PageFooter conseiller={conseiller} isOffMarket={isOffMarket} />
      </Page>
    </Document>
  );
}

// ─────────────────────────────────────────────────────────────────
// Génération d'une phrase d'analyse selon les stats
// ─────────────────────────────────────────────────────────────────

function generateAnalysisText(stats, mandat) {
  const lines = [];
  const { nb_visites, nb_contacts, nb_offres, nb_vues } = stats;

  if (nb_offres > 0) {
    lines.push(
      `Sur la période, ${nb_offres} offre${nb_offres > 1 ? 's ont été reçues' : ' a été reçue'} sur ce bien. `
    );
  }
  if (nb_visites > 0) {
    lines.push(
      `${nb_visites} visite${nb_visites > 1 ? 's ont été organisées' : ' a été organisée'} avec des acquéreurs qualifiés. `
    );
  } else if (nb_contacts > 0) {
    lines.push(
      `${nb_contacts} contact${nb_contacts > 1 ? 's qualifiés ont' : ' qualifié a'} manifesté un intérêt sur la période. `
    );
  }
  if (nb_vues > 50) {
    lines.push(
      `Le bien a généré une exposition significative (${nb_vues} sollicitations) — signe d'un positionnement attractif. `
    );
  }

  if (lines.length === 0) {
    return "Aucune activité significative enregistrée sur cette période. Nous proposons un point téléphonique pour ajuster ensemble la stratégie de commercialisation si nécessaire.";
  }

  lines.push(
    "Nous restons à votre entière disposition pour toute question relative à l'avancement du mandat."
  );

  return lines.join('');
}
