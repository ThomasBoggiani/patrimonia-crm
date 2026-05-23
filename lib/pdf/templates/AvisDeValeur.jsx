// ═══════════════════════════════════════════════════════════════════
// lib/pdf/templates/AvisDeValeur.jsx — v1
// Avis de valeur PDF React-PDF · A4 paysage · 18 slides hybride
//
// Structure :
//  1.  Couverture (placeholder fixe)
//  2.  Avant-propos
//  3.  Qui sommes-nous (placeholder fixe)
//  4.  Notre équipe (placeholder fixe)
//  5.  Nos valeurs (placeholder fixe)
//  6.  Nos dernières ventes (placeholder fixe)
//  7.  Le marché en 2026 (placeholder fixe)
//  8.  Présentation de l'actif (transition)
//  9.  Localisation (DYNAMIQUE)
// 10.  Caractéristiques (DYNAMIQUE)
// 11.  Analyse SWOT (DYNAMIQUE)
// 12.  Portfolio photos (DYNAMIQUE)
// 13.  Plans (DYNAMIQUE)
// 14.  Comparables marché (DYNAMIQUE)
// 15.  Méthode d'évaluation (DYNAMIQUE)
// 16.  Estimation finale (DYNAMIQUE)
// 17.  Recommandations stratégiques (DYNAMIQUE)
// 18.  Notre équipe (DYNAMIQUE style plaquette)
//
// Les données dynamiques sont stockées dans mandat.avis_valeur (JSONB)
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { LOGO_IP_BASE64 } from '../logo-base64';

// ─── PALETTE I&P ───────────────────────────────────────────────────
const SAGE = '#5d6e5d';
const SAGE_DARK = '#3d4d3d';
const CREAM = '#f5f0e8';
const CREAM_LIGHT = '#FAFAF7';
const TEXT_PRIMARY = '#2c2c2a';
const TEXT_MUTED = '#666666';
const TEXT_HINT = '#888888';
const BORDER = '#dddddd';
const BORDER_LIGHT = '#f0f0f0';

// Couleurs SWOT
const COLOR_FORCE_BG = '#EAF3DE';
const COLOR_FORCE_BORDER = '#3B6D11';
const COLOR_FORCE_TEXT = '#173404';
const COLOR_OPP_BG = '#E6F1FB';
const COLOR_OPP_BORDER = '#185FA5';
const COLOR_OPP_TEXT = '#042C53';
const COLOR_FAIB_BG = '#FAEEDA';
const COLOR_FAIB_BORDER = '#854F0B';
const COLOR_FAIB_TEXT = '#412402';
const COLOR_MEN_BG = '#FCEBEB';
const COLOR_MEN_BORDER = '#A32D2D';
const COLOR_MEN_TEXT = '#501313';

// ─── Couleurs lignes RATP/IDFM ─────────────────────────────────────
const LINE_COLORS = {
  '1': '#FFCE00', '2': '#0064B0', '3': '#9F9825', '3bis': '#98D4E2',
  '4': '#C04191', '5': '#F28E42', '6': '#83C491', '7': '#F3A4BA',
  '7bis': '#83C491', '8': '#CEADD2', '9': '#D5C900', '10': '#E3B32A',
  '11': '#8D5E2A', '12': '#00814F', '13': '#98D4E2', '14': '#662483',
  '15': '#B90845', '16': '#F3A4BA', '17': '#D5C900', '18': '#00A88F',
  'A': '#E2231A', 'B': '#7BA3DC', 'C': '#FFCE00', 'D': '#00A88F', 'E': '#BE418D',
  'T1': '#0055B7', 'T2': '#B7DA4D', 'T3a': '#FF5A00', 'T3b': '#7B388C',
};

const LINE_TEXT_COLORS = { '1': '#000', '8': '#000', '9': '#000', '6': '#000' };

function getLineColor(line, mode) {
  if (!line) return null;
  const clean = String(line).trim().toUpperCase();
  if (LINE_COLORS[clean]) return LINE_COLORS[clean];
  const lower = String(line).trim();
  if (LINE_COLORS[lower]) return LINE_COLORS[lower];
  if (mode === 'bus') return '#5A4A8A';
  return null;
}

function LineBadge({ line, mode }) {
  const bgColor = getLineColor(line, mode) || '#888';
  const textColor = LINE_TEXT_COLORS[String(line).trim()] || '#FFF';
  return (
    <View style={{ backgroundColor: bgColor, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 2, marginRight: 3 }}>
      <Text style={{ color: textColor, fontSize: 7, fontFamily: 'Helvetica-Bold' }}>{line}</Text>
    </View>
  );
}

// ─── HELPERS ───────────────────────────────────────────────────────
function safeText(v, fallback = '') {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return s || fallback;
}

function formatPrix(n) {
  if (n === null || n === undefined || n === '') return '—';
  const num = parseFloat(n);
  if (isNaN(num)) return '—';
  return num.toLocaleString('fr-FR').replace(/[\u00A0\u202F]/g, ' ') + ' €';
}

function formatNum(n) {
  if (n === null || n === undefined || n === '') return '—';
  const num = parseFloat(n);
  if (isNaN(num)) return '—';
  return num.toLocaleString('fr-FR').replace(/[\u00A0\u202F]/g, ' ');
}

function formatSurface(n) {
  const num = parseFloat(n);
  if (isNaN(num)) return '';
  return num.toLocaleString('fr-FR').replace(/[\u00A0\u202F]/g, ' ') + ' m²';
}

function walkingTime(meters) {
  const m = parseInt(meters);
  if (!m) return '';
  const min = Math.round(m / 80);
  return min < 1 ? '< 1 min' : `${min} min`;
}

function normalizePhotos(mandat) {
  if (!mandat) return [];
  const arr = mandat.medias || mandat.photos || [];
  return arr
    .filter(p => p && (typeof p === 'string' || p.url))
    .map(p => typeof p === 'string' ? p : p.url)
    .filter(Boolean);
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─── ÉQUIPE (réutilise la logique plaquette) ───────────────────────
function buildTeamForAvis({ mandat, sender, allMembers }) {
  const BOSS_INITIALS = 'TE';
  const ownerInitials = (mandat?.ownerInitials || '').toUpperCase();
  const senderInitials = (sender?.initiales || sender?.initials || '').toUpperCase();

  const allKeys = Object.keys(allMembers || {});
  const boss = allMembers[BOSS_INITIALS];
  const owner = allMembers[ownerInitials];
  const sndr = allMembers[senderInitials];

  const seen = new Set();
  const team = [];

  if (boss) { team.push({ ...boss, position: 'center', isBoss: true }); seen.add(BOSS_INITIALS); }
  if (owner && !seen.has(ownerInitials)) { team.push({ ...owner, position: 'left', isBoss: false }); seen.add(ownerInitials); }
  if (sndr && !seen.has(senderInitials)) { team.push({ ...sndr, position: 'right', isBoss: false }); seen.add(senderInitials); }

  if (team.length === 0 && allKeys.length > 0) {
    for (let i = 0; i < Math.min(3, allKeys.length); i++) {
      const k = allKeys[i];
      team.push({ ...allMembers[k], position: 'fallback', isBoss: i === 0 });
    }
  }
  return team;
}

function TeamCard({ member, compact = false }) {
  const photoSize = compact ? 70 : 90;
  const initials = (member?.name || '?').split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  return (
    <View style={{ alignItems: 'center', maxWidth: 200, marginHorizontal: 12, marginBottom: 8 }}>
      {member.photo ? (
        <Image src={member.photo} style={{ width: photoSize, height: photoSize, borderRadius: photoSize / 2, objectFit: 'cover', marginBottom: 8 }} />
      ) : (
        <View style={{ width: photoSize, height: photoSize, borderRadius: photoSize / 2, backgroundColor: SAGE, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          <Text style={{ color: '#FFFFFF', fontSize: photoSize > 80 ? 26 : 22, fontFamily: 'Helvetica-Bold' }}>{initials}</Text>
        </View>
      )}
      <Text style={{ fontSize: compact ? 9 : 10, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 2, color: TEXT_PRIMARY }}>{member.name || '—'}</Text>
      <Text style={{ fontSize: compact ? 7 : 8, color: TEXT_MUTED, textAlign: 'center', marginBottom: 2, maxWidth: 180 }}>{member.role || ''}</Text>
      {!!member.email && (
        <Text style={{ fontSize: compact ? 6 : 7, color: TEXT_MUTED, textAlign: 'center' }}>{member.email}</Text>
      )}
    </View>
  );
}

// ─── HEADER / FOOTER COMMUNS ───────────────────────────────────────
function SlideHeader({ mandat, slideTitle }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: BORDER, marginBottom: 12 }}>
      <View style={{ width: 26, height: 26, backgroundColor: SAGE, borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 10, fontFamily: 'Helvetica-Bold' }}>I&amp;P</Text>
      </View>
      <Text style={{ fontSize: 7, color: TEXT_HINT, letterSpacing: 1.5 }}>
        AVIS DE VALEUR · {safeText(mandat?.nom || mandat?.adresse, '').toUpperCase()}
      </Text>
    </View>
  );
}

function SlideTitle({ chapter, title }) {
  return (
    <View style={{ marginBottom: 12 }}>
      {chapter && (
        <Text style={{ fontSize: 9, color: SAGE, letterSpacing: 2, fontFamily: 'Helvetica-Bold' }}>
          {chapter}
        </Text>
      )}
      <Text style={{ fontSize: 22, fontFamily: 'Times-Roman', color: TEXT_PRIMARY, marginTop: 2 }}>
        {title}
      </Text>
    </View>
  );
}

function SlideFooter({ pageNum, totalPages }) {
  return (
    <View style={{ position: 'absolute', bottom: 18, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontSize: 7, color: TEXT_HINT }}>www.immeubles-patrimoine.fr</Text>
      <Text style={{ fontSize: 7, color: TEXT_HINT }}>{pageNum}{totalPages ? ` / ${totalPages}` : ''}</Text>
    </View>
  );
}

// ─── STYLES PAGE A4 PAYSAGE ────────────────────────────────────────
const PAGE_PAYSAGE = { size: 'A4', orientation: 'landscape', paddingTop: 22, paddingBottom: 40, paddingHorizontal: 28, fontFamily: 'Helvetica' };

// ═════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═════════════════════════════════════════════════════════════════════
export default function AvisDeValeur({
  mandat,
  avisData = {},        // mandat.avis_valeur (JSONB)
  conseiller,
  teamMembers,
}) {
  const photos = normalizePhotos(mandat);
  const photoChunks = chunkArray(photos, 6); // 6 photos par slide A4 paysage

  const team = buildTeamForAvis({ mandat, sender: conseiller, allMembers: teamMembers || {} });
  const dossier = team.filter(m => m.position === 'left' || m.position === 'right' || m.position === 'fallback' || m.position === 'center');

  // Données dynamiques depuis avisData
  const av = {
    proprietaire: avisData.proprietaire || '',
    date: avisData.date || new Date().toLocaleDateString('fr-FR'),
    avant_propos: avisData.avant_propos || '',
    forces: avisData.forces || [],
    faiblesses: avisData.faiblesses || [],
    opportunites: avisData.opportunites || [],
    menaces: avisData.menaces || [],
    comparables_prix_moyen: avisData.comparables_prix_moyen || null,
    comparables_prix_min: avisData.comparables_prix_min || null,
    comparables_prix_max: avisData.comparables_prix_max || null,
    comparables_rendement: avisData.comparables_rendement || '',
    comparables_transactions: avisData.comparables_transactions || [],
    methode_m2_basse: avisData.methode_m2_basse || null,
    methode_m2_centrale: avisData.methode_m2_centrale || null,
    methode_m2_haute: avisData.methode_m2_haute || null,
    methode_capi: avisData.methode_capi || [],
    prix_coup_coeur: avisData.prix_coup_coeur || null,
    prix_marche: avisData.prix_marche || null,
    prix_plancher: avisData.prix_plancher || null,
    recommandation: avisData.recommandation || '',
    strategie_bloc: avisData.strategie_bloc || '',
    strategie_decoupe: avisData.strategie_decoupe || '',
    ...avisData,
  };

  const surface = parseFloat(mandat?.surface) || 0;
  const adresseFull = [safeText(mandat?.adresse), safeText(mandat?.ville)].filter(Boolean).join(', ');

  // Assets externes (Phase B)
  const streetViewSrc = mandat?.street_view_image_url || null;
  const mapStaticSrc = mandat?.map_static_image_url || null;
  const aerialSrc = mandat?.satellite_image_url || null;
  const cadastreSrc = mandat?.cadastre_image_url || null;
  const transports = mandat?.transports_data || null;

  // Top stations
  const topStations = transports ? (() => {
    const all = [];
    (transports.metro || []).forEach(s => all.push({ ...s, mode: 'metro' }));
    (transports.rer || []).forEach(s => all.push({ ...s, mode: 'rer' }));
    (transports.tram || []).forEach(s => all.push({ ...s, mode: 'tram' }));
    return all.sort((a, b) => a.distance - b.distance).slice(0, 6);
  })() : [];

  let pageNum = 0;

  return (
    <Document title={`Avis de valeur — ${safeText(mandat?.nom, 'Mandat')}`} author="Immeubles & Patrimoine">

      {/* ─────────────────────────────────────────────────────────── */}
      {/* SLIDE 1 · COUVERTURE                                         */}
      {/* ─────────────────────────────────────────────────────────── */}
      <Page {...PAGE_PAYSAGE} style={{ ...PAGE_PAYSAGE, backgroundColor: CREAM }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Image src={LOGO_IP_BASE64} style={{ width: 110, height: 110, marginBottom: 40, objectFit: 'contain' }} />
          {photos[0] ? (
            <Image src={photos[0]} style={{ width: '70%', height: 280, objectFit: 'cover', marginBottom: 30, borderRadius: 4 }} />
          ) : (
            <View style={{ width: '70%', height: 280, backgroundColor: CREAM_LIGHT, marginBottom: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}>
              <Text style={{ fontSize: 12, color: TEXT_HINT, fontFamily: 'Helvetica-Oblique' }}>Photo principale du bien</Text>
            </View>
          )}
          <Text style={{ fontSize: 12, color: SAGE, letterSpacing: 4, fontFamily: 'Helvetica-Bold', marginBottom: 14 }}>
            AVIS DE VALEUR
          </Text>
          <Text style={{ fontSize: 26, fontFamily: 'Times-Roman', color: TEXT_PRIMARY, marginBottom: 8, textAlign: 'center' }}>
            {safeText(mandat?.nom, 'Bien à évaluer').toUpperCase()}
          </Text>
          <Text style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 30 }}>
            {adresseFull}
          </Text>
          <Text style={{ fontSize: 9, color: TEXT_HINT, fontStyle: 'italic' }}>
            Préparé pour {safeText(av.proprietaire, '—')} · {av.date}
          </Text>
        </View>
      </Page>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* SLIDE 2 · AVANT-PROPOS                                       */}
      {/* ─────────────────────────────────────────────────────────── */}
      <Page {...PAGE_PAYSAGE}>
        <SlideHeader mandat={mandat} />
        <SlideTitle chapter="" title="Avant-propos" />
        <View style={{ marginTop: 16, paddingHorizontal: 40 }}>
          <Text style={{ fontSize: 11, color: TEXT_PRIMARY, lineHeight: 1.7, textAlign: 'justify' }}>
            {av.avant_propos || `Madame, Monsieur ${av.proprietaire},\n\nNous vous remercions de la confiance que vous nous accordez pour la valorisation de votre bien situé ${adresseFull}.\n\nLe présent avis de valeur a pour objectif de vous éclairer sur la valeur de marché de cet actif, à l'appui de nos analyses, comparables récents et méthodes d'évaluation reconnues.\n\nNous restons à votre entière disposition pour échanger sur les éléments de ce document.`}
          </Text>
        </View>
        <View style={{ marginTop: 'auto', alignItems: 'flex-end', paddingRight: 40 }}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: SAGE }}>L'équipe Immeubles & Patrimoine</Text>
          <Text style={{ fontSize: 8, color: TEXT_HINT }}>{av.date}</Text>
        </View>
        <SlideFooter pageNum={2} />
      </Page>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* SLIDES 3 à 8 · CONTENU MARKETING FIXE (placeholders)         */}
      {/* À remplacer par les images PNG extraites du PPTX             */}
      {/* ─────────────────────────────────────────────────────────── */}
      {[
        { num: 3, title: 'Qui sommes-nous', subtitle: 'Slide marketing à intégrer depuis le PPTX' },
        { num: 4, title: 'Notre équipe', subtitle: 'Slide marketing à intégrer depuis le PPTX' },
        { num: 5, title: 'Nos valeurs', subtitle: 'Slide marketing à intégrer depuis le PPTX' },
        { num: 6, title: 'Nos dernières ventes', subtitle: 'Slide marketing à intégrer depuis le PPTX' },
        { num: 7, title: 'Le marché en 2026', subtitle: 'Slide marketing à intégrer depuis le PPTX' },
        { num: 8, title: 'Présentation de l\'actif', subtitle: 'Slide de transition' },
      ].map(slide => (
        <Page key={`fixe-${slide.num}`} {...PAGE_PAYSAGE} style={{ ...PAGE_PAYSAGE, backgroundColor: CREAM }}>
          <SlideHeader mandat={mandat} />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 30, fontFamily: 'Times-Roman', color: SAGE, marginBottom: 12, textAlign: 'center' }}>
              {slide.title}
            </Text>
            <Text style={{ fontSize: 10, color: TEXT_HINT, fontStyle: 'italic' }}>
              [{slide.subtitle}]
            </Text>
          </View>
          <SlideFooter pageNum={slide.num} />
        </Page>
      ))}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* SLIDE 9 · LOCALISATION (DYNAMIQUE)                           */}
      {/* ─────────────────────────────────────────────────────────── */}
      <Page {...PAGE_PAYSAGE}>
        <SlideHeader mandat={mandat} />
        <SlideTitle chapter="CHAPITRE 1" title="Localisation" />
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>PLAN DE SITUATION</Text>
            {mapStaticSrc ? (
              <Image src={mapStaticSrc} style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 3 }} />
            ) : (
              <View style={{ width: '100%', height: 220, backgroundColor: CREAM_LIGHT, alignItems: 'center', justifyContent: 'center', borderRadius: 3 }}>
                <Text style={{ fontSize: 9, color: TEXT_HINT, fontStyle: 'italic' }}>Plan non disponible</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>ENVIRONNEMENT</Text>
            <Text style={{ fontSize: 9, color: TEXT_MUTED, lineHeight: 1.6, marginBottom: 12 }}>
              {av.environnement_description || `Bien situé au ${adresseFull}.`}
            </Text>
            {topStations.length > 0 && (
              <>
                <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 6 }}>TRANSPORTS À PROXIMITÉ</Text>
                {topStations.map((s, i) => {
                  const lines = s.lines ? String(s.lines).split(/[;,/]/).map(x => x.trim()).filter(Boolean) : [];
                  return (
                    <View key={i} style={{ flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.3, borderBottomColor: BORDER_LIGHT, alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', minWidth: 48 }}>
                        {lines.slice(0, 2).map((l, j) => <LineBadge key={j} line={l} mode={s.mode} />)}
                      </View>
                      <Text style={{ flex: 1, fontSize: 9, marginLeft: 6 }}>{s.name}</Text>
                      <Text style={{ fontSize: 7, color: TEXT_HINT }}>{s.distance}m · {walkingTime(s.distance)}</Text>
                    </View>
                  );
                })}
              </>
            )}
          </View>
        </View>
        <SlideFooter pageNum={9} />
      </Page>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* SLIDE 10 · CARACTÉRISTIQUES (DYNAMIQUE)                      */}
      {/* ─────────────────────────────────────────────────────────── */}
      <Page {...PAGE_PAYSAGE}>
        <SlideHeader mandat={mandat} />
        <SlideTitle chapter="CHAPITRE 2" title="Caractéristiques du bien" />
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <View style={{ flex: 1.4 }}>
            <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>DESCRIPTION</Text>
            <Text style={{ fontSize: 9, color: TEXT_PRIMARY, lineHeight: 1.6 }}>
              {safeText(mandat?.description, 'Description non renseignée.')}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 6 }}>CARACTÉRISTIQUES</Text>
            <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {mandat?.surface && (
                <View style={{ width: '48%', backgroundColor: CREAM, padding: 8 }}>
                  <Text style={{ fontSize: 7, color: TEXT_HINT, letterSpacing: 0.5, textTransform: 'uppercase' }}>Surface</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Times-Roman', color: SAGE, marginTop: 2 }}>{formatSurface(mandat.surface)}</Text>
                </View>
              )}
              {mandat?.type && (
                <View style={{ width: '48%', backgroundColor: CREAM, padding: 8 }}>
                  <Text style={{ fontSize: 7, color: TEXT_HINT, letterSpacing: 0.5, textTransform: 'uppercase' }}>Type</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Times-Roman', color: SAGE, marginTop: 2 }}>{safeText(mandat.type, '—')}</Text>
                </View>
              )}
              {mandat?.nb_lots && (
                <View style={{ width: '48%', backgroundColor: CREAM, padding: 8 }}>
                  <Text style={{ fontSize: 7, color: TEXT_HINT, letterSpacing: 0.5, textTransform: 'uppercase' }}>Nombre de lots</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Times-Roman', color: SAGE, marginTop: 2 }}>{mandat.nb_lots}</Text>
                </View>
              )}
              {mandat?.annee_construction && (
                <View style={{ width: '48%', backgroundColor: CREAM, padding: 8 }}>
                  <Text style={{ fontSize: 7, color: TEXT_HINT, letterSpacing: 0.5, textTransform: 'uppercase' }}>Construction</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Times-Roman', color: SAGE, marginTop: 2 }}>{mandat.annee_construction}</Text>
                </View>
              )}
              {mandat?.rendement && (
                <View style={{ width: '48%', backgroundColor: CREAM, padding: 8 }}>
                  <Text style={{ fontSize: 7, color: TEXT_HINT, letterSpacing: 0.5, textTransform: 'uppercase' }}>Rendement</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Times-Roman', color: SAGE, marginTop: 2 }}>{parseFloat(mandat.rendement).toFixed(1).replace('.', ',')}%</Text>
                </View>
              )}
              {mandat?.dpe_consommation && (
                <View style={{ width: '48%', backgroundColor: CREAM, padding: 8 }}>
                  <Text style={{ fontSize: 7, color: TEXT_HINT, letterSpacing: 0.5, textTransform: 'uppercase' }}>DPE</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Times-Roman', color: SAGE, marginTop: 2 }}>{mandat.dpe_consommation}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <SlideFooter pageNum={10} />
      </Page>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* SLIDE 11 · ANALYSE SWOT (DYNAMIQUE)                          */}
      {/* ─────────────────────────────────────────────────────────── */}
      <Page {...PAGE_PAYSAGE}>
        <SlideHeader mandat={mandat} />
        <SlideTitle chapter="CHAPITRE 3" title="Analyse de l'actif" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {/* FORCES */}
          <View style={{ width: '48%', backgroundColor: COLOR_FORCE_BG, padding: 12, borderRadius: 3 }}>
            <Text style={{ fontSize: 9, color: COLOR_FORCE_BORDER, letterSpacing: 1.5, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>
              ▲  FORCES
            </Text>
            {(av.forces.length > 0 ? av.forces : ['(à compléter)']).map((f, i) => (
              <Text key={i} style={{ fontSize: 9, color: COLOR_FORCE_TEXT, lineHeight: 1.6, marginBottom: 2 }}>• {f}</Text>
            ))}
          </View>
          {/* OPPORTUNITÉS */}
          <View style={{ width: '48%', backgroundColor: COLOR_OPP_BG, padding: 12, borderRadius: 3 }}>
            <Text style={{ fontSize: 9, color: COLOR_OPP_BORDER, letterSpacing: 1.5, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>
              ○  OPPORTUNITÉS
            </Text>
            {(av.opportunites.length > 0 ? av.opportunites : ['(à compléter)']).map((f, i) => (
              <Text key={i} style={{ fontSize: 9, color: COLOR_OPP_TEXT, lineHeight: 1.6, marginBottom: 2 }}>• {f}</Text>
            ))}
          </View>
          {/* FAIBLESSES */}
          <View style={{ width: '48%', backgroundColor: COLOR_FAIB_BG, padding: 12, borderRadius: 3 }}>
            <Text style={{ fontSize: 9, color: COLOR_FAIB_BORDER, letterSpacing: 1.5, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>
              ▼  FAIBLESSES
            </Text>
            {(av.faiblesses.length > 0 ? av.faiblesses : ['(à compléter)']).map((f, i) => (
              <Text key={i} style={{ fontSize: 9, color: COLOR_FAIB_TEXT, lineHeight: 1.6, marginBottom: 2 }}>• {f}</Text>
            ))}
          </View>
          {/* MENACES */}
          <View style={{ width: '48%', backgroundColor: COLOR_MEN_BG, padding: 12, borderRadius: 3 }}>
            <Text style={{ fontSize: 9, color: COLOR_MEN_BORDER, letterSpacing: 1.5, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>
              ⚠  MENACES
            </Text>
            {(av.menaces.length > 0 ? av.menaces : ['(à compléter)']).map((f, i) => (
              <Text key={i} style={{ fontSize: 9, color: COLOR_MEN_TEXT, lineHeight: 1.6, marginBottom: 2 }}>• {f}</Text>
            ))}
          </View>
        </View>
        <SlideFooter pageNum={11} />
      </Page>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* SLIDE 12 · PORTFOLIO PHOTOS (DYNAMIQUE)                      */}
      {/* ─────────────────────────────────────────────────────────── */}
      {photoChunks.length > 0 && photoChunks.map((chunk, i) => (
        <Page key={`photos-${i}`} {...PAGE_PAYSAGE}>
          <SlideHeader mandat={mandat} />
          <SlideTitle chapter="CHAPITRE 4" title={i === 0 ? 'Portfolio photos' : 'Portfolio photos (suite)'} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {chunk.map((url, j) => (
              <View key={j} style={{ width: '32%', height: 165 }}>
                <Image src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 3 }} />
              </View>
            ))}
          </View>
          <SlideFooter pageNum={12 + i} />
        </Page>
      ))}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* SLIDE 13 · PLANS (DYNAMIQUE)                                 */}
      {/* ─────────────────────────────────────────────────────────── */}
      {(mandat?.plans || []).length > 0 && mandat.plans.map((plan, i) => (
        <Page key={`plans-${i}`} {...PAGE_PAYSAGE}>
          <SlideHeader mandat={mandat} />
          <SlideTitle chapter="" title={i === 0 ? 'Plans' : 'Plans (suite)'} />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Image src={plan.url || plan} style={{ width: '90%', height: 350, objectFit: 'contain' }} />
            {plan.caption && (
              <Text style={{ fontSize: 9, color: TEXT_MUTED, marginTop: 8, fontStyle: 'italic' }}>{plan.caption}</Text>
            )}
          </View>
          <SlideFooter pageNum={13 + i} />
        </Page>
      ))}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* SLIDE 14 · COMPARABLES MARCHÉ (DYNAMIQUE)                    */}
      {/* ─────────────────────────────────────────────────────────── */}
      <Page {...PAGE_PAYSAGE}>
        <SlideHeader mandat={mandat} />
        <SlideTitle chapter="CHAPITRE 5" title="Comparables marché" />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <View style={{ flex: 1, backgroundColor: CREAM_LIGHT, padding: 12 }}>
            <Text style={{ fontSize: 7, color: TEXT_HINT, letterSpacing: 1, textTransform: 'uppercase' }}>Prix moyen zone</Text>
            <Text style={{ fontSize: 17, fontFamily: 'Times-Roman', color: SAGE, marginTop: 2 }}>
              {av.comparables_prix_moyen ? `${formatNum(av.comparables_prix_moyen)} €/m²` : '—'}
            </Text>
            <Text style={{ fontSize: 7, color: TEXT_HINT, marginTop: 4 }}>Sources : MeilleursAgents, SeLoger</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: CREAM_LIGHT, padding: 12 }}>
            <Text style={{ fontSize: 7, color: TEXT_HINT, letterSpacing: 1, textTransform: 'uppercase' }}>Fourchette</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Times-Roman', color: TEXT_PRIMARY, marginTop: 2 }}>
              {av.comparables_prix_min ? formatNum(av.comparables_prix_min) : '—'}
              <Text style={{ fontSize: 9 }}> – </Text>
              {av.comparables_prix_max ? formatNum(av.comparables_prix_max) : '—'}
            </Text>
            <Text style={{ fontSize: 7, color: TEXT_HINT, marginTop: 4 }}>€/m² selon état</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: CREAM_LIGHT, padding: 12 }}>
            <Text style={{ fontSize: 7, color: TEXT_HINT, letterSpacing: 1, textTransform: 'uppercase' }}>Rendement brut zone</Text>
            <Text style={{ fontSize: 17, fontFamily: 'Times-Roman', color: SAGE, marginTop: 2 }}>
              {av.comparables_rendement || '—'}
            </Text>
            <Text style={{ fontSize: 7, color: TEXT_HINT, marginTop: 4 }}>Selon segment</Text>
          </View>
        </View>
        <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 6 }}>
          TRANSACTIONS RÉCENTES
        </Text>
        <View style={{ borderTopWidth: 0.5, borderTopColor: BORDER }}>
          <View style={{ flexDirection: 'row', backgroundColor: CREAM_LIGHT, paddingVertical: 4, paddingHorizontal: 6 }}>
            <Text style={{ flex: 3, fontSize: 7, color: TEXT_MUTED, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' }}>Adresse</Text>
            <Text style={{ flex: 1, fontSize: 7, color: TEXT_MUTED, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', textAlign: 'right' }}>Surface</Text>
            <Text style={{ flex: 1.5, fontSize: 7, color: TEXT_MUTED, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', textAlign: 'right' }}>Prix net</Text>
            <Text style={{ flex: 1, fontSize: 7, color: TEXT_MUTED, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', textAlign: 'right' }}>€/m²</Text>
            <Text style={{ flex: 1, fontSize: 7, color: TEXT_MUTED, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', textAlign: 'center' }}>Date</Text>
          </View>
          {(av.comparables_transactions.length > 0 ? av.comparables_transactions : [{ adresse: '(à compléter)' }]).slice(0, 6).map((t, i) => (
            <View key={i} style={{ flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.3, borderBottomColor: BORDER_LIGHT }}>
              <Text style={{ flex: 3, fontSize: 8 }}>{t.adresse || '—'}</Text>
              <Text style={{ flex: 1, fontSize: 8, textAlign: 'right' }}>{t.surface ? `${t.surface} m²` : '—'}</Text>
              <Text style={{ flex: 1.5, fontSize: 8, textAlign: 'right' }}>{t.prix ? formatPrix(t.prix) : '—'}</Text>
              <Text style={{ flex: 1, fontSize: 8, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{t.prix_m2 ? `${formatNum(t.prix_m2)} €` : '—'}</Text>
              <Text style={{ flex: 1, fontSize: 7, textAlign: 'center', color: TEXT_HINT }}>{t.date || '—'}</Text>
            </View>
          ))}
        </View>
        <SlideFooter pageNum={14} />
      </Page>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* SLIDE 15 · MÉTHODE D'ÉVALUATION (DYNAMIQUE)                  */}
      {/* ─────────────────────────────────────────────────────────── */}
      <Page {...PAGE_PAYSAGE}>
        <SlideHeader mandat={mandat} />
        <SlideTitle chapter="CHAPITRE 6" title="Méthodologie d'évaluation" />
        <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 6 }}>
          MÉTHODE 1 · COMPARAISON AU M²
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
          <View style={{ flex: 1, backgroundColor: CREAM_LIGHT, padding: 10, borderLeftWidth: 2, borderLeftColor: BORDER }}>
            <Text style={{ fontSize: 7, color: TEXT_HINT }}>Valeur basse</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Times-Roman', color: TEXT_HINT, marginTop: 2 }}>
              {av.methode_m2_basse ? `${formatNum(av.methode_m2_basse)} €/m²` : '—'}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'Times-Roman', color: TEXT_PRIMARY, marginTop: 4 }}>
              {(av.methode_m2_basse && surface) ? formatPrix(av.methode_m2_basse * surface) : '—'}
            </Text>
            <Text style={{ fontSize: 6, color: TEXT_HINT, marginTop: 4 }}>Travaux importants à prévoir</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: CREAM, padding: 10, borderLeftWidth: 2, borderLeftColor: SAGE }}>
            <Text style={{ fontSize: 7, color: SAGE, fontFamily: 'Helvetica-Bold' }}>VALEUR CENTRALE</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Times-Roman', color: SAGE, marginTop: 2 }}>
              {av.methode_m2_centrale ? `${formatNum(av.methode_m2_centrale)} €/m²` : '—'}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: 'Times-Roman', color: SAGE_DARK, marginTop: 4, fontFamily: 'Helvetica-Bold' }}>
              {(av.methode_m2_centrale && surface) ? formatPrix(av.methode_m2_centrale * surface) : '—'}
            </Text>
            <Text style={{ fontSize: 6, color: SAGE, marginTop: 4 }}>État actuel, prix de marché</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: CREAM_LIGHT, padding: 10, borderLeftWidth: 2, borderLeftColor: BORDER }}>
            <Text style={{ fontSize: 7, color: TEXT_HINT }}>Valeur haute</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Times-Roman', color: TEXT_HINT, marginTop: 2 }}>
              {av.methode_m2_haute ? `${formatNum(av.methode_m2_haute)} €/m²` : '—'}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'Times-Roman', color: TEXT_PRIMARY, marginTop: 4 }}>
              {(av.methode_m2_haute && surface) ? formatPrix(av.methode_m2_haute * surface) : '—'}
            </Text>
            <Text style={{ fontSize: 6, color: TEXT_HINT, marginTop: 4 }}>Bien rénové, exception</Text>
          </View>
        </View>

        {av.methode_capi.length > 0 && (
          <>
            <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 6 }}>
              MÉTHODE 2 · CAPITALISATION DES LOYERS
            </Text>
            <View style={{ borderTopWidth: 0.5, borderTopColor: BORDER }}>
              <View style={{ flexDirection: 'row', backgroundColor: CREAM_LIGHT, paddingVertical: 4, paddingHorizontal: 6 }}>
                <Text style={{ flex: 1, fontSize: 7, color: TEXT_MUTED, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' }}>Hypothèse rendement</Text>
                <Text style={{ flex: 1, fontSize: 7, color: TEXT_MUTED, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', textAlign: 'right' }}>Valeur acte</Text>
                <Text style={{ flex: 2, fontSize: 7, color: TEXT_MUTED, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' }}>Lecture</Text>
              </View>
              {av.methode_capi.map((c, i) => (
                <View key={i} style={{ flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.3, borderBottomColor: BORDER_LIGHT }}>
                  <Text style={{ flex: 1, fontSize: 8 }}>{c.rendement || '—'}</Text>
                  <Text style={{ flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>{c.valeur ? formatPrix(c.valeur) : '—'}</Text>
                  <Text style={{ flex: 2, fontSize: 8, color: TEXT_MUTED }}>{c.lecture || ''}</Text>
                </View>
              ))}
            </View>
          </>
        )}
        <SlideFooter pageNum={15} />
      </Page>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* SLIDE 16 · ESTIMATION FINALE (DYNAMIQUE)                     */}
      {/* ─────────────────────────────────────────────────────────── */}
      <Page {...PAGE_PAYSAGE}>
        <SlideHeader mandat={mandat} />
        <SlideTitle chapter="CHAPITRE 7" title="Estimation finale" />
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          <View style={{ flex: 1, backgroundColor: CREAM, padding: 14, borderRadius: 3, alignItems: 'center', borderWidth: 1.5, borderColor: SAGE }}>
            <Text style={{ fontSize: 8, color: SAGE, letterSpacing: 1.5, fontFamily: 'Helvetica-Bold' }}>PRIX COUP DE CŒUR</Text>
            <Text style={{ fontSize: 19, fontFamily: 'Times-Roman', color: SAGE_DARK, marginTop: 10, fontFamily: 'Helvetica-Bold' }}>
              {av.prix_coup_coeur ? `${formatPrix(av.prix_coup_coeur)} FAI` : '—'}
            </Text>
            <Text style={{ fontSize: 9, color: SAGE, marginTop: 4 }}>
              {(av.prix_coup_coeur && surface) ? `${formatNum(Math.round(av.prix_coup_coeur / surface))} €/m²` : ''}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: CREAM_LIGHT, padding: 14, borderRadius: 3, alignItems: 'center' }}>
            <Text style={{ fontSize: 8, color: TEXT_HINT, letterSpacing: 1.5, fontFamily: 'Helvetica-Bold' }}>PRIX DE MARCHÉ</Text>
            <Text style={{ fontSize: 19, fontFamily: 'Times-Roman', color: TEXT_PRIMARY, marginTop: 10 }}>
              {av.prix_marche ? `${formatPrix(av.prix_marche)} FAI` : '—'}
            </Text>
            <Text style={{ fontSize: 9, color: TEXT_HINT, marginTop: 4 }}>
              {(av.prix_marche && surface) ? `${formatNum(Math.round(av.prix_marche / surface))} €/m²` : ''}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: CREAM_LIGHT, padding: 14, borderRadius: 3, alignItems: 'center' }}>
            <Text style={{ fontSize: 8, color: TEXT_HINT, letterSpacing: 1.5, fontFamily: 'Helvetica-Bold' }}>PRIX PLANCHER</Text>
            <Text style={{ fontSize: 19, fontFamily: 'Times-Roman', color: TEXT_PRIMARY, marginTop: 10 }}>
              {av.prix_plancher ? `${formatPrix(av.prix_plancher)} FAI` : '—'}
            </Text>
            <Text style={{ fontSize: 9, color: TEXT_HINT, marginTop: 4 }}>
              {(av.prix_plancher && surface) ? `${formatNum(Math.round(av.prix_plancher / surface))} €/m²` : ''}
            </Text>
          </View>
        </View>
        {av.recommandation && (
          <View style={{ marginTop: 4, padding: 12, backgroundColor: CREAM_LIGHT, borderLeftWidth: 2, borderLeftColor: SAGE }}>
            <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>NOTRE RECOMMANDATION</Text>
            <Text style={{ fontSize: 9, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{av.recommandation}</Text>
          </View>
        )}
        <Text style={{ marginTop: 12, fontSize: 7, color: TEXT_HINT, fontStyle: 'italic', textAlign: 'center' }}>
          Honoraires d'agence inclus · Validité de l'avis : 1 mois
        </Text>
        <SlideFooter pageNum={16} />
      </Page>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* SLIDE 17 · RECOMMANDATIONS STRATÉGIQUES (DYNAMIQUE)          */}
      {/* ─────────────────────────────────────────────────────────── */}
      <Page {...PAGE_PAYSAGE}>
        <SlideHeader mandat={mandat} />
        <SlideTitle chapter="CHAPITRE 8" title="Recommandations stratégiques" />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, backgroundColor: CREAM, padding: 14, borderRadius: 3 }}>
            <Text style={{ fontSize: 8, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>
              STRATÉGIE 1 · VENTE EN BLOC
            </Text>
            <Text style={{ fontSize: 10, color: TEXT_PRIMARY, lineHeight: 1.65 }}>
              {av.strategie_bloc || '(à compléter)'}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: CREAM_LIGHT, padding: 14, borderRadius: 3 }}>
            <Text style={{ fontSize: 8, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>
              STRATÉGIE 2 · VENTE À LA DÉCOUPE
            </Text>
            <Text style={{ fontSize: 10, color: TEXT_PRIMARY, lineHeight: 1.65 }}>
              {av.strategie_decoupe || '(à compléter)'}
            </Text>
          </View>
        </View>
        <SlideFooter pageNum={17} />
      </Page>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* SLIDE 18 · NOTRE ÉQUIPE (DYNAMIQUE style plaquette)          */}
      {/* ─────────────────────────────────────────────────────────── */}
      <Page {...PAGE_PAYSAGE}>
        <SlideHeader mandat={mandat} />
        <SlideTitle chapter="" title="Notre équipe" />
        {dossier.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: SAGE, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16, textAlign: 'center' }}>
              Pour ce dossier
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' }}>
              {dossier.map((member, i) => (
                <TeamCard key={`d-${i}`} member={member} />
              ))}
            </View>
          </View>
        )}
        <SlideFooter pageNum={18} />
      </Page>
    </Document>
  );
}
