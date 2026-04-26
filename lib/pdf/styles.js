// ═══════════════════════════════════════════════════════════════════
// lib/pdf/styles.js
// Tokens de la charte graphique I&P pour les PDFs
// 
// 2 modes :
//   - standard : palette sage / crème (mandats normaux)
//   - off-market : palette noir mat / or pâle (biens confidentiels)
// ═══════════════════════════════════════════════════════════════════

import { StyleSheet, Font } from '@react-pdf/renderer';

// ─────────────────────────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────────────────────────

export const COLORS = {
  // Mode standard (charte plaquette existante)
  standard: {
    sage: '#94A084',           // sage du logo et titres
    sageDark: '#6B7858',       // sage plus foncé (titres, accent)
    sageLight: '#C8D0BB',      // sage clair (fonds doux)
    cream: '#F4F2EC',          // fond crème de la couverture
    creamDark: '#EBE9E2',      // crème plus foncé (fond logo)
    ink: '#2D2D2A',            // texte principal
    muted: '#6B6B66',          // texte secondaire
    border: '#D5D2C8',         // bordures fines
    white: '#FFFFFF',
  },
  // Mode off-market (premium confidentiel)
  offmarket: {
    bgDark: '#1A1817',         // fond noir mat
    bgDeep: '#0E0D0C',         // noir plus profond (couverture)
    gold: '#B8985A',           // or pâle (titres, badges)
    goldDim: '#7A6939',        // or plus discret (textes secondaires)
    cream: '#EDE9DF',          // crème pour textes principaux sur noir
    muted: '#9A9486',          // texte secondaire sur noir
    border: '#2E2A26',         // bordures fines mode noir
    accentLine: '#4A4239',     // lignes décoratives
  },
};

// ─────────────────────────────────────────────────────────────────
// LAYOUT (en points : 1pt = 1/72 inch, A4 = 595x842pt)
// ─────────────────────────────────────────────────────────────────

export const LAYOUT = {
  page: {
    A4: { width: 595, height: 842 },
    margin: 40,
    marginBottom: 60,        // pour le footer
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  font: {
    micro: 7,
    tiny: 8,
    small: 9,
    body: 10,
    label: 11,
    section: 13,
    title: 16,
    big: 22,
    huge: 32,
  },
};

// ─────────────────────────────────────────────────────────────────
// HELPER : choisir la palette selon le mode
// ─────────────────────────────────────────────────────────────────

export function getPalette(isOffMarket) {
  return isOffMarket ? COLORS.offmarket : COLORS.standard;
}

// ─────────────────────────────────────────────────────────────────
// STYLES COMMUNS — Mode STANDARD
// ─────────────────────────────────────────────────────────────────

export const stylesStandard = StyleSheet.create({
  // Page de base
  page: {
    backgroundColor: COLORS.standard.cream,
    paddingTop: LAYOUT.page.margin,
    paddingBottom: LAYOUT.page.marginBottom,
    paddingHorizontal: LAYOUT.page.margin,
    fontFamily: 'Helvetica',
    fontSize: LAYOUT.font.body,
    color: COLORS.standard.ink,
  },

  // Header (toutes pages sauf couverture)
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: LAYOUT.spacing.sm,
    marginBottom: LAYOUT.spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.standard.border,
  },
  pageHeaderTitle: {
    fontSize: LAYOUT.font.title,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.standard.sageDark,
    textAlign: 'center',
    flex: 1,
  },
  pageHeaderNumber: {
    fontSize: LAYOUT.font.title,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.standard.sageDark,
  },

  // Footer (toutes pages)
  pageFooter: {
    position: 'absolute',
    bottom: LAYOUT.page.margin,
    left: LAYOUT.page.margin,
    right: LAYOUT.page.margin,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    fontSize: LAYOUT.font.tiny,
    color: COLORS.standard.muted,
  },
  footerLeft: {
    flexDirection: 'column',
  },
  footerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  footerText: {
    fontSize: LAYOUT.font.tiny,
    color: COLORS.standard.muted,
    lineHeight: 1.4,
  },
  footerConfidential: {
    fontSize: LAYOUT.font.tiny,
    color: COLORS.standard.muted,
    fontStyle: 'italic',
    position: 'absolute',
    top: -20,
    right: 0,
  },

  // COUVERTURE
  coverPage: {
    backgroundColor: COLORS.standard.cream,
    padding: 0,
    fontFamily: 'Helvetica',
  },
  coverLogoContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 30,
  },
  coverLogo: {
    width: 140,
    height: 140,
    objectFit: 'contain',
  },
  coverHero: {
    width: '100%',
    height: 380,
    objectFit: 'cover',
  },
  coverHeroPlaceholder: {
    width: '100%',
    height: 380,
    backgroundColor: COLORS.standard.creamDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverHeroPlaceholderText: {
    color: COLORS.standard.muted,
    fontSize: LAYOUT.font.label,
    fontStyle: 'italic',
  },
  coverTitleBand: {
    backgroundColor: COLORS.standard.sage,
    paddingVertical: 24,
    paddingHorizontal: 40,
    marginTop: 0,
  },
  coverTitleText: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.standard.white,
    textAlign: 'center',
  },
  coverContact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingTop: 32,
  },
  coverContactBlock: {
    flexDirection: 'column',
  },
  coverContactLabel: {
    fontSize: LAYOUT.font.small,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.standard.ink,
    marginBottom: 4,
  },
  coverContactLine: {
    fontSize: LAYOUT.font.small,
    color: COLORS.standard.ink,
    lineHeight: 1.4,
  },

  // SOMMAIRE
  tocTitle: {
    fontSize: LAYOUT.font.title,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.standard.sageDark,
    textAlign: 'center',
    paddingBottom: LAYOUT.spacing.sm,
    marginBottom: LAYOUT.spacing.xl,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.standard.border,
  },
  tocItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  tocItemText: {
    fontSize: LAYOUT.font.label,
    color: COLORS.standard.ink,
  },
  tocItemNumber: {
    fontSize: LAYOUT.font.label,
    color: COLORS.standard.ink,
  },

  // SECTIONS DE CONTENU
  sectionLabel: {
    fontSize: LAYOUT.font.small,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.standard.sageDark,
    letterSpacing: 0.8,
    paddingBottom: 4,
    marginBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.standard.border,
  },
  sectionContent: {
    fontSize: LAYOUT.font.body,
    color: COLORS.standard.ink,
    lineHeight: 1.5,
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 30,
  },
  column: {
    flex: 1,
  },

  // Highlights ("Nous aimons" — bullet list)
  highlightItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingRight: 4,
  },
  highlightDash: {
    color: COLORS.standard.ink,
    marginRight: 4,
  },
  highlightText: {
    fontSize: LAYOUT.font.body,
    color: COLORS.standard.ink,
    flex: 1,
    lineHeight: 1.5,
  },

  // INFOS FINANCIERES (tableau clé-valeur)
  finRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.standard.border,
  },
  finLabel: {
    width: 180,
    fontSize: LAYOUT.font.body,
    color: COLORS.standard.ink,
  },
  finValue: {
    flex: 1,
    fontSize: LAYOUT.font.body,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.standard.ink,
  },

  // GRILLE PHOTOS
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoCell: {
    width: '49%',
    height: 175,
    marginBottom: 8,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },

  // KPIs (rapport vendeur)
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: LAYOUT.spacing.lg,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.standard.creamDark,
    padding: 14,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.standard.sage,
  },
  kpiLabel: {
    fontSize: LAYOUT.font.tiny,
    color: COLORS.standard.muted,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: LAYOUT.font.big,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.standard.sageDark,
  },
  kpiUnit: {
    fontSize: LAYOUT.font.small,
    color: COLORS.standard.muted,
    marginTop: 2,
  },

  // BADGE
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
    marginRight: 6,
  },
  badgeStandard: {
    backgroundColor: COLORS.standard.sage,
  },
  badgeText: {
    fontSize: LAYOUT.font.tiny,
    color: COLORS.standard.white,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
});

// ─────────────────────────────────────────────────────────────────
// STYLES COMMUNS — Mode OFF-MARKET
// ─────────────────────────────────────────────────────────────────

export const stylesOffMarket = StyleSheet.create({
  page: {
    backgroundColor: COLORS.offmarket.bgDark,
    paddingTop: LAYOUT.page.margin,
    paddingBottom: LAYOUT.page.marginBottom,
    paddingHorizontal: LAYOUT.page.margin,
    fontFamily: 'Helvetica',
    fontSize: LAYOUT.font.body,
    color: COLORS.offmarket.cream,
  },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: LAYOUT.spacing.sm,
    marginBottom: LAYOUT.spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.offmarket.accentLine,
  },
  pageHeaderTitle: {
    fontSize: LAYOUT.font.title,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.offmarket.gold,
    textAlign: 'center',
    flex: 1,
    letterSpacing: 1.5,
  },
  pageHeaderNumber: {
    fontSize: LAYOUT.font.title,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.offmarket.gold,
  },

  pageFooter: {
    position: 'absolute',
    bottom: LAYOUT.page.margin,
    left: LAYOUT.page.margin,
    right: LAYOUT.page.margin,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerText: {
    fontSize: LAYOUT.font.tiny,
    color: COLORS.offmarket.muted,
    lineHeight: 1.4,
  },
  footerConfidential: {
    fontSize: LAYOUT.font.tiny,
    color: COLORS.offmarket.gold,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.2,
    position: 'absolute',
    top: -20,
    right: 0,
  },

  // COUVERTURE off-market
  coverPage: {
    backgroundColor: COLORS.offmarket.bgDeep,
    padding: 0,
    fontFamily: 'Helvetica',
  },
  coverLogoContainer: {
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 20,
  },
  coverLogo: {
    width: 110,
    height: 110,
    objectFit: 'contain',
  },
  coverOffMarketBadge: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  coverOffMarketText: {
    fontSize: LAYOUT.font.label,
    color: COLORS.offmarket.gold,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 6,
  },
  coverOffMarketSubtext: {
    fontSize: LAYOUT.font.tiny,
    color: COLORS.offmarket.muted,
    fontStyle: 'italic',
    marginTop: 6,
    letterSpacing: 1,
  },
  coverHero: {
    width: '100%',
    height: 360,
    objectFit: 'cover',
    opacity: 0.65,
  },
  coverHeroPlaceholder: {
    width: '100%',
    height: 360,
    backgroundColor: COLORS.offmarket.bgDeep,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: COLORS.offmarket.accentLine,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.offmarket.accentLine,
  },
  coverHeroPlaceholderText: {
    color: COLORS.offmarket.muted,
    fontSize: LAYOUT.font.label,
    fontStyle: 'italic',
  },
  coverTitleBand: {
    backgroundColor: COLORS.offmarket.bgDeep,
    paddingVertical: 30,
    paddingHorizontal: 40,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.offmarket.gold,
  },
  coverTitleText: {
    fontSize: 17,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.offmarket.cream,
    textAlign: 'center',
    letterSpacing: 1,
  },
  coverContact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingTop: 32,
  },
  coverContactBlock: {
    flexDirection: 'column',
  },
  coverContactLabel: {
    fontSize: LAYOUT.font.small,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.offmarket.gold,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  coverContactLine: {
    fontSize: LAYOUT.font.small,
    color: COLORS.offmarket.cream,
    lineHeight: 1.4,
  },

  // SOMMAIRE off-market
  tocTitle: {
    fontSize: LAYOUT.font.title,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.offmarket.gold,
    textAlign: 'center',
    paddingBottom: LAYOUT.spacing.sm,
    marginBottom: LAYOUT.spacing.xl,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.offmarket.accentLine,
    letterSpacing: 2,
  },
  tocItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  tocItemText: {
    fontSize: LAYOUT.font.label,
    color: COLORS.offmarket.cream,
  },
  tocItemNumber: {
    fontSize: LAYOUT.font.label,
    color: COLORS.offmarket.gold,
  },

  // SECTIONS
  sectionLabel: {
    fontSize: LAYOUT.font.small,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.offmarket.gold,
    letterSpacing: 1.2,
    paddingBottom: 4,
    marginBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.offmarket.accentLine,
  },
  sectionContent: {
    fontSize: LAYOUT.font.body,
    color: COLORS.offmarket.cream,
    lineHeight: 1.5,
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 30,
  },
  column: {
    flex: 1,
  },

  highlightItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingRight: 4,
  },
  highlightDash: {
    color: COLORS.offmarket.gold,
    marginRight: 4,
  },
  highlightText: {
    fontSize: LAYOUT.font.body,
    color: COLORS.offmarket.cream,
    flex: 1,
    lineHeight: 1.5,
  },

  finRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.offmarket.accentLine,
  },
  finLabel: {
    width: 180,
    fontSize: LAYOUT.font.body,
    color: COLORS.offmarket.muted,
  },
  finValue: {
    flex: 1,
    fontSize: LAYOUT.font.body,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.offmarket.cream,
  },

  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoCell: {
    width: '49%',
    height: 175,
    marginBottom: 8,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 0.95,
  },

  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: LAYOUT.spacing.lg,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.offmarket.bgDeep,
    padding: 14,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.offmarket.gold,
  },
  kpiLabel: {
    fontSize: LAYOUT.font.tiny,
    color: COLORS.offmarket.muted,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: LAYOUT.font.big,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.offmarket.gold,
  },
  kpiUnit: {
    fontSize: LAYOUT.font.small,
    color: COLORS.offmarket.muted,
    marginTop: 2,
  },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
    marginRight: 6,
  },
  badgeOffMarket: {
    backgroundColor: COLORS.offmarket.gold,
  },
  badgeText: {
    fontSize: LAYOUT.font.tiny,
    color: COLORS.offmarket.bgDeep,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.8,
  },
});

// ─────────────────────────────────────────────────────────────────
// HELPER : retourne le bon style sheet selon le mode
// ─────────────────────────────────────────────────────────────────

export function getStyles(isOffMarket) {
  return isOffMarket ? stylesOffMarket : stylesStandard;
}
