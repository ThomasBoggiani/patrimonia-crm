// ═══════════════════════════════════════════════════════════════════
// lib/avis/renderAvisPdf.js
// Rend l'avis de valeur (design « sombre chic » de buildAvis.js) en PDF,
// côté serveur, via Chromium headless (@sparticuz/chromium + puppeteer-core).
// Sert à joindre le VRAI design au mail « Envoyer au mandant ».
// ═══════════════════════════════════════════════════════════════════

import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';
import { buildAvisHtml } from '@/lib/avis/buildAvis';

// Pack Chromium complet (binaire + bibliothèques système : libnss3, etc.) —
// téléchargé au runtime, ce qui évite les soucis d'inclusion sur Vercel.
// La version DOIT correspondre à @sparticuz/chromium-min (131.0.1).
const CHROMIUM_PACK = process.env.CHROMIUM_PACK_URL
  || 'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Albert+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">`;

// Même mise en page que la page /avis/[id] à l'impression : chaque section = une
// diapositive 16:9 (1920×1080), fonds de couleur conservés.
const PRINT_CSS = `html,body{margin:0;padding:0;background:#fff}
.avis-doc{width:1920px}
.avis-doc, .avis-doc *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}
.avis-doc section{width:1920px;height:1080px;position:relative;margin:0;break-after:page;page-break-after:always}
.avis-doc section:last-child{break-after:auto;page-break-after:auto}
@page{size:1920px 1080px;margin:0}`;

// baseUrl = origine du déploiement (pour résoudre /avis-assets/*.png).
export function buildAvisPageHtml(mandat, baseUrl) {
  const inner = buildAvisHtml(mandat);
  const base = baseUrl ? `<base href="${baseUrl.replace(/\/$/, '')}/">` : '';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">${base}${FONTS}<style>${PRINT_CSS}</style></head><body><div class="avis-doc">${inner}</div></body></html>`;
}

export async function renderAvisPdf(mandat, baseUrl) {
  const html = buildAvisPageHtml(mandat, baseUrl);
  // Pas de WebGL nécessaire pour un PDF : réduit les bibliothèques requises.
  if (typeof chromium.setGraphicsMode === 'boolean' || 'setGraphicsMode' in chromium) {
    try { chromium.setGraphicsMode = false; } catch { /* selon version */ }
  }
  const browser = await puppeteer.launch({
    args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 },
    executablePath: await chromium.executablePath(CHROMIUM_PACK),
    headless: chromium.headless,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 45000 });
    // Laisse le temps aux polices web de se charger (sinon rendu en fallback).
    try { await page.evaluate(() => document.fonts.ready); } catch { /* pas bloquant */ }
    const pdf = await page.pdf({
      width: '1920px',
      height: '1080px',
      printBackground: true,
    });
    return pdf;
  } finally {
    await browser.close();
  }
}
