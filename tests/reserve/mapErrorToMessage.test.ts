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
      'Your email or phone number matches a previous guest, but not both. Please book with the same email address and phone number you used before, or call the restaurant for help.',
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
