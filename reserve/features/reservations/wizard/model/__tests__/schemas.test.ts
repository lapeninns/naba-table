import { describe, expect, it } from 'vitest';

import { planFormSchema, detailsFormSchema } from '../schemas';

describe('planFormSchema', () => {
  const base = {
    date: '2025-05-12',
    time: '18:30',
    party: 2,
    bookingType: 'dinner' as const,
    notes: 'Table near the window please.',
  };

  it('accepts a valid payload', () => {
    const result = planFormSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it('rejects missing time selections', () => {
    const result = planFormSchema.safeParse({ ...base, time: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.time).toContain('Please select a time.');
    }
  });

  it('enforces notes character limit', () => {
    const result = planFormSchema.safeParse({
      ...base,
      notes: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.notes).toContain(
        'Notes must be 500 characters or fewer.',
      );
    }
  });
});

describe('detailsFormSchema', () => {
  const base = {
    name: 'Jamie Example',
    email: 'jamie@example.com',
    phone: '07123456789',
    rememberDetails: true,
    marketingOptIn: false,
    agree: true,
  };

  it('accepts a valid payload', () => {
    const result = detailsFormSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it('requires acceptance of terms', () => {
    const result = detailsFormSchema.safeParse({ ...base, agree: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.agree).toContain(
        'Please accept the terms to continue.',
      );
    }
  });
});
