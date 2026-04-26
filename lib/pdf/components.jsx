// ═══════════════════════════════════════════════════════════════════
// lib/pdf/components.jsx — REFONTE Direction 1 v12.3
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';
import { getStyles } from './styles';
import {
  ensureAbsoluteUrl,
  safeText,
  formatPrix,
} from './helpers';

// ─────────────────────────────────────────────────────────────────
// HEADER de page (eyebrow + titre serif + numéro page)
// ─────────────────────────────────────────────────────────────────

export function PageHeader({ eyebrow, title, pageNumber, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  return (
    <View style={styles.pageHeader}>
      <View>
        {eyebrow && <Text style={styles.pageHeaderEyebrow}>{eyebrow}</Text>}
        <Text style={styles.pageHeaderTitle}>{title}</Text>
      </View>
      <Text style={styles.pageHeaderNumber}>{String(pageNumber).padStart(2, '0')}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// FOOTER de page
// ─────────────────────────────────────────────────────────────────

export function PageFooter({ conseiller, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  const c = conseiller || {};

  return (
    <View style={styles.pageFooter} fixed>
      <Text style={styles.footerConfidential}>
        {isOffMarket ? 'OFF-MARKET — DIFFUSION RESTREINTE' : 'Confidentiel et non contractuel'}
      </Text>

      <View>
        {c.full_name && (
          <Text style={styles.footerText}>
            {c.full_name}
            {c.tel ? ` · ${c.tel}` : ''}
            {c.email ? ` · ${c.email}` : ''}
          </Text>
        )}
        <Text style={styles.footerText}>
          IMMEUBLES & PATRIMOINE · 7 rue de Penthièvre, 75008 Paris
        </Text>
      </View>

      <Text style={styles.footerText}>www.immeubles-patrimoine.fr</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// COUVERTURE — refondue Direction 1
// ─────────────────────────────────────────────────────────────────

export function CoverContent({ mandat, conseiller, logoUrl, heroPhotoUrl, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  const c = conseiller || {};
  const heroUrl = heroPhotoUrl ? ensureAbsoluteUrl(heroPhotoUrl) : null;
  
  // Eyebrow : type de bien en majuscules
  const eyebrow = [
    mandat.is_off_market ? 'Off-market' : null,
    mandat?.type ? `${mandat.type} à vendre` : 'Bien à vendre',
  ].filter(Boolean).join(' · ');
  
  // Référence basée sur les 8 premiers caractères de l'id
  const reference = `Réf. ${(mandat?.id || '').slice(0, 8).toUpperCase()}`;

  return (
    <>
      {/* Top bar : logo + référence */}
      <View style={styles.coverTopBar}>
        {logoUrl ? (
          <Image src={logoUrl} style={styles.coverLogo} />
        ) : (
          <View style={{ height: 50, width: 50 }} />
        )}
        <View style={styles.coverReferenceBlock}>
          <Text style={styles.coverReferenceLabel}>Référence</Text>
          <Text style={styles.coverReferenceValue}>{reference}</Text>
        </View>
      </View>

      {/* Badge OFF-MARKET (uniquement en mode off-market) */}
      {isOffMarket && (
        <View style={styles.coverOffMarketBadge}>
          <Text style={styles.coverOffMarketText}>OFF-MARKET</Text>
          <Text style={styles.coverOffMarketSubtext}>
            Document confidentiel · Diffusion strictement restreinte
          </Text>
        </View>
      )}

      {/* Photo hero — domine la page */}
      {heroUrl ? (
        <Image src={heroUrl} style={styles.coverHero} />
      ) : (
        <View style={styles.coverHeroPlaceholder}>
          <Text style={styles.coverHeroPlaceholderText}>
            Photo principale à venir
          </Text>
        </View>
      )}

      {/* Bloc bas : titre + prix */}
      <View style={styles.coverBottomBlock}>
        <Text style={styles.coverEyebrow}>{eyebrow.toUpperCase()}</Text>
        <View style={styles.coverTitleRow}>
          <View style={styles.coverTitleLeft}>
            <Text style={styles.coverTitleText}>
              {safeText(mandat?.nom, 'Bien sans nom')}
            </Text>
            {mandat?.ville && (
              <Text style={styles.coverLocation}>
                {[mandat?.adresse, mandat?.ville].filter(Boolean).join(' · ').toUpperCase()}
              </Text>
            )}
          </View>
          {mandat?.prix && (
            <View style={styles.coverPriceBlock}>
              <Text style={styles.coverPriceLabel}>Prix de vente</Text>
              <Text style={styles.coverPriceValue}>
                {formatPrix(mandat.prix)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Bloc contact en bas */}
      <View style={styles.coverFooter}>
        <View style={styles.coverFooterBlock}>
          <Text style={styles.coverFooterLabel}>Contact agence</Text>
          <Text style={styles.coverFooterLine}>7 rue de Penthièvre · 75008 Paris</Text>
          <Text style={styles.coverFooterLine}>www.immeubles-patrimoine.fr</Text>
        </View>
        <View style={styles.coverFooterBlock}>
          <Text style={styles.coverFooterLabel}>Votre conseiller</Text>
          <Text style={styles.coverFooterName}>
            {safeText(c.full_name, 'À renseigner')}
          </Text>
          {c.tel && <Text style={styles.coverFooterLine}>{c.tel}</Text>}
          {c.email && <Text style={styles.coverFooterLine}>{c.email}</Text>}
        </View>
      </View>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// SOMMAIRE refondu (numéros romains italiques)
// ─────────────────────────────────────────────────────────────────

export function TableOfContents({ items, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  return (
    <View>
      <Text style={styles.tocEyebrow}>Sommaire</Text>
      <Text style={styles.tocTitle}>Présentation</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.tocItem}>
          <Text style={styles.tocItemNumber}>{romanize(i + 1)}.</Text>
          <Text style={styles.tocItemText}>{item.label}</Text>
          <Text style={styles.tocItemPage}>{item.page}</Text>
        </View>
      ))}
    </View>
  );
}

function romanize(n) {
  const lookup = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
  return Object.keys(lookup).find((k) => lookup[k] === n) || String(n);
}

// ─────────────────────────────────────────────────────────────────
// SECTION : eyebrow + titre serif + filet
// ─────────────────────────────────────────────────────────────────

export function Section({ eyebrow, title, children, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  return (
    <View style={{ marginBottom: 28 }}>
      {eyebrow && <Text style={styles.sectionEyebrow}>{eyebrow}</Text>}
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      <View style={styles.sectionRule} />
      <View>{children}</View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// HIGHLIGHTS — numérotés "01", "02"...
// ─────────────────────────────────────────────────────────────────

export function HighlightsList({ highlights, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  if (!highlights || !Array.isArray(highlights) || highlights.length === 0) {
    return (
      <Text style={{ ...styles.sectionContent, fontStyle: 'italic', color: '#76716A' }}>
        Aucun point fort renseigné
      </Text>
    );
  }

  return (
    <View>
      {highlights.map((h, i) => (
        <View key={i} style={styles.highlightItem}>
          <Text style={styles.highlightNumber}>{String(i + 1).padStart(2, '0')}</Text>
          <Text style={styles.highlightText}>{h}</Text>
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// LIGNE FINANCIÈRE clé/valeur
// ─────────────────────────────────────────────────────────────────

export function FinancialRow({ label, value, big = false, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  return (
    <View style={styles.finRow}>
      <Text style={styles.finLabel}>{label}</Text>
      <Text style={big ? styles.finValueBig : styles.finValue}>{value || '—'}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// KPI Card (rapport vendeur)
// ─────────────────────────────────────────────────────────────────

export function KpiCard({ label, value, unit, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value || '—'}</Text>
      {unit && <Text style={styles.kpiUnit}>{unit}</Text>}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// GRILLE PHOTOS (2 par ligne, photo plus grande)
// ─────────────────────────────────────────────────────────────────

export function PhotoGrid({ photos, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  if (!photos || photos.length === 0) {
    return (
      <Text style={{ ...styles.sectionContent, fontStyle: 'italic' }}>
        Aucune photo renseignée pour ce mandat
      </Text>
    );
  }
  return (
    <View style={styles.photoGrid}>
      {photos.map((photo, i) => (
        <View key={i} style={styles.photoCell}>
          <Image src={ensureAbsoluteUrl(photo)} style={styles.photoImage} />
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// PHOTO PLEINE LARGEUR (pour première page photos)
// ─────────────────────────────────────────────────────────────────

export function PhotoFull({ photo, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  if (!photo) return null;
  return (
    <View style={styles.photoCellTall}>
      <Image src={ensureAbsoluteUrl(photo)} style={styles.photoImage} />
    </View>
  );
}
