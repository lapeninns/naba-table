import { describe, expect, it } from 'vitest';

import {
  formatMissingProfileSetupFields,
  getMissingProfileSetupFields,
  isProfileSetupComplete,
} from '@/lib/ops/restaurant-setup-rules';

describe('restaurant setup rules', () => {
  it('uses the shared four blocking profile fields', () => {
    const details = {
      name: 'Old Crown Girton',
      slug: '',
      timezone: 'Europe/London',
      contactPhone: null,
    };

    expect(isProfileSetupComplete(details)).toBe(false);
    expect(getMissingProfileSetupFields(details).map((field) => field.key)).toEqual([
      'slug',
      'contactPhone',
    ]);
    expect(formatMissingProfileSetupFields(details)).toBe(
      'Add booking URL and public phone before go-live.',
    );
  });

  it('marks profile setup complete only when all blocking fields are present', () => {
    const details = {
      name: 'Old Crown Girton',
      slug: 'old-crown-girton',
      timezone: 'Europe/London',
      contactPhone: '+441223277217',
    };

    expect(isProfileSetupComplete(details)).toBe(true);
    expect(formatMissingProfileSetupFields(details)).toBe('Core public details are present.');
  });
});
