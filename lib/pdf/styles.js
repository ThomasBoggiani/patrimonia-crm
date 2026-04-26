// ═══════════════════════════════════════════════════════════════════
// lib/pdf/styles.js — REFONTE v12.3.2
// 
// "Maison de prestige" - Times-Roman uniquement (police intégrée)
// 
// - AUCUN Font.register (zero appel réseau, zero 404)
// - Times-Roman / Times-Bold / Times-Italic / Times-BoldItalic
// - Marche immédiatement, fiable à 100%
// ═══════════════════════════════════════════════════════════════════

import { StyleSheet } from '@react-pdf/renderer';

// ─────────────────────────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────────────────────────

export const COLORS = {
  standard: {
    sage: '#94A084',
    sageDark: '#5D6B4D',
    sageDeep: '#3F4D32',
    sageLight: '#C8D0BB',
    cream: '#F8F6EF',
    creamWarm: '#EFEBE0',
    creamDark: '#E5DFCF',
    ink: '#1F1F1B',
    inkSoft: '#3A3A33',
    muted: '#76716A',
    mutedLight: '#A8A399',
    border: '#D5D0C2',
    borderLight: '#E8E3D5',
    white: '#FFFFFF',
    accent: '#7E6F4F',
  },
  offmarket: {
    bgDark: '#1A1817',
    bgDeep: '#0E0D0C',
    gold: '#C7A969',
    goldDim: '#8A7741',
    cream: '#EDE9DF',
    muted: '#9A9486',
    border: '#2E2A26',
    accentLine: '#4A4239',
  },
};

// ─────────────────────────────────────────────────────────────────
// LAYOUT
// ─────────────────────────────────────────────────────────────────

export const LAYOUT = {
  page: {
    A4: { width: 595, height: 842 },
    margin: 56,
    marginBottom: 80,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 28,
    xl: 40,
    xxl: 60,
  },
  font: {
    micro: 7,
    tiny: 8,
    small: 10,
    body: 11.5,
    label: 12,
    section: 14,
    h2: 19,
    title: 23,
    big: 30,
    huge: 40,
    heroPrice: 46,
  },
};

// ─────────────────────────────────────────────────────────────────
// HELPER : choisir la palette selon le mode
// ─────────────────────────────────────────────────────────────────

export function getPalette(isOffMarket) {
  return isOffMarket ? COLORS.offmarket : COLORS.standard;
}

// ─────────────────────────────────────────────────────────────────
// STYLES — Mode STANDARD (Times-Roman partout)
// ─────────────────────────────────────────────────────────────────

export const stylesStandard = StyleSheet.create({
  page: {
    backgroundColor: COLORS.standard.cream,
    paddingTop: LAYOUT.page.margin,
    paddingBottom: LAYOUT.page.marginBottom,
    paddingHorizontal: LAYOUT.page.margin,
    fontFamily: 'Times-Roman',
    fontSize: LAYOUT.font.body,
    color: COLORS.standard.ink,
  },

  // ─────────────────────────────────────────
  // HEADER de page
  // ─────────────────────────────────────────
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 12,
    marginBottom: LAYOUT.spacing.xl,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.standard.border,
  },
  pageHeaderEyebrow: {
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Times-Italic',
    color: COLORS.standard.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  pageHeaderTitle: {
    fontSize: LAYOUT.font.title,
    fontFamily: 'Times-Bold',
    color: COLORS.standard.sageDeep,
    marginTop: 4,
  },
  pageHeaderNumber: {
    fontSize: LAYOUT.font.h2,
    fontFamily: 'Times-Italic',
    color: COLORS.standard.muted,
  },

  // ─────────────────────────────────────────
  // FOOTER
  // ─────────────────────────────────────────
  pageFooter: {
    position: 'absolute',
    bottom: 32,
    left: LAYOUT.page.margin,
    right: LAYOUT.page.margin,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.standard.borderLight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerText: {
    fontSize: LAYOUT.font.micro,
    fontFamily: 'Times-Roman',
    color: COLORS.standard.muted,
    lineHeight: 1.5,
    letterSpacing: 0.3,
  },
  footerConfidential: {
    fontSize: LAYOUT.font.micro,
    fontFamily: 'Times-Italic',
    color: COLORS.standard.mutedLight,
    letterSpacing: 0.5,
    position: 'absolute',
    top: -12,
    right: 0,
  },

  // ─────────────────────────────────────────
  // COUVERTURE
  // ─────────────────────────────────────────
  coverPage: {
    backgroundColor: COLORS.standard.cream,
    padding: 0,
    fontFamily: 'Times-Roman',
  },

  coverTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingTop: 32,
    paddingBottom: 16,
  },
  coverLogo: {
    width: 50,
    height: 50,
    objectFit: 'contain',
  },
  coverReferenceBlock: {
    alignItems: 'flex-end',
  },
  coverReferenceLabel: {
    fontSize: LAYOUT.font.micro,
    fontFamily: 'Times-Roman',
    color: COLORS.standard.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  coverReferenceValue: {
    fontSize: LAYOUT.font.small,
    fontFamily: 'Times-Italic',
    color: COLORS.standard.accent,
  },

  coverHero: {
    width: '100%',
    height: 540,
    objectFit: 'cover',
  },
  coverHeroPlaceholder: {
    width: '100%',
    height: 540,
    backgroundColor: COLORS.standard.creamDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverHeroPlaceholderText: {
    fontFamily: 'Times-Italic',
    color: COLORS.standard.muted,
    fontSize: LAYOUT.font.label,
  },

  coverBottomBlock: {
    paddingHorizontal: 36,
    paddingTop: 28,
    paddingBottom: 20,
  },
  coverEyebrow: {
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Times-Bold',
    color: COLORS.standard.sageDeep,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  coverTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 0.75,
    borderBottomColor: COLORS.standard.sageDark,
  },
  coverTitleLeft: {
    flex: 1,
    paddingRight: 24,
  },
  coverTitleText: {
    fontSize: LAYOUT.font.huge,
    fontFamily: 'Times-Bold',
    color: COLORS.standard.ink,
    lineHeight: 1.05,
  },
  coverLocation: {
    fontSize: LAYOUT.font.label,
    fontFamily: 'Times-Italic',
    color: COLORS.standard.muted,
    marginTop: 6,
    letterSpacing: 1,
  },
  coverPriceBlock: {
    alignItems: 'flex-end',
  },
  coverPriceLabel: {
    fontSize: LAYOUT.font.micro,
    fontFamily: 'Times-Roman',
    color: COLORS.standard.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  coverPriceValue: {
    fontSize: LAYOUT.font.heroPrice,
    fontFamily: 'Times-Bold',
    color: COLORS.standard.sageDeep,
    lineHeight: 1,
  },

  coverFooter: {
    paddingHorizontal: 36,
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  coverFooterBlock: {},
  coverFooterLabel: {
    fontSize: LAYOUT.font.micro,
    fontFamily: 'Times-Bold',
    color: COLORS.standard.sageDeep,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  coverFooterLine: {
    fontSize: LAYOUT.font.small,
    fontFamily: 'Times-Roman',
    color: COLORS.standard.inkSoft,
    lineHeight: 1.5,
  },
  coverFooterName: {
    fontSize: LAYOUT.font.small,
    fontFamily: 'Times-Bold',
    color: COLORS.standard.ink,
    lineHeight: 1.5,
  },

  // ─────────────────────────────────────────
  // SOMMAIRE
  // ─────────────────────────────────────────
  tocEyebrow: {
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Times-Bold',
    color: COLORS.standard.muted,
    letterSpacing: 3,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 12,
  },
  tocTitle: {
    fontSize: LAYOUT.font.title,
    fontFamily: 'Times-Bold',
    color: COLORS.standard.ink,
    textAlign: 'center',
    paddingBottom: 20,
    marginBottom: LAYOUT.spacing.xl,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.standard.border,
  },
  tocItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  tocItemNumber: {
    fontSize: LAYOUT.font.label,
    fontFamily: 'Times-Italic',
    color: COLORS.standard.accent,
    width: 32,
  },
  tocItemText: {
    fontSize: LAYOUT.font.label,
    fontFamily: 'Times-Roman',
    color: COLORS.standard.ink,
    flex: 1,
  },
  tocItemPage: {
    fontSize: LAYOUT.font.small,
    fontFamily: 'Times-Italic',
    color: COLORS.standard.muted,
  },

  // ─────────────────────────────────────────
  // SECTIONS
  // ─────────────────────────────────────────
  sectionEyebrow: {
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Times-Bold',
    color: COLORS.standard.sageDeep,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: LAYOUT.font.h2,
    fontFamily: 'Times-Bold',
    color: COLORS.standard.ink,
    marginBottom: 14,
  },
  sectionRule: {
    width: 40,
    height: 1,
    backgroundColor: COLORS.standard.sageDark,
    marginBottom: 16,
  },
  sectionContent: {
    fontSize: LAYOUT.font.body,
    fontFamily: 'Times-Roman',
    color: COLORS.standard.inkSoft,
    lineHeight: 1.55,
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 36,
  },
  column: {
    flex: 1,
  },

  // ─────────────────────────────────────────
  // HIGHLIGHTS numérotés
  // ─────────────────────────────────────────
  highlightItem: {
    flexDirection: 'row',
    marginBottom: 14,
    paddingRight: 4,
  },
  highlightNumber: {
    fontSize: LAYOUT.font.body,
    fontFamily: 'Times-BoldItalic',
    color: COLORS.standard.sageDark,
    width: 24,
  },
  highlightText: {
    fontSize: LAYOUT.font.body,
    fontFamily: 'Times-Roman',
    color: COLORS.standard.inkSoft,
    flex: 1,
    lineHeight: 1.5,
  },

  // ─────────────────────────────────────────
  // INFOS FINANCIERES
  // ─────────────────────────────────────────
  finRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.standard.borderLight,
  },
  finLabel: {
    width: 200,
    fontSize: LAYOUT.font.body,
    fontFamily: 'Times-Roman',
    color: COLORS.standard.muted,
  },
  finValue: {
    flex: 1,
    fontSize: LAYOUT.font.body,
    fontFamily: 'Times-Bold',
    color: COLORS.standard.ink,
  },
  finValueBig: {
    flex: 1,
    fontSize: LAYOUT.font.h2,
    fontFamily: 'Times-Bold',
    color: COLORS.standard.sageDeep,
  },

  // ─────────────────────────────────────────
  // GRILLE PHOTOS
  // ─────────────────────────────────────────
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoCell: {
    width: '49%',
    height: 165,
    marginBottom: 10,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  photoCellTall: {
    width: '100%',
    height: 350,
    marginBottom: 10,
  },

  // ─────────────────────────────────────────
  // KPIs
  // ─────────────────────────────────────────
  kpiRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: LAYOUT.spacing.lg,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.standard.creamWarm,
    padding: 18,
    borderRadius: 2,
  },
  kpiLabel: {
    fontSize: LAYOUT.font.micro,
    fontFamily: 'Times-Roman',
    color: COLORS.standard.muted,
    marginBottom: 6,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: LAYOUT.font.big,
    fontFamily: 'Times-Bold',
    color: COLORS.standard.sageDeep,
  },
  kpiUnit: {
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Times-Roman',
    color: COLORS.standard.muted,
    marginTop: 2,
  },

  // ─────────────────────────────────────────
  // BADGE
  // ─────────────────────────────────────────
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 1,
    marginRight: 6,
  },
  badgeStandard: {
    backgroundColor: COLORS.standard.sageDark,
  },
  badgeText: {
    fontSize: LAYOUT.font.micro,
    fontFamily: 'Times-Bold',
    color: COLORS.standard.white,
    letterSpacing: 1,
  },
});

// ─────────────────────────────────────────────────────────────────
// STYLES — Mode OFF-MARKET
// ─────────────────────────────────────────────────────────────────

export const stylesOffMarket = StyleSheet.create({
  page: {
    backgroundColor: COLORS.offmarket.bgDark,
    paddingTop: LAYOUT.page.margin,
    paddingBottom: LAYOUT.page.marginBottom,
    paddingHorizontal: LAYOUT.page.margin,
    fontFamily: 'Times-Roman',
    fontSize: LAYOUT.font.body,
    color: COLORS.offmarket.cream,
  },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 12,
    marginBottom: LAYOUT.spacing.xl,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.offmarket.accentLine,
  },
  pageHeaderEyebrow: {
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Times-Italic',
    color: COLORS.offmarket.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  pageHeaderTitle: {
    fontSize: LAYOUT.font.title,
    fontFamily: 'Times-Bold',
    color: COLORS.offmarket.gold,
    marginTop: 4,
  },
  pageHeaderNumber: {
    fontSize: LAYOUT.font.h2,
    fontFamily: 'Times-Italic',
    color: COLORS.offmarket.muted,
  },

  pageFooter: {
    position: 'absolute',
    bottom: 32,
    left: LAYOUT.page.margin,
    right: LAYOUT.page.margin,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.offmarket.accentLine,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerText: {
    fontSize: LAYOUT.font.micro,
    fontFamily: 'Times-Roman',
    color: COLORS.offmarket.muted,
    lineHeight: 1.5,
    letterSpacing: 0.3,
  },
  footerConfidential: {
    fontSize: LAYOUT.font.micro,
    fontFamily: 'Times-Bold',
    color: COLORS.offmarket.gold,
    letterSpacing: 1.5,
    position: 'absolute',
    top: -12,
    right: 0,
  },

  coverPage: {
    backgroundColor: COLORS.offmarket.bgDeep,
    padding: 0,
    fontFamily: 'Times-Roman',
  },
  coverTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingTop: 32,
    paddingBottom: 16,
  },
  coverLogo: {
    width: 48,
    height: 48,
    objectFit: 'contain',
  },
  coverReferenceBlock: {
    alignItems: 'flex-end',
  },
  coverReferenceLabel: {
    fontSize: LAYOUT.font.micro,
    fontFamily: 'Times-Roman',
    color: COLORS.offmarket.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  coverReferenceValue: {
    fontSize: LAYOUT.font.small,
    fontFamily: 'Times-Italic',
    color: COLORS.offmarket.gold,
  },
  coverHero: {
    width: '100%',
    height: 480,
    objectFit: 'cover',
    opacity: 0.75,
  },
  coverHeroPlaceholder: {
    width: '100%',
    height: 480,
    backgroundColor: COLORS.offmarket.bgDeep,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: COLORS.offmarket.accentLine,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.offmarket.accentLine,
  },
  coverHeroPlaceholderText: {
    fontFamily: 'Times-Italic',
    color: COLORS.offmarket.muted,
    fontSize: LAYOUT.font.label,
  },
  coverOffMarketBadge: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  coverOffMarketText: {
    fontSize: LAYOUT.font.label,
    fontFamily: 'Times-Bold',
    color: COLORS.offmarket.gold,
    letterSpacing: 8,
  },
  coverOffMarketSubtext: {
    fontSize: LAYOUT.font.micro,
    fontFamily: 'Times-Italic',
    color: COLORS.offmarket.muted,
    marginTop: 6,
    letterSpacing: 1.5,
  },

  coverBottomBlock: {
    paddingHorizontal: 36,
    paddingTop: 24,
    paddingBottom: 20,
  },
  coverEyebrow: {
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Times-Bold',
    color: COLORS.offmarket.gold,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  coverTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 0.75,
    borderBottomColor: COLORS.offmarket.gold,
  },
  coverTitleLeft: {
    flex: 1,
    paddingRight: 24,
  },
  coverTitleText: {
    fontSize: LAYOUT.font.huge,
    fontFamily: 'Times-Bold',
    color: COLORS.offmarket.cream,
    lineHeight: 1.05,
  },
  coverLocation: {
    fontSize: LAYOUT.font.label,
    fontFamily: 'Times-Italic',
    color: COLORS.offmarket.muted,
    marginTop: 6,
    letterSpacing: 1,
  },
  coverPriceBlock: {
    alignItems: 'flex-end',
  },
  coverPriceLabel: {
    fontSize: LAYOUT.font.micro,
    fontFamily: 'Times-Roman',
    color: COLORS.offmarket.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  coverPriceValue: {
    fontSize: LAYOUT.font.heroPrice,
    fontFamily: 'Times-Bold',
    color: COLORS.offmarket.gold,
    lineHeight: 1,
  },

  coverFooter: {
    paddingHorizontal: 36,
    paddingTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  coverFooterBlock: {},
  coverFooterLabel: {
    fontSize: LAYOUT.font.micro,
    fontFamily: 'Times-Bold',
    color: COLORS.offmarket.gold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  coverFooterLine: {
    fontSize: LAYOUT.font.small,
    fontFamily: 'Times-Roman',
    color: COLORS.offmarket.cream,
    lineHeight: 1.5,
  },
  coverFooterName: {
    fontSize: LAYOUT.font.small,
    fontFamily: 'Times-Bold',
    color: COLORS.offmarket.cream,
    lineHeight: 1.5,
  },

  tocEyebrow: {
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Times-Bold',
    color: COLORS.offmarket.muted,
    letterSpacing: 3,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 12,
  },
  tocTitle: {
    fontSize: LAYOUT.font.title,
    fontFamily: 'Times-Bold',
    color: COLORS.offmarket.gold,
    textAlign: 'center',
    paddingBottom: 20,
    marginBottom: LAYOUT.spacing.xl,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.offmarket.accentLine,
  },
  tocItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  tocItemNumber: {
    fontSize: LAYOUT.font.label,
    fontFamily: 'Times-Italic',
    color: COLORS.offmarket.gold,
    width: 32,
  },
  tocItemText: {
    fontSize: LAYOUT.font.label,
    fontFamily: 'Times-Roman',
    color: COLORS.offmarket.cream,
    flex: 1,
  },
  tocItemPage: {
    fontSize: LAYOUT.font.small,
    fontFamily: 'Times-Italic',
    color: COLORS.offmarket.muted,
  },

  sectionEyebrow: {
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Times-Bold',
    color: COLORS.offmarket.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: LAYOUT.font.h2,
    fontFamily: 'Times-Bold',
    color: COLORS.offmarket.cream,
    marginBottom: 14,
  },
  sectionRule: {
    width: 40,
    height: 1,
    backgroundColor: COLORS.offmarket.gold,
    marginBottom: 16,
  },
  sectionContent: {
    fontSize: LAYOUT.font.body,
    fontFamily: 'Times-Roman',
    color: COLORS.offmarket.cream,
    lineHeight: 1.55,
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 36,
  },
  column: {
    flex: 1,
  },

  highlightItem: {
    flexDirection: 'row',
    marginBottom: 14,
    paddingRight: 4,
  },
  highlightNumber: {
    fontSize: LAYOUT.font.body,
    fontFamily: 'Times-BoldItalic',
    color: COLORS.offmarket.gold,
    width: 24,
  },
  highlightText: {
    fontSize: LAYOUT.font.body,
    fontFamily: 'Times-Roman',
    color: COLORS.offmarket.cream,
    flex: 1,
    lineHeight: 1.5,
  },

  finRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.offmarket.accentLine,
  },
  finLabel: {
    width: 200,
    fontSize: LAYOUT.font.body,
    fontFamily: 'Times-Roman',
    color: COLORS.offmarket.muted,
  },
  finValue: {
    flex: 1,
    fontSize: LAYOUT.font.body,
    fontFamily: 'Times-Bold',
    color: COLORS.offmarket.cream,
  },
  finValueBig: {
    flex: 1,
    fontSize: LAYOUT.font.h2,
    fontFamily: 'Times-Bold',
    color: COLORS.offmarket.gold,
  },

  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoCell: {
    width: '49%',
    height: 165,
    marginBottom: 10,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 0.95,
  },
  photoCellTall: {
    width: '100%',
    height: 350,
    marginBottom: 10,
  },

  kpiRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: LAYOUT.spacing.lg,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.offmarket.bgDeep,
    padding: 18,
    borderRadius: 2,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.offmarket.gold,
  },
  kpiLabel: {
    fontSize: LAYOUT.font.micro,
    fontFamily: 'Times-Roman',
    color: COLORS.offmarket.muted,
    marginBottom: 6,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: LAYOUT.font.big,
    fontFamily: 'Times-Bold',
    color: COLORS.offmarket.gold,
  },
  kpiUnit: {
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Times-Roman',
    color: COLORS.offmarket.muted,
    marginTop: 2,
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 1,
    marginRight: 6,
  },
  badgeOffMarket: {
    backgroundColor: COLORS.offmarket.gold,
  },
  badgeText: {
    fontSize: LAYOUT.font.micro,
    fontFamily: 'Times-Bold',
    color: COLORS.offmarket.bgDeep,
    letterSpacing: 1,
  },
});

// ─────────────────────────────────────────────────────────────────
// HELPER : retourne le bon style sheet selon le mode
// ─────────────────────────────────────────────────────────────────

export function getStyles(isOffMarket) {
  return isOffMarket ? stylesOffMarket : stylesStandard;
}
