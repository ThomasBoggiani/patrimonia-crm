// ═══════════════════════════════════════════════════════════════════
// lib/pdf/components.jsx
// Composants partagés entre les 3 templates PDF
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';
import { getStyles } from './styles';
import {
  buildTitleCommercial,
  ensureAbsoluteUrl,
  safeText,
} from './helpers';

// ─────────────────────────────────────────────────────────────────
// HEADER de page (titre section + numéro)
// Reproduit le header de la plaquette existante
// ─────────────────────────────────────────────────────────────────

export function PageHeader({ title, pageNumber, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  return (
    <View style={styles.pageHeader}>
      <View style={{ width: 24 }} />
      <Text style={styles.pageHeaderTitle}>{title}</Text>
      <Text style={styles.pageHeaderNumber}>{pageNumber}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// FOOTER de page (conseiller + agence + site + mention)
// ─────────────────────────────────────────────────────────────────

export function PageFooter({ conseiller, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  const c = conseiller || {};

  return (
    <View style={styles.pageFooter} fixed>
      <Text style={styles.footerConfidential}>
        {isOffMarket ? 'OFF-MARKET — DIFFUSION RESTREINTE' : 'Confidentiel et non contractuel'}
      </Text>

      <View style={styles.footerLeft || {}}>
        {c.full_name && (
          <Text style={styles.footerText}>
            {c.full_name}
            {c.tel ? ` — ${c.tel}` : ''}
            {c.email ? ` — ${c.email}` : ''}
          </Text>
        )}
        <Text style={styles.footerText}>Immeubles & Patrimoine</Text>
        <Text style={styles.footerText}>
          7 rue de Penthièvre, 75008 Paris
        </Text>
      </View>

      <View style={styles.footerRight || {}}>
        <Text style={styles.footerText}>www.immeubles-patrimoine.fr</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// COUVERTURE — Reproduction fidèle de la plaquette existante
// ─────────────────────────────────────────────────────────────────

export function CoverContent({ mandat, conseiller, logoUrl, heroPhotoUrl, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  const titre = buildTitleCommercial(mandat);
  const c = conseiller || {};
  const heroUrl = heroPhotoUrl ? ensureAbsoluteUrl(heroPhotoUrl) : null;

  return (
    <>
      {/* Logo centré en haut */}
      <View style={styles.coverLogoContainer}>
        {logoUrl ? (
          <Image src={logoUrl} style={styles.coverLogo} />
        ) : (
          <View style={{ height: 140, width: 140 }} />
        )}
      </View>

      {/* Badge OFF-MARKET (uniquement en mode off-market) */}
      {isOffMarket && (
        <View style={styles.coverOffMarketBadge}>
          <Text style={styles.coverOffMarketText}>OFF-MARKET</Text>
          <Text style={styles.coverOffMarketSubtext}>
            Document confidentiel — Diffusion strictement restreinte
          </Text>
        </View>
      )}

      {/* Photo principale */}
      {heroUrl ? (
        <Image src={heroUrl} style={styles.coverHero} />
      ) : (
        <View style={styles.coverHeroPlaceholder}>
          <Text style={styles.coverHeroPlaceholderText}>
            (Aucune photo principale renseignée)
          </Text>
        </View>
      )}

      {/* Bandeau titre */}
      <View style={styles.coverTitleBand}>
        <Text style={styles.coverTitleText}>{titre}</Text>
      </View>

      {/* Bloc contact (agence + conseiller) */}
      <View style={styles.coverContact}>
        <View style={styles.coverContactBlock}>
          <Text style={styles.coverContactLabel}>Immeubles & Patrimoine</Text>
          <Text style={styles.coverContactLine}>7 rue de Penthièvre</Text>
          <Text style={styles.coverContactLine}>75008 PARIS</Text>
          <Text style={styles.coverContactLine}>www.immeubles-patrimoine.fr</Text>
        </View>

        <View style={styles.coverContactBlock}>
          <Text style={styles.coverContactLabel}>Votre conseiller</Text>
          <Text style={[styles.coverContactLine, { fontFamily: 'Helvetica-Bold' }]}>
            {safeText(c.full_name, 'À renseigner')}
          </Text>
          {c.email && <Text style={styles.coverContactLine}>{c.email}</Text>}
          {c.tel && <Text style={styles.coverContactLine}>{c.tel}</Text>}
        </View>
      </View>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// SOMMAIRE
// ─────────────────────────────────────────────────────────────────

export function TableOfContents({ items, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  return (
    <View>
      <Text style={styles.tocTitle}>Sommaire</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.tocItem}>
          <Text style={styles.tocItemText}>{item.label}</Text>
          <Text style={styles.tocItemNumber}>{item.page}</Text>
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// SECTION TITRE + CONTENU
// ─────────────────────────────────────────────────────────────────

export function Section({ label, children, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
      <View>{children}</View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// LISTE DE HIGHLIGHTS ("Nous aimons")
// ─────────────────────────────────────────────────────────────────

export function HighlightsList({ highlights, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  if (!highlights || !Array.isArray(highlights) || highlights.length === 0) {
    return (
      <Text style={{ ...styles.sectionContent, fontStyle: 'italic', color: styles.kpiLabel.color }}>
        (Aucun point fort renseigné)
      </Text>
    );
  }

  return (
    <View>
      {highlights.map((h, i) => (
        <View key={i} style={styles.highlightItem}>
          <Text style={styles.highlightDash}>—</Text>
          <Text style={styles.highlightText}>{h}</Text>
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// LIGNE FINANCIÈRE clé/valeur
// ─────────────────────────────────────────────────────────────────

export function FinancialRow({ label, value, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  return (
    <View style={styles.finRow}>
      <Text style={styles.finLabel}>{label}</Text>
      <Text style={styles.finValue}>{value || '—'}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// KPI Card (rapport vendeur, fiche interne)
// ─────────────────────────────────────────────────────────────────

export function KpiCard({ label, value, unit, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.kpiValue}>{value || '—'}</Text>
      {unit && <Text style={styles.kpiUnit}>{unit}</Text>}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// GRILLE DE PHOTOS
// ─────────────────────────────────────────────────────────────────

export function PhotoGrid({ photos, isOffMarket }) {
  const styles = getStyles(isOffMarket);
  if (!photos || photos.length === 0) {
    return (
      <Text style={{ ...styles.sectionContent, fontStyle: 'italic' }}>
        (Aucune photo renseignée pour ce mandat)
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
