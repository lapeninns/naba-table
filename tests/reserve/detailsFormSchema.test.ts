import { describe, expect, it } from 'vitest';

import { createDetailsFormSchema } from '@features/reservations/wizard/model/schemas';

describe('createDetailsFormSchema', () => {
  it('keeps guest terms and contact requirements', () => {
    const result = createDetailsFormSchema('customer').safeParse({
      name: 'Guest Booker',
      email: '',
      phone: '',
      rememberDetails: true,
      marketingOptIn: true,
      agree: false,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected customer validation to fail.');
    }

    const fieldErrors = result.error.flatten().fieldErrors;
    expect(fieldErrors.email?.[0]).toBe('Please enter a valid email address.');
    expect(fieldErrors.phone?.[0]).toBe('Please enter your phone number.');
    expect(fieldErrors.agree?.[0]).toBe('Please accept the terms to continue.');
  });

  it('requires at least one contact method in ops mode without requiring guest terms', () => {
    const result = createDetailsFormSchema('ops').safeParse({
      name: 'Walk In Guest',
      email: '',
      phone: '',
      rememberDetails: false,
      marketingOptIn: false,
      agree: false,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected ops validation to fail.');
    }

    const fieldErrors = result.error.flatten().fieldErrors;
    expect(fieldErrors.email?.[0]).toBe('Add an email address or phone number.');
    expect(fieldErrors.phone?.[0]).toBe('Add an email address or phone number.');
    expect(fieldErrors.agree).toBeUndefined();
  });

  it('accepts ops details with one valid contact method and no terms acceptance', () => {
    const result = createDetailsFormSchema('ops').safeParse({
      name: 'Walk In Guest',
      email: 'guest@example.com',
      phone: '',
      rememberDetails: false,
      marketingOptIn: false,
      agree: false,
    });

    expect(result.success).toBe(true);
  });

  it('keeps WhatsApp transactional consent explicit and unchecked by default', () => {
    const result = createDetailsFormSchema('customer').parse({
      name: 'Guest Booker',
      email: 'guest@example.com',
      phone: '07123 456789',
      rememberDetails: false,
      marketingOptIn: false,
      agree: true,
    });

    expect(result.whatsappOptIn).toBe(false);
  });
});
