/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk', '@sparticuz/chromium', 'puppeteer-core'],
    // Force l'inclusion des binaires + bibliothèques système de Chromium (libnss3…)
    // dans la fonction serverless d'envoi au mandant (sinon « Failed to launch the
    // browser process / libnss3.so not found » sur Vercel).
    outputFileTracingIncludes: {
      '/api/avis-valeur/send-mandant': ['./node_modules/@sparticuz/chromium/**/*'],
    },
  },
};

module.exports = nextConfig;
