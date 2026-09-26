import { describe, expect, it } from 'vitest';

import {
  changesBookingContactEmail,
  withOwnerBindingRevokedOnEmailChange,
} from '@/server/bookings/owner-binding';

const existing = { customer_email: 'Alex@Example.com', auth_user_id: 'user-1' };

describe('withOwnerBindingRevokedOnEmailChange (guest-auth §12.21)', () => {
  it('clears auth_user_id when a staff write changes the contact email', () => {
    const patch = withOwnerBindingRevokedOnEmailChange(existing, {
      customer_email: 'someone-else@example.com',
      notes: 'moved',
    });

    expect(patch).toEqual({
      customer_email: 'someone-else@example.com',
      notes: 'moved',
      auth_user_id: null,
    });
  });

  it('clears the binding when the email is removed', () => {
    expect(withOwnerBindingRevokedOnEmailChange(existing, { customer_email: '' })).toMatchObject({
      auth_user_id: null,
    });
  });

  it('keeps the binding when the email is unchanged apart from case and whitespace', () => {
    const patch = { customer_email: '  alex@example.COM ', notes: null };
    expect(withOwnerBindingRevokedOnEmailChange(existing, patch)).toBe(patch);
    expect(patch).not.toHaveProperty('auth_user_id');
  });

  it('keeps the binding when the write does not touch the email', () => {
    const patch = { party_size: 4 };
    expect(withOwnerBindingRevokedOnEmailChange(existing, patch)).toBe(patch);
    expect(changesBookingContactEmail(existing, patch)).toBe(false);
  });

  it('overrides an explicit auth_user_id in the same patch when the email changes', () => {
    expect(
      withOwnerBindingRevokedOnEmailChange(existing, {
        customer_email: 'new@example.com',
        auth_user_id: 'user-1',
      }),
    ).toMatchObject({ auth_user_id: null });
  });
});
