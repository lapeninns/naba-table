import { isGoogleBusinessProfileError } from './errors';

/** A C1 error the GBP connection routes can return: fixed copy and a stable code. */
export type GoogleBusinessProfileRouteError = {
  status: number;
  code: string;
  message: string;
  retryable?: boolean;
};

export type GoogleBusinessProfileRouteAction = 'link' | 'sync' | 'disconnect' | 'read';

const REAUTH_REQUIRED: GoogleBusinessProfileRouteError = {
  status: 409,
  code: 'GBP_REAUTH_REQUIRED',
  message: 'Reconnect Google Business Profile, then try again.',
};

const NOT_CONNECTED: GoogleBusinessProfileRouteError = {
  status: 409,
  code: 'GBP_NOT_CONNECTED',
  message: 'Connect Google Business Profile, then try again.',
};

const PROVIDER_UNAVAILABLE: GoogleBusinessProfileRouteError = {
  status: 503,
  code: 'GBP_PROVIDER_UNAVAILABLE',
  message: 'Google Business Profile is not responding right now. Try again in a few minutes.',
  retryable: true,
};

/**
 * Maps a failure from the GBP service to a safe route error by its `GoogleBusinessProfileError`
 * code and provider kind. The error message is never inspected or returned: it can carry
 * provider or database text. Anything unrecognised returns `null` and becomes a generic 500.
 */
export function classifyGoogleBusinessProfileRouteError(
  error: unknown,
  action: GoogleBusinessProfileRouteAction,
): GoogleBusinessProfileRouteError | null {
  if (!isGoogleBusinessProfileError(error)) {
    return null;
  }

  switch (error.code) {
    case 'GBP_LOCATION_NOT_FOUND':
      return {
        status: 404,
        code: 'GBP_LOCATION_NOT_FOUND',
        message: 'The selected Google Business Profile location is no longer available.',
      };
    case 'GBP_LOCATION_NOT_LINKED':
    case 'GBP_ACCOUNT_NOT_LINKED':
      return {
        status: 409,
        code: 'GBP_LOCATION_NOT_LINKED',
        message:
          action === 'sync'
            ? 'Connect Google and link a Google Business Profile location before syncing business information.'
            : 'Link a Google Business Profile location first.',
      };
    case 'GBP_NOT_CONNECTED':
      return NOT_CONNECTED;
    case 'GBP_REAUTH_REQUIRED':
      return REAUTH_REQUIRED;
    case 'GBP_REVOCATION_PENDING':
      return {
        status: 409,
        code: 'GBP_REVOCATION_PENDING',
        message: 'Google access is being removed. Try again in a moment.',
        retryable: true,
      };
    case 'GBP_NOT_CONFIGURED':
      return {
        status: 503,
        code: 'GBP_NOT_CONFIGURED',
        message: 'Google Business Profile is not available in this environment.',
      };
    default:
      break;
  }

  switch (error.kind) {
    case 'reauth':
    case 'access_lost':
      return REAUTH_REQUIRED;
    case 'not_found':
      return action === 'link'
        ? {
            status: 404,
            code: 'GBP_LOCATION_NOT_FOUND',
            message: 'The selected Google Business Profile location is no longer available.',
          }
        : null;
    case 'quota':
    case 'timeout':
    case 'upstream':
      return PROVIDER_UNAVAILABLE;
    default:
      return null;
  }
}
