import { describe, expect, it } from 'vitest';

import { getSafeSettingsErrorMessage } from '@/components/features/restaurant-settings/shared/settingsErrorCopy';
import { HttpError } from '@/lib/http/errors';

const SENTINEL = 'SECRET_DB_DETAIL relation "x" does not exist';

describe('getSafeSettingsErrorMessage', () => {
  it('@contract never returns the raw message of a server error', () => {
    const message = getSafeSettingsErrorMessage(
      new HttpError({ status: 500, message: SENTINEL }),
      'Unable to save template.',
    );

    expect(message).not.toContain('SECRET_DB_DETAIL');
    expect(message).toBe('Unable to save template. Reason code: HTTP_500.');
  });

  it('@contract never returns the raw message of a plain Error', () => {
    const message = getSafeSettingsErrorMessage(new Error(SENTINEL), 'Unable to save.');

    expect(message).toBe('Unable to save. Reason code: unknown_error.');
  });

  it.each([
    [401, 'Your session has expired. Sign in again, then retry.'],
    [403, 'You do not have permission to make this change.'],
    [404, 'This item could not be found. Refresh the page and try again.'],
    [409, 'This was changed somewhere else. Refresh the page and try again.'],
    [413, 'The file is too large.'],
    [422, 'Some details were not accepted. Check them and try again.'],
    [429, 'Too many attempts. Wait a moment and try again.'],
  ])('@contract maps HTTP %i to fixed copy', (status, copy) => {
    expect(
      getSafeSettingsErrorMessage(new HttpError({ status, message: SENTINEL }), 'Fallback.'),
    ).toBe(`${copy} Reason code: HTTP_${status}.`);
  });

  it('@contract prefers known codes and keeps only a safe reason code', () => {
    expect(
      getSafeSettingsErrorMessage(
        new HttpError({ status: 403, code: 'PASSWORD_CONFIRMATION_FAILED', message: SENTINEL }),
        'Fallback.',
      ),
    ).toBe(
      'Your password was not accepted. Check it and try again. Reason code: PASSWORD_CONFIRMATION_FAILED.',
    );
    expect(
      getSafeSettingsErrorMessage(
        new HttpError({ status: 500, code: SENTINEL, message: SENTINEL }),
        'Fallback.',
      ),
    ).toBe('Fallback. Reason code: HTTP_500.');
  });

  it('@contract maps network failures to connection copy', () => {
    expect(getSafeSettingsErrorMessage(new TypeError('Failed to fetch'), 'Fallback.')).toBe(
      'Could not reach Nabatable. Check your connection and try again. Reason code: network_error.',
    );
  });
});
