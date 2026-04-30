import { afterEach, describe, expect, it } from 'vitest';

import { isDualSyncUiEnabled } from '@/lib/feature-flags/dual-sync';

const ENV_KEY = 'NEXT_PUBLIC_NABATABLE_DUAL_SYNC_ENABLED';

describe('isDualSyncUiEnabled', () => {
  const originalValue = process.env[ENV_KEY];

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalValue;
    }
  });

  it('defaults to true when the env var is unset', () => {
    delete process.env[ENV_KEY];
    expect(isDualSyncUiEnabled()).toBe(true);
  });

  it('returns false for canonical falsy values', () => {
    for (const v of ['false', 'FALSE', '0', 'no']) {
      process.env[ENV_KEY] = v;
      expect(isDualSyncUiEnabled()).toBe(false);
    }
  });

  it('returns true for canonical truthy values', () => {
    for (const v of ['true', 'TRUE', '1', 'yes']) {
      process.env[ENV_KEY] = v;
      expect(isDualSyncUiEnabled()).toBe(true);
    }
  });

  it('falls back to true for unknown values', () => {
    process.env[ENV_KEY] = 'maybe';
    expect(isDualSyncUiEnabled()).toBe(true);
  });
});
