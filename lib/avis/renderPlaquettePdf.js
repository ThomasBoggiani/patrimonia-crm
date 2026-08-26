// ═══════════════════════════════════════════════════════════════════
// lib/avis/renderPlaquettePdf.js
// Rend la PLAQUETTE COMMERCIALE (buildPlaquette.js) en PDF via PDFShift.
// Format A4 PORTRAIT (794×1123 px @96dpi), charte « sombre chic » de l'avis.
// Nécessite la variable d'environnement PDFSHIFT_API_KEY.
// ═══════════════════════════════════════════════════════════════════

import { buildPlaquetteHtml } from '@/lib/avis/buildPlaquette';

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Albert+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">`;

// Chaque section = une page A4 (794×1123 px). Fonds de couleur conservés.
const PRINT_CSS = `html,body{margin:0;padding:0;background:#fff}
.plaq-doc{width:794px}
.plaq-doc, .plaq-doc *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}
.plaq-doc section{width:794px;height:1123px;position:relative;margin:0;overflow:hidden;break-after:page;page-break-after:always}
.plaq-doc section:last-child{break-after:auto;page-break-after:auto}
@page{size:A4;margin:0}`;

// baseUrl = origine du déploiement (pour résoudre /avis-assets/*.png).
export function buildPlaquettePageHtml(mandat, baseUrl, opts = {}) {
  const inner = buildPlaquetteHtml(mandat, opts);
  const base = baseUrl ? `<base href="${baseUrl.replace(/\/$/, '')}/">` : '';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">${base}${FONTS}<style>${PRINT_CSS}</style></head><body><div class="plaq-doc">${inner}</div></body></html>`;
}

export async function renderPlaquettePdf(mandat, baseUrl, opts = {}) {
  const apiKey = process.env.PDFSHIFT_API_KEY;
  if (!apiKey) {
    throw new Error("Service PDF non configuré. Ajoute la variable d'environnement PDFSHIFT_API_KEY sur Vercel (clé PDFShift), puis redéploie.");
  }
  const html = buildPlaquettePageHtml(mandat, baseUrl, opts);
  const res = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from('api:' + apiKey).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: html,
      format: 'A4',
      use_print: true,
      // La plaquette charge beaucoup d'images. PDFShift plafonne `timeout` à 30 s
      // (max de l'offre) : c'est le délai de chargement de la page. On l'utilise au
      // max, et surtout on ALLÈGE la charge en amont (galerie plafonnée à 12 photos,
      // 4 photos/étage). delay = courte pause après chargement pour peindre.
      timeout: 30,
      delay: 800,
      sandbox: process.env.PDFSHIFT_SANDBOX === '1' || undefined,
    }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 300); } catch { /* */ }
    throw new Error(`Le service PDF a répondu ${res.status}. ${detail}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
