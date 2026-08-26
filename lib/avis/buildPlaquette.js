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
  <img src="${esc(u)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block"/></div>`;

const planBox = (url, extra = '') => `<div style="border:1px solid ${LINE};background:${CARD};display:flex;align-items:center;justify-content:center;overflow:hidden;padding:14px;${extra}">
  <img src="${esc(url)}" alt="" style="max-width:100%;max-height:100%;object-fit:contain;display:block"/></div>`;

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

// ── 1. COUVERTURE — prix FAI en grand, honoraires en tout petit ──────
function slCover(d, m) {
  const prixFai = num(m?.prix);
  const net = num(m?.prix_net_vendeur);
  const hono = num(m?.honoraires_montant) || (prixFai && net ? prixFai - net : 0);
  const honoPct = (hono && net) ? Math.round((hono / net) * 1000) / 10 : 0;
  const surface = num(m?.surface);
  const rdt = num(m?.rendement_brut) || 0;

  const photo = d.coverPhoto
    ? `<div style="position:relative;height:700px;overflow:hidden;background:#EDE6DC">
        <img src="${esc(d.coverPhoto)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"/>
        <div style="position:absolute;left:0;right:0;bottom:0;padding:22px 0;text-align:center;background:linear-gradient(to top,rgba(36,25,18,.5),transparent)">
          <img src="${A}/logo-wordmark-cream-wide.png" alt="Immeubles & Patrimoine" style="height:34px;opacity:.95"/></div>
      </div>`
    : `<div style="height:700px;display:flex;align-items:center;justify-content:center;background:#EDE6DC">${emblem(180, 0.35)}</div>`;

  const col = (label, value) => `<div><div style="font-size:11px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:${SAGE}">${label}</div>
    <div style="font-family:${SERIF};font-size:34px;color:${GREEN};margin-top:2px;line-height:1">${value}</div></div>`;

  const prixCol = prixFai ? `<div>
      <div style="font-size:11px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:${SAGE}">Prix honoraires inclus</div>
      <div style="font-family:${SERIF};font-weight:600;font-size:52px;color:${GREEN};line-height:.95;margin-top:2px">${fmtEUR(prixFai)}</div>
      ${hono ? `<div style="font-size:11px;color:rgba(36,25,18,.55);margin-top:5px">dont honoraires ${fmtEUR(hono)}${honoPct ? ` (${String(honoPct).replace('.', ',')} %)` : ''} à la charge de l'acquéreur</div>` : ''}
    </div>` : '';

  return `<section style="width:794px;height:1123px;box-sizing:border-box;background:${CREAM};position:relative;font-family:${SANS};color:${INK};overflow:hidden;display:flex;flex-direction:column">
    ${photo}
    <div style="flex:1;padding:38px 56px 0">
      <div style="font-size:13px;font-weight:600;letter-spacing:.32em;text-transform:uppercase;color:${SAGE}">${esc(d.ville || 'À vendre')}</div>
      <h1 style="font-family:${SERIF};font-weight:500;font-size:52px;line-height:1.0;color:${GREEN};margin:12px 0 0">${esc(d.titre)}</h1>
      <div style="font-family:${SERIF};font-style:italic;font-size:24px;color:${INK};margin-top:6px">${esc(d.sousTitre || '')}</div>
      <div style="display:flex;gap:48px;margin-top:30px;align-items:flex-end;flex-wrap:wrap">
        ${surface ? col('Surface', fmtM2(surface)) : ''}
        ${prixCol}
        ${rdt ? col('Rendement', `${String(rdt).replace('.', ',')} %`) : ''}
      </div>
    </div>
  </section>`;
}

// ── 3. LE BIEN — pitch + chiffres clés ───────────────────────────────
function slLeBien(d, n) {
  const cards = (d.synthese && d.synthese.cards ? d.synthese.cards : []).slice(0, 6);
  if (!cards.length && !d.pitch) return '';
  const card = (c) => `<div style="background:${CARD};border:1px solid ${LINE2};padding:22px 24px">
    <div style="font-family:${SERIF};font-size:40px;color:${GREEN};line-height:1">${esc(c.figure)}</div>
    <div style="font-size:11px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:${SAGE};margin-top:6px">${esc(c.label)}</div>
    ${c.desc ? `<div style="font-size:13px;line-height:1.3;color:rgba(36,25,18,.8);margin-top:4px">${esc(c.desc)}</div>` : ''}</div>`;
  const pitch = d.pitch ? `<div style="font-family:${SERIF};font-style:italic;font-size:27px;line-height:1.4;color:${INK};max-width:600px">${esc(d.pitch)}</div>` : '';
  const grid = cards.length ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:${pitch ? '40px' : '0'}">${cards.map(card).join('')}</div>` : '';
  return pPage('Le bien', 'En quelques mots', `${pitch}${grid}`, d, n);
}

// ── 4. LOCALISATION — carte + transports + commodités ────────────────
function slLocalisation(d, n) {
  const L = d.localisation;
  if (!L || (!L.mapUrl && !(L.transports || []).length && !(L.commodites || []).length)) return '';
  const map = L.mapUrl
    ? `<div style="height:420px;position:relative;border:1px solid ${LINE};overflow:hidden;background:#EDE6DC;flex-shrink:0"><img src="${esc(L.mapUrl)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"/></div>`
    : '';
  const tRow = (t) => `<div style="font-size:15px;color:${INK};padding:5px 0">
      <span style="font-weight:600;color:${SAGE};text-transform:uppercase;font-size:11px;letter-spacing:.1em">${esc(MODE_LABEL[t.mode] || t.mode)}</span>
      &nbsp;${esc(t.name)}${t.lines && t.lines.length ? ` <span style="color:${SAGE}">${esc(t.lines.join(' · '))}</span>` : ''}</div>`;
  const transports = (L.transports || []).slice(0, 6);
  const commodites = (L.commodites || []).slice(0, 6);
  const bloc = (titre, inner) => inner ? `<div style="flex:1"><div style="font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:${SAGE};margin-bottom:8px">${esc(titre)}</div>${inner}</div>` : '';
  const commList = commodites.length ? commodites.map((c) => `<div style="font-size:15px;color:${INK};padding:4px 0">${esc(c)}</div>`).join('') : '';
  const cols = `<div style="display:flex;gap:36px;margin-top:26px">
      ${bloc('Transports', transports.length ? transports.map(tRow).join('') : '')}
      ${bloc('Commerces · écoles · santé', commList)}</div>`;
  const comment = L.commentaire ? `<div style="font-size:15px;line-height:1.5;color:rgba(36,25,18,.7);margin-top:22px">${esc(L.commentaire)}</div>` : '';
  return pPage("L'emplacement", L.title || 'Le quartier au quotidien', `${map}${cols}${comment}`, d, n);
}

// ── 5. LE FONCIER — cadastre ─────────────────────────────────────────
function slCadastre(d, n) {
  const L = d.localisation;
  if (!L || (!L.cadastreImg && !L.cadastreRef)) return '';
  const img = L.cadastreImg
    ? `<div style="flex:1;min-height:0;border:1px solid ${LINE};overflow:hidden;background:#EDE6DC;position:relative"><img src="${esc(L.cadastreImg)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain"/></div>`
    : '';
  const info = (k, v) => v ? `<div><div style="font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:${SAGE}">${esc(k)}</div><div style="font-family:${SERIF};font-size:34px;color:${GREEN};margin-top:4px">${esc(v)}</div></div>` : '';
  const row = `<div style="display:flex;gap:48px;margin-top:24px;flex-shrink:0">${info('Référence cadastrale', L.cadastreRef)}${info('Emprise au sol', L.cadastreSurface)}</div>`;
  return pPage('Le foncier', 'La parcelle', `${img}${row}`, d, n);
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

// ── 8. RISQUES NATURELS ──────────────────────────────────────────────
function slRisques(d, n) {
  const r = (d.localisation && d.localisation.risques) ? d.localisation.risques : [];
  if (!r.length) return '';
  const item = (t) => `<div style="display:flex;gap:12px;align-items:baseline;font-size:18px;color:${INK};padding:10px 0;border-top:1px solid ${LINE2}"><span style="color:${GOLD}">◆</span><span>${esc(t)}</span></div>`;
  const note = `<div style="margin-top:20px;font-size:12px;font-style:italic;color:rgba(36,25,18,.5)">Source : Géorisques (gouv.fr) — information non contractuelle (art. L125-5 du code de l'environnement).</div>`;
  return pPage('Information réglementaire', 'Risques naturels', `${r.map(item).join('')}${note}`, d, n);
}

// ── 9. NOTRE ÉQUIPE — le conseiller ──────────────────────────────────
function slEquipe(d, n, conseiller) {
  if (!conseiller || !(conseiller.full_name || conseiller.email)) return '';
  const c = conseiller;
  const avatar = c.photo
    ? `<img src="${esc(c.photo)}" alt="" style="width:120px;height:120px;border-radius:50%;object-fit:cover;flex-shrink:0"/>`
    : `<div style="width:120px;height:120px;border-radius:50%;background:${GREEN};color:${CREAM};display:flex;align-items:center;justify-content:center;font-family:${SERIF};font-size:44px;flex-shrink:0">${esc(c.initiales || 'IP')}</div>`;
  const line = (v) => v ? `<div style="font-size:16px;color:${INK};margin-top:4px">${esc(v)}</div>` : '';
  const body = `<div style="flex:1;display:flex;flex-direction:column;justify-content:center">
      <div style="display:flex;gap:28px;align-items:center">${avatar}
        <div>
          <div style="font-family:${SERIF};font-size:34px;color:${GREEN}">${esc(c.full_name || 'Votre conseiller')}</div>
          <div style="font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:${SAGE};margin-top:4px">${esc(c.fonction || 'Conseiller')}</div>
          ${line(c.telephone)}${line(c.email)}
        </div>
      </div>
      <div style="margin-top:40px;padding-top:22px;border-top:1px solid ${LINE2};font-size:14px;color:rgba(36,25,18,.7);line-height:1.5">Immeubles &amp; Patrimoine · www.immeubles-patrimoine.fr</div>
    </div>`;
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
  const untagged = photoMedias
    .filter((p) => inPlaquette(p) && !hasEtage(p.etage))
    .sort((a, b) => {
      if (a.cover && !b.cover) return -1;
      if (b.cover && !a.cover) return 1;
      return (a.ordre || 0) - (b.ordre || 0);
    })
    .map((p) => p.url).filter(Boolean);
  const galleryTitle = groups.length ? 'Autres vues du bien' : 'Le bien en images';
  const galleryChunks = untagged.length ? chunkPhotos(untagged, 6) : [];

  return [
    slCover(d, m),
    slLeBien(d, N()),
    slLocalisation(d, N()),
    ...groups.map((g) => slFloor(d, g, N())),
    ...galleryChunks.map((ch) => slGalerie(d, ch, N(), galleryTitle)),
    slCadastre(d, N()),
    slEtatLocatif(m, d, N()),
    slRisques(d, N()),
    slEquipe(d, N(), opts.conseiller),
  ].filter(Boolean).join('\n');
}
