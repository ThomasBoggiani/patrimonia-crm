// ═══════════════════════════════════════════════════════════════════
// lib/pdf/templates/RapportMandant.jsx — v1
// Rapport d'activité commerciale envoyé au mandant (mensuel ou à la demande)
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { getStyles, COLORS } from '../styles';
import { PageLogo, PageFooter } from '../components';
import { formatPrix, formatSurface, safeText } from '../helpers';
import { LOGO_IP_BASE64 } from '../logo-base64';

// Styles spécifiques à ce template
const localStyles = {
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#5d6e5d',
  },
  headerLabel: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: '#5d6e5d',
    textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Times-Roman',
    marginTop: 6,
    color: '#2c2c2a',
  },
  periodLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'right',
  },
  periodValue: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#2c2c2a',
    marginTop: 2,
    textAlign: 'right',
  },
  bienBox: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#faf8f3',
    borderLeftWidth: 3,
    borderLeftColor: '#5d6e5d',
  },
  bienLabel: {
    fontSize: 8,
    letterSpacing: 1,
    color: '#888',
    textTransform: 'uppercase',
  },
  bienName: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: '#2c2c2a',
    marginTop: 2,
  },
  bienMeta: {
    fontSize: 11,
    color: '#666',
    marginTop: 1,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: '#5d6e5d',
    textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
  },
  kpiGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  kpiBox: {
    flex: 1,
    marginHorizontal: 3,
    padding: 10,
    backgroundColor: '#faf8f3',
    borderRadius: 4,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#5d6e5d',
  },
  kpiLabel: {
    fontSize: 9,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 5,
    marginBottom: 5,
  },
  badgeText: {
    fontSize: 10,
    color: 'white',
    fontFamily: 'Helvetica-Bold',
  },
  prose: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#444',
  },
  proseBox: {
    backgroundColor: '#faf8f3',
    padding: 12,
    borderRadius: 4,
  },
  comparatifRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 6,
  },
  comparatifBox: {
    flex: 1,
    padding: 8,
    borderWidth: 0.5,
    borderColor: '#ddd',
    borderRadius: 4,
  },
  comparatifBoxCurrent: {
    flex: 1,
    padding: 8,
    borderWidth: 0.5,
    borderColor: '#5d6e5d',
    borderRadius: 4,
    backgroundColor: '#faf8f3',
  },
  comparatifLabel: {
    fontSize: 10,
    color: '#888',
  },
  comparatifValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#2c2c2a',
    marginTop: 2,
  },
  signatureSection: {
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: '#ddd',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  signatureName: {
    fontFamily: 'Helvetica-Bold',
    color: '#2c2c2a',
    fontSize: 11,
  },
  signatureRole: {
    fontSize: 10,
    color: '#666',
  },
  signatureEmail: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
};

const PLATEFORMES_COLORS = {
  site_ip: '#5d6e5d',
  seloger: '#e30613',
  leboncoin: '#ff6e14',
  lefigaro: '#0a0a0a',
  bellesdemeures: '#8b6f47',
  jinka: '#1eb6c9',
};

export default function RapportMandant({
  mandat,
  conseiller,
  period,        // { label: 'Avril 2026', start, end }
  stats,         // { nbEnvoisPlaquette, nbAppels, nbVisites, nbVuesTotal }
  diffusionActive, // [{ key, name }]
  profilAcquereurs, // text
  retours,         // [text, text, text]
  prochaines,      // [text, text, text]
  evolution,       // [{ label, value }, { label, value }, { label, value (current) }]
  logoUrl,
}) {
  const styles = getStyles(false);
  const palette = COLORS.standard;

  return (
    <Document
      title={`Rapport ${period?.label || ''} — ${safeText(mandat?.nom, 'Mandat')}`}
      author="Immeubles & Patrimoine"
      subject="Rapport d'activité commerciale"
    >
      <Page size="A4" style={styles.page}>
        <PageLogo logoUrl={logoUrl} isOffMarket={false} />

        {/* Header */}
        <View style={localStyles.header}>
          <View>
            <Text style={localStyles.headerLabel}>Immeubles & Patrimoine</Text>
            <Text style={localStyles.headerTitle}>Rapport d'activité commerciale</Text>
          </View>
          <View>
            <Text style={localStyles.periodLabel}>Période</Text>
            <Text style={localStyles.periodValue}>{safeText(period?.label, '')}</Text>
          </View>
        </View>

        {/* Bien concerné */}
        <View style={localStyles.bienBox}>
          <Text style={localStyles.bienLabel}>Bien concerné</Text>
          <Text style={localStyles.bienName}>{safeText(mandat?.nom, 'Mandat')}</Text>
          <Text style={localStyles.bienMeta}>
            {[
              safeText(mandat?.ville, ''),
              mandat?.prix ? formatPrix(mandat.prix) : '',
              mandat?.mandat_type ? `${mandat.mandat_type}${mandat.date_signature ? ` signé le ${new Date(mandat.date_signature).toLocaleDateString('fr-FR')}` : ''}` : '',
            ].filter(Boolean).join(' · ')}
          </Text>
        </View>

        {/* Synthèse du mois */}
        <Text style={localStyles.sectionLabel}>Synthèse du mois</Text>
        <View style={localStyles.kpiGrid}>
          <View style={localStyles.kpiBox}>
            <Text style={localStyles.kpiValue}>{stats?.nbEnvoisPlaquette || 0}</Text>
            <Text style={localStyles.kpiLabel}>Envois plaquette</Text>
          </View>
          <View style={localStyles.kpiBox}>
            <Text style={localStyles.kpiValue}>{stats?.nbAppels || 0}</Text>
            <Text style={localStyles.kpiLabel}>Appels qualifiés</Text>
          </View>
          <View style={localStyles.kpiBox}>
            <Text style={localStyles.kpiValue}>{stats?.nbVisites || 0}</Text>
            <Text style={localStyles.kpiLabel}>Visites</Text>
          </View>
          <View style={localStyles.kpiBox}>
            <Text style={localStyles.kpiValue}>
              {stats?.nbVuesTotal ? stats.nbVuesTotal.toLocaleString('fr-FR') : 0}
            </Text>
            <Text style={localStyles.kpiLabel}>Vues plateformes</Text>
          </View>
        </View>

        {/* Diffusion active */}
        {Array.isArray(diffusionActive) && diffusionActive.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={localStyles.sectionLabel}>Diffusion active</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {diffusionActive.map((p, i) => (
                <View
                  key={i}
                  style={[
                    localStyles.badge,
                    { backgroundColor: PLATEFORMES_COLORS[p.key] || '#888' },
                  ]}
                >
                  <Text style={localStyles.badgeText}>{p.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Profil acquéreurs */}
        {!!profilAcquereurs && (
          <View style={{ marginBottom: 16 }}>
            <Text style={localStyles.sectionLabel}>Profil des acquéreurs intéressés</Text>
            <Text style={localStyles.prose}>{profilAcquereurs}</Text>
          </View>
        )}

        {/* Retours acquéreurs */}
        {Array.isArray(retours) && retours.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={localStyles.sectionLabel}>Retours des acquéreurs</Text>
            <View style={localStyles.proseBox}>
              {retours.map((r, i) => (
                <Text key={i} style={[localStyles.prose, { marginBottom: i < retours.length - 1 ? 4 : 0 }]}>
                  ▸ « {r} »
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Prochaines actions */}
        {Array.isArray(prochaines) && prochaines.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={localStyles.sectionLabel}>Prochaines actions prévues</Text>
            {prochaines.map((a, i) => (
              <Text key={i} style={[localStyles.prose, { marginBottom: 3 }]}>
                ✓ {a}
              </Text>
            ))}
          </View>
        )}

        {/* Évolution */}
        {Array.isArray(evolution) && evolution.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={localStyles.sectionLabel}>Évolution</Text>
            <View style={localStyles.comparatifRow}>
              {evolution.map((e, i) => {
                const isCurrent = e.current === true;
                return (
                  <View key={i} style={isCurrent ? localStyles.comparatifBoxCurrent : localStyles.comparatifBox}>
                    <Text style={[localStyles.comparatifLabel, isCurrent && { color: '#5d6e5d', fontFamily: 'Helvetica-Bold' }]}>
                      {e.label}
                    </Text>
                    <Text style={localStyles.comparatifValue}>{e.value}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Signature */}
        <View style={localStyles.signatureSection}>
          <View>
            <Text style={localStyles.signatureName}>
              {safeText(conseiller?.full_name, 'Conseiller')}
            </Text>
            <Text style={localStyles.signatureRole}>
              {safeText(conseiller?.fonction, 'Conseiller')}
            </Text>
            <Text style={localStyles.signatureEmail}>
              {safeText(conseiller?.email, '')}
            </Text>
          </View>
          <Text style={{ fontSize: 9, color: '#888' }}>immeubles-patrimoine.fr</Text>
        </View>
      </Page>
    </Document>
  );
}
