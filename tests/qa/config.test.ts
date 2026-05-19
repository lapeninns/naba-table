import { describe, expect, it } from 'vitest';

import { loadQaPersonaConfig, loadQaTestRestaurantConfig, QaConfigError } from '@/scripts/qa';

describe('QA config loaders', () => {
  it('loads persona config from inline JSON env', () => {
    const config = loadQaPersonaConfig({
      env: {
        QA_PERSONA_CONFIG_JSON: JSON.stringify({
          personas: {
            owner: {
              email: 'owner@example.test',
              password: 'test-password',
              role: 'owner',
            },
          },
        }),
      },
    });

    expect(config.personas.owner).toMatchObject({
      email: 'owner@example.test',
      key: 'owner',
      role: 'owner',
    });
  });

  it('fails when an auth persona has no usable credential', () => {
    expect(() =>
      loadQaPersonaConfig({
        json: {
          personas: {
            guest: {
              email: 'guest@example.test',
              role: 'guest',
            },
          },
        },
      }),
    ).toThrowError(QaConfigError);
  });

  it('fails when persona config is present but empty', () => {
    expect(() =>
      loadQaPersonaConfig({
        json: {
          personas: {},
        },
      }),
    ).toThrow(/personas object must contain at least one entry/);
  });

  it('allows unauthenticated persona metadata only when explicitly requested', () => {
    const config = loadQaPersonaConfig({
      json: {
        personas: {
          guest: {
            email: 'guest@example.test',
            role: 'guest',
          },
        },
      },
      requireAuthCredential: false,
    });

    expect(config.personas.guest.email).toBe('guest@example.test');
  });

  it('loads test restaurant config and requires id by default', () => {
    const config = loadQaTestRestaurantConfig({
      json: {
        restaurants: {
          primary: {
            id: 'restaurant-1',
            slug: 'the-bell',
            timezone: 'Europe/London',
          },
        },
      },
    });

    expect(config.restaurants.primary).toMatchObject({
      id: 'restaurant-1',
      key: 'primary',
      slug: 'the-bell',
      timezone: 'Europe/London',
    });
  });

  it('fails when test restaurant id is missing for data-creating suites', () => {
    expect(() =>
      loadQaTestRestaurantConfig({
        json: {
          restaurants: {
            primary: {
              slug: 'the-bell',
            },
          },
        },
      }),
    ).toThrow(/restaurants.primary.id is required/);
  });

  it('fails when test restaurant config is present but empty', () => {
    expect(() =>
      loadQaTestRestaurantConfig({
        json: {
          restaurants: {},
        },
      }),
    ).toThrow(/restaurants object must contain at least one entry/);
  });
});
