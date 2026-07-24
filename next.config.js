/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk', '@sparticuz/chromium-min', 'puppeteer-core'],
  },
};

module.exports = nextConfig;
