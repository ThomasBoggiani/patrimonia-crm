// ═══════════════════════════════════════════════════════════════════
// lib/pdf/templates/RapportVendeur.jsx
// 
// Rapport périodique pour le vendeur (propriétaire du bien)
// Période choisie au moment de l'export
// 
// Contenu :
//   - Couverture sobre (sans prix en gros, plus pro)
//   - KPIs de la période (visites organisées, contacts, offres, vues)
//   - Activité détaillée (timeline d'événements)
//   - Avancement pipeline (étape actuelle)
//   - Pas de noms d'acheteurs / pas de commissions / pas de notes internes
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { Document, Page, View, Text } from '@react-pdf/renderer';
import { getStyles, LAYOUT } from '../styles';
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
  buildTitleCommercial,
  safeText,
} from '../helpers';

export default function RapportVendeur({
  mandat,
  conseiller,
  logoUrl,
  period, // { start, end }
  stats, // { nb_visites, nb_contacts, nb_offres, nb_vues, etc. }
  events, // [{ date, type, description }]
}) {
  const isOffMarket = mandat?.is_off_market === true;
  const styles = getStyles(isOffMarket);
  const periodLabel = formatPeriodLabel(period?.start, period?.end);

  // Stats par défaut (si non fournies)
  const s = stats || {};
  const safeStats = {
    nb_visites: s.nb_visites ?? 0,
    nb_contacts: s.nb_contacts ?? 0,
    nb_offres: s.nb_offres ?? 0,
    nb_vues: s.nb_vues ?? 0,
  };

  const tocItems = [
    { label: "Synthèse de l'activité", page: 1 },
    { label: "Détail des événements", page: 2 },
    { label: 'Le bien & avancement', page: 3 },
  ];

  return (
    <Document
      title={`Rapport vendeur - ${safeText(mandat?.nom, 'Mandat')}`}
      author="Immeubles & Patrimoine"
      subject="Rapport périodique vendeur"
    >
      {/* ═══════════════════════════════════════ */}
      {/* PAGE 1 : COUVERTURE SOBRE               */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <View
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            paddingTop: 80,
            paddingBottom: 40,
          }}
        >
          {logoUrl && (
            <View style={{ alignItems: 'center', marginBottom: 40 }}>
              {/* Image style — réutiliser le coverLogo */}
              <Text style={{ fontSize: 8, color: styles.kpiLabel.color }}>I&P</Text>
            </View>
          )}

          <Text
            style={{
              fontSize: 11,
              letterSpacing: 4,
              color: isOffMarket ? styles.coverContactLabel.color : styles.sectionLabel.color,
              marginBottom: 24,
            }}
          >
            RAPPORT MANDAT VENDEUR
          </Text>

          <Text
            style={{
              fontSize: 22,
              fontFamily: 'Helvetica-Bold',
              color: isOffMarket ? styles.coverTitleText.color : '#2D2D2A',
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            {safeText(mandat?.nom, 'Bien à renseigner')}
          </Text>

          <Text style={{ fontSize: 11, color: styles.kpiLabel.color, marginBottom: 32 }}>
            {[mandat?.type, mandat?.ville].filter(Boolean).join(' — ')}
          </Text>

          {periodLabel && (
            <View
              style={{
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderTopWidth: 0.5,
                borderBottomWidth: 0.5,
                borderColor: isOffMarket ? styles.pageHeader.borderBottomColor : '#D5D2C8',
              }}
            >
              <Text style={{ fontSize: 10, color: styles.kpiLabel.color, letterSpacing: 1 }}>
                PÉRIODE COUVERTE
              </Text>
              <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 4 }}>
                {periodLabel}
              </Text>
            </View>
          )}

          <Text style={{ fontSize: 10, color: styles.kpiLabel.color, marginTop: 60, fontStyle: 'italic' }}>
            Édité le {formatDate(new Date().toISOString())}
          </Text>
        </View>

        <PageFooter conseiller={conseiller} isOffMarket={isOffMarket} />
      </Page>

      {/* ═══════════════════════════════════════ */}
      {/* PAGE 2 : SOMMAIRE                       */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <TableOfContents items={tocItems} isOffMarket={isOffMarket} />
        <PageFooter conseiller={conseiller} isOffMarket={isOffMarket} />
      </Page>

      {/* ═══════════════════════════════════════ */}
      {/* PAGE 3 : SYNTHÈSE D'ACTIVITÉ            */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <PageHeader title="Synthèse de l'activité" pageNumber={1} isOffMarket={isOffMarket} />

        {periodLabel && (
          <Text
            style={{
              fontSize: 10,
              color: styles.kpiLabel.color,
              marginBottom: 16,
              fontStyle: 'italic',
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

        <Section label="Notre analyse" isOffMarket={isOffMarket}>
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
          title="Détail des événements"
          pageNumber={2}
          isOffMarket={isOffMarket}
        />

        <Section label="Activité de la période" isOffMarket={isOffMarket}>
          {events && events.length > 0 ? (
            events.map((event, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  paddingVertical: 8,
                  borderBottomWidth: 0.5,
                  borderBottomColor: styles.finRow.borderBottomColor,
                }}
              >
                <Text style={{ width: 100, fontSize: 9, color: styles.kpiLabel.color }}>
                  {formatDate(event.date)}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>
                    {event.type || 'Événement'}
                  </Text>
                  <Text style={{ fontSize: 9, color: styles.kpiLabel.color, marginTop: 2 }}>
                    {event.description || '—'}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={{ ...styles.sectionContent, fontStyle: 'italic' }}>
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
          title="Le bien & avancement"
          pageNumber={3}
          isOffMarket={isOffMarket}
        />

        <Section label="Caractéristiques principales" isOffMarket={isOffMarket}>
          <FinancialRow
            label="Bien :"
            value={safeText(mandat?.nom, '—')}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Type :"
            value={[mandat?.type, mandat?.sous_type].filter(Boolean).join(' — ') || '—'}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Adresse :"
            value={[mandat?.adresse, mandat?.ville].filter(Boolean).join(', ') || '—'}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Surface :"
            value={formatSurface(mandat?.surface)}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Prix de présentation :"
            value={formatPrix(mandat?.prix)}
            isOffMarket={isOffMarket}
          />
        </Section>

        <Section label="Avancement du mandat" isOffMarket={isOffMarket}>
          <FinancialRow
            label="Statut actuel :"
            value={safeText(mandat?.statut, 'En cours de commercialisation')}
            isOffMarket={isOffMarket}
          />
          <FinancialRow
            label="Type de mandat :"
            value={safeText(mandat?.commercialisation, '—')}
            isOffMarket={isOffMarket}
          />
          {mandat?.date_signature && (
            <FinancialRow
              label="Date de signature :"
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

// Génération d'une phrase d'analyse selon les stats
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
