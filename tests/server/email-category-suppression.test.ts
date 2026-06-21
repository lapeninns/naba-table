import { beforeEach, describe, expect, it, vi } from 'vitest';

// Verifies the transactional/marketing split end-to-end through sendEmail:
// essential mail is blocked only by HARD suppression; optional mail also honours SOFT
// (one-click) opt-outs.

const getSuppressedRecipientEmailsMock = vi.hoisted(() => vi.fn());
const getEmailSuppressionStatesMock = vi.hoisted(() => vi.fn());

vi.mock('@/config', () => ({
  default: { appName: 'Nab a Table', email: { supportEmail: 'support@nabatable.com' } },
}));
vi.mock('@/lib/env', () => ({
  env: { resend: { apiKey: null, from: 'Nab a Table <hello@nabatable.com>', useMock: true } },
}));
vi.mock('@/server/customers', () => ({
  normalizeEmail: (value: string) => (value ?? '').trim().toLowerCase(),
}));
vi.mock('@/server/emails/recipient-suppression', () => ({
  getSuppressedRecipientEmails: getSuppressedRecipientEmailsMock,
}));
vi.mock('@/server/emails/email-suppression-list', () => ({
  getEmailSuppressionStates: getEmailSuppressionStatesMock,
}));
vi.mock('@/server/emails/list-unsubscribe', () => ({
  buildListUnsubscribeHeaders: () => ({}),
}));
vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: vi.fn(async () => {}),
}));

import { isEmailRecipientSuppressedError, sendEmail, type SendEmailParams } from '@/libs/resend';

const RECIPIENT = 'guest@example.com';

function send(category?: SendEmailParams['category']) {
  return sendEmail({ to: RECIPIENT, subject: 'Hi', html: '<p>Hi</p>', text: 'Hi', category });
}

async function wasSuppressed(promise: Promise<unknown>): Promise<boolean> {
  try {
    await promise;
    return false;
  } catch (error) {
    return isEmailRecipientSuppressedError(error);
  }
}

beforeEach(() => {
  getSuppressedRecipientEmailsMock.mockReset();
  getSuppressedRecipientEmailsMock.mockResolvedValue([]);
  getEmailSuppressionStatesMock.mockReset();
  getEmailSuppressionStatesMock.mockResolvedValue({ hard: [], soft: [] });
});

describe('sendEmail category-aware suppression', () => {
  it('delivers ESSENTIAL mail to a soft (one-click) opt-out', async () => {
    getEmailSuppressionStatesMock.mockResolvedValue({ hard: [], soft: [RECIPIENT] });
    await expect(send('booking_confirmation')).resolves.toMatchObject({ provider: 'mock' });
  });

  it('blocks OPTIONAL mail to a soft (one-click) opt-out', async () => {
    getEmailSuppressionStatesMock.mockResolvedValue({ hard: [], soft: [RECIPIENT] });
    expect(await wasSuppressed(send('review_request'))).toBe(true);
  });

  it('blocks ESSENTIAL mail to a HARD-suppressed (bounce/complaint) address', async () => {
    getEmailSuppressionStatesMock.mockResolvedValue({ hard: [RECIPIENT], soft: [] });
    expect(await wasSuppressed(send('booking_confirmation'))).toBe(true);
  });

  it('blocks ESSENTIAL mail when the profile flag is set (hard)', async () => {
    getSuppressedRecipientEmailsMock.mockResolvedValue([RECIPIENT]);
    expect(await wasSuppressed(send('auth'))).toBe(true);
  });

  it('defaults an untagged send to essential (delivers despite a soft opt-out)', async () => {
    getEmailSuppressionStatesMock.mockResolvedValue({ hard: [], soft: [RECIPIENT] });
    await expect(send()).resolves.toMatchObject({ provider: 'mock' });
  });

  it('delivers optional mail when the recipient has not opted out', async () => {
    await expect(send('marketing')).resolves.toMatchObject({ provider: 'mock' });
  });
});
