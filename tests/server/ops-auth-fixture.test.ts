import { describe, expect, it } from 'vitest';

import {
  QA_OPS_AUTH_COOKIE_VALUE,
  QA_OPS_RESTAURANT_ID,
  getQaOpsAuthFixture,
  isQaOpsAuthFixtureAllowed,
} from '@/server/auth/qa-ops-session';

const safeEnv = {
  APP_ENV: 'staging',
  NODE_ENV: 'development',
  NEXT_PUBLIC_ROOT_DOMAIN: 'localhost',
  QA_ENABLE_AUTH_FIXTURES: '1',
  QA_TARGET_ENV: 'local',
  QA_USE_MOCKS: '1',
};

describe('QA ops auth fixture', () => {
  it('allows a local app-host request only with the explicit QA auth cookie @security @local-only', () => {
    expect(
      isQaOpsAuthFixtureAllowed({
        cookieValue: QA_OPS_AUTH_COOKIE_VALUE,
        env: safeEnv,
        host: 'app.localhost:5180',
      }),
    ).toBe(true);

    expect(
      isQaOpsAuthFixtureAllowed({
        cookieValue: null,
        env: safeEnv,
        host: 'app.localhost:5180',
      }),
    ).toBe(false);
  });

  it('uses local process env flags when no explicit env override is supplied @contract @local-only', () => {
    const previous = {
      APP_ENV: process.env.APP_ENV,
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
      QA_ENABLE_AUTH_FIXTURES: process.env.QA_ENABLE_AUTH_FIXTURES,
      QA_TARGET_ENV: process.env.QA_TARGET_ENV,
      QA_USE_MOCKS: process.env.QA_USE_MOCKS,
    };

    Object.assign(process.env, safeEnv);
    try {
      expect(
        isQaOpsAuthFixtureAllowed({
          cookieValue: QA_OPS_AUTH_COOKIE_VALUE,
          host: 'app.localhost:5180',
        }),
      ).toBe(true);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (typeof value === 'undefined') {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });

  it('refuses production-like or non-local hosts even when the cookie is present @security @local-only', () => {
    expect(
      isQaOpsAuthFixtureAllowed({
        cookieValue: QA_OPS_AUTH_COOKIE_VALUE,
        env: { ...safeEnv, APP_ENV: 'production' },
        host: 'app.localhost:5180',
      }),
    ).toBe(false);

    expect(
      isQaOpsAuthFixtureAllowed({
        cookieValue: QA_OPS_AUTH_COOKIE_VALUE,
        env: { ...safeEnv, NEXT_PUBLIC_ROOT_DOMAIN: 'nabatable.com' },
        host: 'app.nabatable.com',
      }),
    ).toBe(false);
  });

  it('returns deterministic ops persona and restaurant fixture data @contract @local-only', () => {
    const fixture = getQaOpsAuthFixture({
      cookieValue: QA_OPS_AUTH_COOKIE_VALUE,
      env: safeEnv,
      host: 'app.localhost:5180',
    });

    expect(fixture?.user.email).toBe('qa.ops@example.test');
    expect(fixture?.initialRestaurantId).toBe(QA_OPS_RESTAURANT_ID);
    expect(fixture?.memberships.map((membership) => membership.restaurantId)).toContain(
      QA_OPS_RESTAURANT_ID,
    );
  });
});
