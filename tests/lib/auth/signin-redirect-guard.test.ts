import { describe, expect, it } from 'vitest';

import { hasRedirectedFrom } from '@/lib/auth/signin-redirect-guard';

describe('hasRedirectedFrom', () => {
  it('treats a redirectedFrom value as an auth-guard handoff', () => {
    expect(hasRedirectedFrom('/settings/restaurant')).toBe(true);
    expect(hasRedirectedFrom(['/guest/dashboard'])).toBe(true);
  });

  it('ignores missing and blank redirectedFrom values', () => {
    expect(hasRedirectedFrom(undefined)).toBe(false);
    expect(hasRedirectedFrom('')).toBe(false);
    expect(hasRedirectedFrom('   ')).toBe(false);
    expect(hasRedirectedFrom([])).toBe(false);
  });
});
