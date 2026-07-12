import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const ORIGINAL_ENV = { ...process.env };

function loadConfig<T>(path: string): T {
  const resolved = require.resolve(path);
  delete require.cache[resolved];
  return require(path) as T;
}

describe('public link configuration', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('uses Nabatable canonical sitemap hosts and prefers NEXT_PUBLIC_SITE_URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.nabatable.com';
    process.env.SITE_URL = 'https://legacy.example.com';

    const sitemapConfig = loadConfig<{ siteUrl: string }>('../../next-sitemap.config.js');

    expect(sitemapConfig.siteUrl).toBe('https://www.nabatable.com');
  });

  it('does not fall back to the starter sitemap domain', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.SITE_URL;

    const sitemapConfig = loadConfig<{ siteUrl: string }>('../../next-sitemap.config.js');

    expect(sitemapConfig.siteUrl).toBe('https://www.nabatable.com');
  });

  it('keeps legacy thank-you redirects on a real route and does not rewrite invite pages away', async () => {
    const nextConfig = loadConfig<{
      redirects: () => Promise<
        Array<{
          source: string;
          destination: string;
          has?: Array<{ type: string; key: string; value?: string }>;
        }>
      >;
    }>('../../next.config.js');

    const redirects = await nextConfig.redirects();
    const thankYouRedirect = redirects.find((redirect) => redirect.source === '/thank-you');

    expect(thankYouRedirect).toMatchObject({
      destination: '/bookings/:bookingId/thank-you',
      has: [{ type: 'query', key: 'bookingId', value: '(?<bookingId>[^/]+)' }],
    });
    expect(redirects.find((redirect) => redirect.source === '/invite/:token')).toBeUndefined();
  });

  it('keeps review destinations purpose-scoped and disables token-bearing invocation logs', () => {
    const config = readFileSync('cloudflare/booking-short-links/wrangler.jsonc', 'utf8');

    expect(config).toContain('"ALLOWED_REVIEW_DESTINATION_HOSTS"');
    expect(config).toContain('"invocation_logs": false');
  });
});
