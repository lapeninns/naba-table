import { describe, expect, it } from 'vitest';

import { type EmailCategory, isEssentialCategory } from '@/server/emails/email-categories';

describe('isEssentialCategory', () => {
  it('treats booking, auth, invitation and operational mail as essential', () => {
    const essential: EmailCategory[] = [
      'booking_confirmation',
      'booking_update',
      'booking_reminder',
      'auth',
      'team_invitation',
      'operational',
    ];
    for (const category of essential) {
      expect(isEssentialCategory(category)).toBe(true);
    }
  });

  it('treats review requests and marketing as optional', () => {
    expect(isEssentialCategory('review_request')).toBe(false);
    expect(isEssentialCategory('marketing')).toBe(false);
  });
});
