// lib/avis/buildAvis.js
// Génère l'avis de valeur (charte « 66 Turenne », HTML/CSS exact) À PARTIR DES
// DONNÉES DU MANDAT. Chaque section se construit depuis le mandat + avis_valeur ;
// les sections sans données sont OMISES (jamais de contenu 66 Turenne en dur).
// Chaque section = une diapositive 16:9 (1920×1080).

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const A = '/avis-assets';

// ── helpers ─────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (n) => { const x = parseFloat(n); return isNaN(x) ? 0 : x; };
const fmtNum = (n) => { const x = num(n); return x ? x.toLocaleString('fr-FR').replace(/ | /g, ' ') : ''; };
const fmtEUR = (n) => { const x = num(n); return x ? fmtNum(x) + ' €' : ''; };
const fmtM2 = (n) => { const x = num(n); return x ? fmtNum(Math.round(x)) + ' m²' : ''; };
function moisAnnee(d = new Date()) { return `${MOIS[d.getMonth()].charAt(0).toUpperCase() + MOIS[d.getMonth()].slice(1)} ${d.getFullYear()}`; }

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
    <div style="flex:.95;display:flex;align-items:center;justify-content:center;position:relative;z-index:1">
      ${d.coverPhoto
      ? `<div style="width:640px;height:820px;overflow:hidden"><img src="${esc(d.coverPhoto)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/></div>`
      : `<img src="${A}/logo-emblem-green.png" alt="" style="width:560px;max-width:100%;display:block"/>`}
    </div>
  </section>`;
}

function slSynthese(d, n) {
  if (!d.synthese || !d.synthese.cards.length) return '';
  const card = (c) => `<div style="background:#FCFAF5;border:1px solid rgba(41,64,41,.13);padding:26px 30px;display:flex;flex-direction:column;gap:9px">
    <div style="font-family:'Cormorant Garamond',serif;font-size:50px;font-weight:500;color:#294029;line-height:1">${esc(c.figure)}</div>
    <div style="font-size:15px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:#8C9978">${esc(c.label)}</div>
    ${c.desc ? `<div style="font-size:18px;line-height:1.35;color:rgba(36,25,18,.82)">${esc(c.desc)}</div>` : ''}</div>`;
  const cards = d.synthese.cards.slice(0, 4).map(card).join('');
  const f = d.synthese.fourchette;
  const panel = f ? `<div style="background:#294029;color:#F5EDE5;padding:46px 44px;display:flex;flex-direction:column;justify-content:center;position:relative;overflow:hidden">
      <div style="position:absolute;right:-60px;bottom:-70px;width:360px;opacity:.1;pointer-events:none"><img src="${A}/logo-emblem-cream.png" alt="" style="width:100%;display:block"/></div>
      <div style="font-size:16px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#C3CCB8;position:relative">${esc(f.label)}</div>
      <div style="margin-top:20px;font-family:'Cormorant Garamond',serif;font-size:62px;font-weight:500;line-height:1.04;color:#F5EDE5;position:relative">${f.value}</div>
      ${f.sub ? `<div style="margin-top:22px;font-size:19px;line-height:1.4;color:rgba(245,237,229,.78);position:relative">${esc(f.sub)}</div>` : ''}
    </div>` : '';
  return section('#F5EDE5',
    `${header('Synthèse', d.synthese.title || 'Les chiffres clés du bien')}
     <div style="flex:1;display:grid;grid-template-columns:${panel ? '1.12fr .88fr' : '1fr'};gap:36px;padding-top:34px">
       <div style="display:grid;grid-template-columns:1fr 1fr;gap:22px;align-content:start">${cards}</div>${panel}</div>
     ${footer(d, n)}`);
}

function slGalerie(d, n) {
  if (!d.galerie || !d.galerie.length) return '';
  const g = d.galerie;
  const slot = (url, cap, big) => `<div style="${big ? 'grid-row:span 2;' : ''}position:relative;min-width:0;min-height:0;border:1px solid rgba(41,64,41,.18);overflow:hidden">
    ${url ? `<img src="${esc(url)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/>` : `<div style="position:absolute;inset:0;background:#EDE6DC"></div>`}
    ${cap ? `<div style="position:absolute;left:0;right:0;bottom:0;padding:${big ? '26px 18px 12px' : '22px 16px 10px'};background:linear-gradient(to top,rgba(36,25,18,.62),transparent);color:#F5EDE5;font-size:${big ? '15px' : '14px'};font-weight:500;letter-spacing:.04em;pointer-events:none">${esc(cap)}</div>` : ''}</div>`;
  const [first, ...rest] = g;
  const petits = rest.slice(0, 4).map(p => slot(p.url, p.cap)).join('');
  return section('#F5EDE5',
    `${header('Le bien en images', d.galerieTitle || 'Le bien en images')}
     <div style="flex:1;display:grid;grid-template-columns:1.5fr 1fr 1fr;grid-template-rows:1fr 1fr;gap:16px;padding-top:24px">
       ${slot(first.url, first.cap, true)}${petits}</div>
     ${footer(d, n)}`);
}

function slMarche(d, n) {
  if (!d.marche || !d.marche.cards.length) return '';
  const card = (c, i) => `<div>
    <div style="font-family:'Cormorant Garamond',serif;font-size:58px;font-weight:500;color:${i === 3 ? '#CFBA9E' : '#F5EDE5'};line-height:1">${esc(c.value)}</div>
    <div style="margin-top:8px;font-size:19px;line-height:1.4;color:rgba(245,237,229,.78)">${esc(c.desc)}</div></div>`;
  const cards = d.marche.cards.slice(0, 4).map(card).join('');
  return `<section style="${SECT('#294029', 'color:#F5EDE5')}">
    ${header('Analyse de marché', d.marche.title || 'Le marché du secteur', true)}
    <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:56px 60px;align-content:center;padding-top:8px">${cards}</div>
    ${d.marche.note ? `<div style="margin-top:14px;font-size:16.5px;line-height:1.5;color:rgba(245,237,229,.66);max-width:1500px">${esc(d.marche.note)}</div>` : ''}
    ${footer(d, n, true)}</section>`;
}

function slValorisation(d, n) {
  if (!d.valorisation || !d.valorisation.prix.length) return '';
  const v = d.valorisation;
  const card = (p) => p.highlight
    ? `<div style="background:#294029;color:#F5EDE5;padding:34px 32px;display:flex;flex-direction:column;position:relative;overflow:hidden">
        <div style="position:absolute;right:-50px;bottom:-60px;width:280px;opacity:.1;pointer-events:none"><img src="${A}/logo-emblem-cream.png" alt="" style="width:100%;display:block"/></div>
        <div style="font-size:15px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#C3CCB8;position:relative">${esc(p.label)}</div>
        <div style="margin-top:16px;font-family:'Cormorant Garamond',serif;font-size:56px;font-weight:600;color:#F5EDE5;line-height:1;position:relative">${p.montant}</div>
        ${p.m2 ? `<div style="margin-top:8px;font-size:17px;color:rgba(245,237,229,.72);position:relative">${esc(p.m2)}</div>` : ''}
        ${p.desc ? `<div style="margin-top:20px;font-size:18px;line-height:1.4;color:rgba(245,237,229,.88);position:relative">${esc(p.desc)}</div>` : ''}</div>`
    : `<div style="border:1px solid rgba(41,64,41,.18);padding:34px 32px;display:flex;flex-direction:column">
        <div style="font-size:15px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#8C9978">${esc(p.label)}</div>
        <div style="margin-top:16px;font-family:'Cormorant Garamond',serif;font-size:56px;font-weight:600;color:#294029;line-height:1">${p.montant}</div>
        ${p.m2 ? `<div style="margin-top:8px;font-size:17px;color:rgba(36,25,18,.6)">${esc(p.m2)}</div>` : ''}
        ${p.desc ? `<div style="margin-top:20px;font-size:18px;line-height:1.4;color:rgba(36,25,18,.82)">${esc(p.desc)}</div>` : ''}</div>`;
  return section('#F5EDE5',
    `${header('Valorisation', v.title || 'Notre préconisation de prix')}
     ${v.intro ? `<div style="margin-top:16px;font-size:17px;line-height:1.4;color:rgba(36,25,18,.7)">${esc(v.intro)}</div>` : ''}
     <div style="flex:1;display:grid;grid-template-columns:repeat(${v.prix.length},1fr);gap:26px;padding-top:26px">${v.prix.map(card).join('')}</div>
     ${v.reco ? `<div style="margin-top:24px;background:#E8DACA;padding:22px 30px;font-size:19px;line-height:1.45;color:#521C14"><strong style="font-weight:600">Recommandation —</strong> ${esc(v.reco)}</div>` : ''}
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
  return section('#F5EDE5',
    `${header('Localisation', L.title || "L'emplacement du bien")}
     <div style="flex:1;display:grid;grid-template-columns:1.35fr 1fr;gap:44px;padding-top:16px;align-items:start">
       <div style="height:720px;border:1px solid rgba(41,64,41,.2);overflow:hidden">${L.mapUrl ? `<img src="${esc(L.mapUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/>` : `<div style="width:100%;height:100%;background:#EDE6DC;display:flex;align-items:center;justify-content:center;color:#8C9978">Carte de situation</div>`}</div>
       <div>${L.commentaire ? `<div style="font-size:20px;line-height:1.55;color:#241912;margin-bottom:24px">${esc(L.commentaire)}</div>` : ''}
         ${grp('Transports', L.transports)}${grp('Commerces & écoles', L.commodites)}${grp('Nature & loisirs', L.loisirs)}</div></div>
     ${footer(d, n)}`);
}

function slCaracteristiques(d, n) {
  if (!d.caracteristiques) return '';
  const C = d.caracteristiques;
  const row = (k, v) => v ? `<div style="display:flex;justify-content:space-between;gap:20px;padding:14px 0;border-bottom:1px solid rgba(41,64,41,.13)">
    <span style="font-size:15px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#8C9978">${esc(k)}</span>
    <span style="font-size:21px;color:#241912;text-align:right">${esc(v)}</span></div>` : '';
  return section('#F5EDE5',
    `${header('Caractéristiques', C.title || 'Le bien en détail')}
     <div style="flex:1;display:grid;grid-template-columns:1fr 1.1fr;gap:50px;padding-top:16px;align-items:start">
       <div style="height:760px;overflow:hidden;border:1px solid rgba(41,64,41,.2)">${C.photo ? `<img src="${esc(C.photo)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/>` : `<div style="width:100%;height:100%;background:#EDE6DC"></div>`}
         ${C.photoLegende ? `<div style="margin-top:-46px;position:relative;padding:14px 18px;background:linear-gradient(to top,rgba(36,25,18,.6),transparent);color:#F5EDE5;font-size:15px">${esc(C.photoLegende)}</div>` : ''}</div>
       <div>${C.rows.map(r => row(r[0], r[1])).join('')}
         ${C.description ? `<div style="margin-top:24px;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:24px;line-height:1.45;color:rgba(36,25,18,.82)">${esc(C.description)}</div>` : ''}</div></div>
     ${footer(d, n)}`);
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

  // Synthèse — cartes depuis le mandat
  const cards = [];
  if (surface) cards.push({ figure: fmtM2(surface), label: 'Surface', desc: '' });
  if (num(m?.dpe_consommation)) cards.push({ figure: `DPE${m?.dpe_classe ? ' ' + m.dpe_classe : ''}`, label: 'Performance', desc: `${fmtNum(m.dpe_consommation)} kWh/m²·an` });
  if (estB2C) { if (num(m?.nb_pieces)) cards.push({ figure: `${fmtNum(m.nb_pieces)} pièces`, label: 'Composition', desc: num(m?.nb_chambres) ? `${fmtNum(m.nb_chambres)} chambre(s)` : '' }); }
  else { if (num(m?.nb_lots)) cards.push({ figure: `${fmtNum(m.nb_lots)} lots`, label: 'Copropriété', desc: num(m?.loyers_annuels) ? `${fmtEUR(m.loyers_annuels)} de revenus/an` : '' }); }
  if (num(m?.prix_m2)) cards.push({ figure: `${fmtNum(m.prix_m2)} €/m²`, label: 'Prix au m²', desc: '' });

  const bas = num(preco.prix_plancher) || num(m2v.valeur_basse?.valeur_totale);
  const haut = num(preco.prix_coup_de_coeur) || num(m2v.valeur_haute?.valeur_totale);
  const central = num(preco.prix_marche) || num(m2v.valeur_centrale?.valeur_totale);
  const mandatNet = num(m?.prix_net_vendeur) || num(m?.prix);
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

  // Valorisation — 3 prix
  const prix = [];
  if (bas) prix.push({ label: 'Prudent', montant: fmtEUR(bas), m2: surface ? `≈ ${fmtNum(Math.round(bas / surface))} €/m²` : '', desc: 'Base de négociation, liquidité rapide.' });
  if (central) prix.push({ label: 'Valeur centrale', montant: fmtEUR(central), m2: surface ? `≈ ${fmtNum(Math.round(central / surface))} €/m²` : '', desc: 'Prix de marché recommandé.', highlight: true });
  if (haut) prix.push({ label: 'Présentation', montant: fmtEUR(haut), m2: surface ? `≈ ${fmtNum(Math.round(haut / surface))} €/m²` : '', desc: "Prix d'affichage, bien d'exception." });

  // Localisation — carte + transports + commodités (assets auto du mandat)
  const td = m?.transports_data || {};
  const qd = m?.quartier_data || {};
  const transports = [];
  const pushMode = (arr, label) => (arr || []).slice(0, 4).forEach(s => {
    const nom = s.name || s.nom || s.station || '';
    const dist = s.distance ? ` — ${Math.round(s.distance)} m` : '';
    const lig = s.lines && s.lines.length ? ` (${[].concat(s.lines).join(', ')})` : '';
    if (nom) transports.push(`${label} ${nom}${lig}${dist}`);
  });
  pushMode(td.metro, 'Métro'); pushMode(td.rer, 'RER'); pushMode(td.tram, 'Tram'); pushMode(td.bus, 'Bus');
  const amen = (arr, k = 3) => (arr || []).slice(0, k).map(a => `${a.name}${a.distance ? ` — ${a.distance} m` : ''}`);
  const commodites = [...amen(qd.ecoles, 3), ...amen(qd.commerces, 2), ...amen(qd.sante, 1)];
  const loisirs = [...amen(qd.parcs, 3), ...amen(qd.culture, 2)];
  const mapUrl = m?.map_static_image_url || m?.satellite_image_url || m?.cadastre_image_url || null;
  const localisation = (mapUrl || transports.length || commodites.length || av.localisation?.commentaire) ? {
    mapUrl, transports,
    commodites: (av.localisation?.commodites || []).concat(commodites),
    loisirs: (av.localisation?.loisirs || []).concat(loisirs),
    commentaire: av.localisation?.commentaire || '',
    title: "L'emplacement du bien",
  } : null;

  // Caractéristiques — détails du mandat
  const cr = [];
  if (surface) cr.push(['Surface', fmtM2(surface)]);
  if (num(m?.nb_pieces)) cr.push(['Pièces', fmtNum(m.nb_pieces)]);
  if (num(m?.nb_chambres)) cr.push(['Chambres', fmtNum(m.nb_chambres)]);
  if (m?.etage != null && m?.etage !== '') cr.push(['Étage', String(m.etage)]);
  if (num(m?.dpe_consommation)) cr.push(['DPE', `${m?.dpe_classe || ''} · ${fmtNum(m.dpe_consommation)} kWh/m²·an`.trim()]);
  if (num(m?.annee_construction)) cr.push(['Année', String(m.annee_construction)]);
  if (num(m?.prix)) cr.push(['Prix FAI', fmtEUR(m.prix)]);
  const streetView = m?.street_view_image_url || null;
  const caracteristiques = cr.length ? { rows: cr, photo: streetView || photos[1] || photos[0] || null, photoLegende: streetView ? "L'immeuble" : '', description: m?.description || '', title: 'Le bien en détail' } : null;

  // Avant-propos
  const avantPropos = `Nous vous remercions de nous avoir consulté dans le cadre de la valorisation de votre bien situé ${lieu}. Vous trouverez dans ce document notre avis de valeur, accompagné de notre recommandation stratégique et marketing pour une mise en vente optimale. Nous restons à votre entière disposition.`;

  // Vigilance — SWOT (facteurs limitatifs + menaces)
  const vig = [];
  (swot.facteurs_limitatifs || []).forEach(t => vig.push({ titre: t, texte: '' }));
  (swot.menaces || []).forEach(t => vig.push({ titre: t, texte: '' }));

  return {
    titre: m?.nom || adresse || 'Bien à évaluer',
    ville, sousTitre: [m?.type, m?.sous_type].filter(Boolean).join(' — ') || (estB2C ? "Bien d'habitation" : 'Immeuble de rapport'),
    eyebrowDate: `Avis de valeur — ${ma}`,
    footerAddr: `${lieu} · ${ma} · Confidentiel`,
    consultant: preco.consultant_nom || 'Immeubles & Patrimoine',
    contactSub: `Avis de valeur · ${lieu}`,
    contactDate: `${ma} · Document confidentiel`,
    coverPhoto: photos[0] || m?.street_view_image_url || null,
    commercialisation: m?.commercialisation,
    avantPropos,
    localisation,
    caracteristiques,
    synthese: cards.length ? { cards, fourchette, title: estB2C ? 'Les chiffres clés du bien' : "Les chiffres clés de l'actif" } : null,
    galerie, galerieTitle: 'Le bien en images',
    marche: marcheCards.length ? { cards: marcheCards, note: esc(comp.commentaire || ''), title: estB2C ? 'Le prix au m² du secteur' : 'Le marché du secteur' } : null,
    valorisation: prix.length ? { prix, intro: '', reco: preco.recommandation || '' } : null,
    vigilance: vig,
    etapes: null,
  };
}

export function buildAvisHtml(m) {
  const d = buildAvisData(m);
  let n = 1; const N = () => String(++n).padStart(2, '0');
  return [
    slCover(d),
    slAvantPropos(d, N()),
    // Agence — pourquoi nous
    slTexteCentre('Qui sommes-nous', "Expert de la vente d'actifs depuis 2010", [AGENCE.intro], N(), d),
    slTexteCentre('Nos valeurs', AGENCE.valeurs.join(', ') + '.', [AGENCE.valeursTexte], N(), d),
    slMethode(d, N()),
    slListe('Commercialisation', 'Nos supports de commercialisation', AGENCE.supports, N(), d, 2),
    slListe('Diffusion', 'Notre réseau et nos moyens', AGENCE.reseau, N(), d, 2),
    // Le bien — présentation & évaluation
    slSynthese(d, N()),
    slLocalisation(d, N()),
    slCaracteristiques(d, N()),
    slGalerie(d, N()),
    slMarche(d, N()),
    slValorisation(d, N()),
    slVigilance(d, N()),
    slEtapes(d, N()),
    slContact(d),
  ].filter(Boolean).join('\n');
}
