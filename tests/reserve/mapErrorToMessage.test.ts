import { describe, expect, it } from 'vitest';

import { mapErrorToMessage } from '@reserve/shared/error';

describe('mapErrorToMessage', () => {
  it('prefers guest-friendly code mappings over technical server messages', () => {
    expect(
      mapErrorToMessage({
        code: 'DUPLICATE_RESOURCE',
        message: 'duplicate key value violates unique constraint',
      }),
    ).toBe(
      'We already have a booking with those details. Please check your confirmation email or call the restaurant if you need help.',
    );
  });

  it('falls back to explicit messages for unknown codes', () => {
    expect(
      mapErrorToMessage({
        code: 'SOMETHING_ELSE',
        message: 'Custom backend guidance',
      }),
    ).toBe('Custom backend guidance');
  });

  it('returns the default fallback when nothing useful is present', () => {
    expect(mapErrorToMessage({ code: 'NO_MAPPING' }, 'Fallback copy')).toBe('Fallback copy');
  });
});
