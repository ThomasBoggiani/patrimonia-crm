// lib/avis/buildPlaquette.js
// PLAQUETTE COMMERCIALE « par étage » — format A4 PORTRAIT, charte « sombre chic »
// de l'avis (Cormorant Garamond + Albert Sans, vert/crème/or). Chaque section = une
// page A4 (794×1123 px @96dpi), rendue via PDFShift (voir renderPlaquettePdf.js).
//
// Vision (Thomas) : 1 étage = 1 page → PLAN « dans un coin » + 3-4 PHOTOS du niveau
// + ligne récap du/des lot(s). Le tag « étage » posé sur photos & plans (MediasInline)
// alimente le regroupement. Blocs auto-effaçables ; sans tag → galerie de secours.
// Règle non négociable : PRIX FAI EN GRAND, honoraires en tout petit (couverture).

import { buildAvisData, esc, num, fmtEUR, fmtM2, etageLabel, A } from '@/lib/avis/buildAvis';
import { chunkPhotos } from '@/lib/pdf/helpers';

// ── charte (constantes) ──────────────────────────────────────────────
const GREEN = '#294029', CREAM = '#F5EDE5', CARD = '#FCFAF5', SAGE = '#8C9978';
const GOLD = '#B08D57', INK = '#241912', LINE = 'rgba(41,64,41,.18)', LINE2 = 'rgba(41,64,41,.16)';
const SERIF = "'Cormorant Garamond',Georgia,serif";
const SANS = "'Albert Sans',system-ui,sans-serif";
const MODE_LABEL = { metro: 'Métro', rer: 'RER', tram: 'Tram', bus: 'Bus' };

// ── briques de charte (A4 portrait) ──────────────────────────────────
const emblem = (h = 40, op = 0.55) => `<img src="${A}/logo-emblem-green.png" alt="" style="height:${h}px;opacity:${op}"/>`;

// Sert les photos Supabase (pleine résolution → PDF énorme) redimensionnées via
// l'optimiseur d'images Vercel (/_next/image). URL relative : résolue contre le
// <base href> = origine du déploiement. Les images non-Supabase (cartes, logos)
// restent inchangées pour éviter tout 400 (hôte non autorisé). w=1400, q=62.
function optImg(url) {
  if (!url) return url;
  try {
    if (!/\.supabase\.co$/i.test(new URL(url).hostname)) return url;
    return `/_next/image?url=${encodeURIComponent(url)}&w=1200&q=62`;
  } catch { return url; }
}

function pHeader(eyebrow, title) {
  return `<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-shrink:0">
    <div>
      <div style="width:52px;height:2px;background:${GOLD};margin:0 0 14px"></div>
      <div style="font-size:13px;font-weight:600;letter-spacing:.32em;text-transform:uppercase;color:${SAGE}">${esc(eyebrow)}</div>
      <h2 style="font-family:${SERIF};font-weight:500;font-size:46px;line-height:1.02;color:${GREEN};margin:8px 0 0">${esc(title)}</h2>
    </div>${emblem(40)}</div>`;
}

function pFooter(d, n) {
  return `<div style="margin-top:18px;flex-shrink:0;display:flex;justify-content:space-between;align-items:center;border-top:1px solid ${LINE2};padding-top:12px;font-size:11px;letter-spacing:.04em;color:rgba(36,25,18,.5)">
    <span style="display:flex;align-items:center;gap:8px">${emblem(15, 0.5)} Immeubles &amp; Patrimoine</span>
    <span>${esc(d.footerAddr)} · ${n}</span></div>`;
}

// Page standard : en-tête + corps (flex:1) + pied. Corps piloté par `body`.
function pPage(eyebrow, title, body, d, n) {
  return `<section style="width:794px;height:1123px;box-sizing:border-box;padding:52px 56px;background:${CREAM};position:relative;font-family:${SANS};color:${INK};overflow:hidden;display:flex;flex-direction:column">
    ${pHeader(eyebrow, title)}
    <div style="flex:1;min-height:0;display:flex;flex-direction:column;padding-top:30px">${body}</div>
    ${pFooter(d, n)}
  </section>`;
}

const photoBox = (u, extra = '') => `<div style="position:relative;min-width:0;min-height:0;border:1px solid ${LINE};overflow:hidden;background:#EDE6DC;${extra}">
  <img src="${esc(optImg(u))}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block"/></div>`;

const planBox = (url, extra = '') => `<div style="border:1px solid ${LINE};background:${CARD};display:flex;align-items:center;justify-content:center;overflow:hidden;padding:14px;${extra}">
  <img src="${esc(optImg(url))}" alt="" style="max-width:100%;max-height:100%;object-fit:contain;display:block"/></div>`;

// Description commerciale « propre » : le champ `description` peut contenir la
// vraie description PUIS de l'analyse IA interne collée à la suite (SYNTHÈSE /
// FORCES / points d'attention / questions au vendeur / emojis…). On coupe avant
// le premier marqueur d'analyse : jamais ça dans une plaquette acquéreur.
function cleanDescription(raw) {
  let t = String(raw || '').trim();
  if (!t) return '';
  const markers = [
    /\banalyse\s+ia\b/i,
    /\bsynth[èe]se\b\s*:?/i,
    /points?\s+d['’]attention/i,
    /strat[ée]gies?\s+de\s+commercialisation/i,
    /questions?\s+[àa]\s+poser/i,
    /profils?\s+acheteurs?\s+cibl/i,
    /[✅⚠🎯❓▶🔍✦►📊💡]/,
  ];
  let cut = t.length;
  for (const re of markers) {
    const mm = t.match(re);
    if (mm && mm.index < cut) cut = mm.index;
  }
  return t.slice(0, cut).replace(/[\s—–-]*\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\s*$/, '').trim();
}

// ── helpers données ──────────────────────────────────────────────────
const hasEtage = (v) => v !== null && v !== undefined && v !== '';
const isImgPlan = (p) =>
  (p?.mime && String(p.mime).startsWith('image')) ||
  /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(p?.url || '');

function floorGroups(m) {
  const medias = Array.isArray(m?.medias) ? m.medias : [];
  const photos = medias.filter((x) => x && x.type === 'photo');
  const plans = medias.filter((x) => x && x.type === 'plan');
  const taggedPhotos = photos.filter((p) => hasEtage(p.etage));
  const taggedPlans = plans.filter((p) => hasEtage(p.etage));
  const floors = [...new Set([...taggedPhotos, ...taggedPlans].map((x) => Number(x.etage)))]
    .filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  return floors.map((f) => {
    const all = taggedPhotos.filter((p) => Number(p.etage) === f);
    const flagged = all.filter((p) => p.plaquette === true);
    const pool = (flagged.length ? flagged : all).sort((a, b) => {
      if (a.cover && !b.cover) return -1;
      if (b.cover && !a.cover) return 1;
      return (a.ordre || 0) - (b.ordre || 0);
    });
    return {
      etage: f,
      photos: pool.slice(0, 4).map((p) => p.url).filter(Boolean),
      plan: taggedPlans.find((p) => Number(p.etage) === f && isImgPlan(p)) || null,
      lots: lotsForFloor(m, f),
    };
  }).filter((g) => g.photos.length || g.plan);
}

function lotsForFloor(m, f) {
  const lots = Array.isArray(m?.etat_locatif) ? m.etat_locatif
    : (Array.isArray(m?.etatLocatif) ? m.etatLocatif : []);
  return lots.filter((l) => l && hasEtage(l.etage) && Number(l.etage) === f);
}

function recapLots(lots) {
  if (!lots || !lots.length) return '';
  const line = (l) => {
    const loue = l.statut === 'loué' || l.statut === 'loue';
    const surf = num(l.surface) ? fmtM2(l.surface) : '';
    return `<div style="display:flex;justify-content:space-between;gap:14px;font-size:16px;color:${INK};border-top:1px solid ${LINE2};padding:9px 0">
      <span><b>${esc(l.numero || 'Lot')}</b> · ${esc(l.type || l.nature || 'Appartement')}</span>
      <span style="color:${SAGE}">${surf}${surf ? ' · ' : ''}${loue ? 'Occupé' : 'Libre'}</span></div>`;
  };
  return `<div style="margin-top:22px;flex-shrink:0">
      <div style="font-size:11px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:${SAGE};margin-bottom:6px">Sur ce niveau</div>
      ${lots.map(line).join('')}</div>`;
}

// Photo de couverture = celle cochée « couverture » ; sinon 1re sélection
// « plaquette » ; sinon 1re photo (ordre) ; sinon façade Street View.
function coverUrlOf(m, d) {
  const ph = (Array.isArray(m?.medias) ? m.medias : []).filter((x) => x && x.type === 'photo');
  const sorted = [...ph].sort((a, b) => {
    if (a.cover && !b.cover) return -1;
    if (b.cover && !a.cover) return 1;
    return (a.ordre || 0) - (b.ordre || 0);
  });
  const sel = sorted.filter((p) => p.plaquette === true);
  return (sorted.find((p) => p.cover) || {}).url || (sel[0] || {}).url || (sorted[0] || {}).url || m?.street_view_image_url || d?.coverPhoto || null;
}

// ── 1. COUVERTURE — photo (haut) + bandeau : ville · titre · adresse · prix ──
function slCover(d, m) {
  const prixFai = num(m?.prix);
  const surface = num(m?.surface);
  const rdt = num(m?.rendement_brut) || 0;
  const coverUrl = coverUrlOf(m, d);

  const photo = coverUrl
    ? `<div style="position:relative;height:560px;overflow:hidden;background:#EDE6DC">
        <img src="${esc(optImg(coverUrl))}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"/>
        <div style="position:absolute;left:0;right:0;bottom:0;padding:22px 0;text-align:center;background:linear-gradient(to top,rgba(36,25,18,.5),transparent)">
          <img src="${A}/logo-wordmark-cream-wide.png" alt="Immeubles & Patrimoine" style="height:34px;opacity:.95"/></div>
      </div>`
    : `<div style="height:560px;display:flex;align-items:center;justify-content:center;background:#EDE6DC">${emblem(180, 0.35)}</div>`;

  const col = (label, value) => `<div><div style="font-size:11px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:${SAGE}">${label}</div>
    <div style="font-family:${SERIF};font-size:36px;color:${GREEN};margin-top:2px;line-height:1">${value}</div></div>`;

  const prixCol = prixFai ? `<div><div style="font-size:11px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:${SAGE}">Prix FAI</div>
      <div style="font-family:${SERIF};font-weight:600;font-size:54px;color:${GREEN};line-height:.95;margin-top:2px">${fmtEUR(prixFai)}</div></div>` : '';

  return `<section style="width:794px;height:1123px;box-sizing:border-box;background:${CREAM};position:relative;font-family:${SANS};color:${INK};overflow:hidden;display:flex;flex-direction:column">
    ${photo}
    <div style="flex:1;padding:44px 56px 0">
      <div style="font-size:13px;font-weight:600;letter-spacing:.32em;text-transform:uppercase;color:${SAGE}">${esc(d.ville || 'À vendre')}</div>
      <h1 style="font-family:${SERIF};font-weight:500;font-size:52px;line-height:1.02;color:${GREEN};margin:12px 0 0">${esc(d.titre)}</h1>
      <div style="font-family:${SERIF};font-style:italic;font-size:24px;color:${INK};margin-top:6px">${esc(d.sousTitre || '')}</div>
      ${m?.adresse ? `<div style="font-size:17px;color:rgba(36,25,18,.7);margin-top:12px">${esc(m.adresse)}</div>` : ''}
      <div style="display:flex;gap:52px;margin-top:34px;align-items:flex-end;flex-wrap:wrap">
        ${surface ? col('Surface', fmtM2(surface)) : ''}
        ${prixCol}
        ${rdt ? col('Rendement', `${String(rdt).replace('.', ',')} %`) : ''}
      </div>
    </div>
  </section>`;
}

// ── 2. LE BIEN — description (haut) + points forts/DPE + chiffres clés (bas) ──
function slLeBien(d, m, n) {
  const dpe = d.dpe || null;
  // Chiffres clés (on retire la carte DPE : elle est reprise en badge dédié).
  const cards = (d.synthese && d.synthese.cards ? d.synthese.cards : [])
    .filter((c) => !/^DPE/i.test(String(c.figure)))
    .slice(0, 6);
  const desc = cleanDescription(m?.description) || cleanDescription(d.pitch);
  const atouts = (d.caracteristiques && Array.isArray(d.caracteristiques.atouts) ? d.caracteristiques.atouts : [])
    .map((x) => String(x || '').trim()).filter(Boolean).slice(0, 5);
  if (!cards.length && !desc && !atouts.length) return '';

  const fs = desc.length > 1100 ? 15 : desc.length > 750 ? 16 : desc.length > 450 ? 18 : 21;
  const pitch = desc
    ? `<div style="flex:1;min-height:0;font-family:${SERIF};font-style:italic;font-size:${fs}px;line-height:1.5;color:${INK}">${esc(desc)}</div>`
    : '<div style="flex:1"></div>';

  // Bloc gauche : points forts + DPE compact
  const atoutItem = (t) => `<div style="display:flex;gap:8px;align-items:baseline;font-size:14px;color:${INK};padding:3px 0"><span style="color:${GOLD}">◆</span><span>${esc(t)}</span></div>`;
  const dpeBadge = dpe ? `<div style="display:flex;align-items:center;gap:10px;margin-top:${atouts.length ? '14px' : '0'}">
      <div style="width:42px;height:42px;border-radius:8px;background:${dpe.color};color:#fff;display:flex;align-items:center;justify-content:center;font-family:${SERIF};font-size:22px;font-weight:600">${esc(dpe.classe)}</div>
      <div><div style="font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:${SAGE}">DPE · ${esc(dpe.niveau)}</div>${dpe.conso ? `<div style="font-size:13px;color:${INK}">${esc(String(dpe.conso))} kWh/m²·an</div>` : ''}</div></div>` : '';
  const leftInner = (atouts.length ? `<div style="font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:${SAGE};margin-bottom:6px">Points forts</div>${atouts.map(atoutItem).join('')}` : '') + dpeBadge;
  const left = leftInner ? `<div style="flex:1.1">${leftInner}</div>` : '';

  // Bloc droit : chiffres clés (2 colonnes compactes)
  const kv = (c) => `<div style="background:${CARD};border:1px solid ${LINE2};padding:11px 14px">
      <div style="font-family:${SERIF};font-size:26px;color:${GREEN};line-height:1">${esc(c.figure)}</div>
      <div style="font-size:9px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:${SAGE};margin-top:3px">${esc(c.label)}</div></div>`;
  const right = cards.length ? `<div style="flex:1">
      <div style="font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:${SAGE};margin-bottom:8px">Chiffres clés</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${cards.map(kv).join('')}</div></div>` : '';

  const bottom = (left || right)
    ? `<div style="display:flex;gap:30px;margin-top:22px;flex-shrink:0;padding-top:18px;border-top:1px solid ${LINE2}">${left}${right}</div>`
    : '';
  return pPage('Le bien', 'En quelques mots', `${pitch}${bottom}`, d, n);
}

// ── 4. L'EMPLACEMENT & LE FONCIER (fusion) ───────────────────────────
//   ½ haut : carte + accès/commodités · ½ bas : cadastre + parcelle + risques
function slEmplacementFoncier(d, n) {
  const L = d.localisation;
  if (!L) return '';
  const hasTop = L.mapUrl || (L.transports || []).length || (L.commodites || []).length;
  const hasBottom = L.cadastreImg || L.cadastreRef || (L.risques || []).length;
  if (!hasTop && !hasBottom) return '';

  // ── demi-haut ──
  const map = L.mapUrl
    ? `<div style="flex:1.1;position:relative;border:1px solid ${LINE};overflow:hidden;background:#EDE6DC"><img src="${esc(optImg(L.mapUrl))}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"/></div>`
    : '';
  const tRow = (t) => `<div style="font-size:13px;color:${INK};padding:3px 0"><span style="font-weight:600;color:${SAGE};text-transform:uppercase;font-size:10px;letter-spacing:.08em">${esc(MODE_LABEL[t.mode] || t.mode)}</span> ${esc(t.name)}${t.lines && t.lines.length ? ` <span style="color:${SAGE}">${esc(t.lines.join(' · '))}</span>` : ''}</div>`;
  const transports = (L.transports || []).slice(0, 5);
  const commodites = (L.commodites || []).slice(0, 5);
  const miniblock = (titre, inner) => inner ? `<div style="margin-bottom:12px"><div style="font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${SAGE};margin-bottom:4px">${esc(titre)}</div>${inner}</div>` : '';
  const commList = commodites.length ? commodites.map((c) => `<div style="font-size:13px;color:${INK};padding:2px 0">${esc(c)}</div>`).join('') : '';
  const acces = `<div style="flex:1;min-width:0">${miniblock('Transports', transports.length ? transports.map(tRow).join('') : '')}${miniblock('Commerces · écoles · santé', commList)}</div>`;
  const top = hasTop ? `<div style="display:flex;gap:24px;flex:1;min-height:0">${map}${acces}</div>` : '';

  // ── demi-bas ──
  const cad = L.cadastreImg
    ? `<div style="flex:1;position:relative;border:1px solid ${LINE};overflow:hidden;background:#EDE6DC"><img src="${esc(optImg(L.cadastreImg))}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain"/></div>`
    : '';
  const info = (k, v) => v ? `<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${SAGE}">${esc(k)}</div><div style="font-family:${SERIF};font-size:24px;color:${GREEN};margin-top:2px">${esc(v)}</div></div>` : '';
  const risqs = (L.risques || []).slice(0, 8);
  const risqBlock = risqs.length ? `<div style="margin-top:6px"><div style="font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${SAGE};margin-bottom:4px">Risques naturels</div><div style="font-size:12px;color:${INK};line-height:1.5">${risqs.map(esc).join(' · ')}</div></div>` : '';
  const parcelle = `<div style="flex:1;min-width:0">${info('Référence cadastrale', L.cadastreRef)}${info('Emprise au sol', L.cadastreSurface)}${risqBlock}</div>`;
  const bottom = hasBottom ? `<div style="display:flex;gap:24px;flex:1;min-height:0;margin-top:20px;padding-top:18px;border-top:1px solid ${LINE2}">${cad}${parcelle}</div>` : '';

  return pPage("L'emplacement", 'Le quartier & le foncier', `${top}${bottom}`, d, n);
}

// ── 6. PAR ÉTAGE — le cœur ───────────────────────────────────────────
function floorBody(g) {
  const P = g.photos;
  const recap = recapLots(g.lots);

  if (g.plan && P.length) {
    const row1 = `<div style="display:flex;gap:16px;height:300px;flex-shrink:0">
        ${planBox(g.plan.url, 'width:46%;flex-shrink:0')}
        ${photoBox(P[0], 'flex:1')}</div>`;
    const rest = P.slice(1, 4);
    const row2 = rest.length ? `<div style="display:flex;gap:16px;height:230px;margin-top:16px;flex-shrink:0">${rest.map((u) => photoBox(u, 'flex:1')).join('')}</div>` : '';
    return `${row1}${row2}${recap}`;
  }
  if (g.plan) {
    return `${planBox(g.plan.url, 'flex:1;min-height:0')}<div style="font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${SAGE};margin-top:12px">Plan de l'étage</div>${recap}`;
  }
  // photos seules
  if (P.length === 1) return `${photoBox(P[0], 'flex:1;min-height:0')}${recap}`;
  const row1 = `<div style="display:flex;gap:16px;height:320px;flex-shrink:0">${P.slice(0, 2).map((u) => photoBox(u, 'flex:1')).join('')}</div>`;
  const rest = P.slice(2, 4);
  const row2 = rest.length ? `<div style="display:flex;gap:16px;height:250px;margin-top:16px;flex-shrink:0">${rest.map((u) => photoBox(u, 'flex:1')).join('')}</div>` : '';
  return `${row1}${row2}${recap}`;
}

function slFloor(d, g, n) {
  return pPage('Le bien étage par étage', etageLabel(g.etage), floorBody(g), d, n);
}

// ── GALERIE de secours (photos non taguées) ──────────────────────────
function slGalerie(d, urls, n, title) {
  const g = urls.slice(0, 6);
  if (!g.length) return '';
  const grid = `<div style="flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;gap:16px">${g.map((u) => photoBox(u)).join('')}</div>`;
  return pPage('Le bien en images', title, grid, d, n);
}

// ── 7. ÉTAT LOCATIF — lots + rendement ───────────────────────────────
function slEtatLocatif(m, d, n) {
  const lots = Array.isArray(m?.etat_locatif) ? m.etat_locatif
    : (Array.isArray(m?.etatLocatif) ? m.etatLocatif : []);
  if (!lots.length) return '';
  const prixN = num(m?.prix_net_vendeur) || num(m?.prix);
  const totalLoyer = lots.reduce((s, l) => s + num(l.loyer), 0);
  const totalLoyerOpt = lots.reduce((s, l) => { const o = num(l.loyer_optimise) || num(l.loyer_potentiel); return s + (o > 0 ? o : num(l.loyer)); }, 0);
  const rdt = (prixN > 0 && totalLoyer > 0) ? Math.round((totalLoyer * 12 / prixN) * 1000) / 10 : null;
  const rdtOpt = (prixN > 0 && totalLoyerOpt > 0) ? Math.round((totalLoyerOpt * 12 / prixN) * 1000) / 10 : null;

  const rdtCard = (label, val, gold) => val != null ? `<div style="flex:1;background:${CARD};border:1px solid ${LINE2};padding:18px 22px">
      <div style="font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${SAGE}">${label}</div>
      <div style="font-family:${SERIF};font-size:40px;font-weight:600;color:${gold ? GOLD : GREEN};margin-top:2px;line-height:1">${String(val).replace('.', ',')} %</div></div>` : '';
  const rdtRow = (rdt != null || rdtOpt != null) ? `<div style="display:flex;gap:16px;margin-bottom:22px;flex-shrink:0">${rdtCard('Rendement présent', rdt)}${rdtCard('Rendement optimisé', rdtOpt, true)}</div>` : '';

  const head = `<div style="display:grid;grid-template-columns:.7fr 2.4fr 1fr 1.2fr .9fr;column-gap:12px;font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:${SAGE};padding-bottom:10px">
    <div>Lot</div><div>Type</div><div style="text-align:right">Surface</div><div style="text-align:right">Loyer/mois</div><div style="text-align:center">Statut</div></div>`;
  const row = (l, i) => {
    const loue = l.statut === 'loué' || l.statut === 'loue';
    return `<div style="display:grid;grid-template-columns:.7fr 2.4fr 1fr 1.2fr .9fr;column-gap:12px;align-items:baseline;padding:9px 0;border-top:1px solid ${LINE2}">
      <div style="font-size:15px;font-weight:600;color:${GREEN}">${esc(l.numero || (i + 1))}</div>
      <div style="font-size:14px;color:${INK}">${esc(l.type || l.nature || '—')}</div>
      <div style="font-size:14px;text-align:right">${num(l.surface) ? fmtM2(l.surface) : '—'}</div>
      <div style="font-size:14px;text-align:right;font-variant-numeric:tabular-nums">${num(l.loyer) ? fmtEUR(l.loyer) : '—'}</div>
      <div style="text-align:center"><span style="font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:2px 8px;color:${loue ? GREEN : '#8a6d1f'};background:${loue ? 'rgba(41,64,41,.1)' : 'rgba(176,141,87,.16)'}">${loue ? 'Loué' : 'Libre'}</span></div></div>`;
  };
  const note = `<div style="margin-top:12px;font-size:11px;font-style:italic;color:rgba(36,25,18,.5)">Loyers hors charges. Rendements calculés sur le prix net vendeur.</div>`;
  const body = `${rdtRow}<div style="flex-shrink:0">${head}${lots.map(row).join('')}</div>${note}`;
  return pPage("L'état locatif", `${lots.length} lot${lots.length > 1 ? 's' : ''}`, body, d, n);
}

// ── 6. NOTRE ÉQUIPE + L'AGENCE ───────────────────────────────────────
//   ½ haut : contact principal (celui qui génère) + dirigeant + équipe
//   ½ bas  : le mot de l'agence (spécialités) + exclusivité en habitation
function slEquipe(d, n, opts) {
  const main = (opts && opts.conseiller && (opts.conseiller.full_name || opts.conseiller.email)) ? opts.conseiller : null;
  const team = (opts && Array.isArray(opts.team)) ? opts.team : [];
  const mainEmail = main && main.email;
  const dirigeant = team.find((t) => t.is_boss && t.email !== mainEmail) || null;
  const others = team.filter((t) => t.email !== mainEmail && (!dirigeant || t.email !== dirigeant.email) && !t.is_boss).slice(0, 4);
  if (!main && !team.length) return '';

  const avatar = (photo, initials, size) => photo
    ? `<img src="${esc(optImg(photo))}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0"/>`
    : `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${GREEN};color:${CREAM};display:flex;align-items:center;justify-content:center;font-family:${SERIF};font-size:${Math.round(size * 0.36)}px;flex-shrink:0">${esc(initials || 'IP')}</div>`;

  const mainBlock = main ? `<div style="display:flex;gap:24px;align-items:center">
      ${avatar(main.photo, main.initiales, 108)}
      <div>
        <div style="font-family:${SERIF};font-size:30px;color:${GREEN};line-height:1">${esc(main.full_name || 'Votre conseiller')}</div>
        <div style="font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${SAGE};margin-top:5px">${esc(main.fonction || 'Conseiller')} · votre interlocuteur</div>
        ${main.telephone ? `<div style="font-size:15px;color:${INK};margin-top:8px">${esc(main.telephone)}</div>` : ''}
        ${main.email ? `<div style="font-size:15px;color:${INK};margin-top:2px">${esc(main.email)}</div>` : ''}
      </div></div>` : '';

  const dirLine = dirigeant ? `<div style="display:flex;align-items:center;gap:12px;margin-top:20px;padding-top:16px;border-top:1px solid ${LINE2}">
      ${avatar(dirigeant.photo, dirigeant.initiales, 46)}
      <div><span style="font-family:${SERIF};font-size:19px;color:${GREEN}">${esc(dirigeant.name)}</span> <span style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:${SAGE}">· ${esc(dirigeant.role || 'Dirigeant')}</span></div></div>` : '';

  const teamRow = others.length ? `<div style="display:flex;gap:26px;flex-wrap:wrap;margin-top:14px">${others.map((t) => `<div style="font-size:13px"><b style="color:${GREEN};font-weight:600">${esc(t.name)}</b><div style="color:${SAGE};font-size:10px;text-transform:uppercase;letter-spacing:.08em">${esc(t.role || 'Conseiller')}</div></div>`).join('')}</div>` : '';

  const chips = ['Immeuble de rapport', 'Vente en bloc', 'Mixte', 'Hôtellerie', 'Bureaux', 'Habitation · exclusivité'];
  const agency = `<div style="margin-top:auto;padding-top:24px;border-top:1px solid ${LINE2}">
      <div style="font-size:11px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:${SAGE};margin-bottom:8px">L'agence</div>
      <div style="font-family:${SERIF};font-size:19px;line-height:1.5;color:${INK}"><b style="color:${GREEN};font-weight:600">Immeubles &amp; Patrimoine</b> — spécialiste de l'<b style="color:${GREEN}">immeuble</b> et de la <b style="color:${GREEN}">vente en bloc</b> : immeubles mixtes, résidentiel, hôtellerie, bureaux. En <b style="color:${GREEN}">habitation</b>, nous n'intervenons qu'en <b style="color:${GREEN}">exclusivité</b>.</div>
      <div style="margin-top:14px;display:flex;gap:7px;flex-wrap:wrap">${chips.map((c) => `<span style="font-size:11px;color:${GREEN};background:rgba(140,153,120,.16);border:1px solid ${LINE2};border-radius:999px;padding:3px 11px">${c}</span>`).join('')}</div>
      <div style="margin-top:14px;font-size:12px;color:rgba(36,25,18,.6)">Immeubles &amp; Patrimoine · www.immeubles-patrimoine.fr</div></div>`;

  const body = `<div style="flex:1;display:flex;flex-direction:column">${mainBlock}${dirLine}${teamRow}${agency}</div>`;
  return pPage('À votre écoute', 'Notre équipe', body, d, n);
}

// ── ASSEMBLAGE ───────────────────────────────────────────────────────
export function buildPlaquetteHtml(m, opts = {}) {
  const d = buildAvisData(m);
  let n = 0;
  const N = () => String(++n).padStart(2, '0');

  const groups = floorGroups(m);

  const photoMedias = (Array.isArray(m?.medias) ? m.medias : []).filter((x) => x && x.type === 'photo');
  const hasSelection = photoMedias.some((p) => p.plaquette === true);
  const inPlaquette = (p) => (hasSelection ? p.plaquette === true : true);
  const coverUrl = coverUrlOf(m, d);
  const untagged = photoMedias
    .filter((p) => inPlaquette(p) && !hasEtage(p.etage))
    .sort((a, b) => {
      if (a.cover && !b.cover) return -1;
      if (b.cover && !a.cover) return 1;
      return (a.ordre || 0) - (b.ordre || 0);
    })
    .map((p) => p.url).filter(Boolean)
    .filter((u) => u !== coverUrl); // pas de doublon avec la couverture
  const galleryTitle = groups.length ? 'Autres vues du bien' : 'Le bien en images';
  // Galerie de secours plafonnée à 12 photos (2 pages) : évite de vider 40 photos
  // dans le PDF (charge trop lourde → PDFShift dépasse le délai de chargement).
  const galleryChunks = untagged.length ? chunkPhotos(untagged.slice(0, 12), 6) : [];

  // Ordre commercial : séduire (couverture) → présenter (le bien) → faire rêver
  // (images / par étage) → situer (emplacement + foncier fusionnés) → rassurer
  // (état locatif, immeuble) → agir (équipe + agence).
  return [
    slCover(d, m),
    slLeBien(d, m, N()),
    ...groups.map((g) => slFloor(d, g, N())),
    ...galleryChunks.map((ch) => slGalerie(d, ch, N(), galleryTitle)),
    slEmplacementFoncier(d, N()),
    slEtatLocatif(m, d, N()),
    slEquipe(d, N(), opts),
  ].filter(Boolean).join('\n');
}
