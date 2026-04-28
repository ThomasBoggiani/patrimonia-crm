// ═══════════════════════════════════════════════════════════════════
// lib/pdf/styles.js — REFONTE "Template I&P" v13.0
// 
// Direction : Template officiel Immeubles & Patrimoine
// - Format PORTRAIT A4
// - Police Helvetica (sans-serif intégré)
// - Sage #94A084 + Crème + Logo centré + Footer sage
// - Mode off-market : adaptation noir/or du même layout
// ═══════════════════════════════════════════════════════════════════

import { StyleSheet } from '@react-pdf/renderer';

// ─────────────────────────────────────────────────────────────────
// PALETTE — fidèle au template I&P
// ─────────────────────────────────────────────────────────────────

export const COLORS = {
  standard: {
    sage: '#94A084',           // Couleur principale (titres, footer)
    sageDark: '#7A8568',       // Sage foncé (variations)
    sageLight: '#B5BFA6',      // Sage clair (cards subtiles)
    sagePale: '#E8EBE0',       // Très clair (fonds)
    cream: '#FAFAF7',          // Fond presque blanc
    white: '#FFFFFF',          // Blanc pur
    ink: '#1F1F1B',            // Texte principal
    inkSoft: '#3A3A33',        // Texte secondaire
    muted: '#76716A',          // Gris doux
    mutedLight: '#A8A399',     // Gris très doux
    border: '#D5D0C2',         // Bordures
    accent: '#7E6F4F',         // Accent doré subtil
  },
  offmarket: {
    bgDark: '#1A1817',         // Noir mat
    bgDeep: '#0E0D0C',         // Noir profond
    gold: '#C7A969',           // Or
    goldDim: '#8A7741',        // Or sombre
    cream: '#EDE9DF',          // Crème pour texte
    muted: '#9A9486',          // Gris doux
    border: '#2E2A26',         // Bordures sombres
    accentLine: '#4A4239',     // Filets sombres
  },
};

// ─────────────────────────────────────────────────────────────────
// LAYOUT — Format PORTRAIT
// ─────────────────────────────────────────────────────────────────

export const LAYOUT = {
  page: {
    A4Portrait: { width: 595, height: 842 }, // PORTRAIT
    margin: 40,
    marginTop: 40,
    marginBottom: 65, // Plus large pour footer sage
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 36,
    xxl: 50,
  },
  font: {
    micro: 7,
    tiny: 8,
    small: 10,
    body: 11,
    label: 12,
    section: 14,
    h2: 18,
    title: 24,
    big: 28,
    huge: 36,
    heroPrice: 32,
    cardNumber: 18,
  },
  logo: {
    coverWidth: 110,    // Logo couverture
    coverHeight: 110,
    pageWidth: 70,      // Logo en-tête de page
    pageHeight: 70,
  },
};

// ─────────────────────────────────────────────────────────────────
// HELPER : palette selon mode
// ─────────────────────────────────────────────────────────────────

export function getPalette(isOffMarket) {
  return isOffMarket ? COLORS.offmarket : COLORS.standard;
}

// ─────────────────────────────────────────────────────────────────
// STYLES — Mode STANDARD (Helvetica + sage)
// ─────────────────────────────────────────────────────────────────

export const stylesStandard = StyleSheet.create({
  page: {
    backgroundColor: COLORS.standard.cream,
    paddingTop: LAYOUT.page.marginTop,
    paddingBottom: LAYOUT.page.marginBottom,
    paddingHorizontal: LAYOUT.page.margin,
    fontFamily: 'Helvetica',
    fontSize: LAYOUT.font.body,
    color: COLORS.standard.ink,
  },

  // ═══ EN-TÊTE DE PAGE (logo centré) ═══
  pageLogo: {
    width: LAYOUT.logo.pageWidth,
    height: LAYOUT.logo.pageHeight,
    objectFit: 'contain',
    alignSelf: 'center',
    marginBottom: 16,
  },

  // ═══ TITRE DE SECTION (gros sage centré) ═══
  sectionTitle: {
    fontSize: LAYOUT.font.title,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.standard.sage,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionTitleMulti: {
    fontSize: LAYOUT.font.title,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.standard.sage,
    textAlign: 'center',
    letterSpacing: 1,
    lineHeight: 1.2,
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: LAYOUT.font.body,
    fontFamily: 'Helvetica',
    color: COLORS.standard.inkSoft,
    textAlign: 'center',
    lineHeight: 1.5,
    marginBottom: LAYOUT.spacing.xl,
    paddingHorizontal: 20,
  },

  // ═══ FOOTER SAGE (bandeau bas de page) ═══
  pageFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: COLORS.standard.sage,
    paddingHorizontal: LAYOUT.page.margin,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flexDirection: 'column',
  },
  footerCompany: {
    fontSize: LAYOUT.font.small,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.standard.white,
  },
  footerAddress: {
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Helvetica',
    color: COLORS.standard.white,
    marginTop: 2,
  },
  footerContact: {
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Helvetica',
    color: COLORS.standard.white,
    marginTop: 2,
  },
  footerPageNumber: {
    fontSize: LAYOUT.font.label,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.standard.white,
  },

  // ═══ MENTION CONFIDENTIEL (italic au-dessus footer) ═══
  confidentialNote: {
    position: 'absolute',
    bottom: 58,
    right: LAYOUT.page.margin,
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Helvetica-Oblique',
    color: COLORS.standard.muted,
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE 1 - COUVERTURE
  // ═══════════════════════════════════════════════════════════════
  coverPage: {
    backgroundColor: COLORS.standard.cream,
    paddingTop: 50,
    paddingBottom: 50,
    paddingHorizontal: 50,
    fontFamily: 'Helvetica',
    borderWidth: 4,
    borderColor: COLORS.standard.sageLight,
  },
  coverLogoLarge: {
    width: LAYOUT.logo.coverWidth,
    height: LAYOUT.logo.coverHeight,
    objectFit: 'contain',
    alignSelf: 'center',
    marginBottom: 30,
  },
  coverPhoto: {
    width: '100%',
    height: 380,
    objectFit: 'cover',
    marginBottom: 30,
  },
  coverPhotoPlaceholder: {
    width: '100%',
    height: 380,
    backgroundColor: COLORS.standard.sagePale,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  coverTitleBlock: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.standard.sage,
  },
  coverTitle: {
    fontSize: LAYOUT.font.huge,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.standard.sage,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 12,
  },
  coverCity: {
    fontSize: LAYOUT.font.title,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.standard.ink,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
  },
  coverSubInfo: {
    fontSize: LAYOUT.font.label,
    fontFamily: 'Helvetica',
    color: COLORS.standard.inkSoft,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 24,
  },
  coverWebsite: {
    fontSize: LAYOUT.font.body,
    fontFamily: 'Helvetica-Oblique',
    color: COLORS.standard.muted,
    textAlign: 'center',
    marginTop: 16,
  },

  // ═══════════════════════════════════════════════════════════════
  // PAGE SOMMAIRE
  // ═══════════════════════════════════════════════════════════════
  tocItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  tocItemNumber: {
    fontSize: LAYOUT.font.label,
    fontFamily: 'Helvetica',
    color: COLORS.standard.ink,
    width: 30,
  },
  tocItemSeparator: {
    fontSize: LAYOUT.font.label,
    fontFamily: 'Helvetica',
    color: COLORS.standard.ink,
    marginRight: 8,
  },
  tocItemLabel: {
    fontSize: LAYOUT.font.label,
    fontFamily: 'Helvetica',
    color: COLORS.standard.ink,
    flex: 1,
  },
  tocItemPage: {
    fontSize: LAYOUT.font.label,
    fontFamily: 'Helvetica',
    color: COLORS.standard.ink,
  },

  // ═══════════════════════════════════════════════════════════════
  // CARDS SAGE (chiffres clés) — LIGNE 3 cards côte à côte
  // ═══════════════════════════════════════════════════════════════
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    marginTop: 30,
    paddingHorizontal: 10,
    gap: 10,
  },
  card: {
    flex: 1,
    minHeight: 95,
    backgroundColor: COLORS.standard.sage,
    borderRadius: 6,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  cardNumber: {
    fontSize: LAYOUT.font.cardNumber,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.standard.white,
    textAlign: 'center',
    marginBottom: 6,
  },
  cardLabel: {
    fontSize: LAYOUT.font.small,
    fontFamily: 'Helvetica',
    color: COLORS.standard.white,
    textAlign: 'center',
    lineHeight: 1.3,
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOCS DESCRIPTION
  // ═══════════════════════════════════════════════════════════════
  descriptionBlock: {
    marginVertical: 16,
    paddingHorizontal: 20,
  },
  descriptionText: {
    fontSize: LAYOUT.font.body,
    fontFamily: 'Helvetica',
    color: COLORS.standard.inkSoft,
    lineHeight: 1.6,
    textAlign: 'center',
  },

  // ═══════════════════════════════════════════════════════════════
  // INFOS FINANCIÈRES (tableau)
  // ═══════════════════════════════════════════════════════════════
  finTable: {
    marginTop: 24,
    marginHorizontal: 30,
    borderWidth: 0.5,
    borderColor: COLORS.standard.muted,
  },
  finRow: {
    flexDirection: 'row',
    minHeight: 50,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.standard.muted,
  },
  finRowLast: {
    flexDirection: 'row',
    minHeight: 50,
  },
  finLabel: {
    flex: 1.2,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: LAYOUT.font.body,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.standard.ink,
    borderRightWidth: 0.5,
    borderRightColor: COLORS.standard.muted,
    justifyContent: 'center',
  },
  finValue: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: LAYOUT.font.body,
    fontFamily: 'Helvetica',
    color: COLORS.standard.ink,
    textAlign: 'center',
    justifyContent: 'center',
  },

  // ═══════════════════════════════════════════════════════════════
  // GRILLE PHOTOS (3×2)
  // ═══════════════════════════════════════════════════════════════
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  photoCell: {
    width: '32%',
    marginBottom: 16,
  },
  photoImage: {
    width: '100%',
    height: 130,
    objectFit: 'cover',
    backgroundColor: COLORS.standard.sagePale,
  },
  photoCaption: {
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Helvetica',
    color: COLORS.standard.inkSoft,
    textAlign: 'center',
    marginTop: 6,
  },

  // ═══════════════════════════════════════════════════════════════
  // ÉQUIPE (4 portraits ronds)
  // ═══════════════════════════════════════════════════════════════
  teamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  teamMember: {
    width: '45%',
    alignItems: 'center',
    marginBottom: 32,
  },
  teamPhoto: {
    width: 110,
    height: 110,
    borderRadius: 55,
    objectFit: 'cover',
    marginBottom: 12,
  },
  teamName: {
    fontSize: LAYOUT.font.body,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.standard.sage,
    textAlign: 'center',
    marginBottom: 4,
  },
  teamRole: {
    fontSize: LAYOUT.font.small,
    fontFamily: 'Helvetica-Oblique',
    color: COLORS.standard.inkSoft,
    textAlign: 'center',
    marginBottom: 4,
  },
  teamEmail: {
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Helvetica',
    color: COLORS.standard.muted,
    textAlign: 'center',
  },
  teamPhone: {
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.standard.ink,
    textAlign: 'center',
    marginTop: 2,
  },
});

// ─────────────────────────────────────────────────────────────────
// STYLES — Mode OFF-MARKET (noir/or)
// ─────────────────────────────────────────────────────────────────

export const stylesOffMarket = StyleSheet.create({
  page: {
    backgroundColor: COLORS.offmarket.bgDark,
    paddingTop: LAYOUT.page.marginTop,
    paddingBottom: LAYOUT.page.marginBottom,
    paddingHorizontal: LAYOUT.page.margin,
    fontFamily: 'Helvetica',
    fontSize: LAYOUT.font.body,
    color: COLORS.offmarket.cream,
  },
  pageLogo: {
    width: 75,
    height: 75,
    objectFit: 'contain',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: LAYOUT.font.title,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.offmarket.gold,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionTitleMulti: {
    fontSize: LAYOUT.font.title,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.offmarket.gold,
    textAlign: 'center',
    letterSpacing: 1,
    lineHeight: 1.2,
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: LAYOUT.font.body,
    fontFamily: 'Helvetica',
    color: COLORS.offmarket.cream,
    textAlign: 'center',
    lineHeight: 1.5,
    marginBottom: LAYOUT.spacing.xl,
    paddingHorizontal: 20,
  },

  pageFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: COLORS.offmarket.bgDeep,
    paddingHorizontal: LAYOUT.page.margin,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.75,
    borderTopColor: COLORS.offmarket.gold,
  },
  footerLeft: {
    flexDirection: 'column',
  },
  footerCompany: {
    fontSize: LAYOUT.font.small,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.offmarket.gold,
  },
  footerAddress: {
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Helvetica',
    color: COLORS.offmarket.cream,
    marginTop: 2,
  },
  footerContact: {
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Helvetica',
    color: COLORS.offmarket.cream,
    marginTop: 2,
  },
  footerPageNumber: {
    fontSize: LAYOUT.font.label,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.offmarket.gold,
  },
  confidentialNote: {
    position: 'absolute',
    bottom: 58,
    right: LAYOUT.page.margin,
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.offmarket.gold,
    letterSpacing: 1.5,
  },

  // COUVERTURE off-market
  coverPage: {
    backgroundColor: COLORS.offmarket.bgDeep,
    paddingTop: 50,
    paddingBottom: 50,
    paddingHorizontal: 50,
    fontFamily: 'Helvetica',
    borderWidth: 4,
    borderColor: COLORS.offmarket.goldDim,
  },
  coverLogoLarge: {
    width: LAYOUT.logo.coverWidth,
    height: LAYOUT.logo.coverHeight,
    objectFit: 'contain',
    alignSelf: 'center',
    marginBottom: 30,
  },
  coverPhoto: {
    width: '100%',
    height: 380,
    objectFit: 'cover',
    marginBottom: 30,
    opacity: 0.85,
  },
  coverPhotoPlaceholder: {
    width: '100%',
    height: 380,
    backgroundColor: COLORS.offmarket.bgDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 0.5,
    borderColor: COLORS.offmarket.goldDim,
  },
  coverTitleBlock: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.offmarket.gold,
  },
  coverTitle: {
    fontSize: LAYOUT.font.huge,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.offmarket.gold,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 12,
  },
  coverCity: {
    fontSize: LAYOUT.font.title,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.offmarket.cream,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
  },
  coverSubInfo: {
    fontSize: LAYOUT.font.label,
    fontFamily: 'Helvetica',
    color: COLORS.offmarket.cream,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 24,
  },
  coverWebsite: {
    fontSize: LAYOUT.font.body,
    fontFamily: 'Helvetica-Oblique',
    color: COLORS.offmarket.muted,
    textAlign: 'center',
    marginTop: 16,
  },

  // SOMMAIRE off-market
  tocItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  tocItemNumber: {
    fontSize: LAYOUT.font.label,
    fontFamily: 'Helvetica',
    color: COLORS.offmarket.cream,
    width: 30,
  },
  tocItemSeparator: {
    fontSize: LAYOUT.font.label,
    fontFamily: 'Helvetica',
    color: COLORS.offmarket.cream,
    marginRight: 8,
  },
  tocItemLabel: {
    fontSize: LAYOUT.font.label,
    fontFamily: 'Helvetica',
    color: COLORS.offmarket.cream,
    flex: 1,
  },
  tocItemPage: {
    fontSize: LAYOUT.font.label,
    fontFamily: 'Helvetica',
    color: COLORS.offmarket.gold,
  },

  // CARDS or — LIGNE 3 cards côte à côte
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    marginTop: 30,
    paddingHorizontal: 10,
    gap: 10,
  },
  card: {
    flex: 1,
    minHeight: 95,
    backgroundColor: COLORS.offmarket.bgDeep,
    borderRadius: 6,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: COLORS.offmarket.gold,
  },
  cardNumber: {
    fontSize: LAYOUT.font.cardNumber,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.offmarket.gold,
    textAlign: 'center',
    marginBottom: 6,
  },
  cardLabel: {
    fontSize: LAYOUT.font.small,
    fontFamily: 'Helvetica',
    color: COLORS.offmarket.cream,
    textAlign: 'center',
    lineHeight: 1.3,
  },

  // DESCRIPTION
  descriptionBlock: {
    marginVertical: 16,
    paddingHorizontal: 20,
  },
  descriptionText: {
    fontSize: LAYOUT.font.body,
    fontFamily: 'Helvetica',
    color: COLORS.offmarket.cream,
    lineHeight: 1.6,
    textAlign: 'center',
  },

  // FINANCIER
  finTable: {
    marginTop: 24,
    marginHorizontal: 30,
    borderWidth: 0.5,
    borderColor: COLORS.offmarket.gold,
  },
  finRow: {
    flexDirection: 'row',
    minHeight: 50,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.offmarket.accentLine,
  },
  finRowLast: {
    flexDirection: 'row',
    minHeight: 50,
  },
  finLabel: {
    flex: 1.2,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: LAYOUT.font.body,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.offmarket.cream,
    borderRightWidth: 0.5,
    borderRightColor: COLORS.offmarket.gold,
    justifyContent: 'center',
  },
  finValue: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: LAYOUT.font.body,
    fontFamily: 'Helvetica',
    color: COLORS.offmarket.gold,
    textAlign: 'center',
    justifyContent: 'center',
  },

  // PHOTOS
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  photoCell: {
    width: '32%',
    marginBottom: 16,
  },
  photoImage: {
    width: '100%',
    height: 130,
    objectFit: 'cover',
    opacity: 0.92,
  },
  photoCaption: {
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Helvetica',
    color: COLORS.offmarket.cream,
    textAlign: 'center',
    marginTop: 6,
  },

  // ÉQUIPE
  teamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  teamMember: {
    width: '45%',
    alignItems: 'center',
    marginBottom: 32,
  },
  teamPhoto: {
    width: 110,
    height: 110,
    borderRadius: 55,
    objectFit: 'cover',
    marginBottom: 12,
  },
  teamName: {
    fontSize: LAYOUT.font.body,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.offmarket.gold,
    textAlign: 'center',
    marginBottom: 4,
  },
  teamRole: {
    fontSize: LAYOUT.font.small,
    fontFamily: 'Helvetica-Oblique',
    color: COLORS.offmarket.cream,
    textAlign: 'center',
    marginBottom: 4,
  },
  teamEmail: {
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Helvetica',
    color: COLORS.offmarket.muted,
    textAlign: 'center',
  },
  teamPhone: {
    fontSize: LAYOUT.font.tiny,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.offmarket.cream,
    textAlign: 'center',
    marginTop: 2,
  },
});

// ─────────────────────────────────────────────────────────────────
// HELPER : retourne le bon style sheet selon le mode
// ─────────────────────────────────────────────────────────────────

export function getStyles(isOffMarket) {
  return isOffMarket ? stylesOffMarket : stylesStandard;
}
