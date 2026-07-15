import { describe, expect, it } from 'vitest';

import { buildShortUrl, parseAllowedHosts } from '../src/core';

describe('booking short-link worker contract', () => {
  it('builds purpose-specific opaque URLs', () => {
    expect(buildShortUrl('https://go.nabatable.com/', 'AbCd1234', 'booking_manage')).toBe(
      'https://go.nabatable.com/m/AbCd1234',
    );
    expect(buildShortUrl('https://go.nabatable.com', 'AbCd1234', 'review')).toBe(
      'https://go.nabatable.com/r/AbCd1234',
    );
  });

  it('normalizes an explicit destination allowlist', () => {
    expect(parseAllowedHosts(' Nabatable.com, APP.NABATABLE.COM ')).toEqual([
      'nabatable.com',
      'app.nabatable.com',
    ]);
  });
});
