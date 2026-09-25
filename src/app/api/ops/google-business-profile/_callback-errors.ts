export const GBP_CALLBACK_FAILURE_MESSAGE = 'Google Business Profile authorization failed.';

// Fixed messages thrown by the OAuth completion flow. They act as reason codes in the callback
// redirect; any other exception text (provider or database detail) is replaced by the fallback.
const KNOWN_CALLBACK_FAILURE_MESSAGES: ReadonlySet<string> = new Set([
  'Google authorization state was not found.',
  'Google authorization state has already been used.',
  'Google authorization state has expired.',
  'Google authorization state did not match this session. Start the connection again from Nabatable.',
  'Google authorization state did not match this restaurant.',
  'Google authorization has expired or been revoked. Please reconnect Google Business Profile.',
  'Google did not provide a refresh token. Please try reconnecting and grant offline access.',
]);

export function getSafeGbpCallbackFailureMessage(error: unknown): string {
  return error instanceof Error && KNOWN_CALLBACK_FAILURE_MESSAGES.has(error.message)
    ? error.message
    : GBP_CALLBACK_FAILURE_MESSAGE;
}
