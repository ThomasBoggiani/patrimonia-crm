// lib/avis/buildAvis.js
// Génère l'avis de valeur (charte « 66 Turenne », HTML/CSS exact) À PARTIR DES
// DONNÉES DU MANDAT. Chaque section se construit depuis le mandat + avis_valeur ;
// les sections sans données sont OMISES (jamais de contenu 66 Turenne en dur).
// Chaque section = une diapositive 16:9 (1920×1080).

import { getLineColor, LINE_TEXT_COLORS } from '../transit-colors';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const A = '/avis-assets';

// Pastille de ligne de transport — ronde pour métro/RER/tram (façon RATP),
// arrondie pour le bus.
function ligneBadge(line, mode) {
  const bg = getLineColor(line, mode) || '#8C9978';
  const fg = LINE_TEXT_COLORS[String(line).trim()] || '#fff';
  const rond = mode !== 'bus';
  const s = rond
    ? `width:30px;height:30px;border-radius:50%;`
    : `min-width:34px;height:26px;border-radius:6px;padding:0 6px;`;
  return `<span style="display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;${s}background:${bg};color:${fg};font-size:15px;font-weight:700;margin-right:6px">${esc(line)}</span>`;
}
const MODE_LABEL = { metro: 'Métro', rer: 'RER', tram: 'Tram', bus: 'Bus' };

// ── helpers ─────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (n) => { const x = parseFloat(n); return isNaN(x) ? 0 : x; };
const fmtNum = (n) => { const x = num(n); return x ? x.toLocaleString('fr-FR').replace(/ | /g, ' ') : ''; };
const fmtEUR = (n) => { const x = num(n); return x ? fmtNum(x) + ' €' : ''; };
const fmtM2 = (n) => { const x = num(n); return x ? fmtNum(Math.round(x)) + ' m²' : ''; };
// Arrondi « présentation » : tous les PRIX affichés sont arrondis à 5 000 € près
// (les €/m² restent précis).
const round5k = (n) => { const x = num(n); return x ? Math.round(x / 5000) * 5000 : 0; };
function moisAnnee(d = new Date()) { return `${MOIS[d.getMonth()].charAt(0).toUpperCase() + MOIS[d.getMonth()].slice(1)} ${d.getFullYear()}`; }

// Médiane d'un tableau de nombres (ignore les non-nombres).
function medArr(arr) {
  const s = (arr || []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}
const yearOf = (d) => { const m = String(d || '').match(/(\d{4})/); return m ? +m[1] : 0; };
// Décale une date ISO (YYYY-MM-DD) de `delta` mois, renvoie une chaîne comparable.
function addMonths(iso, delta) {
  const [y, m, day] = String(iso || '').split('-').map(Number);
  if (!y) return '';
  const d = new Date(Date.UTC(y, (m - 1) + delta, day || 1));
  return d.toISOString().slice(0, 10);
}
const moisFrCourt = (iso) => { const y = iso?.slice(0, 4), mo = +(iso?.slice(5, 7)); return (mo >= 1 && y) ? `${MOIS[mo - 1].slice(0, 4)}. ${y}` : ''; };

// Étiquette du bien : la SOUS-FAMILLE (Studio si appartement 1 pièce,
// « Appartement N pièces » sinon), plutôt que la famille brute. Réplique
// getTypeLabel (lib/crm-constants) en tolérant les deux façons de stocker.
function typeLabelOf(m) {
  const st = String(m?.sous_type || '').trim();
  const fam = String(m?.type || '').trim();
  const np = parseInt(m?.nb_pieces, 10) || 0;
  const estAppart = /appart/i.test(st) || /appart/i.test(fam);
  if (estAppart && np === 1) return 'Studio';
  if (estAppart) return np ? `Appartement ${np} pièces` : 'Appartement';
  if (st) return st;
  return fam;
}

function photosOf(m) {
  const out = [];
  const push = (v) => { if (!v) return; const u = typeof v === 'string' ? v : (v.url || v.src); if (u) out.push(u); };
  if (Array.isArray(m?.photos)) m.photos.forEach(push);
  if (Array.isArray(m?.medias)) m.medias.filter(x => x && x.type !== 'plan').forEach(push);
  return [...new Set(out)];
}

// ── briques de charte ───────────────────────────────────────────────
const SECT = (bg, extra = '') => `display:flex;flex-direction:column;box-sizing:border-box;padding:82px 104px 60px;background:${bg};color:#241912;font-family:'Albert Sans',system-ui,sans-serif;overflow:hidden;${extra}`;
const EMBLEM = (cream) => `<img src="${A}/logo-emblem-${cream ? 'cream' : 'green'}.png" alt="" style="height:74px;opacity:.5;flex-shrink:0"/>`;

function header(eyebrow, title, cream = false) {
  const eb = cream ? '#C3CCB8' : '#8C9978';
  const tt = cream ? '#F5EDE5' : '#294029';
  return `<div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <div style="font-size:19px;font-weight:600;letter-spacing:.34em;text-transform:uppercase;color:${eb}">${esc(eyebrow)}</div>
      <h2 style="margin:12px 0 0;font-family:'Cormorant Garamond',serif;font-weight:500;font-size:60px;line-height:1.02;color:${tt}">${esc(title)}</h2>
    </div>${EMBLEM(cream)}</div>
  <div style="height:1px;background:${cream ? 'rgba(245,237,229,.2)' : 'rgba(41,64,41,.16)'};margin:24px 0 0"></div>`;
}
function footer(d, n, cream = false) {
  const c = cream ? 'rgba(245,237,229,.5)' : 'rgba(36,25,18,.5)';
  const b = cream ? 'rgba(245,237,229,.2)' : 'rgba(41,64,41,.16)';
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:18px;border-top:1px solid ${b};font-size:14.5px;letter-spacing:.05em;color:${c}">
    <span>Immeubles &amp; Patrimoine — Avis de valeur</span><span>${esc(d.footerAddr)} · ${n}</span></div>`;
}
const section = (bg, inner, extra = '') => `<section style="${SECT(bg, extra)}">${inner}</section>`;

// ── sections ────────────────────────────────────────────────────────
function slCover(d) {
  return `<section style="display:flex;flex-direction:row;align-items:center;box-sizing:border-box;padding:96px 110px;background:#F5EDE5;color:#241912;font-family:'Albert Sans',system-ui,sans-serif;overflow:hidden">
    <div style="position:absolute;right:-70px;bottom:-90px;width:760px;opacity:.06;pointer-events:none"><img src="${A}/logo-emblem-green.png" alt="" style="width:100%;display:block"/></div>
    <div style="flex:1.05;display:flex;flex-direction:column;position:relative;z-index:1">
      <img src="${A}/logo-wordmark-green.png" alt="Immeubles & Patrimoine" style="width:300px;display:block"/>
      <div style="margin-top:52px;font-size:20px;font-weight:600;letter-spacing:.36em;text-transform:uppercase;color:#8C9978">${esc(d.eyebrowDate)}</div>
      <h1 style="margin:20px 0 0;font-family:'Cormorant Garamond',serif;font-weight:500;font-size:112px;line-height:.98;color:#294029;letter-spacing:.005em">${esc(d.titre)}</h1>
      ${d.ville ? `<div style="margin-top:22px;font-family:'Cormorant Garamond',serif;font-size:42px;color:#8C9978;letter-spacing:.02em">${esc(d.ville)}</div>` : ''}
      ${d.sousTitre ? `<div style="margin-top:30px;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:38px;line-height:1.25;color:#241912;max-width:640px">${esc(d.sousTitre)}</div>` : ''}
      <div style="margin-top:40px;font-size:19px;line-height:1.5;color:rgba(36,25,18,.6);max-width:600px">Document confidentiel, établi sur pièces, avant visite.</div>
    </div>
    <div style="flex:1.15;display:flex;align-items:center;justify-content:center;position:relative;z-index:1;align-self:stretch;margin:-96px -110px -96px 0">
      ${d.coverPhoto
      ? `<img src="${esc(d.coverPhoto)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/>`
      : `<img src="${A}/logo-emblem-green.png" alt="" style="width:560px;max-width:100%;display:block"/>`}
    </div>
  </section>`;
}

function slSynthese(d, n) {
  if (!d.synthese || !d.synthese.cards.length) return '';
  const card = (c) => `<div style="background:#FCFAF5;border:1px solid rgba(41,64,41,.13);padding:24px 28px;display:flex;flex-direction:column;gap:8px">
    <div style="font-family:'Cormorant Garamond',serif;font-size:44px;font-weight:500;color:#294029;line-height:1">${esc(c.figure)}</div>
    <div style="font-size:14px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:#8C9978">${esc(c.label)}</div>
    ${c.desc ? `<div style="font-size:16px;line-height:1.35;color:rgba(36,25,18,.82)">${esc(c.desc)}</div>` : ''}</div>`;
  const cards = d.synthese.cards.slice(0, 8).map(card).join('');
  const cols = d.synthese.cards.length >= 5 ? 4 : (d.synthese.cards.length >= 3 ? 3 : 2);
  return section('#F5EDE5',
    `${header('Synthèse', d.synthese.title || 'Les chiffres clés du bien')}
     <div style="flex:1;display:grid;grid-template-columns:repeat(${cols},1fr);gap:22px;align-content:center;padding-top:14px">${cards}</div>
     ${footer(d, n)}`);
}

function slGalerie(d, n) {
  if (!d.galerie || !d.galerie.length) return '';
  const g = d.galerie.slice(0, 6);
  // Photo entière (object-fit:contain → rien n'est coupé), cadre net, pas de case vide.
  const cell = (p) => `<div style="position:relative;min-width:0;min-height:0;border:1px solid rgba(41,64,41,.18);overflow:hidden;background:#EDE6DC;display:flex;align-items:center;justify-content:center">
    ${p.url ? `<img src="${esc(p.url)}" alt="" style="max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block"/>` : `<div style="position:absolute;inset:0;background:#EDE6DC"></div>`}
    ${p.cap ? `<div style="position:absolute;left:0;right:0;bottom:0;padding:20px 16px 10px;background:linear-gradient(to top,rgba(36,25,18,.62),transparent);color:#F5EDE5;font-size:14px;font-weight:500;letter-spacing:.04em;pointer-events:none">${esc(p.cap)}</div>` : ''}</div>`;
  // Grille symétrique dimensionnée exactement au nombre de photos (aucune case vide).
  const N = g.length;
  const grid = N === 1 ? 'grid-template-columns:1fr;grid-template-rows:1fr'
    : N === 2 ? 'grid-template-columns:1fr 1fr;grid-template-rows:1fr'
    : N === 3 ? 'grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr'
    : N === 4 ? 'grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr'
    : 'grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr'; // 5–6
  return section('#F5EDE5',
    `${header('Le bien en images', d.galerieTitle || 'Le bien en images')}
     <div style="flex:1;display:grid;${grid};gap:16px;padding-top:24px">${g.map(cell).join('')}</div>
     ${footer(d, n)}`);
}

// Marché du secteur : prix au m² (haut) + évolution 5 ans & focus 12 mois (bas).
function slMarche(d, n) {
  const M = d.marche;
  const E = d.evolution;
  if ((!M || !M.cards.length) && (!E || !E.parAnnee.length)) return '';
  const card = (c, i) => `<div>
    <div style="font-family:'Cormorant Garamond',serif;font-size:46px;font-weight:500;color:${i === 3 ? '#CFBA9E' : '#F5EDE5'};line-height:1">${esc(c.value)}</div>
    <div style="margin-top:6px;font-size:16px;line-height:1.35;color:rgba(245,237,229,.75)">${esc(c.desc)}</div></div>`;
  const cards = (M && M.cards.length) ? `<div style="display:grid;grid-template-columns:repeat(${Math.min(M.cards.length, 3)},1fr);gap:44px;padding-bottom:22px;border-bottom:1px solid rgba(245,237,229,.18)">${M.cards.slice(0, 3).map(card).join('')}</div>` : '';
  let evoBlock = '';
  if (E && E.parAnnee.length >= 2) {
    const vals = E.parAnnee.map(a => a.m2Median || 0);
    const min = Math.min(...vals), max = Math.max(...vals);
    const W = 1000, H = 300, pad = 46;
    const X = (i) => (pad + (i / (vals.length - 1)) * (W - 2 * pad)).toFixed(1);
    const Y = (v) => ((H - pad) - ((v - min) / ((max - min) || 1)) * (H - 2 * pad)).toFixed(1);
    const rising = vals[vals.length - 1] >= vals[0];
    const lc = rising ? '#C3CCB8' : '#E3B7A0';
    const linePts = vals.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
    const areaPts = `${pad},${H - pad} ${linePts} ${W - pad},${H - pad}`;
    const dots = vals.map((v, i) => { const last = i === vals.length - 1; return `<circle cx="${X(i)}" cy="${Y(v)}" r="${last ? 8 : 4.5}" fill="${last ? lc : '#F5EDE5'}"/>`; }).join('');
    const valLabels = vals.map((v, i) => `<text x="${X(i)}" y="${(+Y(v) - 16).toFixed(1)}" fill="#F5EDE5" font-size="21" font-family="'Cormorant Garamond',serif" text-anchor="middle">${fmtNum(v)}</text>`).join('');
    const yearLabels = E.parAnnee.map((a, i) => `<text x="${X(i)}" y="${H - 12}" fill="rgba(245,237,229,.72)" font-size="17" text-anchor="middle">${esc(a.annee)}</text>`).join('');
    const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block">
      <polygon points="${areaPts}" fill="rgba(195,204,184,.12)"/>
      <polyline points="${linePts}" fill="none" stroke="${lc}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}${valLabels}${yearLabels}</svg>`;
    const focus = E.focus12;
    const evo5 = vals[0] ? Math.round(((vals[vals.length - 1] - vals[0]) / vals[0]) * 100) : 0;
    evoBlock = `<div style="display:grid;grid-template-columns:1.6fr 1fr;gap:48px;align-items:center;padding-top:24px">
      <div><div style="display:flex;align-items:baseline;gap:14px;margin-bottom:8px">
          <div style="font-size:14px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#C3CCB8">Évolution des prix sur ${E.parAnnee.length} ans</div>
          <div style="font-size:18px;color:${rising ? '#C3CCB8' : '#E3B7A0'}">${rising ? '▲' : '▼'} ${evo5 > 0 ? '+' : ''}${evo5} %</div></div>
        ${svg}</div>
      <div style="border-left:1px solid rgba(245,237,229,.2);padding-left:40px">
        <div style="font-size:14px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#C3CCB8">Focus 12 derniers mois</div>
        <div style="margin-top:12px;font-family:'Cormorant Garamond',serif;font-size:52px;font-weight:500;color:#F5EDE5;line-height:1">${focus && focus.medianeM2 ? fmtNum(focus.medianeM2) + ' €/m²' : '—'}</div>
        ${focus && Number.isFinite(focus.variationPct) && focus.variationPct !== 0 ? `<div style="margin-top:12px;font-size:20px;color:${focus.variationPct > 0 ? '#C3CCB8' : '#E3B7A0'}">${focus.variationPct > 0 ? '▲' : '▼'} ${Math.abs(focus.variationPct)} % vs année précédente</div>` : ''}
        ${focus && focus.count ? `<div style="margin-top:8px;font-size:15px;color:rgba(245,237,229,.6)">Sur ${focus.count} vente(s).</div>` : ''}</div></div>`;
  }
  const note = (M && M.note) ? `<div style="margin-top:16px;font-size:15.5px;line-height:1.5;color:rgba(245,237,229,.6)">${esc(M.note)}</div>` : '';
  return `<section style="${SECT('#294029', 'color:#F5EDE5')}">
    ${header('Analyse de marché', (M && M.title) || 'Le prix au m² du secteur', true)}
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center">${cards}${evoBlock}${note}</div>
    ${footer(d, n, true)}</section>`;
}

function slComparablesTable(d, n) {
  if (!d.comparablesTable || !d.comparablesTable.ventes.length) return '';
  const T = d.comparablesTable;
  const head = `<div style="display:grid;grid-template-columns:1.1fr 3fr 1.2fr 1fr 1.4fr 1.2fr;column-gap:20px;font-size:14px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#8C9978;padding-bottom:12px">
    <div>Date</div><div>Adresse</div><div>Type</div><div style="text-align:right">Surface</div><div style="text-align:right">Prix</div><div style="text-align:right">€/m²</div></div>`;
  const row = (v) => `<div style="display:grid;grid-template-columns:1.1fr 3fr 1.2fr 1fr 1.4fr 1.2fr;column-gap:20px;align-items:baseline;padding:11px 0;border-top:1px solid rgba(41,64,41,.13);${v.memeImmeuble ? 'background:rgba(41,64,41,.05)' : ''}">
    <div style="font-size:17px;color:rgba(36,25,18,.7)">${esc(v.date ? v.date.slice(5, 7) + '/' + v.date.slice(0, 4) : '')}</div>
    <div style="font-size:17px;color:#241912">${esc(v.adresse || '—')}${v.memeImmeuble ? ' <span style="color:#8C9978;font-weight:600">· cet immeuble</span>' : ''}</div>
    <div style="font-size:16px;color:rgba(36,25,18,.7)">${esc(v.type || '')}</div>
    <div style="font-size:17px;text-align:right">${v.surface ? v.surface + ' m²' : '—'}</div>
    <div style="font-size:17px;text-align:right;font-variant-numeric:tabular-nums">${fmtEUR(v.prix)}</div>
    <div style="font-size:18px;text-align:right;font-variant-numeric:tabular-nums;color:#294029;font-weight:600">${fmtNum(v.prixM2)}</div></div>`;
  const rows = T.ventes.slice(0, 11).map(row).join('');
  // Historique de l'immeuble : rappel quand des ventes de l'immeuble même sont présentes.
  const immo = T.immeuble ? `<div style="margin-top:18px;display:inline-flex;align-items:center;gap:10px;background:#294029;color:#F5EDE5;padding:10px 18px"><span style="font-size:13px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#C3CCB8">Historique de l'immeuble</span><span style="font-size:18px">${T.immeuble} vente(s) surlignée(s) ci-dessus</span></div>` : '';
  return section('#F5EDE5',
    `${header('Comparables', 'Ventes récentes du secteur (DVF)')}
     <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-top:6px">${head}${rows}${immo}
       <div style="margin-top:18px;font-size:14px;color:rgba(36,25,18,.5)">Source : Demandes de Valeurs Foncières (data.gouv.fr) — ventes réellement enregistrées.</div></div>
     ${footer(d, n)}`, 'padding:78px 104px 56px');
}

function slBiensSimilaires(d, n) {
  if (!d.biensSimilaires || !d.biensSimilaires.length) return '';
  const dom = (u) => { try { return new URL(u).hostname.replace('www.', ''); } catch { return u; } };
  const card = (b) => `<div style="border:1px solid rgba(41,64,41,.18);display:flex;flex-direction:column">
    <div style="height:380px;background:#EDE6DC;position:relative">${b.photo ? `<img src="${esc(b.photo)}" style="width:100%;height:100%;object-fit:cover"/>` : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#8C9978;font-size:16px">Photo de l'annonce</div>`}</div>
    <div style="padding:26px 28px;display:flex;flex-direction:column;gap:10px;flex:1">
      <div style="font-family:'Cormorant Garamond',serif;font-size:30px;color:#294029;line-height:1.1">${esc(b.adresse || 'Bien similaire')}</div>
      <div style="display:flex;gap:18px;font-size:18px;color:#241912">${b.surface ? `<span>${esc(b.surface)} m²</span>` : ''}${b.prixM2 ? `<span style="color:#8C9978">${fmtNum(b.prixM2)} €/m²</span>` : ''}</div>
      <div style="font-family:'Cormorant Garamond',serif;font-size:34px;font-weight:600;color:#521C14;margin-top:auto">${b.prix ? fmtEUR(b.prix) : ''}</div>
      ${b.lien ? `<div style="font-size:14px;color:#8C9978;word-break:break-all">${esc(dom(b.lien))}</div>` : ''}</div></div>`;
  return section('#F5EDE5',
    `${header('Comparaison', 'Biens similaires disponibles')}
     <div style="flex:1;display:grid;grid-template-columns:repeat(${Math.min(3, d.biensSimilaires.length)},1fr);gap:32px;padding-top:20px">${d.biensSimilaires.slice(0, 3).map(card).join('')}</div>
     ${footer(d, n)}`);
}

function slValorisation(d, n) {
  if (!d.valorisation || !d.valorisation.prix.length) return '';
  const v = d.valorisation;
  const card = (p) => {
    const m2 = (v.surface && p.valeur) ? `${fmtNum(Math.round(p.valeur / v.surface))} €/m²` : '';
    return p.highlight
    ? `<div style="background:#294029;color:#F5EDE5;padding:34px 32px;display:flex;flex-direction:column;position:relative;overflow:hidden">
        <div style="position:absolute;right:-50px;bottom:-60px;width:280px;opacity:.1;pointer-events:none"><img src="${A}/logo-emblem-cream.png" alt="" style="width:100%;display:block"/></div>
        <div style="font-size:15px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#C3CCB8;position:relative">${esc(p.label)}</div>
        <div style="margin-top:16px;font-family:'Cormorant Garamond',serif;font-size:56px;font-weight:600;color:#F5EDE5;line-height:1;position:relative">${p.montant}</div>
        ${m2 ? `<div style="margin-top:8px;font-size:20px;font-weight:600;color:#C3CCB8;position:relative">${esc(m2)}</div>` : ''}
        ${p.desc ? `<div style="margin-top:20px;font-size:18px;line-height:1.4;color:rgba(245,237,229,.88);position:relative">${esc(p.desc)}</div>` : ''}</div>`
    : `<div style="border:1px solid rgba(41,64,41,.18);padding:34px 32px;display:flex;flex-direction:column">
        <div style="font-size:15px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#8C9978">${esc(p.label)}</div>
        <div style="margin-top:16px;font-family:'Cormorant Garamond',serif;font-size:56px;font-weight:600;color:#294029;line-height:1">${p.montant}</div>
        ${m2 ? `<div style="margin-top:8px;font-size:20px;font-weight:600;color:#8C9978">${esc(m2)}</div>` : ''}
        ${p.desc ? `<div style="margin-top:20px;font-size:18px;line-height:1.4;color:rgba(36,25,18,.82)">${esc(p.desc)}</div>` : ''}</div>`;
  };
  const confPill = v.confiance ? `<div style="display:inline-flex;align-items:center;gap:10px;margin-top:16px;background:#294029;color:#F5EDE5;padding:10px 18px;border-radius:999px">
     <span style="font-size:13px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#C3CCB8">Niveau de confiance</span>
     <span style="font-family:'Cormorant Garamond',serif;font-size:24px;line-height:1">${esc(v.confiance.niveau)}</span></div>
     ${v.confiance.texte ? `<div style="margin-top:10px;font-size:15px;line-height:1.5;color:rgba(36,25,18,.6)">${esc(v.confiance.texte)}</div>` : ''}` : '';
  return section('#F5EDE5',
    `${header('Valorisation', v.title || (v.isPreAvis ? 'Notre première fourchette de valeur' : 'Notre préconisation de prix'))}
     ${v.intro ? `<div style="margin-top:16px;font-size:17px;line-height:1.4;color:rgba(36,25,18,.7)">${esc(v.intro)}</div>` : ''}
     <div style="flex:1;display:grid;grid-template-columns:repeat(${v.prix.length},1fr);gap:26px;padding-top:26px">${v.prix.map(card).join('')}</div>
     ${confPill}
     ${v.reco ? `<div style="margin-top:24px;background:#E8DACA;padding:22px 30px;font-size:19px;line-height:1.45;color:#521C14"><strong style="font-weight:600">Recommandation —</strong> ${esc(v.reco)}${v.positionnement ? ` ${esc(v.positionnement)}.` : ''}</div>` : (v.positionnement ? `<div style="margin-top:24px;background:#E8DACA;padding:22px 30px;font-size:19px;line-height:1.45;color:#521C14"><strong style="font-weight:600">Recommandation —</strong> ${esc(v.positionnement)}.</div>` : '')}
     ${(v.ajustements && v.ajustements.length) ? (() => {
      const tot = v.ajustements.reduce((s, a) => s + (+a.pct || 0), 0);
      return `<div style="margin-top:12px;font-size:15px;line-height:1.5;color:rgba(36,25,18,.6)">Ajustements retenus : ${v.ajustements.map(a => `${esc(a.label || 'facteur')} ${(+a.pct || 0) > 0 ? '+' : ''}${a.pct || 0} %`).join(' · ')}${tot ? ` <span style="color:#521C14">(total ${tot > 0 ? '+' : ''}${tot} %)</span>` : ''}</div>`;
    })() : ''}
     ${v.decote ? `<div style="margin-top:8px;font-size:15px;line-height:1.5;color:rgba(36,25,18,.55)">Facteurs pris en compte : ${esc(v.decote)}.</div>` : ''}
     ${footer(d, n)}`, 'padding:82px 104px 58px');
}

function slVigilance(d, n) {
  if (!d.vigilance || !d.vigilance.length) return '';
  const cell = (p, i) => `<div style="background:#FCFAF5;border:1px solid rgba(41,64,41,.13);padding:26px 30px;display:flex;gap:20px;align-items:flex-start">
    <div style="font-family:'Cormorant Garamond',serif;font-size:52px;font-weight:500;color:#521C14;line-height:.9">${i + 1}</div>
    <div><div style="font-size:21px;font-weight:600;color:#294029">${esc(p.titre)}</div>
    ${p.texte ? `<div style="margin-top:6px;font-size:17.5px;line-height:1.4;color:rgba(36,25,18,.8)">${esc(p.texte)}</div>` : ''}</div></div>`;
  const items = d.vigilance.slice(0, 6);
  const rows = Math.ceil(items.length / 3);
  return section('#F5EDE5',
    `${header('Sécurisation du mandat', 'Points de vigilance avant commercialisation')}
     <div style="flex:1;display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:repeat(${rows},1fr);gap:22px;padding-top:8px">${items.map(cell).join('')}</div>
     ${footer(d, n)}`, 'padding:82px 104px 58px');
}

function slEtapes(d, n) {
  const step = (i, t) => `<div style="display:flex;gap:22px;align-items:baseline;${i < 4 ? 'border-bottom:1px solid rgba(41,64,41,.13);padding-bottom:20px' : ''}">
    <span style="font-family:'Cormorant Garamond',serif;font-size:40px;color:#8C9978;line-height:1;min-width:52px">${String(i).padStart(2, '0')}</span>
    <span style="font-size:23px;line-height:1.35;color:#241912">${esc(t)}</span></div>`;
  const steps = (d.etapes || [
    'Visite du bien et validation de la fourchette de valeur.',
    'Levée des points juridiques et constitution du dossier.',
    'Signature du mandat et stratégie de commercialisation.',
    'Dossier acquéreur complet : un récit de vente abouti.',
  ]).slice(0, 4);
  return section('#F5EDE5',
    `${header('Prochaines étapes', 'Du mandat à la commercialisation')}
     <div style="flex:1;display:grid;grid-template-columns:1.3fr .7fr;gap:56px;align-items:center;padding-top:20px">
       <div style="display:flex;flex-direction:column;gap:22px">${steps.map((t, i) => step(i + 1, t)).join('')}</div>
       <div style="background:#E8DACA;padding:36px 34px;align-self:stretch;display:flex;flex-direction:column;justify-content:center">
         <div style="font-size:16px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#521C14">${esc(d.commercialisation || 'Commercialisation')}</div>
         <div style="margin-top:8px;font-size:16px;line-height:1.4;color:rgba(82,28,20,.72)">Diffusion maîtrisée auprès d'un réseau qualifié.</div>
         <div style="margin-top:22px;font-family:'Cormorant Garamond',serif;font-size:26px;line-height:1.35;color:#294029">Réseau de chasseurs et confrères.</div>
         <div style="margin-top:15px;font-family:'Cormorant Garamond',serif;font-size:26px;line-height:1.35;color:#294029">Family offices et banques privées.</div>
         <div style="margin-top:15px;font-family:'Cormorant Garamond',serif;font-size:26px;line-height:1.35;color:#294029">Acquéreurs qualifiés.</div>
       </div></div>
     ${footer(d, n)}`);
}

function slContact(d) {
  return `<section style="display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;padding:96px;background:#294029;color:#F5EDE5;font-family:'Albert Sans',system-ui,sans-serif;overflow:hidden;text-align:center">
    <img src="${A}/logo-emblem-cream.png" alt="" style="height:250px;display:block"/>
    <img src="${A}/logo-wordmark-cream-wide.png" alt="Immeubles & Patrimoine" style="width:360px;display:block;margin-top:30px"/>
    <div style="width:70px;height:1px;background:rgba(245,237,229,.4);margin:38px 0"></div>
    <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:34px;color:rgba(245,237,229,.9)">${esc(d.contactSub)}</div>
    <div style="margin-top:34px;font-size:22px;font-weight:500;letter-spacing:.04em;color:#F5EDE5">${esc(d.consultant)}</div>
    <div style="margin-top:12px;font-size:16px;letter-spacing:.2em;text-transform:uppercase;color:#C3CCB8">${esc(d.contactDate)}</div>
  </section>`;
}

// ── contenu agence (statique) ───────────────────────────────────────
const AGENCE = {
  intro: "Immeubles & Patrimoine — expert immobilier indépendant spécialisé dans la vente d'actifs depuis 2010 en Île-de-France. Nous maximisons la valeur de chaque bien et intervenons à chaque étape : analyse de faisabilité, valorisation, structuration juridique et financière, jusqu'à la commercialisation.",
  valeurs: ['Discrétion', 'Exigence', 'Performance'],
  valeursTexte: "Notre réputation repose sur l'intégrité de nos équipes et une relation de confiance durable avec chaque client. Chaque projet bénéficie d'une approche sur mesure, confidentielle et orientée création de valeur.",
  methode: [
    { t: 'Analyse du bien', d: "Collecte des caractéristiques intrinsèques et des facteurs de valeur : emplacement, état, charges, travaux, contexte juridique." },
    { t: 'Analyse du marché', d: "Étude de la demande, des biens comparables vendus (DVF) et disponibles, et de l'évolution des prix du secteur." },
    { t: 'Méthode par comparaison', d: "Valorisation au m² pondérée selon la qualité, l'étage, l'exposition et les prestations, croisée avec les références du secteur." },
    { t: 'Préconisation', d: "Trois scénarios de prix (plancher, marché, présentation) et une stratégie de commercialisation adaptée." },
  ],
  supports: ['Photographies professionnelles', 'Home staging virtuel', 'Visite virtuelle Matterport', 'Vidéo drone', 'Plans détaillés 2D/3D', 'Vidéo immersive projet d\'aménagement'],
  reseau: ['Meilleurs portails immobiliers & site internet', 'Mailing direct sur base de données qualifiée', 'Réseau de chasseurs et confrères haut de gamme', 'Family offices, banques privées, CGP', 'Acquéreurs internationaux qualifiés', 'Diffusion off-market confidentielle'],
};

function slAvantPropos(d, n) {
  if (!d.avantPropos) return '';
  return `<section style="${SECT('#F5EDE5')}">
    <div style="flex:1;display:grid;grid-template-columns:1fr 1.1fr;gap:64px;align-items:center">
      <div style="height:840px;overflow:hidden;border:10px solid #B7C6A6">${d.coverPhoto ? `<img src="${esc(d.coverPhoto)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/>` : `<div style="width:100%;height:100%;background:#EDE6DC"></div>`}</div>
      <div>
        <div style="font-size:19px;font-weight:600;letter-spacing:.34em;text-transform:uppercase;color:#8C9978">Avant-propos</div>
        <h2 style="margin:14px 0 34px;font-family:'Cormorant Garamond',serif;font-weight:500;font-size:64px;line-height:1;color:#294029">Un mot avant tout</h2>
        <div style="font-size:22px;line-height:1.6;color:#241912">${esc(d.avantPropos)}</div>
      </div></div>
    ${footer(d, n)}</section>`;
}

function slTexteCentre(eyebrow, title, paras, n, d) {
  return `<section style="${SECT('#F5EDE5', 'align-items:center;justify-content:center;text-align:center')}">
    <div style="font-size:20px;font-weight:600;letter-spacing:.34em;text-transform:uppercase;color:#8C9978">${esc(eyebrow)}</div>
    <h2 style="margin:22px 0 40px;font-family:'Cormorant Garamond',serif;font-weight:500;font-size:76px;line-height:1.05;color:#294029;max-width:1400px">${title}</h2>
    <div style="max-width:1250px;font-size:24px;line-height:1.6;color:#241912">${paras.map(p => `<p style="margin:0 0 22px">${esc(p)}</p>`).join('')}</div>
    ${d ? `<div style="position:absolute;left:0;right:0;bottom:40px;text-align:center;font-size:14.5px;color:rgba(36,25,18,.5)">${esc(d.footerAddr)} · ${n}</div>` : ''}</section>`;
}

function slListe(eyebrow, title, items, n, d, cols = 2) {
  const cell = (t) => `<div style="display:flex;gap:16px;align-items:flex-start;padding:20px 0;border-top:1px solid rgba(41,64,41,.14)">
    <img src="${A}/logo-emblem-green.png" style="height:30px;opacity:.55;margin-top:2px"/>
    <div style="font-size:23px;line-height:1.4;color:#241912">${esc(t)}</div></div>`;
  return section('#F5EDE5',
    `${header(eyebrow, title)}
     <div style="flex:1;display:grid;grid-template-columns:repeat(${cols},1fr);column-gap:64px;align-content:center;padding-top:8px">${items.map(cell).join('')}</div>
     ${footer(d, n)}`);
}

function slQuiSommesNous(d, n) {
  return section('#F5EDE5',
    `${header("L'agence", 'Qui sommes-nous')}
     <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:34px;padding-top:8px">
       <div style="font-size:23px;line-height:1.6;color:#241912;max-width:1500px">${esc(AGENCE.intro)}</div>
       <div style="display:flex;gap:16px;flex-wrap:wrap">
         ${AGENCE.valeurs.map(v => `<div style="font-family:'Cormorant Garamond',serif;font-size:36px;color:#294029;border:1px solid rgba(41,64,41,.2);padding:14px 34px">${esc(v)}</div>`).join('')}
       </div>
       <div style="font-size:20px;line-height:1.55;color:rgba(36,25,18,.75);max-width:1500px">${esc(AGENCE.valeursTexte)}</div>
     </div>
     ${footer(d, n)}`);
}

function slSupportsReseau(d, n) {
  const col = (titre, items) => `<div>
    <div style="font-size:16px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#8C9978;margin-bottom:16px">${esc(titre)}</div>
    ${items.map(t => `<div style="display:flex;gap:14px;align-items:flex-start;padding:14px 0;border-top:1px solid rgba(41,64,41,.14)"><img src="${A}/logo-emblem-green.png" style="height:26px;opacity:.5;margin-top:2px"/><div style="font-size:21px;line-height:1.35;color:#241912">${esc(t)}</div></div>`).join('')}</div>`;
  return section('#F5EDE5',
    `${header('Commercialisation', 'Nos supports & notre réseau')}
     <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:64px;align-content:center;padding-top:8px">
       ${col('Supports de commercialisation', AGENCE.supports)}${col('Réseau & diffusion', AGENCE.reseau)}</div>
     ${footer(d, n)}`);
}

function slMethode(d, n) {
  const cell = (s, i) => `<div style="background:#FCFAF5;border:1px solid rgba(41,64,41,.13);padding:30px 32px;display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;align-items:center;gap:16px"><div style="width:44px;height:44px;border-radius:50%;background:#294029;color:#F5EDE5;display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:24px">${i + 1}</div>
    <div style="font-family:'Cormorant Garamond',serif;font-size:32px;color:#294029">${esc(s.t)}</div></div>
    <div style="font-size:19px;line-height:1.45;color:rgba(36,25,18,.82)">${esc(s.d)}</div></div>`;
  return section('#F5EDE5',
    `${header('Notre méthode', "Comment nous estimons votre bien")}
     <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:24px;padding-top:20px">${AGENCE.methode.map(cell).join('')}</div>
     ${footer(d, n)}`);
}

function slLocalisation(d, n) {
  if (!d.localisation) return '';
  const L = d.localisation;
  const grp = (titre, arr) => arr && arr.length ? `<div style="margin-bottom:22px">
    <div style="font-size:15px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#8C9978;margin-bottom:8px">${esc(titre)}</div>
    ${arr.slice(0, 5).map(t => `<div style="font-size:19px;line-height:1.5;color:#241912">${esc(t)}</div>`).join('')}</div>` : '';
  // Transports avec pastilles de lignes colorées
  const transportsBloc = (L.transports && L.transports.length) ? `<div style="margin-bottom:22px">
    <div style="font-size:15px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#8C9978;margin-bottom:10px">Transports</div>
    ${L.transports.slice(0, 6).map(t => `<div style="display:flex;align-items:center;gap:4px;margin-bottom:8px;flex-wrap:wrap">
      ${(t.lines || []).map(l => ligneBadge(l, t.mode)).join('')}
      <span style="font-size:18px;color:#241912">${esc(t.name)}</span>
      ${t.distance ? `<span style="font-size:15px;color:#8C9978">· ${t.distance} m</span>` : ''}</div>`).join('')}</div>` : '';
  // Cadastre compact : petite carte à côté du numéro de parcelle.
  const cadastreBloc = (L.cadastreRef || L.cadastreImg) ? `<div style="display:flex;align-items:center;gap:18px;margin-bottom:22px">
    ${L.cadastreImg ? `<div style="width:172px;height:128px;flex-shrink:0;border:1px solid rgba(41,64,41,.2);overflow:hidden;background:#EDE6DC"><img src="${esc(L.cadastreImg)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/></div>` : ''}
    <div>
      <div style="font-size:14px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#8C9978">Cadastre</div>
      <div style="font-family:'Cormorant Garamond',serif;font-size:40px;color:#294029;line-height:1.1">${esc(L.cadastreRef || '—')}</div>
      ${L.cadastreSurface ? `<div style="font-size:16px;color:#8C9978">${esc(L.cadastreSurface)}</div>` : ''}</div></div>` : '';
  const risquesBloc = (L.risques && L.risques.length) ? `<div style="margin-bottom:20px">
    <div style="font-size:15px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#8C9978;margin-bottom:6px">Risques (Géorisques)</div>
    <div style="font-size:16px;line-height:1.45;color:#241912">${L.risques.slice(0, 4).map(esc).join(' · ')}</div>
    ${L.commentaireUrbanisme ? `<div style="font-size:15px;line-height:1.4;color:rgba(36,25,18,.65);margin-top:4px">${esc(L.commentaireUrbanisme)}</div>` : ''}</div>` : '';
  return section('#F5EDE5',
    `${header('Le secteur', L.title || "Le quartier et l'accès au bien")}
     <div style="flex:1;display:grid;grid-template-columns:1.4fr 1fr;gap:44px;padding-top:14px;align-items:start">
       <div style="height:720px;border:1px solid rgba(41,64,41,.2);overflow:hidden">${L.mapUrl ? `<img src="${esc(L.mapUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/>` : `<div style="width:100%;height:100%;background:#EDE6DC;display:flex;align-items:center;justify-content:center;color:#8C9978">Carte de situation</div>`}</div>
       <div>${cadastreBloc}${L.commentaire ? `<div style="font-size:18px;line-height:1.5;color:#241912;margin-bottom:20px">${esc(L.commentaire)}</div>` : ''}
         ${transportsBloc}${grp('Vie de quartier — commerces & écoles', L.commodites)}${grp('Nature & loisirs', L.loisirs)}${risquesBloc}</div></div>
     ${footer(d, n)}`);
}

function slCaracteristiques(d, n) {
  if (!d.caracteristiques) return '';
  const C = d.caracteristiques;
  const P = d.dpe;
  const doc = d.documents || {};
  const row = (k, v) => v ? `<div style="display:flex;justify-content:space-between;gap:20px;padding:13px 0;border-bottom:1px solid rgba(41,64,41,.13)">
    <span style="font-size:15px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#8C9978">${esc(k)}</span>
    <span style="font-size:21px;color:#241912;text-align:right">${esc(v)}</span></div>` : '';
  // Bande « dossier » fusionnée : DPE + taxe foncière + charges + lots.
  const fig = (label, val) => val ? `<div><div style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#8C9978;margin-bottom:3px">${label}</div><div style="font-size:19px;color:#241912">${esc(val)}</div></div>` : '';
  const dpeFig = P ? `<div><div style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#8C9978;margin-bottom:3px">DPE</div><div style="display:flex;align-items:center;gap:7px"><span style="display:inline-flex;width:28px;height:28px;border-radius:5px;background:${P.color};color:#fff;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:600">${P.classe}</span>${P.conso ? `<span style="font-size:15px;color:#8C9978">${fmtNum(P.conso)} kWh/m²·an</span>` : ''}</div></div>` : '';
  const figs = [dpeFig, fig('Taxe foncière', doc.taxeFonciere ? doc.taxeFonciere + ' / an' : ''), fig('Charges', doc.charges ? doc.charges + ' / an' : ''), fig('Lots', doc.nbLots)].filter(Boolean);
  const dossierStrip = figs.length ? `<div style="display:flex;gap:30px;flex-wrap:wrap;margin-top:22px;padding-top:18px;border-top:1px solid rgba(41,64,41,.13)">${figs.join('')}</div>` : '';
  // Analyse DPE compacte (impact + pistes), pour ne pas garder un slide dossier à moitié vide.
  const dpeLine = P ? `<div style="margin-top:14px;font-size:15px;line-height:1.45;color:rgba(36,25,18,.72)"><b style="color:#8C9978">DPE ${P.classe} — ${esc(P.niveau)} :</b> ${esc(P.impact)}${P.obligations.length ? ' ' + P.obligations.map(esc).join(' · ') : ''}${P.pistes.length ? ` <span style="color:rgba(36,25,18,.55)">Pistes : ${P.pistes.map(esc).join(', ')}.</span>` : ''}</div>` : '';
  return section('#F5EDE5',
    `${header('Caractéristiques', C.title || 'Le bien en détail')}
     <div style="flex:1;display:grid;grid-template-columns:1fr 1.1fr;gap:50px;padding-top:16px;align-items:start">
       <div style="height:760px;overflow:hidden;border:1px solid rgba(41,64,41,.2);background:#FCFAF5;display:flex;align-items:center;justify-content:center">${C.photo ? `<img src="${esc(C.photo)}" alt="" style="max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block"/>` : `<div style="width:100%;height:100%;background:#EDE6DC"></div>`}
         ${C.photoLegende ? `<div style="margin-top:-46px;position:relative;padding:14px 18px;background:linear-gradient(to top,rgba(36,25,18,.6),transparent);color:#F5EDE5;font-size:15px">${esc(C.photoLegende)}</div>` : ''}</div>
       <div>${C.rows.map(r => row(r[0], r[1])).join('')}
         ${dossierStrip}${dpeLine}
         ${(C.atouts && C.atouts.length) ? `<div style="margin-top:18px;display:flex;flex-direction:column;gap:8px">${C.atouts.slice(0, 6).map(a => `<div style="display:flex;gap:12px;align-items:flex-start"><img src="${A}/logo-emblem-green.png" style="height:22px;opacity:.55;margin-top:2px"/><div style="font-size:18px;line-height:1.4;color:#241912">${esc(a)}</div></div>`).join('')}</div>` : ''}</div></div>
     ${footer(d, n)}`);
}

// ── PHASE 1 : nouvelles pages « entonnoir » ─────────────────────────

// Analyse de la RUE — ventes DVF de la même voie (photo Street View + stats).
function slRue(d, n) {
  if (!d.rue) return '';
  const R = d.rue;
  const stat = (val, lib) => `<div style="flex:1">
    <div style="font-family:'Cormorant Garamond',serif;font-size:52px;font-weight:500;color:#294029;line-height:1">${esc(val)}</div>
    <div style="margin-top:6px;font-size:15px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#8C9978">${esc(lib)}</div></div>`;
  const ligne = (v) => `<div style="display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-top:1px solid rgba(41,64,41,.13)">
    <span style="font-size:16px;color:rgba(36,25,18,.7);min-width:74px">${esc(moisFrCourt(v.date))}</span>
    <span style="flex:1;font-size:16px;color:#241912">${esc(v.adresse || '')}${v.memeImmeuble ? ' <span style="color:#8C9978;font-weight:600">· cet immeuble</span>' : ''}</span>
    <span style="font-size:16px;text-align:right">${v.surface ? v.surface + ' m²' : ''}</span>
    <span style="font-size:17px;text-align:right;font-weight:600;color:#294029;min-width:96px">${fmtNum(v.prixM2)} €/m²</span></div>`;
  return section('#F5EDE5',
    `${header('Le secteur', R.title || "L'analyse de la rue")}
     <div style="flex:1;display:grid;grid-template-columns:1fr 1.15fr;gap:48px;padding-top:14px;align-items:start">
       <div style="height:720px;border:1px solid rgba(41,64,41,.2);overflow:hidden;background:#EDE6DC">${R.photo ? `<img src="${esc(R.photo)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/>` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#8C9978">La rue</div>`}</div>
       <div>
         <div style="display:flex;gap:24px;margin-bottom:22px">${stat(R.count ? `${R.count}` : '—', 'Ventes DVF sur la rue')}${stat(R.medianeM2 ? `${fmtNum(R.medianeM2)} €/m²` : '—', 'Médiane de la rue')}</div>
         ${R.commentaire ? `<div style="font-size:19px;line-height:1.5;color:#241912;margin-bottom:20px">${esc(R.commentaire)}</div>` : ''}
         ${R.ventes && R.ventes.length ? `<div style="font-size:15px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#8C9978;margin-bottom:6px">Ventes récentes de la voie</div>${R.ventes.slice(0, 7).map(ligne).join('')}` : ''}
       </div></div>
     ${footer(d, n)}`);
}

// Synthèse marché : réalisé (DVF) vs affiché (annonces).
function slSyntheseMarche(d, n) {
  if (!d.syntheseMarche) return '';
  const S = d.syntheseMarche;
  const bloc = (eyebrow, val, sub, dark) => `<div style="flex:1;padding:38px 34px;${dark ? 'background:#294029;color:#F5EDE5' : 'background:#FCFAF5;border:1px solid rgba(41,64,41,.15)'}">
    <div style="font-size:15px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:${dark ? '#C3CCB8' : '#8C9978'}">${esc(eyebrow)}</div>
    <div style="margin-top:18px;font-family:'Cormorant Garamond',serif;font-size:60px;font-weight:500;line-height:1;color:${dark ? '#F5EDE5' : '#294029'}">${esc(val)}</div>
    <div style="margin-top:12px;font-size:18px;line-height:1.4;color:${dark ? 'rgba(245,237,229,.8)' : 'rgba(36,25,18,.78)'}">${esc(sub)}</div></div>`;
  return section('#F5EDE5',
    `${header('Synthèse de marché', 'Marché réalisé vs marché affiché')}
     <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:28px;padding-top:8px">
       <div style="display:flex;gap:28px">
         ${bloc('Réalisé — ventes DVF', S.dvfM2 ? `${fmtNum(S.dvfM2)} €/m²` : '—', 'Prix réellement enregistrés (actes notariés).', true)}
         ${bloc('Affiché — annonces', S.annoncesM2 ? `${fmtNum(S.annoncesM2)} €/m²` : '—', 'Prix demandés par les vendeurs aujourd\'hui.')}
       </div>
       ${S.ecartPct != null && Number.isFinite(S.ecartPct) ? `<div style="background:#E8DACA;padding:22px 30px;font-size:20px;line-height:1.45;color:#521C14"><strong style="font-weight:600">Écart réalisé / affiché : ${S.ecartPct > 0 ? '+' : ''}${S.ecartPct} %.</strong> ${esc(S.note || '')}</div>` : (S.note ? `<div style="background:#E8DACA;padding:22px 30px;font-size:20px;line-height:1.45;color:#521C14">${esc(S.note)}</div>` : '')}
     </div>
     ${footer(d, n)}`);
}

// ── PHASE 2 : pages « visite » (le bien en détail) ──────────────────
const visBlk = (t, v) => v ? `<div style="margin-bottom:20px">
  <div style="font-size:15px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#8C9978;margin-bottom:6px">${esc(t)}</div>
  <div style="font-size:19px;line-height:1.55;color:#241912">${esc(v)}</div></div>` : '';

function slImmeuble(d, n) {
  if (!d.immeuble) return '';
  const I = d.immeuble;
  return section('#F5EDE5',
    `${header('Le bien', "L'immeuble")}
     <div style="flex:1;display:grid;grid-template-columns:1fr 1.1fr;gap:46px;padding-top:14px;align-items:start">
       <div style="height:760px;border:1px solid rgba(41,64,41,.2);overflow:hidden;background:#EDE6DC">${I.photo ? `<img src="${esc(I.photo)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/>` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#8C9978">L'immeuble</div>`}</div>
       <div style="align-self:center">${visBlk('Architecture & style', I.architecture)}${visBlk("Qualité de l'immeuble", I.immeuble_qualite)}${visBlk('Parties communes', I.parties_communes)}</div>
     </div>
     ${footer(d, n)}`);
}

function slHabitabilite(d, n) {
  if (!d.habitabilite || !d.habitabilite.cards.length) return '';
  const card = (c) => `<div style="background:#FCFAF5;border:1px solid rgba(41,64,41,.13);padding:26px 28px">
    <div style="font-size:15px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#8C9978;margin-bottom:10px">${esc(c.t)}</div>
    <div style="font-size:19px;line-height:1.5;color:#241912">${esc(c.v)}</div></div>`;
  return section('#F5EDE5',
    `${header('Le bien', 'Volumes, lumière & exposition')}
     <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:24px;align-content:center;padding-top:10px">${d.habitabilite.cards.map(card).join('')}</div>
     ${footer(d, n)}`);
}

function slPrestations(d, n) {
  if (!d.prestationsEtat) return '';
  const P = d.prestationsEtat;
  const presta = P.prestations.length ? `<div style="font-size:15px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#8C9978;margin-bottom:12px">Prestations remarquables</div>
    ${P.prestations.slice(0, 10).map(p => `<div style="display:flex;gap:14px;align-items:flex-start;padding:12px 0;border-top:1px solid rgba(41,64,41,.13)"><img src="${A}/logo-emblem-green.png" style="height:24px;opacity:.5;margin-top:2px"/><div style="font-size:19px;line-height:1.4;color:#241912">${esc(p)}</div></div>`).join('')}` : '';
  return section('#F5EDE5',
    `${header('Le bien', 'Prestations & état')}
     <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:46px;padding-top:14px;align-items:start">
       <div>${presta}</div>
       <div style="align-self:center">${visBlk('État général', P.etat_general)}${visBlk('Travaux à prévoir', P.travaux)}${visBlk('Potentiel de valorisation', P.potentiel)}</div>
     </div>
     ${footer(d, n)}`);
}

// ── PHASE 2 : DPE analysé + dossier documentaire ────────────────────
const DPE_COLORS = { A: '#4e9a51', B: '#71b34e', C: '#a9c24e', D: '#e3c24e', E: '#e0993e', F: '#d8722f', G: '#c0392b' };
const DPE_DATA = {
  A: { niveau: 'Excellent', impact: "Bien très économe en énergie : argument de vente fort, meilleure liquidité et prime à la revente." },
  B: { niveau: 'Très bon', impact: "Performance énergétique élevée et rassurante pour l'acquéreur ; aucun frein à la vente ni à la location." },
  C: { niveau: 'Bon', impact: "Performance dans la bonne moyenne du marché : effet neutre à légèrement positif sur la valeur." },
  D: { niveau: 'Correct', impact: "Classe la plus répandue : effet neutre sur la valeur, conforme à la norme du marché." },
  E: { niveau: 'À surveiller', impact: "Point de vigilance : les logements E seront interdits à la location en 2034. Léger frein possible à la revente." },
  F: { niveau: 'Passoire thermique', impact: "Malus fréquent (souvent de −5 % à −15 %). Audit énergétique obligatoire à la vente ; anticiper des travaux." },
  G: { niveau: 'Passoire thermique', impact: "Malus souvent marqué. Audit énergétique obligatoire à la vente ; forte incitation à rénover." },
};
const DPE_PISTES = {
  C: ['Optimiser la ventilation', 'Réguler le chauffage'],
  D: ['Isolation des combles', 'Menuiseries double vitrage'],
  E: ['Isolation des murs', 'Chauffage plus performant', 'Remplacement des menuiseries'],
  F: ['Isolation murs & combles', 'Remplacement du système de chauffage', 'Double vitrage', 'Ventilation (VMC)'],
  G: ['Isolation globale de l\'enveloppe', "Changement d'énergie de chauffage", 'Double vitrage performant', 'Ventilation'],
};
function dpeInfo(classe, conso, commentaire) {
  let c = String(classe || '').toUpperCase().trim();
  if (!DPE_COLORS[c] && conso) { // déduit la classe depuis la conso si besoin
    c = 'G';
    for (const [s, l] of [[70, 'A'], [110, 'B'], [180, 'C'], [250, 'D'], [330, 'E'], [420, 'F']]) { if (conso <= s) { c = l; break; } }
  }
  if (!DPE_COLORS[c]) return null;
  const obligations = [];
  if (c === 'F' || c === 'G') obligations.push('Audit énergétique réglementaire obligatoire à la vente.');
  if (c === 'G') obligations.push('Location interdite depuis 2025 pour les logements classés G.');
  if (c === 'F') obligations.push('Location interdite à compter de 2028 pour les logements classés F.');
  if (c === 'E') obligations.push('Location interdite à compter de 2034 pour les logements classés E.');
  return { classe: c, conso, color: DPE_COLORS[c], niveau: DPE_DATA[c].niveau, impact: DPE_DATA[c].impact, obligations, pistes: DPE_PISTES[c] || [], commentaire: commentaire || '' };
}
// Constitution du dossier — check-list des pièces par niveau (pré-avis / complet).
function slChecklist(d, n) {
  if (!d.checklist || !d.checklist.items.length) return '';
  const C = d.checklist;
  const item = (it) => `<div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-top:1px solid rgba(41,64,41,.1)">
    <div style="width:26px;height:26px;border-radius:5px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;${it.ok ? 'background:#294029;color:#F5EDE5' : 'border:1.5px solid rgba(41,64,41,.28)'}">${it.ok ? '✓' : ''}</div>
    <div style="font-size:18px;color:${it.ok ? '#241912' : 'rgba(36,25,18,.5)'}">${esc(it.label)}</div></div>`;
  const g1 = C.items.filter(i => i.niveau === 1);
  const g2 = C.items.filter(i => i.niveau === 2);
  const half = Math.ceil(g2.length / 2);
  const banner = `<div style="display:flex;align-items:center;gap:22px;background:#294029;color:#F5EDE5;padding:22px 28px;margin-bottom:26px">
    <div style="font-family:'Cormorant Garamond',serif;font-size:50px;line-height:1">${C.pct}%</div>
    <div><div style="font-size:14px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#C3CCB8">Dossier réuni</div>
      <div style="font-size:16px;color:rgba(245,237,229,.85);margin-top:3px">${C.manquantes.length ? 'À fournir pour une estimation complète : ' + C.manquantes.slice(0, 6).map(esc).join(' · ') : 'Toutes les pièces sont réunies.'}</div></div></div>`;
  return section('#F5EDE5',
    `${header('Constitution du dossier', 'Les pièces pour une estimation fiable')}
     <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-top:4px">
       ${banner}
       <div style="font-size:14px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#8C9978;margin-bottom:2px">Niveau 1 — Pré-avis (depuis l'adresse)</div>
       <div style="display:flex;gap:44px;margin-bottom:22px">${g1.map(it => `<div style="flex:1">${item(it)}</div>`).join('')}</div>
       <div style="font-size:14px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#8C9978;margin-bottom:2px">Niveau 2 — Estimation complète</div>
       <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 44px">${[g2.slice(0, half), g2.slice(half)].map(col => `<div>${col.map(item).join('')}</div>`).join('')}</div>
     </div>
     ${footer(d, n)}`);
}

// Le dossier du bien — copropriété / diagnostics. N'apparaît QUE s'il y a du
// contenu copro réel (DPE + taxe/charges/lots sont désormais sur « Le bien en
// détail »). Pas de contenu → pas de page.
function slDocuments(d, n) {
  const D = d.documents || {};
  const aContenu = D.fondsTravaux || D.chargesDetail || D.travaux_votes || D.procedures || D.diagnostics || D.servitudes || D.commentaire;
  if (!aContenu) return '';
  const stat = (v, l) => v ? `<div style="background:#FCFAF5;border:1px solid rgba(41,64,41,.13);padding:20px 24px">
    <div style="font-family:'Cormorant Garamond',serif;font-size:36px;color:#294029;line-height:1">${esc(v)}</div>
    <div style="margin-top:6px;font-size:13.5px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;color:#8C9978">${esc(l)}</div></div>` : '';
  const stats = D.fondsTravaux ? `<div style="margin-bottom:24px;max-width:320px">${stat(D.fondsTravaux, 'Fonds travaux')}</div>` : '';
  const textes = (D.travaux_votes || D.procedures || D.diagnostics || D.servitudes) ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:44px">
       <div>${visBlk('Travaux votés / à prévoir', D.travaux_votes)}${visBlk('Procédures en cours', D.procedures)}</div>
       <div>${visBlk('Diagnostics techniques', D.diagnostics)}${visBlk('Servitudes', D.servitudes)}</div></div>` : '';
  const chargesDetail = D.chargesDetail ? `<div style="margin-bottom:22px;font-size:16.5px;line-height:1.45;color:rgba(36,25,18,.75)"><b style="color:#8C9978">Les charges comprennent :</b> ${esc(D.chargesDetail)}</div>` : '';
  return section('#F5EDE5',
    `${header('Copropriété & diagnostics', 'Le dossier du bien')}
     <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-top:10px">
       ${stats}${chargesDetail}${textes}
       ${D.commentaire ? `<div style="margin-top:20px;background:#E8DACA;padding:20px 28px;font-size:18px;line-height:1.45;color:#521C14">${esc(D.commentaire)}</div>` : ''}
     </div>
     ${footer(d, n)}`);
}

// PRÉ-AVIS uniquement — fourchette de valeur du secteur (€/m² × surface) +
// pièces nécessaires pour affiner et intégrer les bonus/malus.
function slPreAvis(d, n) {
  if (!d.preAvis) return '';
  const P = d.preAvis;
  const docs = ['La visite du bien', 'DPE & diagnostics techniques', 'Règlement de copropriété & PV d\'assemblée', 'Charges courantes & taxe foncière', 'Plans & photographies', 'Titre de propriété'];
  const docLine = (t) => `<div style="display:flex;gap:12px;align-items:flex-start;padding:11px 0;border-top:1px solid rgba(41,64,41,.13)"><img src="${A}/logo-emblem-green.png" style="height:24px;opacity:.55;margin-top:1px"/><div style="font-size:19px;line-height:1.4;color:#241912">${esc(t)}</div></div>`;
  return section('#F5EDE5',
    `${header('Pré-avis de valeur', 'Une première fourchette, à affiner')}
     <div style="flex:1;display:grid;grid-template-columns:1.1fr 1fr;gap:52px;align-items:center;padding-top:10px">
       <div>
         <div style="background:#294029;color:#F5EDE5;padding:32px 36px;position:relative;overflow:hidden">
           <div style="position:absolute;right:-40px;bottom:-50px;width:230px;opacity:.1"><img src="${A}/logo-emblem-cream.png" alt="" style="width:100%;display:block"/></div>
           <div style="font-size:14px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#C3CCB8;position:relative">Fourchette de valeur estimée</div>
           <div style="font-family:'Cormorant Garamond',serif;font-size:54px;font-weight:600;line-height:1.05;margin-top:12px;position:relative">${fmtNum(P.valLow)} – ${fmtNum(P.valHigh)} €</div>
           <div style="font-size:17px;color:rgba(245,237,229,.78);margin-top:12px;position:relative">${fmtNum(P.m2Low)} – ${fmtNum(P.m2High)} €/m² × ${fmtNum(P.surface)} m²</div>
         </div>
         <div style="margin-top:20px;font-size:16.5px;line-height:1.55;color:rgba(36,25,18,.78)">Fourchette établie <b>sur pièces, avant visite</b>, à partir des ventes réelles du secteur (DVF). Elle sera <b>affinée</b> dès réception des éléments ci-contre — permettant d'intégrer les <b>bonus et malus</b> propres à votre bien pour aboutir à un avis de valeur définitif.</div>
       </div>
       <div>
         <div style="font-size:15px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#8C9978;margin-bottom:4px">Pour affiner l'estimation</div>
         ${docs.map(docLine).join('')}
       </div>
     </div>
     ${footer(d, n)}`);
}

// Calcul de valeur (surface pondérée) : prix de référence au m² (mélange DVF +
// annonces) → décote/surcote assumée → habitable → annexes au prorata → prix.
function slCalcul(d, n) {
  if (!d.calcul) return '';
  const C = d.calcul;
  const ajRow = (a) => `<div style="display:grid;grid-template-columns:2.4fr .7fr 3fr;column-gap:18px;align-items:baseline;padding:9px 0;border-top:1px solid rgba(41,64,41,.12)">
    <div style="font-size:18px;color:#241912">${esc(a.label)}</div>
    <div style="text-align:right;font-size:18px;font-weight:600;color:${a.pct >= 0 ? '#294029' : '#521C14'}">${a.pct > 0 ? '+' : ''}${a.pct} %</div>
    <div style="font-size:14.5px;color:rgba(36,25,18,.6)">${esc(a.note || '')}</div></div>`;
  const annexeRow = (x) => `<div style="display:grid;grid-template-columns:2fr 1.5fr 1fr 1.2fr;column-gap:16px;align-items:baseline;padding:8px 0;border-top:1px solid rgba(41,64,41,.12)">
    <div style="font-size:18px;color:#241912">${esc(x.type)}</div>
    <div style="text-align:right;font-size:15.5px;color:rgba(36,25,18,.65)">${fmtNum(x.surface)} m² × ${x.prorata} %</div>
    <div style="text-align:right;font-size:15.5px;color:#8C9978">${fmtNum(x.m2)} €/m²</div>
    <div style="text-align:right;font-size:18px;font-weight:600;color:#294029">${fmtNum(x.valeur)} €</div></div>`;
  const srcParts = [];
  if (C.dvfM2) srcParts.push(`DVF ${fmtNum(C.dvfM2)}`);
  if (C.annoncesM2) srcParts.push(`annonces ${fmtNum(C.annoncesM2)}`);
  if (C.maM2) srcParts.push(`MeilleursAgents ${fmtNum(C.maM2)}`);
  const refText = srcParts.length > 1 ? `moyenne de ${srcParts.join(' · ')}` : (srcParts[0] ? `d'après ${srcParts[0]}` : '');
  return section('#F5EDE5',
    `${header('Calcul de la valeur', 'Comment nous arrivons à cette valeur')}
     <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-top:2px">
       <div style="display:flex;justify-content:space-between;align-items:center;background:#FCFAF5;border:1px solid rgba(41,64,41,.15);padding:16px 24px">
         <div style="font-size:14px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#8C9978">Prix de référence au m² — ${esc(refText)}</div>
         <div style="font-family:'Cormorant Garamond',serif;font-size:38px;color:#294029">${fmtNum(C.refM2)} €/m²</div></div>
       ${d.pitch ? `<div style="margin:14px 0 2px;padding:12px 20px;background:#FCFAF5;border-left:3px solid #8C9978"><div style="font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#8C9978;margin-bottom:3px">Ce bien en particulier</div><div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:19px;line-height:1.45;color:#241912">${esc(d.pitch.length > 240 ? d.pitch.slice(0, 238).trim() + '…' : d.pitch)}</div></div>` : ''}
       ${C.ajustements.length ? `<div style="font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#8C9978;padding:16px 0 0">Décote / surcote appliquée</div>${C.ajustements.map(ajRow).join('')}
         <div style="display:flex;justify-content:space-between;align-items:baseline;padding:11px 0 0;margin-top:3px;border-top:1px solid rgba(41,64,41,.2)"><span style="font-size:16px;color:rgba(36,25,18,.72)">€/m² retenu (${C.totalPct > 0 ? '+' : ''}${C.totalPct} %)</span><span style="font-family:'Cormorant Garamond',serif;font-size:26px;color:#294029">${fmtNum(C.habM2)} €/m²</span></div>` : ''}
       <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:12px;padding:11px 0;border-top:1px solid rgba(41,64,41,.12)">
         <span style="font-size:17px;color:#241912">Surface habitable — ${fmtNum(C.habM2)} €/m² × ${fmtNum(C.surface)} m²</span>
         <span style="font-family:'Cormorant Garamond',serif;font-size:28px;color:#294029">${fmtNum(C.habValue)} €</span></div>
       ${C.annexes.length ? `<div style="font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#8C9978;padding:8px 0 0">Annexes — au prorata du €/m² habitable</div>${C.annexes.map(annexeRow).join('')}` : ''}
       <div style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;background:#294029;color:#F5EDE5;padding:22px 28px;position:relative;overflow:hidden">
         <div style="position:absolute;right:-40px;bottom:-50px;width:220px;opacity:.1"><img src="${A}/logo-emblem-cream.png" alt="" style="width:100%;display:block"/></div>
         <div style="position:relative"><div style="font-size:15px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#C3CCB8">Prix de marché retenu</div>${C.finaleM2 ? `<div style="font-size:16px;color:rgba(245,237,229,.72);margin-top:4px">soit ${fmtNum(C.finaleM2)} €/m²${C.annexesTotal ? ' · habitable + annexes' : ''}</div>` : ''}</div>
         <div style="font-family:'Cormorant Garamond',serif;font-size:52px;font-weight:600;position:relative">${fmtNum(C.finale)} €</div></div>
       <div style="margin-top:12px;font-size:14px;color:rgba(36,25,18,.55)">Prix de référence mixte (ventes DVF + annonces), décote/surcote assumées, annexes au prorata. Valeur nette vendeur, hors honoraires.</div>
     </div>
     ${footer(d, n)}`, 'padding:70px 104px 50px');
}

// ── data + assemblage ───────────────────────────────────────────────
export function buildAvisData(m) {
  const ma = moisAnnee();
  const adresse = (m?.adresse || '').trim();
  const ville = (m?.ville || '').trim();
  const lieu = [adresse, ville].filter(Boolean).join(', ') || (m?.nom || 'Bien à évaluer');
  const estB2C = (m?.marche || '') === 'b2c';
  const av = m?.avis_valeur || {};
  const preco = av.preconisation || {};
  const comp = av.comparables || {};
  const m2v = av.methode_m2 || {};
  const swot = av.swot || {};
  const photos = photosOf(m);
  const surface = num(m?.surface);

  // ── CALCUL DE VALEUR (méthode surface pondérée) — calculé tôt car les 3 prix
  //    en découlent. Prix de référence au m² = mélange DVF réalisé (70 %) +
  //    annonces affichées (30 %). Décote/surcote assumée (±25 %). Annexes au
  //    prorata du €/m² habitable (jardin, cave, terrasse, parking…).
  const dvfM2 = num(comp.mediane_m2) || medArr((Array.isArray(comp.ventes) ? comp.ventes : []).map(v => v.prixM2));
  const annoncesM2 = medArr((comp.biens_similaires || []).map(b => (num(b.prix) && num(b.surface)) ? Math.round(num(b.prix) / num(b.surface)) : 0).filter(Boolean));
  const maM2 = num(comp.meilleurs_agents_m2); // MeilleursAgents (saisi à la main d'après un screenshot)
  // Prix de référence = moyenne pondérée des 3 sources dispo (DVF 50 %, annonces 25 %, MeilleursAgents 25 %),
  // renormalisée si une source manque.
  const refParts = [[dvfM2, 0.5], [annoncesM2, 0.25], [maM2, 0.25]].filter(x => x[0] > 0);
  const refM2 = refParts.length ? Math.round(refParts.reduce((s, [v, w]) => s + v * w, 0) / refParts.reduce((s, [, w]) => s + w, 0)) : 0;
  let calcul = null;
  if (refM2 && surface) {
    const ajs = (preco.ajustements || []).filter(a => a && (a.label || a.pct));
    const totalPct = ajs.reduce((s, a) => s + (+a.pct || 0), 0);
    const habM2 = Math.round(refM2 * (1 + totalPct / 100));       // €/m² retenu pour l'habitable
    const habValue = Math.round(habM2 * surface);
    const annexes = (preco.annexes || [])
      .filter(a => a && num(a.surface) > 0 && num(a.prorata) > 0)
      .map(a => { const s = num(a.surface), pr = num(a.prorata); return { type: a.type || 'Annexe', surface: s, prorata: pr, m2: Math.round((pr / 100) * habM2), valeur: Math.round(s * (pr / 100) * habM2) }; });
    const annexesTotal = annexes.reduce((s, a) => s + a.valeur, 0);
    const finale = round5k(habValue + annexesTotal);
    calcul = {
      refM2, dvfM2, annoncesM2, maM2, surface,
      ajustements: ajs.map(a => ({ label: a.label || 'Ajustement', pct: +a.pct || 0, note: a.note || '' })),
      totalPct, habM2, habValue, annexes, annexesTotal, finale,
      finaleM2: surface ? Math.round(finale / surface) : 0,
    };
  }

  // Synthèse — cartes DESCRIPTIVES (pas de prix ici)
  const cards = [];
  if (surface) cards.push({ figure: fmtM2(surface), label: estB2C ? 'Surface habitable' : 'Surface totale', desc: '' });
  if (num(m?.nb_pieces)) cards.push({ figure: `${fmtNum(m.nb_pieces)}`, label: 'Pièces', desc: '' });
  if (num(m?.nb_chambres)) cards.push({ figure: `${fmtNum(m.nb_chambres)}`, label: 'Chambres', desc: '' });
  if (num(m?.nb_sdb)) cards.push({ figure: `${fmtNum(m.nb_sdb)}`, label: 'Salles de bain', desc: '' });
  if (m?.etage != null && m?.etage !== '') cards.push({ figure: `${esc(m.etage)}`, label: 'Étage', desc: '' });
  if (num(m?.nb_lots)) cards.push({ figure: `${fmtNum(m.nb_lots)}`, label: 'Lots', desc: '' });
  if (num(m?.dpe_consommation)) cards.push({ figure: `DPE ${m?.dpe_classe || ''}`.trim(), label: 'Performance', desc: `${fmtNum(m.dpe_consommation)} kWh/m²·an` });
  if (num(m?.annee_construction)) cards.push({ figure: `${m.annee_construction}`, label: 'Année', desc: '' });
  if (num(m?.loyers_annuels)) cards.push({ figure: `${fmtEUR(m.loyers_annuels)}`, label: 'Loyers / an', desc: '' });

  // Prix arrondis à 5 000 € près. Ils DÉCOULENT du calcul (habitable + annexes)
  // quand il existe : marché = valeur retenue, plancher −5 %, coup de cœur +5 % (écart total ≤ 10 %).
  const central = calcul ? calcul.finale : round5k(num(preco.prix_marche) || num(m2v.valeur_centrale?.valeur_totale));
  const bas = calcul ? round5k(calcul.finale * 0.95) : round5k(num(preco.prix_plancher) || num(m2v.valeur_basse?.valeur_totale));
  const haut = calcul ? round5k(calcul.finale * 1.05) : round5k(num(preco.prix_coup_de_coeur) || num(m2v.valeur_haute?.valeur_totale));
  const mandatNet = round5k(num(m?.prix_net_vendeur) || num(m?.prix));
  let fourchette = null;
  if (bas && haut) fourchette = { label: 'Fourchette de valorisation proposée', value: `${fmtEUR(bas)}<br>– ${fmtEUR(haut)}`, sub: '' };
  else if (mandatNet) fourchette = { label: 'Prix demandé (net vendeur)', value: fmtEUR(mandatNet), sub: '' };

  // Galerie — photos du mandat
  const galerie = photos.slice(0, 5).map(u => ({ url: u, cap: '' }));

  // Marché — comparables DVF
  const marcheCards = [];
  if (num(comp.prix_zone_min) || num(comp.prix_zone_max)) marcheCards.push({ value: `${fmtNum(comp.prix_zone_min)} – ${fmtNum(comp.prix_zone_max)} €/m²`, desc: 'Fourchette de prix au m² observée sur le secteur (ventes réelles DVF).' });
  if (num(m?.prix_m2)) marcheCards.push({ value: `${fmtNum(m.prix_m2)} €/m²`, desc: 'Positionnement de ce bien, frais d\'agence inclus.' });
  if (!estB2C && (num(comp.rendement_zone_min) || num(comp.rendement_zone_max))) marcheCards.push({ value: `${fmtNum(comp.rendement_zone_min)} – ${fmtNum(comp.rendement_zone_max)} %`, desc: 'Rendement brut de la zone.' });

  // Valorisation — 3 prix. Le €/m² est recalculé dans la carte (valeur ÷ surface).
  const prix = [];
  if (bas) prix.push({ label: 'Prudent', valeur: bas, montant: fmtEUR(bas), desc: 'Base de négociation, liquidité rapide.' });
  if (central) prix.push({ label: 'Valeur centrale', valeur: central, montant: fmtEUR(central), desc: 'Prix de marché recommandé.', highlight: true });
  if (haut) prix.push({ label: 'Présentation', valeur: haut, montant: fmtEUR(haut), desc: "Prix d'affichage, bien d'exception." });

  // Localisation — carte + transports + commodités (assets auto du mandat)
  const td = m?.transports_data || {};
  const qd = m?.quartier_data || {};
  const transports = [];
  const pushMode = (arr, mode) => (arr || []).slice(0, 4).forEach(s => {
    const nom = s.name || s.nom || s.station || '';
    if (nom) transports.push({ mode, name: nom, lines: [].concat(s.lines || s.ligne || []).filter(Boolean), distance: s.distance ? Math.round(s.distance) : 0 });
  });
  pushMode(td.metro, 'metro'); pushMode(td.rer, 'rer'); pushMode(td.tram, 'tram'); pushMode(td.bus, 'bus');
  const amen = (arr, k = 3) => (arr || []).slice(0, k).map(a => `${a.name}${a.distance ? ` — ${a.distance} m` : ''}`);
  const commodites = [...amen(qd.ecoles, 3), ...amen(qd.commerces, 2), ...amen(qd.sante, 1)];
  const loisirs = [...amen(qd.parcs, 3), ...amen(qd.culture, 2)];
  const mapUrl = m?.map_static_image_url || m?.satellite_image_url || m?.cadastre_image_url || null;
  const pc = m?.parcelle_data || {};
  const prefixeUtile = pc.prefixe && !/^0+$/.test(String(pc.prefixe).trim()) ? String(pc.prefixe).trim() : '';
  const cadastreRef = (pc.section || pc.numero)
    ? `${[prefixeUtile, pc.section].filter(Boolean).join(' ')} n° ${pc.numero || '—'}`.replace(/\s+/g, ' ').trim()
    : '';
  const cadastreSurface = pc.contenance ? `${fmtNum(pc.contenance)} m² au sol` : '';
  // Risques naturels (Géorisques, forme variable) — affichés en compact dans l'emplacement.
  const risques = [];
  (function scan(obj, depth) {
    if (!obj || depth > 4 || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.forEach(o => scan(o, depth + 1)); return; }
    const present = obj.present === true || obj.present === 'true' || obj.presence === true;
    const lib = obj.libelle_risque_long || obj.libelle_risque || obj.libelle || obj.nom || obj.type;
    if (present && lib) { const s = String(lib).trim(); if (s && !risques.includes(s)) risques.push(s); }
    Object.values(obj).forEach(v => scan(v, depth + 1));
  })(m?.risques_data || {}, 0);
  const localisation = (mapUrl || transports.length || commodites.length || cadastreRef || risques.length || av.localisation?.commentaire) ? {
    mapUrl, cadastreRef, cadastreSurface,
    cadastreImg: m?.cadastre_image_url || null,
    risques,
    transports,
    commodites: (av.localisation?.commodites || []).concat(commodites),
    loisirs: (av.localisation?.loisirs || []).concat(loisirs),
    commentaire: av.localisation?.commentaire || '',
    commentaireUrbanisme: av.localisation?.commentaire_urbanisme || '',
    title: "L'emplacement du bien",
  } : null;

  // Caractéristiques — détails du mandat
  const cr = [];
  if (surface) cr.push(['Surface', fmtM2(surface)]);
  if (num(m?.nb_pieces)) cr.push(['Pièces', fmtNum(m.nb_pieces)]);
  if (num(m?.nb_chambres)) cr.push(['Chambres', fmtNum(m.nb_chambres)]);
  if (m?.etage != null && m?.etage !== '') cr.push(['Étage', String(m.etage)]);
  if (num(m?.annee_construction)) cr.push(['Année', String(m.annee_construction)]);
  if (num(m?.prix)) cr.push(['Prix FAI', fmtEUR(m.prix)]);
  const streetView = m?.street_view_image_url || null;
  // Vraie photo en priorité ; Street View seulement s'il n'y a AUCUNE photo.
  const caracPhoto = photos[1] || photos[0] || streetView;
  // Descriptif : priorité au texte saisi dans l'avis (caractéristiques → commentaire).
  const avCarac = av.caracteristiques || {};
  const descTxt = String(m?.description || avCarac.commentaire || avCarac.distribution || '').trim();
  const descCourt = descTxt.length > 620 ? descTxt.slice(0, 618) + '…' : descTxt;
  const atoutsCarac = Array.isArray(avCarac.atouts_distinctifs) ? avCarac.atouts_distinctifs.map(x => String(x || '').trim()).filter(Boolean) : [];
  const caracteristiques = cr.length ? { rows: cr, photo: caracPhoto, photoLegende: (caracPhoto === streetView) ? "L'immeuble" : '', description: descCourt, atouts: atoutsCarac, title: 'Le bien en détail' } : null;

  // Comparables DVF détaillés (tableau) + biens similaires disponibles (saisis)
  const comparablesTable = (comp.ventes && comp.ventes.length) ? { ventes: comp.ventes, parAnnee: comp.par_annee || [] } : null;
  const biensSimilaires = (comp.biens_similaires || [])
    .filter(b => b && (b.adresse || b.lien || b.prix))
    .map(b => ({ ...b, prixM2: (num(b.prix) && num(b.surface)) ? Math.round(num(b.prix) / num(b.surface)) : 0 }));

  // ── ENTONNOIR PHASE 1 : analyses dérivées des ventes DVF déjà stockées ──
  const ventes = Array.isArray(comp.ventes) ? comp.ventes : [];
  // dvfM2 / annoncesM2 déjà calculés plus haut (pour le calcul de valeur).

  // Phase du document : 'definitif' si visite/dossier complet, sinon 'pre_avis'.
  const phase = (av.phase === 'definitif' || av.phase === 'pre_avis') ? av.phase
    : (av.visite || av.documents || caracteristiques?.description || photos.length) ? 'definitif' : 'pre_avis';
  const isPreAvis = phase !== 'definitif';
  const docLabel = isPreAvis ? 'Pré-avis de valeur' : 'Avis de valeur';

  // Analyse de la RUE — ventes de la même voie.
  const rueVentes = ventes.filter(v => v.memeRue);
  const rue = rueVentes.length ? {
    photo: streetView || mapUrl,
    count: rueVentes.length,
    medianeM2: medArr(rueVentes.map(v => v.prixM2)),
    ventes: [...rueVentes].sort((a, b) => String(b.date).localeCompare(String(a.date))),
    commentaire: av.localisation?.commentaire_rue || `Sur cette voie, ${rueVentes.length} vente(s) enregistrée(s) permettent de caler le positionnement au plus près du bien.`,
    title: "L'analyse de la rue",
  } : null;

  // Historique de l'immeuble — intégré au tableau comparables (lignes surlignées).
  const immeubleVentes = ventes.filter(v => v.memeImmeuble);

  // ÉVOLUTION DES PRIX — par année (5 ans) + focus 12 derniers mois.
  let parAnnee = (comp.par_annee && comp.par_annee.length)
    ? [...comp.par_annee].map(a => ({ annee: a.annee, count: a.count, m2Median: a.m2Median }))
    : Object.entries(ventes.reduce((acc, v) => { const y = yearOf(v.date); if (y) (acc[y] = acc[y] || []).push(v.prixM2); return acc; }, {}))
        .map(([annee, arr]) => ({ annee: +annee, count: arr.length, m2Median: medArr(arr) }));
  parAnnee = parAnnee.filter(a => a.m2Median).sort((a, b) => a.annee - b.annee).slice(-5);
  let evolution = null;
  if (parAnnee.length >= 2) {
    const dates = ventes.map(v => v.date).filter(Boolean).sort();
    const maxD = dates[dates.length - 1];
    let focus12 = null;
    if (maxD) {
      const c1 = addMonths(maxD, -12), c2 = addMonths(maxD, -24);
      const rec = ventes.filter(v => v.date && v.date > c1);
      const prev = ventes.filter(v => v.date && v.date > c2 && v.date <= c1);
      const mRec = medArr(rec.map(v => v.prixM2)), mPrev = medArr(prev.map(v => v.prixM2));
      focus12 = { medianeM2: mRec, count: rec.length, variationPct: (mRec && mPrev) ? Math.round(((mRec - mPrev) / mPrev) * 100) : null };
    }
    evolution = { parAnnee, focus12, title: "L'évolution des prix sur 5 ans", note: 'Médianes €/m² issues des ventes réelles (DVF). Les 12 derniers mois donnent la tendance la plus récente du secteur.' };
  }

  // SYNTHÈSE MARCHÉ — réalisé (DVF) vs affiché (annonces). annoncesM2 déjà calculé plus haut.
  const syntheseMarche = (dvfM2 && annoncesM2) ? {
    dvfM2, annoncesM2,
    ecartPct: Math.round(((annoncesM2 - dvfM2) / dvfM2) * 100),
    note: annoncesM2 > dvfM2
      ? 'Les prix affichés intègrent une marge de négociation : la valeur réelle se situe généralement en deçà.'
      : 'Les prix affichés sont alignés, voire inférieurs aux ventes réelles — marché tendu à l\'achat.',
  } : (dvfM2 ? { dvfM2, annoncesM2: 0, ecartPct: null, note: 'Peu d\'annonces comparables actuellement : le marché réalisé (DVF) reste la référence la plus fiable.' } : null);

  // ── PHASE 2 : observations de visite (seulement en avis définitif) ──
  const vis = av.visite || {};
  const visiteOn = !isPreAvis;
  const immeuble = (visiteOn && (vis.architecture || vis.immeuble_qualite || vis.parties_communes)) ? {
    photo: photos[2] || photos[1] || streetView,
    architecture: vis.architecture, immeuble_qualite: vis.immeuble_qualite, parties_communes: vis.parties_communes,
  } : null;
  const habCards = [];
  if (visiteOn) {
    const add = (t, v) => { if (String(v || '').trim()) habCards.push({ t, v }); };
    add('Agencement', vis.agencement); add('Volumes', vis.volumes); add('Luminosité', vis.luminosite);
    add('Exposition', vis.exposition); add('Vues & dégagement', vis.vues);
  }
  const habitabilite = habCards.length ? { cards: habCards } : null;
  const prestaList = (vis.prestations || []).map(x => String(x || '').trim()).filter(Boolean);
  const prestationsEtat = (visiteOn && (prestaList.length || vis.etat_general || vis.travaux || vis.potentiel)) ? {
    prestations: prestaList, etat_general: vis.etat_general, travaux: vis.travaux, potentiel: vis.potentiel,
  } : null;

  // ── PHASE 2 : DPE analysé + dossier documentaire (option « sur pièces ») ──
  const dpe = (m?.dpe_classe || num(m?.dpe_consommation))
    ? dpeInfo(m?.dpe_classe, num(m?.dpe_consommation), av.dpe?.commentaire || '') : null;
  const doc = av.documents || {};
  // Champs partagés avec la fiche mandat : le mandat est la source (source unique).
  const taxeF = num(m?.taxe_fonciere) || num(doc.taxe_fonciere);
  const chargesVal = num(m?.charges_annuelles) || num(doc.charges_annuelles);
  const nbLotsVal = num(m?.nb_lots) || num(doc.copro_nb_lots);
  const documents = (taxeF || chargesVal || num(doc.fonds_travaux) || nbLotsVal
    || doc.charges_detail || doc.travaux_votes || doc.procedures || doc.diagnostics || doc.servitudes || doc.commentaire) ? {
    taxeFonciere: taxeF ? fmtEUR(taxeF) : '',
    charges: chargesVal ? fmtEUR(chargesVal) : '',
    chargesDetail: doc.charges_detail || '',
    fondsTravaux: num(doc.fonds_travaux) ? fmtEUR(doc.fonds_travaux) : '',
    nbLots: nbLotsVal ? fmtNum(nbLotsVal) : '',
    travaux_votes: doc.travaux_votes || '', procedures: doc.procedures || '',
    diagnostics: doc.diagnostics || '', servitudes: doc.servitudes || '', commentaire: doc.commentaire || '',
  } : null;

  // CHECK-LIST des pièces du dossier — cochée auto dès que la donnée existe
  // (mandat OU avis), sinon manuelle via la case à cocher du formulaire.
  const ck = doc.checklist || {};
  const ckItem = (key, label, niveau, auto) => ({ label, niveau, ok: ck[key] === true || !!auto });
  const hasPlan = (Array.isArray(m?.medias) && m.medias.some(x => x && x.type === 'plan'))
    || (Array.isArray(m?.plans) && m.plans.length > 0) || !!m?.plan_url;
  const anyCharges = num(doc.charges_annuelles) || num(m?.charges_annuelles) || num(m?.charges) || num(m?.charges_recup) || num(m?.charges_non_recup);
  // Pièces cochées au niveau du MANDAT (check-list du dossier) + déductions data.
  const P = new Set([].concat(m?.pieces_presentes || m?.piecesPresentes || []));
  const ckItems = [
    ckItem('adresse', 'Adresse du bien', 1, m?.adresse),
    ckItem('type_surface', 'Type & surface du bien', 1, surface || m?.type),
    ckItem('photos', 'Photos du bien', 2, P.has('photos') || photos.length),
    ckItem('plans', 'Plans du bien', 2, P.has('plans') || hasPlan),
    ckItem('titre', 'Titre de propriété', 2, P.has('titre')),
    ckItem('dpe', 'DPE', 2, P.has('dpe') || m?.dpe_classe || num(m?.dpe_consommation)),
    ckItem('diagnostics', 'Diagnostics techniques', 2, P.has('diagnostics') || doc.diagnostics),
    ckItem('taxe', 'Avis de taxe foncière', 2, P.has('taxe') || taxeF),
    ckItem('charges', 'Appels de charges', 2, P.has('appels_charges') || anyCharges),
    ckItem('reglement', 'Règlement de copropriété', 2, P.has('reglement_copro')),
    ckItem('pv_ag', "PV d'assemblée générale", 2, P.has('pv_ag')),
    ckItem('carnet', "Carnet d'entretien de l'immeuble", 2, false),
  ];
  const ckOk = ckItems.filter(i => i.ok).length;
  const checklist = {
    items: ckItems,
    pct: Math.round((ckOk / ckItems.length) * 100),
    manquantes: ckItems.filter(i => !i.ok).map(i => i.label),
  };

  // (Le calcul de valeur est fait en amont — voir « CALCUL DE VALEUR ».)

  // PRÉ-AVIS — fourchette de valeur (prix/m² du secteur × surface), avant visite.
  const preAvis = (isPreAvis && dvfM2 && surface) ? {
    medianM2: dvfM2, surface,
    m2Low: Math.round(dvfM2 * 0.95), m2High: Math.round(dvfM2 * 1.05),
    valLow: round5k(dvfM2 * surface * 0.95), valHigh: round5k(dvfM2 * surface * 1.05),
  } : null;

  // NIVEAU DE CONFIANCE — heuristique honnête (surchargée si saisie manuelle).
  let confiance = null;
  {
    let score = 0;
    score += ventes.length >= 15 ? 2 : ventes.length >= 6 ? 1 : 0;
    score += rueVentes.length >= 3 ? 1 : 0;
    score += immeubleVentes.length >= 1 ? 1 : 0;
    score += biensSimilaires.length >= 2 ? 1 : 0;
    score += surface ? 1 : 0;
    const niveau = preco.confiance || (score >= 5 ? 'Élevé' : score >= 3 ? 'Correct' : 'Indicatif');
    const base = [];
    if (ventes.length) base.push(`${ventes.length} vente(s) DVF`);
    if (rueVentes.length) base.push(`${rueVentes.length} sur la rue`);
    if (immeubleVentes.length) base.push(`${immeubleVentes.length} dans l'immeuble`);
    if (biensSimilaires.length) base.push(`${biensSimilaires.length} annonce(s)`);
    confiance = { niveau, texte: base.length ? `Fondé sur ${base.join(', ')}.` : 'Estimation indicative, à affiner avec la visite ou le dossier.' };
  }

  // Avant-propos
  const avantPropos = isPreAvis
    ? `Nous vous remercions de nous avoir consulté dans le cadre de la valorisation de votre bien situé ${lieu}. Ce pré-avis de valeur, établi sur pièces et données de marché, avant visite, constitue une première estimation argumentée. Il sera enrichi et confirmé dès la visite du bien ou la réception de votre dossier. Nous restons à votre entière disposition.`
    : `Nous vous remercions de nous avoir consulté dans le cadre de la valorisation de votre bien situé ${lieu}. Vous trouverez dans ce document notre avis de valeur, accompagné de notre recommandation stratégique et marketing pour une mise en vente optimale. Nous restons à votre entière disposition.`;

  // Vigilance — SWOT (facteurs limitatifs + menaces)
  const vig = [];
  (swot.facteurs_limitatifs || []).forEach(t => vig.push({ titre: t, texte: '' }));
  (swot.menaces || []).forEach(t => vig.push({ titre: t, texte: '' }));

  return {
    phase, isPreAvis, docLabel,
    titre: m?.nom || adresse || 'Bien à évaluer',
    ville, sousTitre: typeLabelOf(m) || (estB2C ? "Bien d'habitation" : 'Immeuble de rapport'),
    eyebrowDate: `${docLabel} — ${ma}`,
    footerAddr: `${lieu} · ${ma} · Confidentiel`,
    consultant: preco.consultant_nom || 'Immeubles & Patrimoine',
    contactSub: `${docLabel} · ${lieu}`,
    contactDate: `${ma} · Document confidentiel`,
    coverPhoto: photos[0] || m?.street_view_image_url || null,
    commercialisation: m?.commercialisation,
    avantPropos,
    localisation,
    rue,
    caracteristiques,
    immeuble,
    habitabilite,
    prestationsEtat,
    pitch: descCourt,
    dpe,
    documents,
    synthese: cards.length ? { cards, fourchette, title: estB2C ? 'Les chiffres clés du bien' : "Les chiffres clés de l'actif" } : null,
    galerie, galerieTitle: 'Le bien en images',
    marche: marcheCards.length ? { cards: marcheCards, note: esc(comp.commentaire || ''), title: estB2C ? 'Le prix au m² du secteur' : 'Le marché du secteur' } : null,
    evolution,
    comparablesTable: comparablesTable ? { ...comparablesTable, immeuble: immeubleVentes.length } : null,
    biensSimilaires,
    syntheseMarche,
    preAvis,
    calcul,
    confiance,
    valorisation: prix.length ? { prix, surface, intro: '', reco: preco.recommandation || '', decote: preco.facteurs_decote || '', positionnement: preco.positionnement || '', ajustements: (preco.ajustements || []).filter(a => a && (a.label || a.pct)), confiance, isPreAvis } : null,
    vigilance: vig,
    etapes: null,
  };
}

export function buildAvisHtml(m) {
  const d = buildAvisData(m);
  let n = 1; const N = () => String(++n).padStart(2, '0');
  // Ordre = ENTONNOIR (cahier des charges) : rituel → agence → secteur →
  // marché → bien → valorisation. Chaque section s'omet si vide : un pré-avis
  // (adresse seule) sort plus court, un avis définitif s'enrichit sans casser.
  return [
    slCover(d),
    slSynthese(d, N()),            // chiffres clés (descriptif, sans prix)
    slAvantPropos(d, N()),
    // Agence — « pourquoi nous » + méthodologie
    slQuiSommesNous(d, N()),
    slMethode(d, N()),             // méthodologie d'évaluation
    slSupportsReseau(d, N()),
    // Le secteur — entonnoir géographique : quartier → rue → urbanisme
    slLocalisation(d, N()),        // quartier, commerces, transports + cadastre compact
    slRue(d, N()),                 // analyse de la rue (DVF même voie)
    // Le marché — entonnoir marché : local → évolution → comparables → annonces → synthèse
    slMarche(d, N()),              // prix au m² du secteur + évolution 5 ans + focus 12 mois
    slComparablesTable(d, N()),    // comparables DVF (+ historique immeuble surligné)
    slBiensSimilaires(d, N()),     // annonces en commercialisation
    slSyntheseMarche(d, N()),      // réalisé (DVF) vs affiché (annonces)
    slPreAvis(d, N()),             // PRÉ-AVIS uniquement : fourchette secteur × surface + pièces à fournir
    // Le bien — enrichi en Phase 2 (visite / dossier) ; omis si vide en pré-avis
    slCaracteristiques(d, N()),
    slImmeuble(d, N()),        // architecture, qualité, parties communes
    slHabitabilite(d, N()),    // volumes, lumière, expositions, vues, agencement
    slPrestations(d, N()),     // prestations + état + travaux + potentiel
    slGalerie(d, N()),
    // Dossier — copropriété / fiscalité / diagnostics (si renseigné)
    slDocuments(d, N()),
    // Valorisation — calcul transparent (bonus/malus justifiés) puis fourchette + confiance
    slCalcul(d, N()),
    slValorisation(d, N()),
    slEtapes(d, N()),
    slVigilance(d, N()),
    slContact(d),
  ].filter(Boolean).join('\n');
}
