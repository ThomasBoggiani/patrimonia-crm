// ═══════════════════════════════════════════════════════════════════
// lib/pdf/helpers.js — Fonctions utilitaires de formatage pour les PDFs
// 
// FIX v13.1 : Intl.NumberFormat utilise espace insécable U+00A0 que 
// @react-pdf/renderer remplace par "/" → on remplace par espace normal
// ═══════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// FORMATAGE PRIX
// ─────────────────────────────────────────────────────────────────

export function formatPrix(prix, options = {}) {
  if (prix === null || prix === undefined || prix === '') return '—';
  const num = Number(prix);
  if (isNaN(num)) return '—';

  const formatter = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  // Remplacer espace insécable (U+00A0) et fin de ligne narrow (U+202F) par espace normal
  // pour éviter le bug @react-pdf/renderer qui les remplace par "/"
  const formatted = formatter.format(num).replace(/[\u00A0\u202F]/g, ' ');
  return `${formatted} €${options.suffix || ''}`;
}

export function formatPrixM2(prix, surface) {
  if (!prix || !surface) return '—';
  const m2 = Math.round(Number(prix) / Number(surface));
  return `${formatPrix(m2)}/m²`;
}

// ─────────────────────────────────────────────────────────────────
// FORMATAGE SURFACE
// ─────────────────────────────────────────────────────────────────

export function formatSurface(surface) {
  if (surface === null || surface === undefined || surface === '') return '—';
  const num = Number(surface);
  if (isNaN(num)) return '—';
  // Idem : espace insécable → espace normal
  const formatted = new Intl.NumberFormat('fr-FR').format(num).replace(/[\u00A0\u202F]/g, ' ');
  return `${formatted} m²`;
}

// ─────────────────────────────────────────────────────────────────
// FORMATAGE NOMBRE GÉNÉRIQUE (pour cards, stats, etc.)
// ─────────────────────────────────────────────────────────────────

export function formatNombre(num) {
  if (num === null || num === undefined || num === '') return '—';
  const n = Number(num);
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR').format(n).replace(/[\u00A0\u202F]/g, ' ');
}

// ─────────────────────────────────────────────────────────────────
// FORMATAGE RENDEMENT
// ─────────────────────────────────────────────────────────────────

export function formatRendement(rdt) {
  if (rdt === null || rdt === undefined || rdt === '') return '—';
  const num = Number(rdt);
  if (isNaN(num)) return '—';
  // Tolérance : si > 1, on suppose pourcentage déjà exprimé (5.5), sinon décimal (0.055)
  const pct = num > 1 ? num : num * 100;
  return `${pct.toFixed(2).replace('.', ',')} %`;
}

// ─────────────────────────────────────────────────────────────────
// FORMATAGE DATES
// ─────────────────────────────────────────────────────────────────

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatPeriodLabel(start, end) {
  if (!start || !end) return '';
  const dStart = new Date(start);
  const dEnd = new Date(end);
  const opts = { day: '2-digit', month: 'long', year: 'numeric' };
  return `${dStart.toLocaleDateString('fr-FR', opts)} — ${dEnd.toLocaleDateString('fr-FR', opts)}`;
}

// ─────────────────────────────────────────────────────────────────
// CONSTRUCTION DU TITRE COMMERCIAL D'UN MANDAT
// ─────────────────────────────────────────────────────────────────

export function buildTitleCommercial(mandat) {
  const parts = [];
  if (mandat.type) {
    parts.push(`${mandat.type.toUpperCase()} À VENDRE`);
  } else {
    parts.push('BIEN À VENDRE');
  }
  if (mandat.ville) {
    parts.push(mandat.ville.toUpperCase());
  }
  if (mandat.prix) {
    parts.push(formatPrix(mandat.prix));
  }
  return parts.join(' - ');
}

// ─────────────────────────────────────────────────────────────────
// EXTRACTION DES PHOTOS — supporte 3 formats d'entrée :
//   1. Tableau de photos déjà extrait (legacy : [string, ...] ou [{url}, ...])
//   2. Un mandat entier avec `mandat.medias` (nouveau format unifié)
//   3. Un mandat entier avec `mandat.photos` (legacy)
// ─────────────────────────────────────────────────────────────────

export function normalizePhotos(input) {
  if (!input) return [];

  // Cas 1 : on reçoit un tableau (ancienne signature)
  if (Array.isArray(input)) {
    return input
      .map((p) => {
        if (typeof p === 'string') return p;
        if (typeof p === 'object' && p !== null) return p.url || p.src || null;
        return null;
      })
      .filter(Boolean);
  }

  // Cas 2/3 : on reçoit un mandat entier
  if (typeof input === 'object') {
    // Priorité au nouveau format `medias` filtré sur les photos
    if (Array.isArray(input.medias) && input.medias.length > 0) {
      return input.medias
        .filter((m) => m && m.type === 'photo')
        .sort((a, b) => {
          if (a.cover && !b.cover) return -1;
          if (b.cover && !a.cover) return 1;
          return (a.ordre || 0) - (b.ordre || 0);
        })
        .map((m) => m.url)
        .filter(Boolean);
    }
    // Fallback legacy `photos`
    if (Array.isArray(input.photos)) {
      return input.photos
        .map((p) => {
          if (typeof p === 'string') return p;
          if (typeof p === 'object' && p !== null) return p.url || p.src || null;
          return null;
        })
        .filter(Boolean);
    }
  }

  return [];
}

// ─────────────────────────────────────────────────────────────────
// EXTRACTION DES PLANS (uniquement depuis le nouveau format `medias`)
// ─────────────────────────────────────────────────────────────────

export function normalizePlans(mandat) {
  if (!mandat || !Array.isArray(mandat.medias)) return [];
  return mandat.medias
    .filter((m) => m && m.type === 'plan')
    .map((m) => ({ url: m.url, nom: m.nom || '' }))
    .filter((p) => !!p.url);
}

// ─────────────────────────────────────────────────────────────────
// DÉCOUPAGE DE PHOTOS EN GRILLE 2×N PAR PAGE
// ─────────────────────────────────────────────────────────────────

export function chunkPhotos(photos, perPage = 6) {
  const chunks = [];
  for (let i = 0; i < photos.length; i += perPage) {
    chunks.push(photos.slice(i, i + perPage));
  }
  return chunks;
}

// ─────────────────────────────────────────────────────────────────
// NETTOYAGE TEXTE
// ─────────────────────────────────────────────────────────────────

export function safeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return String(value);
  return value;
}

// ─────────────────────────────────────────────────────────────────
// VÉRIFICATION URL ABSOLUE
// ─────────────────────────────────────────────────────────────────

export function ensureAbsoluteUrl(url, baseUrl = 'https://patrimonia-crm.vercel.app') {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${baseUrl}${url}`;
  return `${baseUrl}/${url}`;
}
