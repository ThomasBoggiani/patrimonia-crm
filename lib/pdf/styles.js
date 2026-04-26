// ═══════════════════════════════════════════════════════════════════
// lib/pdf/styles.js — REFONTE Direction 1 v12.3
// 
// "Maison de prestige parisienne" — inspiration Barnes / Daniel Féau
// 
// - Cormorant Garamond pour les titres (serif élégant français)
// - Inter pour le corps (sans-serif moderne)
// - Beaucoup d'air, filets décoratifs subtils
// - Photo dominante en couverture (70% hauteur)
// - Prix en grand, séparé du titre
// ═══════════════════════════════════════════════════════════════════

import { StyleSheet, Font } from '@react-pdf/renderer';

// ─────────────────────────────────────────────────────────────────
// REGISTER FONTS — chargées depuis Google Fonts CDN
// ─────────────────────────────────────────────────────────────────

Font.register({
  family: 'Cormorant Garamond',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/cormorantgaramond/v16/co3bmX5slCNuHLi8bLeY9MK7whWMhyjornFLsS6V7w.ttf',
      fontWeight: 'normal',
    },
    {
      src: 'https://fonts.gstatic.com/s/cormorantgaramond/v16/co3YmX5slCNuHLi8bLeY9MK7whWMhyjQAllTuQWcyfYPbg.ttf',
      fontWeight: 'normal',
      fontStyle: 'italic',
    },
    {
      src: 'https://fonts.gstatic.com/s/cormorantgaramond/v16/co3bmX5slCNuHLi8bLeY9MK7whWMhyjor3FNsS6V7w.ttf',
      fontWeight: 600,
    },
    {
      src: 'https://fonts.gstatic.com/s/cormorantgaramond/v16/co3bmX5slCNuHLi8bLeY9MK7whWMhyjorPFOsS6V7w.ttf',
      fontWeight: 700,
    },
  ],
});

Font.register({
  family: 'Inter',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.ttf',
      fontWeight: 'normal',
    },
    {
      src: 'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa2pL7.ttf',
      fontWeight: 500,
    },
    {
      src: 'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa05L7.ttf',
      fontWeight: 600,
    },
    {
      src: 'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1pL7.ttf',
      fontWeight: 700,
    },
  ],
});

// ─────────────────────────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────────────────────────

export const COLORS = {
  standard: {
    sage: '#94A084',
    sageDark: '#5D6B4D',          // plus foncé qu'avant pour plus de contraste
    sageDeep: '#3F4D32',           // pour les filets accents
    sageLight: '#C8D0BB',
    cream: '#F8F6EF',              // crème plus clair, plus raffiné
    creamWarm: '#EFEBE0',          // warm cream pour bandeaux
    creamDark: '#E5DFCF',
    ink: '#1F1F1B',                // noir presque pur pour textes
    inkSoft: '#3A3A33',
    muted: '#76716A',
    mutedLight: '#A8A399',
    border: '#D5D0C2',
    borderLight: '#E8E3D5',
    white: '#FFFFFF',
    accent: '#7E6F4F',             // bois pour accents discrets (chiffres, références)
  },
  offmarket: {
    bgDark: '#1A1817',
    bgDeep: '#0E0D0C',
    gold: '#C7A969',               // doré plus chaud
    goldDim: '#8A7741',
    cream: '#EDE9DF',
    muted: '#9A9486',
    border: '#2E2A26',
    accentLine: '#4A4239',
  },
};

// ─────────────────────────────────────────────────────────────────
// LAYOUT (en points : 1pt = 1/72 inch, A4 = 595x842pt)
// ─────────────────────────────────────────────────────────────────

export const LAYOUT = {
  page: {
    A4: { width: 595, height: 842 },
    margin: 56,                     // marges intérieures généreuses (vs 40 avant)
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
    small: 9.5,
    body: 10.5,
    label: 11,
    section: 13,
    h2: 18,
    title: 22,
    big: 28,
    huge: 38,
    heroPrice: 44,
  },
};

// ─────────────────────────────────────────────────────────────────
// HELPER : choisir la palette selon le mode
// ─────────────────────────────────────────────────────────────────

export function getPalette(isOffMarket) {
  return isOffMarket ? COLORS.offmarket : COLORS.standard;
}

// ─────────────────────────────────────────────────────────────────
// STYLES — Mode STANDARD (refondus)
// ─────────────────────────────────────────────────────────────────

export const stylesStandard = StyleSheet.create({
  page: {
    backgroundColor: COLORS.standard.cream,
    paddingTop: LAYOUT.page.margin,
    paddingBottom: LAYOUT.page.marginBottom,
    paddingHorizontal: LAYOUT.page.margin,
    fontFamily: 'Inter',
    fontSize: LAYOUT.font.body,
    color: COLORS.standard.ink,
  },

  // ─────────────────────────────────────────
  // HEADER de page (pour pages 2+)
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
    fontFamily: 'Inter',
    fontWeight: 500,
    color: COLORS.standard.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  pageHeaderTitle: {
    fontSize: LAYOUT.font.title,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 600,
    color: COLORS.standard.sageDeep,
    marginTop: 4,
  },
  pageHeaderNumber: {
    fontSize: LAYOUT.font.h2,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 'normal',
    color: COLORS.standard.muted,
    fontStyle: 'italic',
  },

  // ─────────────────────────────────────────
  // FOOTER (pages 2+)
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
    color: COLORS.standard.muted,
    lineHeight: 1.5,
    letterSpacing: 0.3,
  },
  footerConfidential: {
    fontSize: LAYOUT.font.micro,
    color: COLORS.standard.mutedLight,
    fontStyle: 'italic',
    letterSpacing: 0.5,
    position: 'absolute',
    top: -12,
    right: 0,
  },

  // ─────────────────────────────────────────
  // COUVERTURE — refondue
  // ─────────────────────────────────────────
  coverPage: {
    backgroundColor: COLORS.standard.cream,
    padding: 0,
    fontFamily: 'Inter',
  },

  // Top bar : logo à gauche, référence à droite
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
    color: COLORS.standard.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  coverReferenceValue: {
    fontSize: LAYOUT.font.small,
    color: COLORS.standard.accent,
    fontFamily: 'Cormorant Garamond',
    fontStyle: 'italic',
  },

  // Photo hero (70% hauteur)
  coverHero: {
    width: '100%',
    height: 540,                       // ~64% de la page A4 (842pt)
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
    color: COLORS.standard.muted,
    fontSize: LAYOUT.font.label,
    fontStyle: 'italic',
  },

  // Bloc bas avec titre + prix
  coverBottomBlock: {
    paddingHorizontal: 36,
    paddingTop: 28,
    paddingBottom: 20,
  },
  coverEyebrow: {
    fontSize: LAYOUT.font.tiny,
    color: COLORS.standard.sageDeep,
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: 600,
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
    fontFamily: 'Cormorant Garamond',
    fontWeight: 600,
    color: COLORS.standard.ink,
    lineHeight: 1.05,
  },
  coverLocation: {
    fontSize: LAYOUT.font.label,
    color: COLORS.standard.muted,
    fontFamily: 'Inter',
    marginTop: 6,
    letterSpacing: 1,
  },
  coverPriceBlock: {
    alignItems: 'flex-end',
  },
  coverPriceLabel: {
    fontSize: LAYOUT.font.micro,
    color: COLORS.standard.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  coverPriceValue: {
    fontSize: LAYOUT.font.heroPrice,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 600,
    color: COLORS.standard.sageDeep,
    lineHeight: 1,
  },

  // Bloc contact en bas
  coverFooter: {
    paddingHorizontal: 36,
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  coverFooterBlock: {},
  coverFooterLabel: {
    fontSize: LAYOUT.font.micro,
    fontFamily: 'Inter',
    fontWeight: 600,
    color: COLORS.standard.sageDeep,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  coverFooterLine: {
    fontSize: LAYOUT.font.small,
    color: COLORS.standard.inkSoft,
    lineHeight: 1.5,
  },
  coverFooterName: {
    fontSize: LAYOUT.font.small,
    color: COLORS.standard.ink,
    fontFamily: 'Inter',
    fontWeight: 600,
    lineHeight: 1.5,
  },

  // ─────────────────────────────────────────
  // SOMMAIRE
  // ─────────────────────────────────────────
  tocEyebrow: {
    fontSize: LAYOUT.font.tiny,
    color: COLORS.standard.muted,
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: 600,
    textAlign: 'center',
    marginBottom: 12,
  },
  tocTitle: {
    fontSize: LAYOUT.font.title,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 600,
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
    fontFamily: 'Cormorant Garamond',
    fontStyle: 'italic',
    color: COLORS.standard.accent,
    width: 32,
  },
  tocItemText: {
    fontSize: LAYOUT.font.label,
    color: COLORS.standard.ink,
    fontFamily: 'Inter',
    fontWeight: 500,
    flex: 1,
  },
  tocItemPage: {
    fontSize: LAYOUT.font.small,
    color: COLORS.standard.muted,
    fontFamily: 'Cormorant Garamond',
    fontStyle: 'italic',
  },

  // ─────────────────────────────────────────
  // SECTIONS DE CONTENU
  // ─────────────────────────────────────────
  sectionEyebrow: {
    fontSize: LAYOUT.font.tiny,
    color: COLORS.standard.sageDeep,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    fontWeight: 600,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: LAYOUT.font.h2,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 600,
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
    color: COLORS.standard.inkSoft,
    lineHeight: 1.7,
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 36,
  },
  column: {
    flex: 1,
  },

  // ─────────────────────────────────────────
  // HIGHLIGHTS numérotés ("01" "02" "03"...)
  // ─────────────────────────────────────────
  highlightItem: {
    flexDirection: 'row',
    marginBottom: 14,
    paddingRight: 4,
  },
  highlightNumber: {
    fontSize: LAYOUT.font.body,
    fontFamily: 'Cormorant Garamond',
    fontStyle: 'italic',
    color: COLORS.standard.sageDark,
    width: 24,
    fontWeight: 600,
  },
  highlightText: {
    fontSize: LAYOUT.font.body,
    color: COLORS.standard.inkSoft,
    flex: 1,
    lineHeight: 1.6,
  },

  // ─────────────────────────────────────────
  // INFOS FINANCIERES (tableau clé-valeur)
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
    color: COLORS.standard.muted,
    fontFamily: 'Inter',
  },
  finValue: {
    flex: 1,
    fontSize: LAYOUT.font.body,
    fontFamily: 'Inter',
    fontWeight: 600,
    color: COLORS.standard.ink,
  },
  finValueBig: {
    flex: 1,
    fontSize: LAYOUT.font.h2,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 600,
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
  // KPIs (rapport vendeur)
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
    color: COLORS.standard.muted,
    marginBottom: 6,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: LAYOUT.font.big,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 600,
    color: COLORS.standard.sageDeep,
  },
  kpiUnit: {
    fontSize: LAYOUT.font.tiny,
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
    color: COLORS.standard.white,
    fontFamily: 'Inter',
    fontWeight: 600,
    letterSpacing: 1,
  },
});

// ─────────────────────────────────────────────────────────────────
// STYLES — Mode OFF-MARKET (gardé proche de l'ancien, juste affiné)
// ─────────────────────────────────────────────────────────────────

export const stylesOffMarket = StyleSheet.create({
  page: {
    backgroundColor: COLORS.offmarket.bgDark,
    paddingTop: LAYOUT.page.margin,
    paddingBottom: LAYOUT.page.marginBottom,
    paddingHorizontal: LAYOUT.page.margin,
    fontFamily: 'Inter',
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
    fontFamily: 'Inter',
    fontWeight: 500,
    color: COLORS.offmarket.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  pageHeaderTitle: {
    fontSize: LAYOUT.font.title,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 600,
    color: COLORS.offmarket.gold,
    marginTop: 4,
  },
  pageHeaderNumber: {
    fontSize: LAYOUT.font.h2,
    fontFamily: 'Cormorant Garamond',
    color: COLORS.offmarket.muted,
    fontStyle: 'italic',
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
    color: COLORS.offmarket.muted,
    lineHeight: 1.5,
    letterSpacing: 0.3,
  },
  footerConfidential: {
    fontSize: LAYOUT.font.micro,
    color: COLORS.offmarket.gold,
    fontFamily: 'Inter',
    fontWeight: 600,
    letterSpacing: 1.5,
    position: 'absolute',
    top: -12,
    right: 0,
  },

  coverPage: {
    backgroundColor: COLORS.offmarket.bgDeep,
    padding: 0,
    fontFamily: 'Inter',
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
    color: COLORS.offmarket.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  coverReferenceValue: {
    fontSize: LAYOUT.font.small,
    color: COLORS.offmarket.gold,
    fontFamily: 'Cormorant Garamond',
    fontStyle: 'italic',
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
    color: COLORS.offmarket.muted,
    fontSize: LAYOUT.font.label,
    fontStyle: 'italic',
  },
  coverOffMarketBadge: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  coverOffMarketText: {
    fontSize: LAYOUT.font.label,
    color: COLORS.offmarket.gold,
    fontFamily: 'Inter',
    fontWeight: 700,
    letterSpacing: 8,
  },
  coverOffMarketSubtext: {
    fontSize: LAYOUT.font.micro,
    color: COLORS.offmarket.muted,
    fontStyle: 'italic',
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
    color: COLORS.offmarket.gold,
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: 600,
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
    fontFamily: 'Cormorant Garamond',
    fontWeight: 600,
    color: COLORS.offmarket.cream,
    lineHeight: 1.05,
  },
  coverLocation: {
    fontSize: LAYOUT.font.label,
    color: COLORS.offmarket.muted,
    fontFamily: 'Inter',
    marginTop: 6,
    letterSpacing: 1,
  },
  coverPriceBlock: {
    alignItems: 'flex-end',
  },
  coverPriceLabel: {
    fontSize: LAYOUT.font.micro,
    color: COLORS.offmarket.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  coverPriceValue: {
    fontSize: LAYOUT.font.heroPrice,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 600,
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
    fontFamily: 'Inter',
    fontWeight: 600,
    color: COLORS.offmarket.gold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  coverFooterLine: {
    fontSize: LAYOUT.font.small,
    color: COLORS.offmarket.cream,
    lineHeight: 1.5,
  },
  coverFooterName: {
    fontSize: LAYOUT.font.small,
    color: COLORS.offmarket.cream,
    fontFamily: 'Inter',
    fontWeight: 600,
    lineHeight: 1.5,
  },

  tocEyebrow: {
    fontSize: LAYOUT.font.tiny,
    color: COLORS.offmarket.muted,
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: 600,
    textAlign: 'center',
    marginBottom: 12,
  },
  tocTitle: {
    fontSize: LAYOUT.font.title,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 600,
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
    fontFamily: 'Cormorant Garamond',
    fontStyle: 'italic',
    color: COLORS.offmarket.gold,
    width: 32,
  },
  tocItemText: {
    fontSize: LAYOUT.font.label,
    color: COLORS.offmarket.cream,
    fontFamily: 'Inter',
    fontWeight: 500,
    flex: 1,
  },
  tocItemPage: {
    fontSize: LAYOUT.font.small,
    color: COLORS.offmarket.muted,
    fontFamily: 'Cormorant Garamond',
    fontStyle: 'italic',
  },

  sectionEyebrow: {
    fontSize: LAYOUT.font.tiny,
    color: COLORS.offmarket.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    fontWeight: 600,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: LAYOUT.font.h2,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 600,
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
    color: COLORS.offmarket.cream,
    lineHeight: 1.7,
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
    fontFamily: 'Cormorant Garamond',
    fontStyle: 'italic',
    color: COLORS.offmarket.gold,
    width: 24,
    fontWeight: 600,
  },
  highlightText: {
    fontSize: LAYOUT.font.body,
    color: COLORS.offmarket.cream,
    flex: 1,
    lineHeight: 1.6,
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
    color: COLORS.offmarket.muted,
    fontFamily: 'Inter',
  },
  finValue: {
    flex: 1,
    fontSize: LAYOUT.font.body,
    fontFamily: 'Inter',
    fontWeight: 600,
    color: COLORS.offmarket.cream,
  },
  finValueBig: {
    flex: 1,
    fontSize: LAYOUT.font.h2,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 600,
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
    color: COLORS.offmarket.muted,
    marginBottom: 6,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: LAYOUT.font.big,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 600,
    color: COLORS.offmarket.gold,
  },
  kpiUnit: {
    fontSize: LAYOUT.font.tiny,
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
    color: COLORS.offmarket.bgDeep,
    fontFamily: 'Inter',
    fontWeight: 600,
    letterSpacing: 1,
  },
});

// ─────────────────────────────────────────────────────────────────
// HELPER : retourne le bon style sheet selon le mode
// ─────────────────────────────────────────────────────────────────

export function getStyles(isOffMarket) {
  return isOffMarket ? stylesOffMarket : stylesStandard;
}
