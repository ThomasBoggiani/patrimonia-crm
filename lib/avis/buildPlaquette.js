// lib/avis/buildPlaquette.js
// Génère la PLAQUETTE COMMERCIALE « par étage » à partir du mandat, en réutilisant
// EXACTEMENT la charte « sombre chic » de l'avis (mêmes briques : section/header,
// mêmes polices, mêmes couleurs). Chaque section = une diapositive 16:9 (1920×1080),
// rendue via PDFShift (voir renderPlaquettePdf.js).
//
// Vision (Thomas) : 1 étage = 1 page → le PLAN dans un coin + 3-4 PHOTOS de ce
// niveau. Le tag « étage » posé sur chaque photo/plan (composant MediasInline)
// est le carburant de ce regroupement. Blocs auto-effaçables : un étage sans
// visuel disparaît ; sans aucun tag, on retombe proprement sur une galerie.
//
// Règle non négociable : PRIX FAI EN GRAND, commission en tout petit (couverture).

import {
  buildAvisData, esc, num, fmtEUR, fmtM2, etageLabel, A, section, header,
} from '@/lib/avis/buildAvis';
import { chunkPhotos } from '@/lib/pdf/helpers';

// ── helpers ──────────────────────────────────────────────────────────
const hasEtage = (v) => v !== null && v !== undefined && v !== '';
const MODE_LABEL = { metro: 'Métro', rer: 'RER', tram: 'Tram', bus: 'Bus' };

// Un plan est affichable en <img> uniquement si c'est une image (pas un PDF).
const isImgPlan = (p) =>
  (p?.mime && String(p.mime).startsWith('image')) ||
  /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(p?.url || '');

// Footer plaquette (même charte que l'avis, libellé adapté).
function plaqFooter(d, n) {
  const c = 'rgba(36,25,18,.5)', b = 'rgba(41,64,41,.16)';
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:18px;border-top:1px solid ${b};font-size:14.5px;letter-spacing:.05em;color:${c}">
    <span>Immeubles &amp; Patrimoine — Présentation du bien</span><span>${esc(d.footerAddr)} · ${n}</span></div>`;
}

// Cellule photo « pleine » (cadrage couverture, sans vide autour).
const photoCell = (u, span = false) => `<div style="position:relative;min-width:0;min-height:0;border:1px solid rgba(41,64,41,.18);overflow:hidden;background:#EDE6DC;${span ? 'grid-column:span 2' : ''}">
  <img src="${esc(u)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block"/></div>`;

// Grille de photos qui remplit sa zone (aucune case vide selon le nombre).
function photoGrid(urls) {
  const g = urls.slice(0, 4);
  const N = g.length;
  if (!N) return '';
  let tpl, cells;
  if (N === 1) { tpl = 'grid-template-columns:1fr;grid-template-rows:1fr'; cells = photoCell(g[0]); }
  else if (N === 2) { tpl = 'grid-template-columns:1fr 1fr;grid-template-rows:1fr'; cells = g.map((u) => photoCell(u)).join(''); }
  else if (N === 3) { tpl = 'grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr'; cells = photoCell(g[0], true) + photoCell(g[1]) + photoCell(g[2]); }
  else { tpl = 'grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr'; cells = g.map((u) => photoCell(u)).join(''); }
  return `<div style="display:grid;${tpl};gap:16px;height:100%;width:100%">${cells}</div>`;
}

// ── extraction des étages (photos + plans taggés) ────────────────────
function floorGroups(m) {
  const medias = Array.isArray(m?.medias) ? m.medias : [];
  const photos = medias.filter((x) => x && x.type === 'photo');
  const plans = medias.filter((x) => x && x.type === 'plan');

  const taggedPhotos = photos.filter((p) => hasEtage(p.etage));
  const taggedPlans = plans.filter((p) => hasEtage(p.etage));

  const floors = [...new Set([...taggedPhotos, ...taggedPlans].map((x) => Number(x.etage)))]
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);

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

// Lots de l'état locatif rattachés à un étage (si le champ `etage` existe sur le lot).
// Aujourd'hui les lots n'ont pas forcément d'étage → la ligne récap s'efface d'elle-même.
function lotsForFloor(m, f) {
  const lots = Array.isArray(m?.etat_locatif) ? m.etat_locatif
    : (Array.isArray(m?.etatLocatif) ? m.etatLocatif : []);
  return lots.filter((l) => l && hasEtage(l.etage) && Number(l.etage) === f);
}

// Ligne(s) récap des lots d'un étage (surface + statut ; PAS le loyer — discrétion).
function recapLots(lots) {
  if (!lots || !lots.length) return '';
  const line = (l) => {
    const loue = l.statut === 'loué' || l.statut === 'loue';
    const surf = num(l.surface) ? fmtM2(l.surface) : '';
    const st = loue ? 'Occupé' : 'Libre';
    return `<div style="display:flex;justify-content:space-between;gap:14px;font-size:16px;color:#241912;border-top:1px solid rgba(41,64,41,.12);padding-top:8px">
      <span><b>${esc(l.numero || 'Lot')}</b> · ${esc(l.type || l.nature || 'Appartement')}</span>
      <span style="color:#8C9978">${surf}${surf ? ' · ' : ''}${st}</span></div>`;
  };
  return `<div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">${lots.map(line).join('')}</div>`;
}

// ── COUVERTURE — prix FAI en grand, honoraires en tout petit ─────────
function slPlaqCover(d, m) {
  const prixFai = num(m?.prix);
  const net = num(m?.prix_net_vendeur);
  const hono = num(m?.honoraires_montant) || (prixFai && net ? prixFai - net : 0);
  const honoPct = (hono && net) ? Math.round((hono / net) * 1000) / 10 : 0;
  const surface = num(m?.surface);
  const typeAV = `${(m?.type || 'Bien')} à vendre`;

  const prixBloc = prixFai ? `<div style="margin-top:46px">
      <div style="font-family:'Cormorant Garamond',serif;font-weight:600;font-size:104px;line-height:.92;color:#294029;letter-spacing:.005em">${fmtEUR(prixFai)}</div>
      <div style="margin-top:10px;font-size:15px;color:rgba(36,25,18,.55)">Honoraires inclus (FAI)${hono ? ` · dont honoraires ${fmtEUR(hono)}${honoPct ? ` (${String(honoPct).replace('.', ',')} %)` : ''} à la charge de l'acquéreur` : ''}</div>
    </div>` : '';

  const infos = [
    surface ? fmtM2(surface) : '',
    m?.adresse ? esc(m.adresse) : '',
  ].filter(Boolean).join(' · ');

  return `<section style="display:flex;flex-direction:row;align-items:stretch;box-sizing:border-box;background:#F5EDE5;color:#241912;font-family:'Albert Sans',system-ui,sans-serif;overflow:hidden">
    <div style="position:absolute;right:-70px;bottom:-90px;width:760px;opacity:.06;pointer-events:none"><img src="${A}/logo-emblem-green.png" alt="" style="width:100%;display:block"/></div>
    <div style="flex:1.02;display:flex;flex-direction:column;justify-content:center;padding:96px 90px;position:relative;z-index:1">
      <img src="${A}/logo-wordmark-green.png" alt="Immeubles & Patrimoine" style="width:280px;display:block"/>
      <div style="margin-top:48px;font-size:19px;font-weight:600;letter-spacing:.34em;text-transform:uppercase;color:#8C9978">${esc(typeAV)}${d.ville ? ` · ${esc(d.ville)}` : ''}</div>
      <h1 style="margin:18px 0 0;font-family:'Cormorant Garamond',serif;font-weight:500;font-size:78px;line-height:1.0;color:#294029">${esc(d.sousTitre || d.titre)}</h1>
      ${infos ? `<div style="margin-top:18px;font-size:20px;color:rgba(36,25,18,.7)">${infos}</div>` : ''}
      ${prixBloc}
    </div>
    <div style="flex:1.18;position:relative;z-index:1">
      ${d.coverPhoto
      ? `<img src="${esc(d.coverPhoto)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block"/>`
      : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#EDE6DC"><img src="${A}/logo-emblem-green.png" alt="" style="width:420px;max-width:70%"/></div>`}
    </div>
  </section>`;
}

// ── PAGE PAR ÉTAGE — le cœur de la plaquette ─────────────────────────
function slFloor(d, m, g, n) {
  const title = etageLabel(g.etage);
  const grid = photoGrid(g.photos);
  const recap = recapLots(g.lots);

  const planCard = (extraStyle = '') => `<div style="flex:1;border:1px solid rgba(41,64,41,.18);background:#FCFAF5;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:26px;${extraStyle}">
      <img src="${esc(g.plan.url)}" alt="" style="max-width:100%;max-height:100%;object-fit:contain;display:block"/></div>`;
  const planCaption = `<div style="font-size:14px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#8C9978">Plan · ${esc(title)}</div>`;

  let body;
  if (g.plan && g.photos.length) {
    // Plan « dans un coin » (colonne gauche) + photos qui remplissent le reste.
    body = `<div style="flex:1;display:flex;gap:40px;padding-top:28px;min-height:0">
        <div style="width:600px;flex-shrink:0;display:flex;flex-direction:column;gap:16px;min-height:0">${planCard()}${planCaption}${recap}</div>
        <div style="flex:1;min-width:0;min-height:0">${grid}</div>
      </div>`;
  } else if (g.plan) {
    // Plan seul (grand, centré).
    body = `<div style="flex:1;display:flex;flex-direction:column;gap:16px;padding-top:28px;min-height:0">${planCard('padding:44px')}${planCaption}${recap}</div>`;
  } else {
    // Photos seules (pleine largeur).
    body = `<div style="flex:1;display:flex;flex-direction:column;gap:16px;padding-top:28px;min-height:0"><div style="flex:1;min-height:0">${grid}</div>${recap}</div>`;
  }

  return section('#F5EDE5', `${header('Le bien étage par étage', title)}${body}${plaqFooter(d, n)}`);
}

// ── GALERIE de secours — photos non taguées (ou tout, si aucun tag) ──
function slPlaqGalerie(d, urls, n, title) {
  const g = urls.slice(0, 6);
  const N = g.length;
  if (!N) return '';
  const grid = N === 1 ? 'grid-template-columns:1fr;grid-template-rows:1fr'
    : N === 2 ? 'grid-template-columns:1fr 1fr;grid-template-rows:1fr'
    : N === 3 ? 'grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr'
    : N === 4 ? 'grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr'
    : 'grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr';
  return section('#F5EDE5',
    `${header('Le bien en images', title)}
     <div style="flex:1;display:grid;${grid};gap:16px;padding-top:24px">${g.map((u) => photoCell(u)).join('')}</div>
     ${plaqFooter(d, n)}`);
}

// ── LE BIEN — pitch commercial + chiffres clés ──────────────────────
function slPlaqLeBien(d, n) {
  const cards = (d.synthese && d.synthese.cards ? d.synthese.cards : []).slice(0, 8);
  if (!cards.length && !d.pitch) return '';
  const card = (c) => `<div style="background:#FCFAF5;border:1px solid rgba(41,64,41,.13);padding:22px 26px;display:flex;flex-direction:column;gap:6px">
    <div style="font-family:'Cormorant Garamond',serif;font-size:42px;font-weight:500;color:#294029;line-height:1">${esc(c.figure)}</div>
    <div style="font-size:13px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:#8C9978">${esc(c.label)}</div>
    ${c.desc ? `<div style="font-size:15px;line-height:1.3;color:rgba(36,25,18,.8)">${esc(c.desc)}</div>` : ''}</div>`;
  const pitch = d.pitch ? `<div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:32px;line-height:1.35;color:#241912;max-width:1300px">${esc(d.pitch)}</div>` : '';
  const cols = cards.length >= 4 ? 4 : (cards.length || 1);
  const grid = cards.length ? `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:18px;margin-top:${pitch ? '40px' : '0'}">${cards.map(card).join('')}</div>` : '';
  return section('#F5EDE5',
    `${header('Le bien', 'En quelques mots')}
     <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-top:10px">${pitch}${grid}</div>
     ${plaqFooter(d, n)}`);
}

// ── LOCALISATION — carte + transports + commodités ──────────────────
function slPlaqLocalisation(d, n) {
  const L = d.localisation;
  if (!L || (!L.mapUrl && !(L.transports || []).length && !(L.commodites || []).length)) return '';
  const map = L.mapUrl
    ? `<div style="flex:1.1;border:1px solid rgba(41,64,41,.18);overflow:hidden;background:#EDE6DC;position:relative"><img src="${esc(L.mapUrl)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block"/></div>`
    : '';
  const tRow = (t) => `<div style="display:flex;gap:12px;align-items:baseline;font-size:18px;color:#241912;padding:6px 0">
      <span style="font-weight:600;color:#8C9978;min-width:66px;text-transform:uppercase;font-size:12px;letter-spacing:.1em">${esc(MODE_LABEL[t.mode] || t.mode)}</span>
      <span>${esc(t.name)}${t.lines && t.lines.length ? ` <span style="color:#8C9978">${esc(t.lines.join(' · '))}</span>` : ''}${t.distance ? ` <span style="color:rgba(36,25,18,.5)">· ${t.distance} m</span>` : ''}</span></div>`;
  const transports = (L.transports || []).slice(0, 6);
  const commodites = (L.commodites || []).slice(0, 6);
  const bloc = (titre, inner) => inner ? `<div style="margin-bottom:26px"><div style="font-size:13px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#8C9978;margin-bottom:8px">${esc(titre)}</div>${inner}</div>` : '';
  const commList = commodites.length ? `<div style="display:flex;flex-direction:column;gap:5px">${commodites.map((c) => `<div style="font-size:17px;color:#241912">${esc(c)}</div>`).join('')}</div>` : '';
  const side = `<div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-left:6px">
      ${bloc('Transports', transports.length ? `<div>${transports.map(tRow).join('')}</div>` : '')}
      ${bloc('Commerces, écoles, santé', commList)}
      ${L.commentaire ? `<div style="font-size:17px;line-height:1.5;color:rgba(36,25,18,.7)">${esc(L.commentaire)}</div>` : ''}</div>`;
  return section('#F5EDE5',
    `${header("L'emplacement", L.title || 'Le quartier au quotidien')}
     <div style="flex:1;display:flex;gap:44px;padding-top:26px;min-height:0">${map}${side}</div>
     ${plaqFooter(d, n)}`);
}

// ── CADASTRE — parcelle + plan cadastral ────────────────────────────
function slPlaqCadastre(d, n) {
  const L = d.localisation;
  if (!L || (!L.cadastreImg && !L.cadastreRef)) return '';
  const img = L.cadastreImg
    ? `<div style="flex:1.1;border:1px solid rgba(41,64,41,.18);overflow:hidden;background:#EDE6DC;position:relative"><img src="${esc(L.cadastreImg)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block"/></div>`
    : '';
  const info = (k, v) => v ? `<div style="margin-bottom:22px"><div style="font-size:13px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#8C9978;margin-bottom:6px">${esc(k)}</div><div style="font-family:'Cormorant Garamond',serif;font-size:38px;color:#294029">${esc(v)}</div></div>`;
  const side = `<div style="flex:.85;display:flex;flex-direction:column;justify-content:center">${info('Référence cadastrale', L.cadastreRef)}${info('Emprise au sol', L.cadastreSurface)}</div>`;
  return section('#F5EDE5',
    `${header('Le foncier', 'La parcelle')}
     <div style="flex:1;display:flex;gap:44px;padding-top:26px;min-height:0">${img}${side}</div>
     ${plaqFooter(d, n)}`);
}

// ── ÉTAT LOCATIF — tableau des lots + rendement ─────────────────────
function slPlaqEtatLocatif(m, d, n) {
  const lots = Array.isArray(m?.etat_locatif) ? m.etat_locatif
    : (Array.isArray(m?.etatLocatif) ? m.etatLocatif : []);
  if (!lots.length) return '';
  const prixN = num(m?.prix_net_vendeur) || num(m?.prix);
  const totalLoyer = lots.reduce((s, l) => s + num(l.loyer), 0);
  const totalLoyerOpt = lots.reduce((s, l) => { const o = num(l.loyer_optimise) || num(l.loyer_potentiel); return s + (o > 0 ? o : num(l.loyer)); }, 0);
  const rdt = (prixN > 0 && totalLoyer > 0) ? Math.round((totalLoyer * 12 / prixN) * 1000) / 10 : null;
  const rdtOpt = (prixN > 0 && totalLoyerOpt > 0) ? Math.round((totalLoyerOpt * 12 / prixN) * 1000) / 10 : null;

  const head = `<div style="display:grid;grid-template-columns:.8fr 2.6fr 1fr 1.2fr 1fr;column-gap:18px;font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#8C9978;padding-bottom:12px">
    <div>Lot</div><div>Type</div><div style="text-align:right">Surface</div><div style="text-align:right">Loyer/mois</div><div style="text-align:center">Statut</div></div>`;
  const row = (l, i) => {
    const loue = l.statut === 'loué' || l.statut === 'loue';
    return `<div style="display:grid;grid-template-columns:.8fr 2.6fr 1fr 1.2fr 1fr;column-gap:18px;align-items:baseline;padding:11px 0;border-top:1px solid rgba(41,64,41,.13)">
      <div style="font-size:18px;font-weight:600;color:#294029">${esc(l.numero || (i + 1))}</div>
      <div style="font-size:17px;color:#241912">${esc(l.type || l.nature || '—')}</div>
      <div style="font-size:17px;text-align:right">${num(l.surface) ? fmtM2(l.surface) : '—'}</div>
      <div style="font-size:17px;text-align:right;font-variant-numeric:tabular-nums">${num(l.loyer) ? fmtEUR(l.loyer) : '—'}</div>
      <div style="text-align:center"><span style="font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;padding:3px 10px;color:${loue ? '#294029' : '#8a6d1f'};background:${loue ? 'rgba(41,64,41,.1)' : 'rgba(176,141,87,.16)'}">${loue ? 'Loué' : 'Libre'}</span></div></div>`;
  };
  const rdtCard = (label, val, gold) => val != null ? `<div style="background:#FCFAF5;border:1px solid rgba(41,64,41,.13);padding:20px 26px">
      <div style="font-size:13px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#8C9978">${label}</div>
      <div style="font-family:'Cormorant Garamond',serif;font-size:48px;font-weight:600;color:${gold ? '#B08D57' : '#294029'};margin-top:4px;line-height:1">${String(val).replace('.', ',')} %</div></div>` : '';
  const rdtRow = (rdt != null || rdtOpt != null) ? `<div style="display:flex;gap:18px;margin-bottom:24px">${rdtCard('Rendement présent', rdt)}${rdtCard('Rendement optimisé', rdtOpt, true)}</div>` : '';
  return section('#F5EDE5',
    `${header("L'état locatif", `${lots.length} lot${lots.length > 1 ? 's' : ''}`)}
     <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-top:14px">
       ${rdtRow}
       <div>${head}${lots.map(row).join('')}</div>
       <div style="margin-top:14px;font-size:13px;font-style:italic;color:rgba(36,25,18,.5)">Loyers exprimés hors charges. Rendements calculés sur le prix net vendeur.</div>
     </div>
     ${plaqFooter(d, n)}`);
}

// ── RISQUES NATURELS — information réglementaire ────────────────────
function slPlaqRisques(d, n) {
  const r = (d.localisation && d.localisation.risques) ? d.localisation.risques : [];
  if (!r.length) return '';
  const item = (t) => `<div style="display:flex;gap:12px;align-items:baseline;font-size:20px;color:#241912;padding:10px 0;border-top:1px solid rgba(41,64,41,.12)"><span style="color:#B08D57">◆</span><span>${esc(t)}</span></div>`;
  return section('#F5EDE5',
    `${header('Information réglementaire', 'Risques naturels')}
     <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-top:10px;max-width:1300px">
       ${r.map(item).join('')}
       <div style="margin-top:22px;font-size:14px;font-style:italic;color:rgba(36,25,18,.5)">Source : Géorisques (gouv.fr) — information non contractuelle (art. L125-5 du code de l'environnement).</div>
     </div>
     ${plaqFooter(d, n)}`);
}

// ── ASSEMBLAGE ───────────────────────────────────────────────────────
export function buildPlaquetteHtml(m) {
  const d = buildAvisData(m);
  let n = 0;
  const N = () => String(++n).padStart(2, '0');

  const groups = floorGroups(m);

  // Photos NON taguées (ou toutes si aucune sélection plaquette) → galerie de secours.
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
    .map((p) => p.url)
    .filter(Boolean);

  const galleryTitle = groups.length ? 'Autres vues du bien' : 'Le bien en images';
  const galleryChunks = untagged.length ? chunkPhotos(untagged, 6) : [];

  // Numérotation dans l'ordre RÉEL du document (la couverture n'est pas numérotée).
  return [
    slPlaqCover(d, m),
    slPlaqLeBien(d, N()),
    slPlaqLocalisation(d, N()),
    ...groups.map((g) => slFloor(d, m, g, N())),
    ...galleryChunks.map((ch) => slPlaqGalerie(d, ch, N(), galleryTitle)),
    slPlaqCadastre(d, N()),
    slPlaqEtatLocatif(m, d, N()),
    slPlaqRisques(d, N()),
  ].filter(Boolean).join('\n');
}
