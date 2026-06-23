import { describe, expect, it } from 'vitest';

import {
  buildLocalRoutingEnvWarning,
  type LocalRoutingEnvCheckInput,
} from '@/scripts/local-routing-env-check';

/** A local-dev env whose ROOT_DOMAIN mismatches localhost URLs (the broken state). */
function mismatchedInput(
  overrides: Partial<LocalRoutingEnvCheckInput> = {},
): LocalRoutingEnvCheckInput {
  return {
    nodeEnv: 'development',
    vercelEnv: undefined,
    rootDomain: 'nabatable.com',
    urls: {
      BASE_URL: 'http://localhost:3000',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    },
    ...overrides,
  };
}

describe('buildLocalRoutingEnvWarning', () => {
  it('warns when ROOT_DOMAIN is a real domain but URLs point at localhost', () => {
    const warning = buildLocalRoutingEnvWarning(mismatchedInput());

    expect(warning).not.toBeNull();
    expect(warning).toContain('NEXT_PUBLIC_ROOT_DOMAIN is "nabatable.com"');
    expect(warning).toContain('app.localhost');
    expect(warning).toContain('app.nabatable.com');
    expect(warning).toContain('NEXT_PUBLIC_ROOT_DOMAIN=localhost');
    expect(warning).toContain('docs/dev-routing.md');
  });

  it('lists every localhost URL key, sorted, with plural grammar', () => {
    const warning = buildLocalRoutingEnvWarning(mismatchedInput());

    expect(warning).toContain(
      'BASE_URL, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SITE_URL point to localhost',
    );
  });

  it('uses singular grammar and names only the offending URL', () => {
    const warning = buildLocalRoutingEnvWarning(
      mismatchedInput({
        urls: {
          BASE_URL: 'http://localhost:3000',
          NEXT_PUBLIC_APP_URL: 'https://app.nabatable.com',
          NEXT_PUBLIC_SITE_URL: 'https://nabatable.com',
        },
      }),
    );

    expect(warning).toContain('BASE_URL points to localhost');
    expect(warning).not.toContain('NEXT_PUBLIC_APP_URL');
  });

  it('treats 127.0.0.1 and *.localhost as loopback', () => {
    expect(
      buildLocalRoutingEnvWarning(
        mismatchedInput({
          urls: { BASE_URL: 'http://127.0.0.1:3000' },
        }),
      ),
    ).toContain('BASE_URL points to localhost');

    expect(
      buildLocalRoutingEnvWarning(
        mismatchedInput({
          urls: { NEXT_PUBLIC_APP_URL: 'http://app.localhost:3000' },
        }),
      ),
    ).toContain('NEXT_PUBLIC_APP_URL points to localhost');
  });

  it('does not warn when ROOT_DOMAIN is localhost', () => {
    expect(buildLocalRoutingEnvWarning(mismatchedInput({ rootDomain: 'localhost' }))).toBeNull();
  });

  it('does not warn when ROOT_DOMAIN is unset (proxy defaults to localhost)', () => {
    expect(buildLocalRoutingEnvWarning(mismatchedInput({ rootDomain: undefined }))).toBeNull();
    expect(buildLocalRoutingEnvWarning(mismatchedInput({ rootDomain: '  ' }))).toBeNull();
  });

  it('does not warn when URLs already match the real domain', () => {
    expect(
      buildLocalRoutingEnvWarning(
        mismatchedInput({
          urls: {
            BASE_URL: 'https://nabatable.com',
            NEXT_PUBLIC_APP_URL: 'https://app.nabatable.com',
            NEXT_PUBLIC_SITE_URL: 'https://nabatable.com',
          },
        }),
      ),
    ).toBeNull();
  });

  it('does not warn on Vercel builds (VERCEL_ENV set)', () => {
    expect(buildLocalRoutingEnvWarning(mismatchedInput({ vercelEnv: 'preview' }))).toBeNull();
    expect(buildLocalRoutingEnvWarning(mismatchedInput({ vercelEnv: 'production' }))).toBeNull();
  });

  it('does not warn outside local development (NODE_ENV=production|test)', () => {
    expect(buildLocalRoutingEnvWarning(mismatchedInput({ nodeEnv: 'production' }))).toBeNull();
    expect(buildLocalRoutingEnvWarning(mismatchedInput({ nodeEnv: 'test' }))).toBeNull();
  });

  it('defaults missing NODE_ENV to development and still warns', () => {
    expect(buildLocalRoutingEnvWarning(mismatchedInput({ nodeEnv: undefined }))).not.toBeNull();
  });

  it('ignores empty or unparseable URL values', () => {
    expect(
      buildLocalRoutingEnvWarning(
        mismatchedInput({
          urls: { BASE_URL: '', NEXT_PUBLIC_APP_URL: 'not-a-url', NEXT_PUBLIC_SITE_URL: undefined },
        }),
      ),
    ).toBeNull();
  });

  it('returns null when no URLs are provided', () => {
    expect(buildLocalRoutingEnvWarning(mismatchedInput({ urls: {} }))).toBeNull();
    expect(buildLocalRoutingEnvWarning(mismatchedInput({ urls: undefined }))).toBeNull();
  });
});
