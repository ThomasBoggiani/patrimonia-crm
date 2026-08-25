// ═══════════════════════════════════════════════════════════════════
// lib/avis/renderPlaquettePdf.js
// Rend la PLAQUETTE COMMERCIALE (buildPlaquette.js, même charte « sombre chic »
// que l'avis) en PDF via PDFShift (rendu Chrome). Mêmes contraintes que l'avis :
// diapositives 16:9 exactes (1920×1080), fonds de couleur conservés.
// Nécessite la variable d'environnement PDFSHIFT_API_KEY.
// ═══════════════════════════════════════════════════════════════════

import { buildPlaquetteHtml } from '@/lib/avis/buildPlaquette';

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Albert+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">`;

// Chaque section = une diapositive 16:9 (1920×1080). Réutilise le conteneur
// `.avis-doc` (mêmes règles d'impression que l'avis) pour un rendu identique.
const PRINT_CSS = `html,body{margin:0;padding:0;background:#fff}
.avis-doc{width:1920px}
.avis-doc, .avis-doc *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}
.avis-doc section{width:1920px;height:1080px;position:relative;margin:0;break-after:page;page-break-after:always}
.avis-doc section:last-child{break-after:auto;page-break-after:auto}
@page{size:1920px 1080px;margin:0}`;

// baseUrl = origine du déploiement (pour résoudre /avis-assets/*.png).
export function buildPlaquettePageHtml(mandat, baseUrl) {
  const inner = buildPlaquetteHtml(mandat);
  const base = baseUrl ? `<base href="${baseUrl.replace(/\/$/, '')}/">` : '';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">${base}${FONTS}<style>${PRINT_CSS}</style></head><body><div class="avis-doc">${inner}</div></body></html>`;
}

export async function renderPlaquettePdf(mandat, baseUrl) {
  const apiKey = process.env.PDFSHIFT_API_KEY;
  if (!apiKey) {
    throw new Error("Service PDF non configuré. Ajoute la variable d'environnement PDFSHIFT_API_KEY sur Vercel (clé PDFShift), puis redéploie.");
  }
  const html = buildPlaquettePageHtml(mandat, baseUrl);
  const res = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from('api:' + apiKey).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: html,
      format: '1920x1080',
      use_print: true,
      delay: 1500,
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
