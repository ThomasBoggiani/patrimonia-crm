// ═══════════════════════════════════════════════════════════════════
// lib/pdf/templates/PlaquetteAcheteur.jsx — REFONTE Template I&P v13.0
// 
// Direction : Template officiel Immeubles & Patrimoine
// Format : Portrait A4
// Pages dynamiques selon données disponibles :
//   1. Couverture (toujours)
//   2. Sommaire (toujours)
//   3. Le bien — description + 4 cards sage (toujours)
//   4. Situation & Transports (si carte fournie)
//   5. Vue aérienne (si fournie)
//   6. Cadastre (si plan fourni)
//   7. État locatif (si infos)
//   8. Informations financières (toujours)
//   9. Photos (si photos)
//   10. Plans (si fournis)
//   11. Notre équipe (toujours, dynamique : boss + détenteur + expéditeur)
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { getStyles, COLORS, LAYOUT } from '../styles';
import {
  PageLogo,
  SectionTitle,
  PageFooter,
  Card,
  CardsRow,
  FinancialTable,
  PhotoGrid,
  TeamMember,
  TableOfContents,
} from '../components';
import {
  formatPrix,
  formatPrixM2,
  formatSurface,
  formatRendement,
  safeText,
  normalizePhotos,
  chunkPhotos,
  ensureAbsoluteUrl,
} from '../helpers';

// ─────────────────────────────────────────────────────────────────
// Construction de l'équipe affichée — DYNAMIQUE
// 3 personnes max : Boss (Thomas Ezquerra) + Détenteur mandat + Expéditeur
// Déduplication automatique si même personne
// ─────────────────────────────────────────────────────────────────
function buildTeamForPlaquette({ mandat, sender, allMembers }) {
  // allMembers est un dictionnaire : { 'TE': {name, role, email, phone, photo}, 'TB': ..., 'LH': ..., etc. }
  // Le BOSS est toujours Thomas Ezquerra (initiales 'TE')
  const BOSS_INITIALS = 'TE';
  const ownerInitials = (mandat?.owner || '').toUpperCase();
  const senderInitials = (sender?.initiales || sender?.initials || '').toUpperCase();

  const boss = allMembers[BOSS_INITIALS];
  const owner = allMembers[ownerInitials];
  const sndr = allMembers[senderInitials];

  // Déduplication : on garde l'ordre Boss > Owner > Sender
  // Mais on n'affiche pas une personne 2 fois
  const seen = new Set();
  const team = [];

  // Boss au centre (toujours en premier dans l'array, pour le placement)
  if (boss) {
    team.push({ ...boss, position: 'center', isBoss: true });
    seen.add(BOSS_INITIALS);
  }

  // Détenteur du mandat (à gauche)
  if (owner && !seen.has(ownerInitials)) {
    team.push({ ...owner, position: 'left', label: 'Détenteur du mandat' });
    seen.add(ownerInitials);
  }

  // Expéditeur (à droite)
  if (sndr && !seen.has(senderInitials)) {
    team.push({ ...sndr, position: 'right', label: 'Votre interlocuteur' });
    seen.add(senderInitials);
  }

  return team;
}

export default function PlaquetteAcheteur({
  mandat,
  conseiller,         // Le commercial qui envoie : { initiales, name, role, email, phone, photo }
  logoUrl,
  teamMembers,        // Dictionnaire complet : { 'TE': {...}, 'TB': {...}, 'LH': {...}, 'PK': {...} }
}) {
  const isOffMarket = mandat?.is_off_market === true;
  const styles = getStyles(isOffMarket);
  const palette = isOffMarket ? COLORS.offmarket : COLORS.standard;

  const photos = normalizePhotos(mandat?.photos);
  const photoChunks = chunkPhotos(photos, 6); // 6 photos par page (3×2)
  
  // Détection des sections optionnelles
  const hasMapImage = !!mandat?.map_image_url;
  const hasAerialImage = !!mandat?.aerial_image_url;
  const hasCadastreImage = !!mandat?.cadastre_image_url;
  const hasEtatLocatif = mandat?.etat_locatif && Array.isArray(mandat.etat_locatif) && mandat.etat_locatif.length > 0;
  const hasPlans = mandat?.plans && Array.isArray(mandat.plans) && mandat.plans.length > 0;
  const hasPhotos = photos.length > 0;
  
  // Construction du sommaire dynamique
  const tocItems = [];
  let p = 3; // page 1 = cover, 2 = sommaire, 3 = première section
  tocItems.push({ label: 'LE BIEN', page: `P. ${p++}` });
  if (hasMapImage) tocItems.push({ label: 'SITUATION & TRANSPORTS', page: `P. ${p++}` });
  if (hasAerialImage) tocItems.push({ label: 'VUE AÉRIENNE ET SATELLITE', page: `P. ${p++}` });
  if (hasCadastreImage) tocItems.push({ label: 'CADASTRE', page: `P. ${p++}` });
  if (hasEtatLocatif) tocItems.push({ label: 'ETAT LOCATIF', page: `P. ${p++}` });
  tocItems.push({ label: 'INFORMATIONS FINANCIÈRES', page: `P. ${p++}` });
  if (hasPhotos) {
    tocItems.push({ label: 'PHOTOS', page: `P. ${p}` });
    p += photoChunks.length;
  }
  if (hasPlans) {
    tocItems.push({ label: 'PLANS', page: `P. ${p}` });
    p += mandat.plans.length;
  }
  tocItems.push({ label: 'NOTRE EQUIPE', page: `P. ${p++}` });

  // Construction de l'équipe pour la page de fin
  const team = buildTeamForPlaquette({
    mandat,
    sender: conseiller,
    allMembers: teamMembers || {},
  });

  // ───── Préparation des chiffres clés (Page "LE BIEN") ─────
  const cards = [];
  if (mandat?.surface) {
    cards.push({ number: parseFloat(mandat.surface).toLocaleString('fr-FR'), label: 'Surface (m²)' });
  }
  if (mandat?.nb_lots && parseInt(mandat.nb_lots) > 0) {
    cards.push({ number: mandat.nb_lots, label: parseInt(mandat.nb_lots) > 1 ? 'Lots' : 'Lot' });
  }
  if (mandat?.type) {
    // Card "Type" : on affiche par exemple "MIXTE" ou "STUDIO"
    cards.push({ number: mandat.type.toUpperCase().substring(0, 14), label: 'Type' });
  }
  if (mandat?.rendement && parseFloat(mandat.rendement) > 0) {
    cards.push({ number: `${parseFloat(mandat.rendement).toFixed(1).replace('.', ',')}%`, label: 'Rendement' });
  }

  // ───── Données financières ─────
  const honoraires = mandat?.honoraires_charge && mandat?.honoraires_montant
    ? mandat.honoraires_montant
    : null;
  const prixNet = mandat?.prix || 0;
  const prixTotal = honoraires ? prixNet + parseFloat(honoraires) : prixNet;

  const finRows = [
    { label: 'Prix net vendeur', value: formatPrix(prixNet) },
  ];
  if (honoraires && mandat?.honoraires_taux) {
    finRows.push({
      label: `Honoraires TTC (${mandat.honoraires_taux}%)`,
      value: formatPrix(honoraires),
    });
    finRows.push({
      label: 'Prix frais d\'agence inclus',
      value: formatPrix(prixTotal),
    });
  } else if (mandat?.honoraires_charge) {
    finRows.push({
      label: 'Honoraires',
      value: safeText(mandat.honoraires_charge, "À la charge de l'acquéreur"),
    });
  }
  if (mandat?.surface && prixNet > 0) {
    finRows.push({ label: 'Prix au m²', value: formatPrixM2(prixNet, mandat.surface) });
  }
  if (mandat?.loyersAnnuels || mandat?.loyers_annuels) {
    const loyers = mandat.loyersAnnuels || mandat.loyers_annuels;
    finRows.push({ label: 'Loyers annuels HT/HC', value: formatPrix(loyers) });
  }

  // ───── Description du bien ─────
  const description = safeText(mandat?.description, '');

  return (
    <Document
      title={`Plaquette acheteur — ${safeText(mandat?.nom, 'Mandat')}`}
      author="Immeubles & Patrimoine"
      subject="Plaquette de présentation"
    >
      {/* ═══════════════════════════════════════ */}
      {/* PAGE 1 : COUVERTURE                     */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.coverPage}>
        {logoUrl && <Image src={logoUrl} style={styles.coverLogoLarge} />}
        
        {photos[0] ? (
          <Image src={photos[0]} style={styles.coverPhoto} />
        ) : (
          <View style={styles.coverPhotoPlaceholder}>
            <Text style={{ fontSize: 12, color: palette.muted, fontFamily: 'Helvetica-Oblique' }}>
              Photo principale du bien
            </Text>
          </View>
        )}

        <View style={styles.coverTitleBlock}>
          <Text style={styles.coverTitle}>
            {safeText(mandat?.nom, 'BIEN À DÉCOUVRIR').toUpperCase()}
          </Text>
          <Text style={styles.coverCity}>
            {safeText(mandat?.ville, '').toUpperCase()}
          </Text>
          <Text style={styles.coverSubInfo}>
            {[
              mandat?.type ? mandat.type.toUpperCase() : '',
              mandat?.surface ? `${formatSurface(mandat.surface)}` : '',
              prixNet > 0 ? formatPrix(prixTotal) + ' HAI' : '',
            ].filter(Boolean).join('  │  ')}
          </Text>
        </View>

        <Text style={styles.coverWebsite}>www.immeubles-patrimoine.fr</Text>
      </Page>

      {/* ═══════════════════════════════════════ */}
      {/* PAGE 2 : SOMMAIRE                       */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
        <SectionTitle title="SOMMAIRE" isOffMarket={isOffMarket} />
        <View style={{ marginTop: 30 }}>
          <TableOfContents items={tocItems} isOffMarket={isOffMarket} />
        </View>
        <PageFooter pageNumber={2} isOffMarket={isOffMarket} />
      </Page>

      {/* ═══════════════════════════════════════ */}
      {/* PAGE 3 : LE BIEN                        */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
        <SectionTitle title="LE BIEN" isOffMarket={isOffMarket} />
        
        {description && (
          <View style={styles.descriptionBlock}>
            <Text style={styles.descriptionText}>
              {description}
            </Text>
          </View>
        )}

        {cards.length > 0 && (
          <CardsRow isOffMarket={isOffMarket}>
            {cards.map((c, i) => (
              <Card key={i} number={c.number} label={c.label} isOffMarket={isOffMarket} />
            ))}
          </CardsRow>
        )}

        <PageFooter pageNumber={3} isOffMarket={isOffMarket} />
      </Page>

      {/* ═══════════════════════════════════════ */}
      {/* PAGE SITUATION & TRANSPORTS (si carte)  */}
      {/* ═══════════════════════════════════════ */}
      {hasMapImage && (
        <Page size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle 
            title={"SITUATION\n& TRANSPORTS"} 
            multiLine={true} 
            isOffMarket={isOffMarket} 
          />
          {mandat?.transport_info && (
            <View style={styles.descriptionBlock}>
              <Text style={styles.descriptionText}>{mandat.transport_info}</Text>
            </View>
          )}
          <Image src={mandat.map_image_url} style={{ width: '100%', height: 350, objectFit: 'contain', marginTop: 20 }} />
          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* PAGE VUE AÉRIENNE (si fournie)          */}
      {/* ═══════════════════════════════════════ */}
      {hasAerialImage && (
        <Page size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle 
            title={"VUE AÉRIENNE\n& SATELLITE"} 
            multiLine={true} 
            isOffMarket={isOffMarket} 
          />
          <Text style={[styles.descriptionText, { marginVertical: 12 }]}>
            Ce bien est situé au{'\n'}
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>
              {safeText(mandat?.adresse, '')}
            </Text>
            {'\n'}{safeText(mandat?.ville, '')}
          </Text>
          <Image src={mandat.aerial_image_url} style={{ width: '100%', height: 380, objectFit: 'contain' }} />
          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* PAGE CADASTRE (si plan fourni)          */}
      {/* ═══════════════════════════════════════ */}
      {hasCadastreImage && (
        <Page size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle title="CADASTRE" isOffMarket={isOffMarket} />
          {mandat?.cadastre_description && (
            <Text style={[styles.descriptionText, { marginVertical: 12 }]}>
              {mandat.cadastre_description}
            </Text>
          )}
          <Image src={mandat.cadastre_image_url} style={{ width: '100%', height: 380, objectFit: 'contain', marginTop: 16 }} />
          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* PAGE ÉTAT LOCATIF (si infos)            */}
      {/* ═══════════════════════════════════════ */}
      {hasEtatLocatif && (
        <Page size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle title="ETAT LOCATIF" isOffMarket={isOffMarket} />
          <Text style={[styles.descriptionText, { marginTop: 16, fontSize: 10 }]}>
            Synthèse de l'état locatif au {new Date().toLocaleDateString('fr-FR')}
          </Text>
          {/* Tableau simple — pour version 2, on enrichira */}
          <View style={{ marginTop: 24, marginHorizontal: 30 }}>
            {(mandat.etat_locatif || []).map((lot, i) => (
              <View key={i} style={{ 
                flexDirection: 'row', 
                paddingVertical: 8, 
                borderBottomWidth: 0.5, 
                borderBottomColor: palette.muted || palette.accentLine 
              }}>
                <Text style={{ flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold' }}>
                  Lot {lot.numero || (i + 1)}
                </Text>
                <Text style={{ flex: 2, fontSize: 10 }}>
                  {lot.nature || ''} {lot.surface ? `· ${lot.surface} m²` : ''}
                </Text>
                <Text style={{ flex: 1, fontSize: 10, textAlign: 'right' }}>
                  {lot.loyer ? formatPrix(lot.loyer) : '—'}
                </Text>
              </View>
            ))}
          </View>
          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* PAGE INFORMATIONS FINANCIÈRES           */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
        <SectionTitle 
          title={"INFORMATIONS\nFINANCIÈRES"} 
          multiLine={true} 
          isOffMarket={isOffMarket} 
        />
        <FinancialTable rows={finRows} isOffMarket={isOffMarket} />
        <PageFooter isOffMarket={isOffMarket} />
      </Page>

      {/* ═══════════════════════════════════════ */}
      {/* PAGES PHOTOS (1 ou plusieurs pages)     */}
      {/* ═══════════════════════════════════════ */}
      {photoChunks.map((chunk, pageIndex) => (
        <Page key={`photos-${pageIndex}`} size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle title="PHOTOS" isOffMarket={isOffMarket} />
          <View style={{ marginTop: 16 }}>
            <PhotoGrid 
              photos={chunk.map(url => ({ url }))} 
              isOffMarket={isOffMarket} 
            />
          </View>
          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      ))}

      {/* ═══════════════════════════════════════ */}
      {/* PAGES PLANS (si fournis)                */}
      {/* ═══════════════════════════════════════ */}
      {hasPlans && mandat.plans.map((plan, i) => (
        <Page key={`plan-${i}`} size="A4" style={styles.page}>
          <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
          <SectionTitle title="PLANS" isOffMarket={isOffMarket} />
          <Image 
            src={plan.url || plan} 
            style={{ width: '100%', height: 500, objectFit: 'contain', marginTop: 24 }} 
          />
          {plan.caption && (
            <Text style={[styles.descriptionText, { marginTop: 12, fontSize: 10 }]}>
              {plan.caption}
            </Text>
          )}
          <PageFooter isOffMarket={isOffMarket} />
        </Page>
      ))}

      {/* ═══════════════════════════════════════ */}
      {/* PAGE NOTRE ÉQUIPE (toujours)            */}
      {/* Layout : Boss au centre + 1-2 autres    */}
      {/* ═══════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <PageLogo logoUrl={logoUrl} isOffMarket={isOffMarket} />
        <SectionTitle title="NOTRE ÉQUIPE" isOffMarket={isOffMarket} />

        {team.length === 1 ? (
          /* Seulement le boss → portrait grand au centre */
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <TeamMember 
              photoUrl={team[0].photo}
              name={team[0].name}
              role={team[0].role}
              email={team[0].email}
              phone={team[0].phone}
              large={true}
              isOffMarket={isOffMarket}
            />
          </View>
        ) : team.length === 2 ? (
          /* Boss + 1 autre → côte à côte */
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 30, paddingHorizontal: 20 }}>
            {team.map((m, i) => (
              <TeamMember 
                key={i}
                photoUrl={m.photo}
                name={m.name}
                role={m.role}
                email={m.email}
                phone={m.phone}
                large={m.isBoss}
                isOffMarket={isOffMarket}
              />
            ))}
          </View>
        ) : (
          /* 3 personnes : Boss au centre, plus grand. Détenteur gauche, Expéditeur droite */
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 30, paddingHorizontal: 10 }}>
            {/* Détenteur à gauche */}
            <View style={{ flex: 1, alignItems: 'center', paddingTop: 20 }}>
              {(() => {
                const owner = team.find(m => m.position === 'left');
                return owner ? (
                  <TeamMember 
                    photoUrl={owner.photo}
                    name={owner.name}
                    role={owner.role}
                    email={owner.email}
                    phone={owner.phone}
                    isOffMarket={isOffMarket}
                  />
                ) : null;
              })()}
            </View>
            {/* Boss au centre */}
            <View style={{ flex: 1.2, alignItems: 'center' }}>
              {(() => {
                const boss = team.find(m => m.isBoss);
                return boss ? (
                  <TeamMember 
                    photoUrl={boss.photo}
                    name={boss.name}
                    role={boss.role}
                    email={boss.email}
                    phone={boss.phone}
                    large={true}
                    isOffMarket={isOffMarket}
                  />
                ) : null;
              })()}
            </View>
            {/* Expéditeur à droite */}
            <View style={{ flex: 1, alignItems: 'center', paddingTop: 20 }}>
              {(() => {
                const sender = team.find(m => m.position === 'right');
                return sender ? (
                  <TeamMember 
                    photoUrl={sender.photo}
                    name={sender.name}
                    role={sender.role}
                    email={sender.email}
                    phone={sender.phone}
                    isOffMarket={isOffMarket}
                  />
                ) : null;
              })()}
            </View>
          </View>
        )}

        <PageFooter isOffMarket={isOffMarket} />
      </Page>
    </Document>
  );
}
