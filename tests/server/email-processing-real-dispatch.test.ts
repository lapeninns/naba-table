import { beforeEach, describe, expect, it, vi } from 'vitest';

// Runs processEmailJob through the REAL booking email dispatch (server/emails/bookings.ts); only
// the provider call (libs/resend sendEmail), the database and the delivery log are mocked. This
// proves that a suppressed recipient or an ambiguous skip is not reported to the queue as "sent".

const sendEmailMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const recordEmailDeliveryLogMock = vi.hoisted(() => vi.fn());
const hasRecentEmailDeliveryMock = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('@/config', () => ({
  default: {
    appName: 'Nab a Table',
    auth: { loginUrl: '/auth' },
    email: { supportEmail: 'support@nabatable.com', platformReplyTo: 'platform@nabatable.com' },
  },
}));
vi.mock('@/lib/env', () => ({
  env: {
    raw: { NEXT_PUBLIC_SITE_URL: 'https://www.nabatable.com' },
    app: { url: 'https://app.nabatable.com' },
    resend: { apiKey: null, from: 'Nab a Table <hello@nabatable.com>', useMock: true },
    security: {
      sessionRecoveryAccessTokenSecret: null,
      sessionRecoveryAccessTokenTtlSeconds: 900,
    },
  },
}));
vi.mock('@/libs/resend', async () => {
  const actual = await vi.importActual<typeof ResendModule>('@/libs/resend');
  return { ...actual, sendEmail: sendEmailMock };
});
vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));
vi.mock('@/server/emails/email-delivery-log', async () => {
  const actual = await vi.importActual<typeof DeliveryLogModule>(
    '@/server/emails/email-delivery-log',
  );
  return {
    EmailDeliveryRetryError: actual.EmailDeliveryRetryError,
    hasRecentEmailDelivery: hasRecentEmailDeliveryMock,
    recordEmailDeliveryLog: recordEmailDeliveryLogMock,
  };
});
vi.mock('@/server/reviews/journeys', () => ({
  canSendReviewRequest: vi.fn(async () => true),
  recordReviewRequestEvent: vi.fn(),
}));

import { EmailRecipientSuppressedError, ResendSendError } from '@/libs/resend';
import { processEmailJob } from '@/server/queue/email-processing';

import type * as ResendModule from '@/libs/resend';
import type * as DeliveryLogModule from '@/server/emails/email-delivery-log';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

const booking = {
  id: 'booking-1',
  restaurant_id: RESTAURANT_ID,
  customer_name: 'Guest One',
  customer_email: 'guest@example.com',
  customer_phone: '+447700900123',
  party_size: 2,
  booking_date: '2099-06-01',
  start_time: '18:00:00',
  end_time: '20:00:00',
  start_at: '2099-06-01T17:00:00.000Z',
  end_at: '2099-06-01T19:00:00.000Z',
  status: 'confirmed',
  reference: 'ABC123',
  booking_type: 'standard',
  seating_preference: 'any',
  notes: null,
  updated_at: '2026-05-11T12:00:00.000Z',
};

const restaurant = {
  id: RESTAURANT_ID,
  slug: 'the-venue',
  name: 'The Venue',
  timezone: 'Europe/London',
  address: '1 High Street',
  contact_phone: '+441234567890',
  contact_email: 'venue@restaurant.test',
  booking_policy: '',
  logo_url: null,
  google_map_url: null,
  google_review_url: null,
  email_templates: null,
};

function mockDatabase() {
  getServiceSupabaseClientMock.mockReturnValue({
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: table === 'bookings' ? booking : table === 'restaurants' ? restaurant : null,
            error: null,
          })),
        })),
      })),
    })),
  });
}

function job(type: 'confirmation' | 'reminder_24h') {
  return { id: 'job-1', payload: { bookingId: 'booking-1', restaurantId: RESTAURANT_ID, type } };
}

describe('queued booking emails through the real dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockDatabase();
    hasRecentEmailDeliveryMock.mockResolvedValue(false);
    recordEmailDeliveryLogMock.mockResolvedValue({ id: 'log-1' });
    sendEmailMock.mockResolvedValue({ provider: 'resend', messageId: 'msg-1' });
  });

  it('reports a sent email as sent', async () => {
    await expect(processEmailJob(job('confirmation'))).resolves.toEqual({
      jobId: 'job-1',
      success: true,
    });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('fails a suppressed recipient terminally instead of marking it sent', async () => {
    sendEmailMock.mockRejectedValue(new EmailRecipientSuppressedError(['guest@example.com']));

    await expect(processEmailJob(job('confirmation'))).resolves.toEqual({
      jobId: 'job-1',
      success: false,
      terminal: true,
      error: 'RECIPIENT_SUPPRESSED',
    });
  });

  it('skips (not sends) a reminder that already went out recently', async () => {
    hasRecentEmailDeliveryMock.mockResolvedValue(true);

    await expect(processEmailJob(job('reminder_24h'))).resolves.toEqual({
      jobId: 'job-1',
      success: true,
      skipped: true,
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('fails a provider-rejected recipient (422) terminally', async () => {
    sendEmailMock.mockRejectedValue(
      new ResendSendError({ name: 'validation_error', message: 'Invalid `to`.', statusCode: 422 }),
    );

    await expect(processEmailJob(job('confirmation'))).resolves.toEqual({
      jobId: 'job-1',
      success: false,
      terminal: true,
      error: 'INVALID_RECIPIENT',
    });
  });

  it('keeps a 403 sender-configuration validation_error retryable', async () => {
    sendEmailMock.mockRejectedValue(
      new ResendSendError({
        name: 'validation_error',
        message: 'The domain is not verified.',
        statusCode: 403,
      }),
    );

    await expect(processEmailJob(job('confirmation'))).resolves.toEqual({
      jobId: 'job-1',
      success: false,
      error: 'PROVIDER_CONFIG_ERROR',
    });
  });
});
