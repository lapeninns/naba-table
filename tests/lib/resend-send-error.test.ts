import { beforeEach, describe, expect, it, vi } from 'vitest';

// sendEmail must surface provider failures as a typed ResendSendError (name + HTTP status), so
// the queue and the manual resend classify them structurally instead of parsing messages.

const sendMock = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));
vi.mock('@/config', () => ({
  default: { appName: 'Nab a Table', email: { supportEmail: 'support@nabatable.com' } },
}));
vi.mock('@/lib/env', () => ({
  env: { resend: { apiKey: 're_test', from: 'Nab a Table <hello@nabatable.com>', useMock: false } },
}));
vi.mock('@/server/customers', () => ({
  normalizeEmail: (value: string) => (value ?? '').trim().toLowerCase(),
}));
vi.mock('@/server/emails/recipient-suppression', () => ({
  getSuppressedRecipientEmails: vi.fn(async () => []),
}));
vi.mock('@/server/emails/email-suppression-list', () => ({
  getEmailSuppressionStates: vi.fn(async () => ({ hard: [], soft: [] })),
}));
vi.mock('@/server/emails/list-unsubscribe', () => ({
  buildListUnsubscribeHeaders: () => ({}),
}));
vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: vi.fn(async () => {}),
}));

import {
  isDefinitiveResendNotSent,
  isResendRejectedMessageError,
  isResendSendError,
  ResendSendError,
  sendEmail,
} from '@/libs/resend';

function send() {
  return sendEmail({ to: 'guest@example.org', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' });
}

async function sendError(): Promise<unknown> {
  try {
    await send();
  } catch (error) {
    return error;
  }
  throw new Error('expected sendEmail to reject');
}

describe('sendEmail provider errors', () => {
  beforeEach(() => {
    sendMock.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('throws a ResendSendError carrying the provider error name and status', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { name: 'validation_error', message: 'Invalid `to` field.', statusCode: 422 },
    });

    const error = await sendError();

    expect(isResendSendError(error)).toBe(true);
    expect(error).toMatchObject({ providerErrorName: 'validation_error', statusCode: 422 });
    expect((error as Error).message).toBe(
      'Resend API error (validation_error): Invalid `to` field.',
    );
  });

  it('reports a success without an id as an ambiguous missing_id error', async () => {
    sendMock.mockResolvedValue({ data: {}, error: null });

    const error = await sendError();

    expect(error).toMatchObject({ providerErrorName: 'missing_id', statusCode: null });
    expect(isDefinitiveResendNotSent(error)).toBe(false);
  });
});

describe('Resend failure classification', () => {
  const err = (name: string, statusCode: number | null) =>
    new ResendSendError({ name, message: 'x', statusCode });

  it('treats only request rejections as definitively not sent', () => {
    expect(isDefinitiveResendNotSent(err('validation_error', 422))).toBe(true);
    expect(isDefinitiveResendNotSent(err('rate_limit_exceeded', 429))).toBe(true);
    expect(isDefinitiveResendNotSent(err('invalid_from_address', 422))).toBe(true);
    // Network failures/timeouts (SDK application_error) and 5xx may hide an accepted send.
    expect(isDefinitiveResendNotSent(err('application_error', null))).toBe(false);
    expect(isDefinitiveResendNotSent(err('internal_server_error', 500))).toBe(false);
    expect(isDefinitiveResendNotSent(err('concurrent_idempotent_requests', 409))).toBe(false);
    expect(isDefinitiveResendNotSent(new Error('socket hang up'))).toBe(false);
  });

  it('treats 400/422 message rejections as permanent but not a 403 sender-config error', () => {
    expect(isResendRejectedMessageError(err('validation_error', 422))).toBe(true);
    expect(isResendRejectedMessageError(err('invalid_parameter', 400))).toBe(true);
    expect(isResendRejectedMessageError(err('missing_required_field', 422))).toBe(true);
    expect(isResendRejectedMessageError(err('validation_error', 403))).toBe(false);
    expect(isResendRejectedMessageError(err('rate_limit_exceeded', 429))).toBe(false);
    expect(isResendRejectedMessageError(new Error('Resend API error (validation_error): x'))).toBe(
      false,
    );
  });
});
