// ═══════════════════════════════════════════════════════════════════
// lib/pdf/components.jsx — Composants partagés "Template I&P" v13.0
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';
import { getStyles, COLORS } from './styles';

// ─────────────────────────────────────────────────────────────────
// PageLogo — Logo centré en haut de chaque page
// ─────────────────────────────────────────────────────────────────
export function PageLogo({ logoUrl, isOffMarket }) {
  // Fallback : si pas de logoUrl, on utilise l'URL en dur
  const finalUrl = logoUrl || 'https://patrimonia-crm.vercel.app/logo-ip-sage.png';
  return (
    <Image 
      src={finalUrl} 
      style={{ 
        width: 75, 
        height: 75, 
        objectFit: 'contain', 
        alignSelf: 'center', 
        marginBottom: 16 
      }} 
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// SectionTitle — Titre de section sage centré
// ─────────────────────────────────────────────────────────────────
export function SectionTitle({ title, subtitle, multiLine, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  const lines = multiLine ? title.split('\n') : [title];
  return (
    <>
      <Text style={multiLine ? styles.sectionTitleMulti : styles.sectionTitle}>
        {title}
      </Text>
      {subtitle && (
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// PageFooter — Bandeau sage en bas avec coords + n° page
// ─────────────────────────────────────────────────────────────────
export function PageFooter({ pageNumber, isOffMarket, showConfidential = true }) {
  const styles = getStyles(isOffMarket);
  return (
    <>
      {showConfidential && (
        <Text style={styles.confidentialNote}>
          {isOffMarket ? 'OFF-MARKET — DIFFUSION RESTREINTE' : 'Confidentiel et non contractuel'}
        </Text>
      )}
      <View style={styles.pageFooter} fixed>
        <View style={styles.footerLeft}>
          <Text style={styles.footerCompany}>Immeubles & Patrimoine</Text>
          <Text style={styles.footerAddress}>7 rue de Penthièvre 75008 Paris</Text>
          <Text style={styles.footerContact}>06 84 40 81 09  •  www.immeubles-patrimoine.fr</Text>
        </View>
        {pageNumber && (
          <Text style={styles.footerPageNumber}>{pageNumber}</Text>
        )}
      </View>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Card — Carte sage avec chiffre + label (chiffres clés du bien)
// ─────────────────────────────────────────────────────────────────
export function Card({ number, label, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  return (
    <View style={styles.card}>
      <Text style={styles.cardNumber}>{number}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// CardsRow — Conteneur pour aligner plusieurs cards
// ─────────────────────────────────────────────────────────────────
export function CardsRow({ children, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  return (
    <View style={styles.cardsContainer}>
      {children}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// FinancialTable — Tableau financier (3 colonnes labels/valeurs)
// ─────────────────────────────────────────────────────────────────
export function FinancialTable({ rows, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  return (
    <View style={styles.finTable}>
      {rows.map((row, i) => {
        const isLast = i === rows.length - 1;
        return (
          <View key={i} style={isLast ? styles.finRowLast : styles.finRow}>
            <Text style={styles.finLabel}>{row.label}</Text>
            <Text style={styles.finValue}>{row.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// PhotoGrid — Grille 3×2 photos avec légendes
// ─────────────────────────────────────────────────────────────────
export function PhotoGrid({ photos, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  return (
    <View style={styles.photoGrid}>
      {photos.map((photo, i) => (
        <View key={i} style={styles.photoCell}>
          {photo.url ? (
            <Image src={photo.url} style={styles.photoImage} />
          ) : (
            <View style={[styles.photoImage, { justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ fontSize: 8, color: '#999' }}>—</Text>
            </View>
          )}
          {photo.caption && (
            <Text style={styles.photoCaption}>{photo.caption}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// TeamMember — Portrait équipe avec coordonnées
// Si photoUrl manquante : placeholder rond sage avec initiales
// Si large=true : portrait plus gros (pour le boss au centre)
// ─────────────────────────────────────────────────────────────────
export function TeamMember({ photoUrl, name, role, email, phone, large, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  const initials = (name || '?')
    .split(' ')
    .map(s => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const photoSize = large ? 140 : 110;
  const photoStyle = {
    width: photoSize,
    height: photoSize,
    borderRadius: photoSize / 2,
    objectFit: 'cover',
    marginBottom: 12,
  };
  const placeholderStyle = {
    ...photoStyle,
    backgroundColor: isOffMarket ? COLORS.offmarket.bgDeep : COLORS.standard.sage,
    borderWidth: isOffMarket ? 2 : 0,
    borderColor: isOffMarket ? COLORS.offmarket.gold : 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  };
  const initialsStyle = {
    fontSize: large ? 42 : 32,
    fontFamily: 'Helvetica-Bold',
    color: isOffMarket ? COLORS.offmarket.gold : COLORS.standard.white,
    letterSpacing: 2,
  };

  return (
    <View style={styles.teamMember}>
      {photoUrl ? (
        <Image src={photoUrl} style={photoStyle} />
      ) : (
        <View style={placeholderStyle}>
          <Text style={initialsStyle}>{initials}</Text>
        </View>
      )}
      <Text style={styles.teamName}>{name}</Text>
      <Text style={styles.teamRole}>{role}</Text>
      {email && <Text style={styles.teamEmail}>{email}</Text>}
      {phone && <Text style={styles.teamPhone}>{phone}</Text>}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// TableOfContents — Page sommaire
// ─────────────────────────────────────────────────────────────────
export function TableOfContents({ items, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={styles.tocItem}>
          <Text style={styles.tocItemNumber}>{i + 1}</Text>
          <Text style={styles.tocItemSeparator}>—</Text>
          <Text style={styles.tocItemLabel}>{item.label}</Text>
          <Text style={styles.tocItemPage}>{item.page}</Text>
        </View>
      ))}
    </View>
  );
}
