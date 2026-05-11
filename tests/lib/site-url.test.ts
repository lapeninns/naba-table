import { afterEach, describe, expect, it } from 'vitest';

import { getTrustedSiteOrigin } from '@/lib/site-url';

const originalEnv = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnv);
}

function clearUrlEnv() {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_URL;
  delete process.env.BASE_URL;
  delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  delete process.env.NEXT_PUBLIC_APP_URL;
}

describe('site URL resolution', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('prefers the explicit public site URL for guest links', () => {
    clearUrlEnv();
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.nabatable.com/';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.nabatable.com';

    expect(getTrustedSiteOrigin()).toBe('https://www.nabatable.com');
  });

  it('keeps guest links off the app host when the public site URL is misconfigured', () => {
    clearUrlEnv();
    process.env.NEXT_PUBLIC_SITE_URL = 'https://app.nabatable.com';

    expect(getTrustedSiteOrigin()).toBe('https://nabatable.com');
  });

  it('derives the root host when only an app host URL is available', () => {
    clearUrlEnv();
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.nabatable.com';

    expect(getTrustedSiteOrigin()).toBe('https://nabatable.com');
  });

  it('derives the root host when BASE_URL was populated from an app host URL', () => {
    clearUrlEnv();
    process.env.BASE_URL = 'https://app.nabatable.com';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.nabatable.com';

    expect(getTrustedSiteOrigin()).toBe('https://nabatable.com');
  });

  it('uses NEXT_PUBLIC_ROOT_DOMAIN before falling back to the canonical config domain', () => {
    clearUrlEnv();
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'staging.nabatable.com';

    expect(getTrustedSiteOrigin()).toBe('https://staging.nabatable.com');
  });
});
