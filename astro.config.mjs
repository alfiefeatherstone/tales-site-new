// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Load .env into process.env (Node built-in; existing env vars win).
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the real environment.
}

const PLACEHOLDER_SITE = 'https://example.com';
const site = process.env.SITE_URL || PLACEHOLDER_SITE;

if (site === PLACEHOLDER_SITE) {
  console.warn(
    `\n[config] SITE_URL is not set; using the placeholder ${PLACEHOLDER_SITE}.\n` +
      '[config] Canonical URLs, Open Graph URLs and the sitemap will be wrong. Set SITE_URL before deploying.\n',
  );
}

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // Keep HTML-aware whitespace handling (Astro 7 defaults to JSX-style stripping).
  compressHTML: true,
  image: {
    // Allow Astro to optimise the remote cover art hosted by RSS.com.
    domains: ['media.rss.com'],
  },
  integrations: [
    sitemap({
      filter: (page) => !page.endsWith('/404/'),
    }),
  ],
});
