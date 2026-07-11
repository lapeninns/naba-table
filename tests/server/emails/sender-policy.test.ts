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

  it('resolves the configured platform reply-to address @contract', async () => {
    const { resolvePlatformReplyTo } = await loadPolicy(' support@nabatable.com ');

    expect(resolvePlatformReplyTo()).toBe('support@nabatable.com');
  });

  it('falls back to the platform default when config is missing or blank @contract', async () => {
    const missingPolicy = await loadPolicy(undefined);
    expect(missingPolicy.resolvePlatformReplyTo()).toBe('info@lapeninns.com');

    const blankPolicy = await loadPolicy('   ');
    expect(blankPolicy.resolvePlatformReplyTo()).toBe('info@lapeninns.com');
  });

  it('routes restaurant replies to venue email with platform fallback @contract', async () => {
    const { resolveRestaurantReplyTo } = await loadPolicy('platform@nabatable.com');

    expect(resolveRestaurantReplyTo(' venue@example.com ')).toBe('venue@example.com');
    expect(resolveRestaurantReplyTo('')).toBe('platform@nabatable.com');
    expect(resolveRestaurantReplyTo('   ')).toBe('platform@nabatable.com');
    expect(resolveRestaurantReplyTo(null)).toBe('platform@nabatable.com');
  });

  it('keeps sender display names deterministic @contract', async () => {
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

  it('builds a personal review-request sender name from the manager + venue with fallback @contract', async () => {
    const { resolveReviewRequestSenderName } = await loadPolicy('support@nabatable.com');

    // Manager + venue both present -> personal "<manager> from <venue>".
    expect(resolveReviewRequestSenderName(' Sam ', ' Old Crown ')).toBe('Sam from Old Crown');
    // No manager set -> fall back to the plain venue sender name.
    expect(resolveReviewRequestSenderName(null, ' Old Crown ')).toBe('Old Crown');
    expect(resolveReviewRequestSenderName('', 'Old Crown')).toBe('Old Crown');
    // Neither manager nor venue -> generic restaurant sender.
    expect(resolveReviewRequestSenderName(null, null)).toBe('Restaurant');
  });
});
