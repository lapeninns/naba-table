import { describe, expect, it } from 'vitest';

import {
  createDetailsContactSchema,
  createDetailsFormSchema,
} from '@features/reservations/wizard/model/schemas';

describe('createDetailsFormSchema', () => {
  it('accepts valid guest contacts before terms are accepted @contract', () => {
    expect(
      createDetailsContactSchema().safeParse({
        name: 'Guest Booker',
        email: 'guest@example.com',
        phone: '',
      }).success,
    ).toBe(true);
  });

  it('keeps contact requirements in the contact-only schema @contract', () => {
    const result = createDetailsContactSchema().safeParse({
      name: 'G',
      email: '',
      phone: '',
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected contact validation to fail.');
    }

    const fieldErrors = result.error.flatten().fieldErrors;
    expect(fieldErrors.name?.[0]).toBe('Please enter at least two characters.');
    expect(fieldErrors.email?.[0]).toBe('Add an email address or phone number.');
    expect(fieldErrors.phone?.[0]).toBe('Add an email address or phone number.');
  });

  it('keeps guest terms and contact requirements @contract', () => {
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
    expect(fieldErrors.email?.[0]).toBe('Add an email address or phone number.');
    expect(fieldErrors.phone?.[0]).toBe('Add an email address or phone number.');
    expect(fieldErrors.agree?.[0]).toBe('Please accept the terms to continue.');
  });

  it.each([
    { email: 'guest@example.com', phone: '' },
    { email: '', phone: '07123 456789' },
  ])('accepts customer details with one valid contact method @contract', ({ email, phone }) => {
    expect(
      createDetailsFormSchema('customer').safeParse({
        name: 'Guest Booker',
        email,
        phone,
        rememberDetails: false,
        marketingOptIn: false,
        agree: true,
      }).success,
    ).toBe(true);
  });

  it('rejects a malformed populated contact even when the alternative is valid @contract', () => {
    const result = createDetailsFormSchema('customer').safeParse({
      name: 'Guest Booker',
      email: 'guest@example.com',
      phone: '123',
      rememberDetails: false,
      marketingOptIn: false,
      agree: true,
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected phone validation to fail.');
    expect(result.error.flatten().fieldErrors.phone?.[0]).toMatch(/valid UK phone number/);
  });

  it('requires at least one contact method in ops mode without requiring guest terms @contract', () => {
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

  it('accepts ops details with one valid contact method and no terms acceptance @contract', () => {
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

  it('keeps WhatsApp transactional consent explicit and unchecked by default @contract', () => {
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

  it('defaults WhatsApp and marketing opt-in on for staff-created bookings @contract', () => {
    const result = createDetailsFormSchema('ops').parse({
      name: 'Walk In Guest',
      email: 'guest@example.com',
      phone: '07123 456789',
    });

    expect(result.whatsappOptIn).toBe(true);
    expect(result.marketingOptIn).toBe(true);
    expect(result.agree).toBe(true);
  });
});
