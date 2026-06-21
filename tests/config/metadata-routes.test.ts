import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadMetadataRoutes() {
  vi.resetModules();
  const [{ default: robots }, { default: sitemap }] = await Promise.all([
    import('@/src/app/robots'),
    import('@/src/app/sitemap'),
  ]);
  return { robots, sitemap };
}

function restoreEnv() {
  process.env = { ...ORIGINAL_ENV };
}

describe('metadata routes', () => {
  afterEach(() => {
    restoreEnv();
    vi.resetModules();
  });

  it('falls back to the Nabatable canonical origin for robots and sitemap', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.SITE_URL;

    const { robots, sitemap } = await loadMetadataRoutes();

    expect(robots().sitemap).toBe('https://www.nabatable.com/sitemap.xml');
    expect(sitemap().map((entry) => entry.url)).toContain('https://www.nabatable.com/');
  });
});
