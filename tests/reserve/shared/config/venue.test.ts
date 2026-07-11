import { describe, expect, it } from 'vitest';

import { DEFAULT_VENUE, resolveVenueDetails } from '@shared/config/venue';

describe('DEFAULT_VENUE', () => {
  it('ships a cancellation policy fallback without env configuration @contract', () => {
    expect(DEFAULT_VENUE.policy).toContain('cancel or amend up to 24 hours');
    expect(DEFAULT_VENUE.id).toBe('');
    expect(DEFAULT_VENUE.slug).toBe('');
    expect(DEFAULT_VENUE.logoUrl).toBeNull();
    expect(DEFAULT_VENUE.googleMapUrl).toBeNull();
  });
});

describe('resolveVenueDetails', () => {
  it('returns the defaults when called without overrides @contract', () => {
    expect(resolveVenueDetails()).toEqual({ ...DEFAULT_VENUE, slug: '' });
  });

  it('merges overrides on top of the defaults @contract', () => {
    const resolved = resolveVenueDetails({
      name: 'The Old Crown',
      timezone: 'Europe/London',
      slug: 'the-old-crown',
    });

    expect(resolved.name).toBe('The Old Crown');
    expect(resolved.timezone).toBe('Europe/London');
    expect(resolved.slug).toBe('the-old-crown');
    expect(resolved.policy).toBe(DEFAULT_VENUE.policy);
  });

  it('resets the slug to empty when overrides omit it @contract', () => {
    // slug is identity-bearing; a partial override must not inherit a stale slug.
    const resolved = resolveVenueDetails({ name: 'Somewhere' });
    expect(resolved.slug).toBe('');
  });
});
