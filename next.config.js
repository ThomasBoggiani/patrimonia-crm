/** @type {import('next').NextConfig} */

// Hôte Supabase (storage des photos/plans) — autorisé pour l'optimiseur d'images
// Vercel (/_next/image), utilisé par la plaquette pour servir des photos
// redimensionnées/recompressées (sinon un PDF de plusieurs dizaines de Mo).
let supabaseHost;
try {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
  }
} catch { /* ignore */ }

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
  },
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: 'https', hostname: supabaseHost }]
      : [],
  },
};

module.exports = nextConfig;
