import { describe, expect, it } from 'vitest';

import { getInitialDetails } from '../reducer';
import { buildReservationDraft } from '../transformers';

describe('buildReservationDraft', () => {
  it('fails when time is missing', () => {
    const details = getInitialDetails();
    details.time = '';

    const result = buildReservationDraft(details);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Please select a time');
    }
  });

  it('returns normalized draft when details are valid', () => {
    const details = getInitialDetails();
    details.time = '18:00';
    details.party = 2;
    details.bookingType = 'dinner';
    details.name = '  Jane Doe  ';
    details.email = ' jane@example.com ';
    details.phone = ' +441234567890 ';
    details.rememberDetails = true;

    const result = buildReservationDraft(details);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.time).toBe('18:00');
      expect(result.draft.party).toBe(2);
      expect(result.draft.name).toBe('Jane Doe');
      expect(result.draft.email).toBe('jane@example.com');
      expect(result.draft.phone).toBe('+441234567890');
    }
  });
});
