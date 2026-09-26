import { describe, expect, it } from 'vitest';

import { HttpError, normalizeError } from '@/lib/http/errors';
import {
  DEFAULT_ERROR_COPY,
  getFieldErrors,
  isNetworkError,
  toUserMessage,
} from '@/lib/http/userMessage';

describe('toUserMessage (C2)', () => {
  it('prefers caller copy keyed by code', () => {
    const error = normalizeError({
      status: 409,
      body: { code: 'SLUG_TAKEN', message: 'Slug taken on server' },
    });
    expect(toUserMessage(error, { copy: { SLUG_TAKEN: 'Pick another address.' } })).toBe(
      'Pick another address.',
    );
  });

  it('shows a 4xx server message from a legacy { error } body', () => {
    const error = normalizeError({ status: 409, body: { error: 'Booking no longer available' } });
    expect(toUserMessage(error)).toBe('Booking no longer available');
  });

  it('shows the nested legacy message', () => {
    const error = normalizeError({
      status: 403,
      body: { error: { code: 'FORBIDDEN', message: 'Only owners can do that.' } },
    });
    expect(toUserMessage(error)).toBe('Only owners can do that.');
  });

  it('uses default status copy when the message is generic or statusText', () => {
    expect(toUserMessage(normalizeError({ status: 401 }))).toBe(DEFAULT_ERROR_COPY.unauthenticated);
    expect(toUserMessage(normalizeError({ status: 403, statusText: 'Forbidden' }))).toBe(
      "You don't have permission to do that.",
    );
    expect(toUserMessage(normalizeError({ status: 404 }))).toBe('That item no longer exists.');
    expect(toUserMessage(normalizeError({ status: 409, statusText: 'Conflict' }))).toBe(
      'This changed while you were working. Refresh and try again.',
    );
    expect(toUserMessage(normalizeError({ status: 429 }))).toBe(
      'Too many attempts. Wait a moment and try again.',
    );
    expect(toUserMessage(normalizeError({ status: 401 }))).toBe(
      'Your session has ended. Sign in again.',
    );
  });

  it('treats a directly constructed generic message as not from the server', () => {
    const error = new HttpError({ message: 'Request failed with status 404', status: 404 });
    expect(toUserMessage(error)).toBe('That item no longer exists.');
  });

  it('never shows a 5xx server message', () => {
    for (const status of [500, 502, 503, 504]) {
      const error = normalizeError({
        status,
        body: { message: 'duplicate key value violates unique constraint' },
      });
      expect(toUserMessage(error)).toBe('Something went wrong on our side. Try again.');
    }
  });

  it('still honours caller copy for 5xx codes', () => {
    const error = normalizeError({ status: 503, body: { code: 'PROVIDER_DOWN' } });
    expect(toUserMessage(error, { copy: { PROVIDER_DOWN: 'Google is unavailable.' } })).toBe(
      'Google is unavailable.',
    );
  });

  it('recognises network failures', () => {
    const copy = "Couldn't reach the server. Check your connection and try again.";
    expect(toUserMessage(new TypeError('Failed to fetch'))).toBe(copy);
    expect(toUserMessage(new TypeError('fetch failed'))).toBe(copy);
    expect(toUserMessage(new TypeError('Load failed'))).toBe(copy);
    expect(toUserMessage(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(
      copy,
    );
    expect(isNetworkError(new TypeError('Cannot read properties of undefined'))).toBe(false);
  });

  it('falls back for unknown errors without leaking their messages', () => {
    expect(toUserMessage(new Error('internal detail'))).toBe(DEFAULT_ERROR_COPY.fallback);
    expect(toUserMessage('weird', { fallback: 'Could not save.' })).toBe('Could not save.');
    expect(toUserMessage(normalizeError({ status: 400 }), { fallback: 'Could not save.' })).toBe(
      'Could not save.',
    );
  });
});

describe('getFieldErrors', () => {
  it('returns server fields for form binding', () => {
    const error = normalizeError({
      status: 400,
      body: { code: 'VALIDATION_FAILED', fields: { name: ['Enter a name.'] } },
    });
    expect(getFieldErrors(error)).toEqual({ name: ['Enter a name.'] });
  });

  it('returns undefined when there are no fields or it is not an HttpError', () => {
    expect(getFieldErrors(normalizeError({ status: 400 }))).toBeUndefined();
    expect(getFieldErrors(new Error('x'))).toBeUndefined();
    expect(getFieldErrors(normalizeError({ status: 400, body: { fields: {} } }))).toBeUndefined();
  });
});
