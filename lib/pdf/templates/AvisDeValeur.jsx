// ═══════════════════════════════════════════════════════════════════
// lib/pdf/templates/AvisDeValeur.jsx — v2
// Avis de valeur PDF React-PDF · A4 paysage
// Lit le schéma JSONB mandat.avis_valeur tel que défini dans AvisDeValeurEditor :
//   localisation, situation_locative, caracteristiques, comparables,
//   swot, methode_m2, methode_capi, reconversion, preconisation
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { LOGO_IP_BASE64 } from '../logo-base64';

// ─── PALETTE ───────────────────────────────────────────────────────
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
  if (isNaN(num) || num === 0) return '—';
  return num.toLocaleString('fr-FR').replace(/[\u00A0\u202F]/g, ' ') + ' €';
}

function formatNum(n) {
  if (n === null || n === undefined || n === '') return '—';
  const num = parseFloat(n);
  if (isNaN(num) || num === 0) return '—';
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

// ─── ÉQUIPE ────────────────────────────────────────────────────────
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

// ─── HEADER / FOOTER ──────────────────────────────────────────────
function SlideHeader({ mandat }) {
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

function SlideFooter({ pageNum }) {
  return (
    <View style={{ position: 'absolute', bottom: 18, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontSize: 7, color: TEXT_HINT }}>www.immeubles-patrimoine.fr</Text>
      <Text style={{ fontSize: 7, color: TEXT_HINT }}>{pageNum}</Text>
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
  avisData = {},
  conseiller,
  teamMembers,
}) {
  const av = avisData || {};

  // Sections du schéma
  const localisation = av.localisation || {};
  const situationLocative = av.situation_locative || {};
  const caracteristiques = av.caracteristiques || {};
  const comparables = av.comparables || {};
  const swot = av.swot || { forces: [], opportunites: [], facteurs_limitatifs: [], menaces: [] };
  const methodeM2 = av.methode_m2 || {};
  const methodeCapi = av.methode_capi || { hypotheses: [] };
  const reconversion = av.reconversion || { usages: [], profils_acquereurs: [] };
  const preconisation = av.preconisation || {};

  const photos = normalizePhotos(mandat);
  const photoChunks = chunkArray(photos, 6);

  const team = buildTeamForAvis({ mandat, sender: conseiller, allMembers: teamMembers || {} });
  const dossier = team;

  const adresseFull = [safeText(mandat?.adresse), safeText(mandat?.ville)].filter(Boolean).join(', ');

  // Assets externes (Phase B)
  const mapStaticSrc = mandat?.map_static_image_url || null;
  const transports = mandat?.transports_data || null;
  const topStations = transports ? (() => {
    const all = [];
    (transports.metro || []).forEach(s => all.push({ ...s, mode: 'metro' }));
    (transports.rer || []).forEach(s => all.push({ ...s, mode: 'rer' }));
    (transports.tram || []).forEach(s => all.push({ ...s, mode: 'tram' }));
    return all.sort((a, b) => a.distance - b.distance).slice(0, 6);
  })() : [];

  // État locatif depuis le mandat
  const lots = Array.isArray(mandat?.etat_locatif) ? mandat.etat_locatif : [];
  const sumLoyer = lots.reduce((s, l) => s + (parseFloat(l.loyer) || 0), 0);
  const sumPotentiel = lots.reduce((s, l) => {
    const p = parseFloat(l.loyer_potentiel) || 0;
    return s + (p > 0 ? p : (parseFloat(l.loyer) || 0));
  }, 0);
  const caActuel = sumLoyer * 12;
  const caPotentiel = sumPotentiel * 12;

  return (
    <Document title={`Avis de valeur — ${safeText(mandat?.nom, 'Mandat')}`} author="Immeubles & Patrimoine">

      {/* ─── 1. COUVERTURE ─── */}
      <Page {...PAGE_PAYSAGE} style={{ ...PAGE_PAYSAGE, backgroundColor: CREAM }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Image src={LOGO_IP_BASE64} style={{ width: 110, height: 110, marginBottom: 30, objectFit: 'contain' }} />
          {photos[0] ? (
            <Image src={photos[0]} style={{ width: '70%', height: 260, objectFit: 'cover', marginBottom: 24, borderRadius: 4 }} />
          ) : (
            <View style={{ width: '70%', height: 260, backgroundColor: CREAM_LIGHT, marginBottom: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}>
              <Text style={{ fontSize: 12, color: TEXT_HINT, fontFamily: 'Helvetica-Oblique' }}>Photo principale du bien</Text>
            </View>
          )}
          <Text style={{ fontSize: 12, color: SAGE, letterSpacing: 4, fontFamily: 'Helvetica-Bold', marginBottom: 12 }}>
            AVIS DE VALEUR
          </Text>
          <Text style={{ fontSize: 26, fontFamily: 'Times-Roman', color: TEXT_PRIMARY, marginBottom: 6, textAlign: 'center' }}>
            {safeText(mandat?.nom, 'Bien à évaluer').toUpperCase()}
          </Text>
          <Text style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 24 }}>
            {adresseFull}
          </Text>
          <Text style={{ fontSize: 9, color: TEXT_HINT, fontStyle: 'italic' }}>
            {av.date_estimation || new Date().toLocaleDateString('fr-FR')} · Validité : {av.validite_mois || 1} mois
          </Text>
        </View>
      </Page>

      {/* ─── 2. AVANT-PROPOS / TRANSITION ─── */}
      <Page {...PAGE_PAYSAGE}>
        <SlideHeader mandat={mandat} />
        <SlideTitle title="Avant-propos" />
        <View style={{ marginTop: 16, paddingHorizontal: 40 }}>
          <Text style={{ fontSize: 11, color: TEXT_PRIMARY, lineHeight: 1.7, textAlign: 'justify' }}>
            Cher Mandant,{'\n\n'}
            Nous vous remercions de la confiance que vous nous accordez pour la valorisation de votre bien situé {adresseFull}.{'\n\n'}
            Le présent avis de valeur a pour objectif de vous éclairer sur la valeur de marché de cet actif, à l'appui de nos analyses, comparables récents et méthodes d'évaluation reconnues.{'\n\n'}
            Nous restons à votre entière disposition pour échanger sur les éléments de ce document.
          </Text>
        </View>
        <View style={{ marginTop: 'auto', alignItems: 'flex-end', paddingRight: 40, marginBottom: 28 }}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: SAGE }}>L'équipe Immeubles & Patrimoine</Text>
          <Text style={{ fontSize: 8, color: TEXT_HINT }}>{av.date_estimation || new Date().toLocaleDateString('fr-FR')}</Text>
        </View>
        <SlideFooter pageNum={2} />
      </Page>

      {/* ─── 3. LOCALISATION ─── */}
      <Page {...PAGE_PAYSAGE}>
        <SlideHeader mandat={mandat} />
        <SlideTitle chapter="CHAPITRE 1" title="Localisation & accessibilité" />
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
            {localisation.commentaire && (
              <>
                <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>ENVIRONNEMENT</Text>
                <Text style={{ fontSize: 9, color: TEXT_PRIMARY, lineHeight: 1.6, marginBottom: 12 }}>
                  {localisation.commentaire}
                </Text>
              </>
            )}

            {/* Transports : prioriser le texte saisi, sinon les stations OSM */}
            {localisation.transports ? (
              <>
                <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>TRANSPORTS & ACCESSIBILITÉ</Text>
                <Text style={{ fontSize: 9, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{localisation.transports}</Text>
              </>
            ) : topStations.length > 0 ? (
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
            ) : null}
          </View>
        </View>
        <SlideFooter pageNum={3} />
      </Page>

      {/* ─── 4. SITUATION LOCATIVE ─── */}
      {lots.length > 0 && (
        <Page {...PAGE_PAYSAGE}>
          <SlideHeader mandat={mandat} />
          <SlideTitle chapter="CHAPITRE 2" title="Situation locative" />

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <View style={{ flex: 1, backgroundColor: CREAM, padding: 10 }}>
              <Text style={{ fontSize: 7, color: SAGE, textTransform: 'uppercase' }}>CA actuel HT/an</Text>
              <Text style={{ fontSize: 17, fontFamily: 'Times-Roman', color: SAGE_DARK, marginTop: 2 }}>
                {caActuel > 0 ? formatPrix(caActuel) : '—'}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#FAEEDA', padding: 10 }}>
              <Text style={{ fontSize: 7, color: '#854F0B', textTransform: 'uppercase' }}>CA potentiel HT/an</Text>
              <Text style={{ fontSize: 17, fontFamily: 'Times-Roman', color: '#412402', marginTop: 2 }}>
                {caPotentiel > 0 ? formatPrix(caPotentiel) : '—'}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: CREAM_LIGHT, padding: 10 }}>
              <Text style={{ fontSize: 7, color: TEXT_HINT, textTransform: 'uppercase' }}>Lots</Text>
              <Text style={{ fontSize: 17, fontFamily: 'Times-Roman', color: TEXT_PRIMARY, marginTop: 2 }}>{lots.length}</Text>
            </View>
          </View>

          <View style={{ borderTopWidth: 0.5, borderTopColor: BORDER }}>
            <View style={{ flexDirection: 'row', backgroundColor: CREAM_LIGHT, paddingVertical: 4, paddingHorizontal: 6 }}>
              <Text style={{ flex: 0.5, fontSize: 7, color: TEXT_MUTED, fontFamily: 'Helvetica-Bold' }}>LOT</Text>
              <Text style={{ flex: 2, fontSize: 7, color: TEXT_MUTED, fontFamily: 'Helvetica-Bold' }}>TYPE</Text>
              <Text style={{ flex: 1, fontSize: 7, color: TEXT_MUTED, fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>SURFACE</Text>
              <Text style={{ flex: 1.2, fontSize: 7, color: TEXT_MUTED, fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>LOYER</Text>
              <Text style={{ flex: 1.2, fontSize: 7, color: TEXT_MUTED, fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>POTENTIEL</Text>
            </View>
            {lots.slice(0, 14).map((lot, i) => (
              <View key={i} style={{ flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.3, borderBottomColor: BORDER_LIGHT }}>
                <Text style={{ flex: 0.5, fontSize: 8, fontFamily: 'Helvetica-Bold' }}>{lot.numero || (i + 1)}</Text>
                <Text style={{ flex: 2, fontSize: 8 }}>{lot.type || lot.nature || '—'}</Text>
                <Text style={{ flex: 1, fontSize: 8, textAlign: 'right' }}>{lot.surface ? `${lot.surface} m²` : '—'}</Text>
                <Text style={{ flex: 1.2, fontSize: 8, textAlign: 'right' }}>{lot.loyer ? formatPrix(lot.loyer) : '—'}</Text>
                <Text style={{ flex: 1.2, fontSize: 8, textAlign: 'right', color: '#854F0B' }}>{lot.loyer_potentiel ? formatPrix(lot.loyer_potentiel) : '—'}</Text>
              </View>
            ))}
          </View>

          {situationLocative.commentaire && (
            <View style={{ marginTop: 12, padding: 10, backgroundColor: CREAM_LIGHT, borderLeftWidth: 2, borderLeftColor: SAGE }}>
              <Text style={{ fontSize: 9, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{situationLocative.commentaire}</Text>
            </View>
          )}

          <SlideFooter pageNum={4} />
        </Page>
      )}

      {/* ─── 5. CARACTÉRISTIQUES ─── */}
      <Page {...PAGE_PAYSAGE}>
        <SlideHeader mandat={mandat} />
        <SlideTitle chapter="CHAPITRE 3" title="Caractéristiques & atouts" />
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <View style={{ flex: 1.4 }}>
            <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>DESCRIPTION</Text>
            <Text style={{ fontSize: 9, color: TEXT_PRIMARY, lineHeight: 1.6 }}>
              {safeText(mandat?.description, caracteristiques.commentaire || 'Description non renseignée.')}
            </Text>

            {caracteristiques.distribution && (
              <>
                <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginTop: 12, marginBottom: 4 }}>DISTRIBUTION PAR NIVEAU</Text>
                <Text style={{ fontSize: 9, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{caracteristiques.distribution}</Text>
              </>
            )}

            {Array.isArray(caracteristiques.atouts_distinctifs) && caracteristiques.atouts_distinctifs.length > 0 && (
              <>
                <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginTop: 12, marginBottom: 4 }}>ATOUTS DISTINCTIFS</Text>
                {caracteristiques.atouts_distinctifs.map((a, i) => (
                  <Text key={i} style={{ fontSize: 9, color: TEXT_PRIMARY, lineHeight: 1.6 }}>• {a}</Text>
                ))}
              </>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 6 }}>CARACTÉRISTIQUES</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {mandat?.surface && (
                <View style={{ width: '48%', backgroundColor: CREAM, padding: 8 }}>
                  <Text style={{ fontSize: 7, color: TEXT_HINT, letterSpacing: 0.5, textTransform: 'uppercase' }}>Surface</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Times-Roman', color: SAGE, marginTop: 2 }}>{formatSurface(mandat.surface)}</Text>
                </View>
              )}
              {mandat?.type && (
                <View style={{ width: '48%', backgroundColor: CREAM, padding: 8 }}>
                  <Text style={{ fontSize: 7, color: TEXT_HINT, letterSpacing: 0.5, textTransform: 'uppercase' }}>Type</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Times-Roman', color: SAGE, marginTop: 2 }}>{safeText(mandat.type, '—')}</Text>
                </View>
              )}
              {mandat?.nb_lots && (
                <View style={{ width: '48%', backgroundColor: CREAM, padding: 8 }}>
                  <Text style={{ fontSize: 7, color: TEXT_HINT, letterSpacing: 0.5, textTransform: 'uppercase' }}>Nombre de lots</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Times-Roman', color: SAGE, marginTop: 2 }}>{mandat.nb_lots}</Text>
                </View>
              )}
              {caracteristiques.annee_construction && (
                <View style={{ width: '48%', backgroundColor: CREAM, padding: 8 }}>
                  <Text style={{ fontSize: 7, color: TEXT_HINT, letterSpacing: 0.5, textTransform: 'uppercase' }}>Construction</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Times-Roman', color: SAGE, marginTop: 2 }}>{caracteristiques.annee_construction}</Text>
                </View>
              )}
              {caracteristiques.architecte && (
                <View style={{ width: '48%', backgroundColor: CREAM, padding: 8 }}>
                  <Text style={{ fontSize: 7, color: TEXT_HINT, letterSpacing: 0.5, textTransform: 'uppercase' }}>Architecte</Text>
                  <Text style={{ fontSize: 11, fontFamily: 'Times-Roman', color: SAGE, marginTop: 2 }}>{caracteristiques.architecte}</Text>
                </View>
              )}
              {mandat?.dpe_consommation && (
                <View style={{ width: '48%', backgroundColor: CREAM, padding: 8 }}>
                  <Text style={{ fontSize: 7, color: TEXT_HINT, letterSpacing: 0.5, textTransform: 'uppercase' }}>DPE</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Times-Roman', color: SAGE, marginTop: 2 }}>{mandat.dpe_consommation}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <SlideFooter pageNum={5} />
      </Page>

      {/* ─── 6. COMPARABLES MARCHÉ ─── */}
      <Page {...PAGE_PAYSAGE}>
        <SlideHeader mandat={mandat} />
        <SlideTitle chapter="CHAPITRE 4" title="Comparables & données marché" />

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <View style={{ flex: 1, backgroundColor: CREAM_LIGHT, padding: 10 }}>
            <Text style={{ fontSize: 7, color: TEXT_HINT, letterSpacing: 1, textTransform: 'uppercase' }}>Prix zone min</Text>
            <Text style={{ fontSize: 15, fontFamily: 'Times-Roman', color: SAGE, marginTop: 2 }}>
              {comparables.prix_zone_min ? `${formatNum(comparables.prix_zone_min)} €/m²` : '—'}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: CREAM_LIGHT, padding: 10 }}>
            <Text style={{ fontSize: 7, color: TEXT_HINT, letterSpacing: 1, textTransform: 'uppercase' }}>Prix zone max</Text>
            <Text style={{ fontSize: 15, fontFamily: 'Times-Roman', color: SAGE, marginTop: 2 }}>
              {comparables.prix_zone_max ? `${formatNum(comparables.prix_zone_max)} €/m²` : '—'}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: CREAM_LIGHT, padding: 10 }}>
            <Text style={{ fontSize: 7, color: TEXT_HINT, letterSpacing: 1, textTransform: 'uppercase' }}>Rdt zone min</Text>
            <Text style={{ fontSize: 15, fontFamily: 'Times-Roman', color: SAGE, marginTop: 2 }}>
              {comparables.rendement_zone_min ? `${comparables.rendement_zone_min}%` : '—'}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: CREAM_LIGHT, padding: 10 }}>
            <Text style={{ fontSize: 7, color: TEXT_HINT, letterSpacing: 1, textTransform: 'uppercase' }}>Rdt zone max</Text>
            <Text style={{ fontSize: 15, fontFamily: 'Times-Roman', color: SAGE, marginTop: 2 }}>
              {comparables.rendement_zone_max ? `${comparables.rendement_zone_max}%` : '—'}
            </Text>
          </View>
        </View>

        {comparables.transactions_recentes && (
          <>
            <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 6 }}>
              TRANSACTIONS RÉCENTES
            </Text>
            <View style={{ padding: 10, backgroundColor: CREAM_LIGHT, borderRadius: 3 }}>
              <Text style={{ fontSize: 8, color: TEXT_PRIMARY, lineHeight: 1.7, fontFamily: 'Courier' }}>
                {comparables.transactions_recentes}
              </Text>
            </View>
          </>
        )}

        {comparables.commentaire && (
          <View style={{ marginTop: 10, padding: 10, backgroundColor: CREAM_LIGHT, borderLeftWidth: 2, borderLeftColor: SAGE }}>
            <Text style={{ fontSize: 9, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{comparables.commentaire}</Text>
          </View>
        )}

        <SlideFooter pageNum={6} />
      </Page>

      {/* ─── 7. ANALYSE SWOT ─── */}
      <Page {...PAGE_PAYSAGE}>
        <SlideHeader mandat={mandat} />
        <SlideTitle chapter="CHAPITRE 5" title="Analyse SWOT" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <View style={{ width: '48%', backgroundColor: COLOR_FORCE_BG, padding: 12, borderRadius: 3 }}>
            <Text style={{ fontSize: 9, color: COLOR_FORCE_BORDER, letterSpacing: 1.5, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>
              ▲  FORCES
            </Text>
            {((swot.forces && swot.forces.length > 0) ? swot.forces : ['(à compléter)']).map((f, i) => (
              <Text key={i} style={{ fontSize: 9, color: COLOR_FORCE_TEXT, lineHeight: 1.6, marginBottom: 2 }}>• {f}</Text>
            ))}
          </View>
          <View style={{ width: '48%', backgroundColor: COLOR_OPP_BG, padding: 12, borderRadius: 3 }}>
            <Text style={{ fontSize: 9, color: COLOR_OPP_BORDER, letterSpacing: 1.5, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>
              ○  OPPORTUNITÉS
            </Text>
            {((swot.opportunites && swot.opportunites.length > 0) ? swot.opportunites : ['(à compléter)']).map((f, i) => (
              <Text key={i} style={{ fontSize: 9, color: COLOR_OPP_TEXT, lineHeight: 1.6, marginBottom: 2 }}>• {f}</Text>
            ))}
          </View>
          <View style={{ width: '48%', backgroundColor: COLOR_FAIB_BG, padding: 12, borderRadius: 3 }}>
            <Text style={{ fontSize: 9, color: COLOR_FAIB_BORDER, letterSpacing: 1.5, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>
              ▼  FACTEURS LIMITATIFS
            </Text>
            {((swot.facteurs_limitatifs && swot.facteurs_limitatifs.length > 0) ? swot.facteurs_limitatifs : ['(à compléter)']).map((f, i) => (
              <Text key={i} style={{ fontSize: 9, color: COLOR_FAIB_TEXT, lineHeight: 1.6, marginBottom: 2 }}>• {f}</Text>
            ))}
          </View>
          <View style={{ width: '48%', backgroundColor: COLOR_MEN_BG, padding: 12, borderRadius: 3 }}>
            <Text style={{ fontSize: 9, color: COLOR_MEN_BORDER, letterSpacing: 1.5, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>
              ⚠  MENACES
            </Text>
            {((swot.menaces && swot.menaces.length > 0) ? swot.menaces : ['(à compléter)']).map((f, i) => (
              <Text key={i} style={{ fontSize: 9, color: COLOR_MEN_TEXT, lineHeight: 1.6, marginBottom: 2 }}>• {f}</Text>
            ))}
          </View>
        </View>
        <SlideFooter pageNum={7} />
      </Page>

      {/* ─── 8. PHOTOS ─── */}
      {photoChunks.map((chunk, i) => (
        <Page key={`photos-${i}`} {...PAGE_PAYSAGE}>
          <SlideHeader mandat={mandat} />
          <SlideTitle chapter="" title={i === 0 ? 'Portfolio photos' : 'Portfolio photos (suite)'} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {chunk.map((url, j) => (
              <View key={j} style={{ width: '32%', height: 165 }}>
                <Image src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 3 }} />
              </View>
            ))}
          </View>
          <SlideFooter pageNum={8 + i} />
        </Page>
      ))}

      {/* ─── 9. PLANS ─── */}
      {(mandat?.plans || []).length > 0 && mandat.plans.map((plan, i) => (
        <Page key={`plans-${i}`} {...PAGE_PAYSAGE}>
          <SlideHeader mandat={mandat} />
          <SlideTitle title={i === 0 ? 'Plans' : 'Plans (suite)'} />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Image src={plan.url || plan} style={{ width: '90%', height: 350, objectFit: 'contain' }} />
            {plan.caption && (
              <Text style={{ fontSize: 9, color: TEXT_MUTED, marginTop: 8, fontStyle: 'italic' }}>{plan.caption}</Text>
            )}
          </View>
          <SlideFooter pageNum={9 + i} />
        </Page>
      ))}

      {/* ─── 10. MÉTHODE M² ─── */}
      <Page {...PAGE_PAYSAGE}>
        <SlideHeader mandat={mandat} />
        <SlideTitle chapter="CHAPITRE 6" title="Méthodologie d'évaluation" />

        <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 6 }}>
          MÉTHODE 1 · COMPARAISON AU M²
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
          {[
            { key: 'valeur_basse', label: 'Valeur basse', highlight: false },
            { key: 'valeur_centrale', label: 'Valeur centrale', highlight: true },
            { key: 'valeur_haute', label: 'Valeur haute', highlight: false },
          ].map((v) => {
            const item = methodeM2[v.key] || {};
            return (
              <View key={v.key} style={{
                flex: 1,
                backgroundColor: v.highlight ? CREAM : CREAM_LIGHT,
                padding: 10,
                borderLeftWidth: 2,
                borderLeftColor: v.highlight ? SAGE : BORDER
              }}>
                <Text style={{ fontSize: 7, color: v.highlight ? SAGE : TEXT_HINT, fontFamily: v.highlight ? 'Helvetica-Bold' : 'Helvetica' }}>
                  {v.label.toUpperCase()}
                </Text>
                <Text style={{ fontSize: 13, fontFamily: 'Times-Roman', color: v.highlight ? SAGE : TEXT_HINT, marginTop: 2 }}>
                  {item.prix_m2 ? `${formatNum(item.prix_m2)} €/m²` : '—'}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: 'Times-Roman', color: v.highlight ? SAGE_DARK : TEXT_PRIMARY, marginTop: 4, fontFamily: v.highlight ? 'Helvetica-Bold' : 'Times-Roman' }}>
                  {item.valeur_totale ? formatPrix(item.valeur_totale) : '—'}
                </Text>
                {item.commentaire && (
                  <Text style={{ fontSize: 6, color: v.highlight ? SAGE : TEXT_HINT, marginTop: 4 }}>{item.commentaire}</Text>
                )}
              </View>
            );
          })}
        </View>

        {Array.isArray(methodeCapi.hypotheses) && methodeCapi.hypotheses.length > 0 && (
          <>
            <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 6 }}>
              MÉTHODE 2 · CAPITALISATION DES LOYERS
              {methodeCapi.ca_base ? ` · CA base : ${formatPrix(methodeCapi.ca_base)}` : ''}
            </Text>
            <View style={{ borderTopWidth: 0.5, borderTopColor: BORDER }}>
              <View style={{ flexDirection: 'row', backgroundColor: CREAM_LIGHT, paddingVertical: 4, paddingHorizontal: 6 }}>
                <Text style={{ flex: 1, fontSize: 7, color: TEXT_MUTED, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' }}>Rendement</Text>
                <Text style={{ flex: 1.5, fontSize: 7, color: TEXT_MUTED, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', textAlign: 'right' }}>Valeur acte</Text>
                <Text style={{ flex: 3, fontSize: 7, color: TEXT_MUTED, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' }}>Lecture marché</Text>
              </View>
              {methodeCapi.hypotheses.map((h, i) => (
                <View key={i} style={{ flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.3, borderBottomColor: BORDER_LIGHT }}>
                  <Text style={{ flex: 1, fontSize: 8 }}>{h.rendement_pct ? `${h.rendement_pct}%` : '—'}</Text>
                  <Text style={{ flex: 1.5, fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>{h.valeur_acte ? formatPrix(h.valeur_acte) : '—'}</Text>
                  <Text style={{ flex: 3, fontSize: 8, color: TEXT_MUTED }}>{h.lecture || '—'}</Text>
                </View>
              ))}
            </View>
            {methodeCapi.zone_atterrissage && (
              <View style={{ marginTop: 10, padding: 10, backgroundColor: CREAM_LIGHT, borderLeftWidth: 2, borderLeftColor: SAGE }}>
                <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>ZONE D'ATTERRISSAGE</Text>
                <Text style={{ fontSize: 9, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{methodeCapi.zone_atterrissage}</Text>
              </View>
            )}
          </>
        )}

        <SlideFooter pageNum={10} />
      </Page>

      {/* ─── 11. RECONVERSION ─── */}
      {(reconversion.usages?.length > 0 || reconversion.bilan_financier || reconversion.profils_acquereurs?.length > 0) && (
        <Page {...PAGE_PAYSAGE}>
          <SlideHeader mandat={mandat} />
          <SlideTitle chapter="CHAPITRE 7" title="Potentiel de reconversion" />

          {Array.isArray(reconversion.usages) && reconversion.usages.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 6 }}>
                USAGES ALTERNATIFS ENVISAGEABLES
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {reconversion.usages.map((u, i) => (
                  <View key={i} style={{ width: '48%', backgroundColor: CREAM_LIGHT, padding: 10, borderRadius: 3 }}>
                    <Text style={{ fontSize: 10, color: SAGE_DARK, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>
                      {u.titre || `Usage ${i + 1}`}
                    </Text>
                    {u.description && (
                      <Text style={{ fontSize: 8, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{u.description}</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {reconversion.bilan_financier && (
            <View style={{ marginBottom: 10, padding: 10, backgroundColor: CREAM, borderLeftWidth: 2, borderLeftColor: SAGE }}>
              <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>BILAN FINANCIER INDICATIF</Text>
              <Text style={{ fontSize: 9, color: TEXT_PRIMARY, lineHeight: 1.7, fontFamily: 'Courier' }}>{reconversion.bilan_financier}</Text>
            </View>
          )}

          {Array.isArray(reconversion.profils_acquereurs) && reconversion.profils_acquereurs.length > 0 && (
            <View>
              <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 6 }}>PROFILS D'ACQUÉREURS CIBLÉS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {reconversion.profils_acquereurs.map((p, i) => (
                  <View key={i} style={{ backgroundColor: CREAM, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 3 }}>
                    <Text style={{ fontSize: 9, color: SAGE_DARK }}>{p}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <SlideFooter pageNum={11} />
        </Page>
      )}

      {/* ─── 12. PRÉCONISATION + 3 PRIX ─── */}
      <Page {...PAGE_PAYSAGE}>
        <SlideHeader mandat={mandat} />
        <SlideTitle chapter="CHAPITRE 8" title="Préconisation & estimation" />

        {preconisation.recommandation && (
          <View style={{ marginBottom: 14, padding: 12, backgroundColor: CREAM_LIGHT, borderLeftWidth: 2, borderLeftColor: SAGE }}>
            <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>NOTRE RECOMMANDATION</Text>
            <Text style={{ fontSize: 10, color: TEXT_PRIMARY, lineHeight: 1.65 }}>{preconisation.recommandation}</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, backgroundColor: CREAM, padding: 14, borderRadius: 3, alignItems: 'center', borderWidth: 1.5, borderColor: SAGE }}>
            <Text style={{ fontSize: 8, color: SAGE, letterSpacing: 1.5, fontFamily: 'Helvetica-Bold' }}>PRIX COUP DE CŒUR</Text>
            <Text style={{ fontSize: 19, fontFamily: 'Times-Roman', color: SAGE_DARK, marginTop: 10, fontFamily: 'Helvetica-Bold' }}>
              {preconisation.prix_coup_de_coeur ? `${formatPrix(preconisation.prix_coup_de_coeur)} FAI` : '—'}
            </Text>
            <Text style={{ fontSize: 8, color: SAGE, marginTop: 4 }}>Acquéreur convaincu</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: CREAM_LIGHT, padding: 14, borderRadius: 3, alignItems: 'center' }}>
            <Text style={{ fontSize: 8, color: TEXT_HINT, letterSpacing: 1.5, fontFamily: 'Helvetica-Bold' }}>PRIX DE MARCHÉ</Text>
            <Text style={{ fontSize: 19, fontFamily: 'Times-Roman', color: TEXT_PRIMARY, marginTop: 10 }}>
              {preconisation.prix_marche ? `${formatPrix(preconisation.prix_marche)} FAI` : '—'}
            </Text>
            <Text style={{ fontSize: 8, color: TEXT_HINT, marginTop: 4 }}>Recommandé</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: CREAM_LIGHT, padding: 14, borderRadius: 3, alignItems: 'center' }}>
            <Text style={{ fontSize: 8, color: TEXT_HINT, letterSpacing: 1.5, fontFamily: 'Helvetica-Bold' }}>PRIX PLANCHER</Text>
            <Text style={{ fontSize: 19, fontFamily: 'Times-Roman', color: TEXT_PRIMARY, marginTop: 10 }}>
              {preconisation.prix_plancher ? `${formatPrix(preconisation.prix_plancher)} FAI` : '—'}
            </Text>
            <Text style={{ fontSize: 8, color: TEXT_HINT, marginTop: 4 }}>Base négociation</Text>
          </View>
        </View>

        <Text style={{ marginTop: 14, fontSize: 7, color: TEXT_HINT, fontStyle: 'italic', textAlign: 'center' }}>
          Honoraires d'agence inclus {preconisation.honoraires_pct ? `${preconisation.honoraires_pct}%` : ''} · Validité de l'avis : {av.validite_mois || 1} mois
        </Text>

        {preconisation.avis_client && (
          <View style={{ marginTop: 12, padding: 10, backgroundColor: CREAM, borderLeftWidth: 2, borderLeftColor: SAGE }}>
            <Text style={{ fontSize: 7, color: SAGE, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>TÉMOIGNAGE CLIENT</Text>
            <Text style={{ fontSize: 9, color: TEXT_PRIMARY, lineHeight: 1.6, fontStyle: 'italic' }}>« {preconisation.avis_client} »</Text>
          </View>
        )}

        <SlideFooter pageNum={12} />
      </Page>

      {/* ─── 13. NOTRE ÉQUIPE ─── */}
      <Page {...PAGE_PAYSAGE}>
        <SlideHeader mandat={mandat} />
        <SlideTitle title="Notre équipe à votre service" />
        {dossier.length > 0 ? (
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: SAGE, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16, textAlign: 'center' }}>
              Pour ce dossier
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' }}>
              {dossier.map((member, i) => (
                <TeamCard key={`d-${i}`} member={member} />
              ))}
            </View>
          </View>
        ) : (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ fontSize: 10, color: TEXT_HINT, fontStyle: 'italic' }}>Équipe non chargée</Text>
          </View>
        )}
        <SlideFooter pageNum={13} />
      </Page>
    </Document>
  );
}
