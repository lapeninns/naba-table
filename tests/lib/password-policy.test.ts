import { describe, expect, it } from 'vitest';

import { validatePasswordForSignIn, validatePasswordStrength } from '@/lib/security/passwordPolicy';

describe('password policy helpers', () => {
  it('keeps creation-time password strength checks strict', () => {
    expect(validatePasswordStrength('short')).toMatchObject({
      success: false,
      error: 'Use at least 12 characters',
    });
  });

  it('allows sign-in passwords to pass through unchanged when non-empty', () => {
    expect(validatePasswordForSignIn(' legacy password ')).toEqual({
      success: true,
      value: ' legacy password ',
    });
  });

  it('rejects only missing sign-in passwords client-side', () => {
    expect(validatePasswordForSignIn('')).toEqual({
      success: false,
      error: 'Enter your password',
    });
  });
});
