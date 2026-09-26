import { describe, expect, it } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import { DEFAULT_ERROR_COPY } from '@/lib/http/userMessage';
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

describe('mapErrorToMessage never shows raw transport or parser text', () => {
  it('runs the code map before an HttpError message (ops 409 CAPACITY_EXCEEDED)', () => {
    const error = new HttpError({
      message: 'No capacity for 19:00 in zone 3',
      status: 409,
      code: 'CAPACITY_EXCEEDED',
    });
    expect(mapErrorToMessage(error)).toBe(
      'No tables are available at that time. Please choose another slot.',
    );
  });

  it('hides a generic 5xx HttpError message behind the server copy', () => {
    const error = new HttpError({
      message: 'Request failed with status 504',
      status: 504,
      hasServerMessage: false,
    });
    expect(mapErrorToMessage(error, 'Unable to process booking')).toBe(
      DEFAULT_ERROR_COPY.server,
    );
  });

  it('shows network copy for a fetch TypeError', () => {
    expect(mapErrorToMessage(new TypeError('Failed to fetch'))).toBe(DEFAULT_ERROR_COPY.network);
    expect(mapErrorToMessage(new TypeError('Load failed'))).toBe(DEFAULT_ERROR_COPY.network);
  });

  it('uses the fallback for a JSON SyntaxError', () => {
    expect(
      mapErrorToMessage(
        new SyntaxError('Unexpected token \'A\', "An error o"... is not valid JSON'),
        'Unable to process booking',
      ),
    ).toBe('Unable to process booking');
  });

  it('hides the message of a plain 5xx ApiError from the reserve client', () => {
    expect(
      mapErrorToMessage({ code: '504', message: 'Gateway Timeout', status: 504 }, 'Fallback'),
    ).toBe(DEFAULT_ERROR_COPY.server);
  });

  it('does not show the generic "Request failed with status N" text for a 4xx', () => {
    expect(
      mapErrorToMessage(
        { code: '400', message: 'Request failed with status 400', status: 400 },
        'Fallback',
      ),
    ).toBe('Fallback');
  });

  it('keeps a safe 4xx server message', () => {
    expect(
      mapErrorToMessage({ code: 'SOMETHING', message: 'Pick a later date.', status: 400 }),
    ).toBe('Pick a later date.');
  });
});
