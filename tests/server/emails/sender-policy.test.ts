import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadPolicy(platformReplyTo?: string | null) {
  vi.resetModules();
  vi.doMock('@/config', () => ({
    default: {
      appName: 'Nab a Table',
      email: {
        platformReplyTo,
      },
    },
  }));

  return import('@/server/emails/sender-policy');
}

describe('email sender policy', () => {
  afterEach(() => {
    vi.doUnmock('@/config');
    vi.resetModules();
  });

  it('resolves the configured platform reply-to address', async () => {
    const { resolvePlatformReplyTo } = await loadPolicy(' support@nabatable.com ');

    expect(resolvePlatformReplyTo()).toBe('support@nabatable.com');
  });

  it('falls back to the platform default when config is missing or blank', async () => {
    const missingPolicy = await loadPolicy(undefined);
    expect(missingPolicy.resolvePlatformReplyTo()).toBe('info@lapeninns.com');

    const blankPolicy = await loadPolicy('   ');
    expect(blankPolicy.resolvePlatformReplyTo()).toBe('info@lapeninns.com');
  });

  it('routes restaurant replies to venue email with platform fallback', async () => {
    const { resolveRestaurantReplyTo } = await loadPolicy('platform@nabatable.com');

    expect(resolveRestaurantReplyTo(' venue@example.com ')).toBe('venue@example.com');
    expect(resolveRestaurantReplyTo('')).toBe('platform@nabatable.com');
    expect(resolveRestaurantReplyTo('   ')).toBe('platform@nabatable.com');
    expect(resolveRestaurantReplyTo(null)).toBe('platform@nabatable.com');
  });

  it('keeps sender display names deterministic', async () => {
    const {
      resolvePlatformAppSenderName,
      resolvePlatformSupportSenderName,
      resolveRestaurantSenderName,
    } = await loadPolicy('support@nabatable.com');

    expect(resolvePlatformAppSenderName()).toBe('Nab a Table');
    expect(resolvePlatformSupportSenderName()).toBe('Nab a Table Support');
    expect(resolveRestaurantSenderName(' The Venue ')).toBe('The Venue');
    expect(resolveRestaurantSenderName('')).toBe('Restaurant');
  });
});
