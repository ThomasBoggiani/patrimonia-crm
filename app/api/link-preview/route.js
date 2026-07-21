// ═══════════════════════════════════════════════════════════════════
// app/api/link-preview/route.js
// Aperçu d'une annonce à partir de son lien : récupère la photo principale
// (og:image), le titre, et tente d'extraire prix + surface depuis le HTML.
// Best-effort : certains portails (SPA / anti-bot) ne renvoient pas tout.
// ═══════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 20;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  return error ? null : user;
}

function meta(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
  return (html.match(re) || html.match(re2) || [])[1] || '';
}
const num = (s) => { const n = parseInt(String(s).replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? n : 0; };

export async function POST(request) {
  try {
    const { token, url } = await request.json();
    const user = await verifyToken(token);
    if (!user) return Response.json({ ok: false, error: 'Authentification requise' }, { status: 401 });
    if (!url || !/^https?:\/\//i.test(url)) return Response.json({ ok: false, error: 'Lien invalide' }, { status: 400 });

    let html = '';
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'fr-FR,fr;q=0.9',
        },
        redirect: 'follow',
      });
      html = await r.text();
    } catch (e) {
      return Response.json({ ok: false, error: "Impossible d'ouvrir le lien (site protégé ?)." }, { status: 502 });
    }

    const image = meta(html, 'og:image') || meta(html, 'twitter:image');
    const title = meta(html, 'og:title') || (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || '';
    const description = meta(html, 'og:description') || '';
    const hay = `${title} ${description}`;

    // Prix : cherche un montant en € plausible (>= 50 000)
    let prix = 0;
    const prixMatches = [...`${hay} ${html.slice(0, 60000)}`.matchAll(/(\d[\d  .]{4,})\s*€/g)];
    for (const m of prixMatches) { const v = num(m[1]); if (v >= 50000 && v <= 100000000) { prix = v; break; } }
    // Surface : "XX m²" / "XX m2"
    const surfMatch = hay.match(/(\d{1,4})\s?m(?:²|2)/i) || html.slice(0, 60000).match(/(\d{1,4})\s?m(?:²|2)\b/i);
    const surface = surfMatch ? num(surfMatch[1]) : 0;

    return Response.json({
      ok: true,
      image: image || '',
      title: (title || '').trim().slice(0, 120),
      prix, surface,
      source: (() => { try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; } })(),
    });
  } catch (e) {
    console.error('[link-preview]', e);
    return Response.json({ ok: false, error: e.message || 'Erreur serveur' }, { status: 500 });
  }
}
