// ═══════════════════════════════════════════════════════════════════
// lib/pdf/templates/FicheInterne.jsx — v2.0 Template I&P
//
// Fiche signalétique INTERNE complète — pour usage équipe.
// Affiche TOUTES les infos disponibles (publiques + confidentielles).
// Intelligence d'affichage : un champ vide est simplement masqué.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { getStyles, COLORS, LAYOUT } from '../styles';
import { PageLogo, SectionTitle, PageFooter } from '../components';
import {
  formatPrix,
  formatPrixM2,
  formatSurface,
  formatRendement,
  safeText,
  normalizePhotos,
} from '../helpers';
import { LOGO_IP_BASE64 } from '../logo-base64';

// ─────────────────────────────────────────────────────────────────
// Helpers locaux
// ─────────────────────────────────────────────────────────────────
function formatDateFR(d) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  } catch { return null; }
}

function formatNum(n, suffix = '') {
  if (n === null || n === undefined || n === '') return null;
  const num = parseFloat(n);
  if (isNaN(num)) return null;
  return num.toLocaleString('fr-FR').replace(/[\u00A0\u202F]/g, ' ') + suffix;
}

// Calcul de la classe DPE (A à G) selon consommation kWh/m²/an
function getDPELabel(conso) {
  if (!conso) return null;
  const c = parseFloat(conso);
  if (c <= 70) return 'A';
  if (c <= 110) return 'B';
  if (c <= 180) return 'C';
  if (c <= 250) return 'D';
  if (c <= 330) return 'E';
  if (c <= 420) return 'F';
  return 'G';
}
function getGESLabel(emis) {
  if (!emis) return null;
  const e = parseFloat(emis);
  if (e <= 6) return 'A';
  if (e <= 11) return 'B';
  if (e <= 30) return 'C';
  if (e <= 50) return 'D';
  if (e <= 70) return 'E';
  if (e <= 100) return 'F';
  return 'G';
}

// ─────────────────────────────────────────────────────────────────
// Composants réutilisables
// ─────────────────────────────────────────────────────────────────
function FieldRow({ label, value, palette }) {
  if (value === null || value === undefined || value === '' || value === false) return null;
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.3, borderBottomColor: palette.muted || '#CCC' }}>
      <Text style={{ width: '40%', fontSize: 9, color: palette.muted || '#666', fontFamily: 'Helvetica' }}>
        {label}
      </Text>
      <Text style={{ flex: 1, fontSize: 9, fontFamily: 'Helvetica-Bold', color: palette.text || '#222' }}>
        {String(value)}
      </Text>
    </View>
  );
}

function SubsectionTitle({ title, palette }) {
  return (
    <Text style={{
      fontSize: 10,
      fontFamily: 'Helvetica-Bold',
      color: palette.accent || '#9CAF88',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginTop: 12,
      marginBottom: 6,
    }}>
      {title}
    </Text>
  );
}

function ConfidentialBadge({ palette }) {
  return (
    <View style={{
      position: 'absolute',
      top: 8,
      right: 40,
      paddingVertical: 3,
      paddingHorizontal: 8,
      backgroundColor: '#C0392B',
    }}>
      <Text style={{ color: '#FFFFFF', fontSize: 8, fontFamily: 'Helvetica-Bold' }}>
        USAGE INTERNE
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────
export default function FicheInterne({ mandat, conseiller, logoUrl }) {
  const isOffMarket = mandat?.is_off_market === true;
  const styles = getStyles(isOffMarket);
  const palette = isOffMarket ? COLORS.offmarket : COLORS.standard;

  const photos = normalizePhotos(mandat?.photos);
  const heroPhoto = photos[0] || null;

  // Mandat info
  const mandatType = mandat?.mandat_type || null;
  const mandatNumero = mandat?.mandat_numero || null;
  const mandatDateSignature = formatDateFR(mandat?.date_signature);
  const mandatDateEcheance = formatDateFR(mandat?.mandat_date_echeance);
  const today = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  // Visite virtuelle
  const visiteVirtuelle = mandat?.visite_info?.url || mandat?.visite_info?.lien || null;

  // Mandant
  const mandantNom = mandat?.mandant_info?.nom || mandat?.contact || null;
  const mandantTel = mandat?.mandant_info?.tel || mandat?.tel || null;
  const mandantEmail = mandat?.mandant_info?.email || null;

  // DPE
  const dpeConso = mandat?.dpe_consommation;
  const dpeEmis = mandat?.dpe_emissions;
  const dpeClasse = getDPELabel(dpeConso);
  const gesClasse = getGESLabel(dpeEmis);
  const dpeDate = formatDateFR(mandat?.dpe_date);

  // Highlights "Nous aimons"
  const highlights = Array.isArray(mandat?.highlights)
    ? mandat.highlights
    : (mandat?.highlights?.list || []);

  return (
    <Document
      title={`Fiche interne — ${safeText(mandat?.nom, 'Mandat')}`}
      author="Immeubles & Patrimoine"
      subject="Fiche interne"
    >
      {/* ═══════════════════════════════════════ */}
      {/* PAGE 1 : EN-TÊTE + IDENTITÉ + MANDAT    */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <ConfidentialBadge palette={palette} />
        <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
        <SectionTitle title="FICHE INTERNE" isOffMarket={isOffMarket} />

        <Text style={{
          fontSize: 9,
          color: palette.muted || '#666',
          textAlign: 'center',
          fontFamily: 'Helvetica-Oblique',
          marginBottom: 20,
        }}>
          Document à usage strictement interne — édité le {today}
        </Text>

        {/* En-tête : photo + nom + prix */}
        <View style={{ flexDirection: 'row', marginBottom: 20, paddingHorizontal: 20 }}>
          {heroPhoto && (
            <Image src={heroPhoto} style={{
              width: 130,
              height: 100,
              objectFit: 'cover',
              marginRight: 16,
            }} />
          )}
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{
              fontSize: 14,
              fontFamily: 'Helvetica-Bold',
              color: palette.text || '#222',
              marginBottom: 4,
            }}>
              {safeText(mandat?.nom, 'Mandat')}
            </Text>
            <Text style={{ fontSize: 10, color: palette.muted, marginBottom: 4 }}>
              {[
                safeText(mandat?.adresse, ''),
                safeText(mandat?.ville, ''),
              ].filter(Boolean).join(' — ')}
            </Text>
            <Text style={{
              fontSize: 16,
              fontFamily: 'Helvetica-Bold',
              color: palette.accent || '#9CAF88',
            }}>
              {formatPrix(mandat?.prix || 0)}
              {mandat?.surface ? ` (${formatPrixM2(mandat?.prix, mandat.surface)})` : ''}
            </Text>
          </View>
        </View>

        {/* IDENTITÉ DU BIEN */}
        <View style={{ paddingHorizontal: 20 }}>
          <SubsectionTitle title="Identité du bien" palette={palette} />
          <FieldRow label="Type" value={mandat?.type} palette={palette} />
          <FieldRow label="Sous-type" value={mandat?.sous_type} palette={palette} />
          <FieldRow label="Surface habitable" value={mandat?.surface ? formatSurface(mandat.surface) : null} palette={palette} />
          <FieldRow label="Nombre de pièces" value={mandat?.nb_pieces} palette={palette} />
          <FieldRow label="Nombre de chambres" value={mandat?.nb_chambres} palette={palette} />
          <FieldRow label="Étage" value={mandat?.etage} palette={palette} />
          <FieldRow label="Année de construction" value={mandat?.annee_construction} palette={palette} />
          <FieldRow label="Adresse" value={mandat?.adresse} palette={palette} />
          <FieldRow label="Ville" value={mandat?.ville} palette={palette} />
          <FieldRow label="Off-market" value={isOffMarket ? 'OUI' : null} palette={palette} />

          <SubsectionTitle title="Mandat" palette={palette} />
          <FieldRow label="Type de mandat" value={mandatType} palette={palette} />
          <FieldRow label="Numéro de mandat" value={mandatNumero} palette={palette} />
          <FieldRow label="Date de signature" value={mandatDateSignature} palette={palette} />
          <FieldRow label="Date d'échéance" value={mandatDateEcheance} palette={palette} />
          <FieldRow label="Statut" value={mandat?.statut} palette={palette} />
          <FieldRow label="Commercialisation" value={mandat?.commercialisation} palette={palette} />
          <FieldRow label="Négociateur" value={conseiller?.full_name || conseiller?.name} palette={palette} />

          <SubsectionTitle title="Mandant (propriétaire)" palette={palette} />
          <FieldRow label="Nom" value={mandantNom} palette={palette} />
          <FieldRow label="Téléphone" value={mandantTel} palette={palette} />
          <FieldRow label="Email" value={mandantEmail} palette={palette} />
        </View>

        <PageFooter isOffMarket={isOffMarket} />
      </Page>

      {/* ═══════════════════════════════════════ */}
      {/* PAGE 2 : INFORMATIONS FINANCIÈRES        */}
      {/* + COPROPRIÉTÉ + CHARGES + DPE            */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <ConfidentialBadge palette={palette} />
        <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
        <SectionTitle title="INFORMATIONS FINANCIÈRES" isOffMarket={isOffMarket} />

        <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
          <SubsectionTitle title="Prix" palette={palette} />
          <FieldRow label="Prix de vente honoraires inclus" value={formatPrix(mandat?.prix || 0)} palette={palette} />
          <FieldRow label="Prix net vendeur" value={mandat?.prix_net_vendeur ? formatPrix(mandat.prix_net_vendeur) : null} palette={palette} />
          <FieldRow label="Prix au m²" value={mandat?.surface && mandat?.prix ? formatPrixM2(mandat.prix, mandat.surface) : null} palette={palette} />
          <FieldRow label="Prix au m² (saisi)" value={mandat?.prix_m2 ? formatPrix(mandat.prix_m2) + '/m²' : null} palette={palette} />

          <SubsectionTitle title="Honoraires" palette={palette} />
          <FieldRow label="Honoraires à charge" value={mandat?.honoraires_charge} palette={palette} />
          <FieldRow label="Taux honoraires TTC" value={mandat?.honoraires_taux ? mandat.honoraires_taux + ' %' : null} palette={palette} />
          <FieldRow label="Montant honoraires TTC" value={mandat?.honoraires_montant ? formatPrix(mandat.honoraires_montant) : null} palette={palette} />

          <SubsectionTitle title="Investissement locatif" palette={palette} />
          <FieldRow label="Loyers annuels HT/HC" value={mandat?.loyers_annuels ? formatPrix(mandat.loyers_annuels) : null} palette={palette} />
          <FieldRow label="Rendement" value={mandat?.rendement ? mandat.rendement + ' %' : null} palette={palette} />

          <SubsectionTitle title="Copropriété" palette={palette} />
          <FieldRow label="Statut copropriété" value={mandat?.statut_copropriete} palette={palette} />
          <FieldRow label="Nombre de lots" value={mandat?.nb_lots} palette={palette} />
          <FieldRow label="Charges courantes annuelles" value={mandat?.charges_annuelles ? formatPrix(mandat.charges_annuelles) + ' / an' : null} palette={palette} />

          <SubsectionTitle title="Fiscalité" palette={palette} />
          <FieldRow label="Taxe foncière" value={mandat?.taxe_fonciere ? formatPrix(mandat.taxe_fonciere) : null} palette={palette} />

          <SubsectionTitle title="Performance énergétique (DPE)" palette={palette} />
          <FieldRow label="Date du DPE" value={dpeDate} palette={palette} />
          <FieldRow label="Consommation énergétique" value={dpeConso ? `${dpeConso} kWhEP/m²/an` : null} palette={palette} />
          <FieldRow label="Classe énergie" value={dpeClasse} palette={palette} />
          <FieldRow label="Émissions GES" value={dpeEmis ? `${dpeEmis} kgCO2/m²/an` : null} palette={palette} />
          <FieldRow label="Classe GES" value={gesClasse} palette={palette} />
        </View>

        <PageFooter isOffMarket={isOffMarket} />
      </Page>

      {/* ═══════════════════════════════════════ */}
      {/* PAGE 3 : DESCRIPTIF + HIGHLIGHTS         */}
      {/* + VISITE VIRTUELLE                       */}
      {/* ═══════════════════════════════════════ */}
      {(mandat?.description || highlights.length > 0 || visiteVirtuelle) && (
        <Page size="A4" style={styles.page}>
          <ConfidentialBadge palette={palette} />
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle title="DESCRIPTIF" isOffMarket={isOffMarket} />

          <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
            {mandat?.description && (
              <>
                <SubsectionTitle title="Texte de l'annonce" palette={palette} />
                <Text style={{
                  fontSize: 9,
                  color: palette.text || '#333',
                  lineHeight: 1.5,
                  textAlign: 'justify',
                  marginBottom: 8,
                }}>
                  {mandat.description}
                </Text>
              </>
            )}

            {highlights.length > 0 && (
              <>
                <SubsectionTitle title="Nous aimons" palette={palette} />
                {highlights.map((h, i) => (
                  <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
                    <Text style={{
                      fontSize: 10,
                      color: palette.accent || '#9CAF88',
                      marginRight: 8,
                    }}>•</Text>
                    <Text style={{ flex: 1, fontSize: 9, color: palette.text || '#333' }}>
                      {typeof h === 'string' ? h : (h.label || h.text || JSON.stringify(h))}
                    </Text>
                  </View>
                ))}
              </>
            )}

            {visiteVirtuelle && (
              <>
                <SubsectionTitle title="Visite virtuelle" palette={palette} />
                <Text style={{ fontSize: 9, color: palette.text || '#333', marginBottom: 4 }}>
                  Lien : {visiteVirtuelle}
                </Text>
              </>
            )}
          </View>

          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* PAGE 4 : ALERTES + MÉTADONNÉES SYSTÈME   */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <ConfidentialBadge palette={palette} />
        <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
        <SectionTitle title="SUIVI & ALERTES" isOffMarket={isOffMarket} />

        <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
          {/* ALERTES */}
          {Array.isArray(mandat?.alerts) && mandat.alerts.length > 0 ? (
            <>
              <SubsectionTitle title="Alertes en cours" palette={palette} />
              {mandat.alerts.map((a, i) => (
                <View key={i} style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  marginBottom: 6,
                  backgroundColor: '#FFF3CD',
                  borderLeftWidth: 3,
                  borderLeftColor: '#856404',
                }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#856404' }}>
                    {a.type || 'Alerte'}
                  </Text>
                  {a.message && (
                    <Text style={{ fontSize: 9, color: '#333', marginTop: 2 }}>
                      {a.message}
                    </Text>
                  )}
                </View>
              ))}
            </>
          ) : (
            <Text style={{ fontSize: 9, color: palette.muted || '#999', fontStyle: 'italic' }}>
              Aucune alerte en cours.
            </Text>
          )}

          {/* DOCUMENTS LIÉS */}
          <SubsectionTitle title="Documents liés" palette={palette} />
          {Array.isArray(mandat?.docs) && mandat.docs.length > 0 ? (
            mandat.docs.map((d, i) => (
              <FieldRow
                key={i}
                label={d.type || `Document ${i + 1}`}
                value={d.nom || d.name || d.url || '—'}
                palette={palette}
              />
            ))
          ) : (
            <Text style={{ fontSize: 9, color: palette.muted || '#999', fontStyle: 'italic' }}>
              Aucun document attaché à ce mandat.
            </Text>
          )}

          {/* MÉTADONNÉES SYSTÈME */}
          <SubsectionTitle title="Métadonnées système" palette={palette} />
          <FieldRow label="ID mandat" value={mandat?.id} palette={palette} />
          <FieldRow label="Créé le" value={formatDateFR(mandat?.created_at)} palette={palette} />
          <FieldRow label="Mis à jour le" value={formatDateFR(mandat?.updated_at)} palette={palette} />
          <FieldRow label="Nombre de photos" value={photos.length} palette={palette} />
        </View>

        <PageFooter isOffMarket={isOffMarket} />
      </Page>
    </Document>
  );
}
