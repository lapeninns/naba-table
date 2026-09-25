import { HttpError } from '@/lib/http/errors';

import { getSettingsSaveReasonCode } from './settingsSaveSequence';

// Copy for API codes whose meaning staff can act on. Keyed by code, never by message.
const CODE_COPY: ReadonlyMap<string, string> = new Map([
  ['PASSWORD_CONFIRMATION_REQUIRED', 'Enter your password to confirm this change.'],
  ['PASSWORD_CONFIRMATION_FAILED', 'Your password was not accepted. Check it and try again.'],
  [
    'PASSWORD_CONFIRMATION_RATE_LIMITED',
    'Too many password attempts. Wait a moment and try again.',
  ],
  [
    'GBP_NOTIFICATION_TOPIC_CONFLICT',
    'A different managed topic already exists for this Google account.',
  ],
  ['network_error', 'Could not reach Nabatable. Check your connection and try again.'],
]);

const STATUS_COPY: ReadonlyMap<number, string> = new Map([
  [400, 'Some details were not accepted. Check them and try again.'],
  [401, 'Your session has expired. Sign in again, then retry.'],
  [403, 'You do not have permission to make this change.'],
  [404, 'This item could not be found. Refresh the page and try again.'],
  [409, 'This was changed somewhere else. Refresh the page and try again.'],
  [413, 'The file is too large.'],
  [422, 'Some details were not accepted. Check them and try again.'],
  [429, 'Too many attempts. Wait a moment and try again.'],
]);

/**
 * Fixed, staff-facing copy for a failed settings request, with its safe reason code. Server
 * messages can echo database or provider internals, so they are never shown.
 */
export function getSafeSettingsErrorMessage(error: unknown, fallback: string): string {
  const reasonCode = getSettingsSaveReasonCode(error);
  const statusCopy = error instanceof HttpError ? STATUS_COPY.get(error.status) : undefined;
  const copy = CODE_COPY.get(reasonCode) ?? statusCopy ?? fallback;
  return `${copy} Reason code: ${reasonCode}.`;
}
