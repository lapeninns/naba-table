import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordBookingCreatedEventMock = vi.hoisted(() => vi.fn());
const sendFirstBookingConfirmationNotificationsMock = vi.hoisted(() => vi.fn());
const enqueueEmailJobMock = vi.hoisted(() => vi.fn());
const emailQueueEnabled = vi.hoisted(() => ({ value: true }));
const loggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/analytics', () => ({
  recordBookingCancelledEvent: vi.fn(),
  recordBookingCreatedEvent: recordBookingCreatedEventMock,
}));
vi.mock('@/server/bookings/confirmation-notifications', () => ({
  sendFirstBookingConfirmationNotifications: sendFirstBookingConfirmationNotificationsMock,
}));
vi.mock('@/server/emails/bookings', () => ({
  sendBookingCancellationEmail: vi.fn(),
  sendBookingConfirmationEmail: vi.fn(),
  sendBookingReminderEmail: vi.fn(),
  sendBookingReviewRequestEmail: vi.fn(),
  sendBookingUpdateEmail: vi.fn(),
  sendRestaurantCancellationEmail: vi.fn(),
}));
vi.mock('@/server/sms/bookings', () => ({
  sendGuestBookingCancellationSms: vi.fn(),
  sendGuestBookingUpdateSms: vi.fn(),
}));
vi.mock('@/server/runtime-policy', () => ({
  isEmailQueueEnabled: vi.fn(() => emailQueueEnabled.value),
}));
vi.mock('@/server/queue/email', () => ({ enqueueEmailJob: enqueueEmailJobMock }));
vi.mock('@/server/queue/email-intents', () => ({ cancelEmailIntents: vi.fn() }));
vi.mock('@/server/observability', () => ({ recordObservabilityEvent: vi.fn() }));
vi.mock('@/server/reviews/journeys', () => ({ createReviewJourney: vi.fn() }));
vi.mock('@/server/supabase', () => ({ getServiceSupabaseClient: getServiceSupabaseClientMock }));
vi.mock('@/lib/logger', () => ({ logger: loggerMock }));

import {
  enqueueBookingCreatedSideEffects,
  enqueueBookingUpdatedSideEffects,
} from '@/server/jobs/booking-side-effects';

type Intent = {
  id: string;
  dedupe_key: string;
  booking_id: string;
  restaurant_id: string;
  email_type: string;
  status: string;
  attempts_made: number;
  max_attempts: number;
  claim_generation: number;
  scheduled_for: string;
};

/**
 * In-memory stand-in for the ensure/claim/settle RPCs with the same semantics as
 * the SQL (insert-if-absent by dedupe key; conditional claim; guarded settle).
 * The SQL itself is exercised by tests/db/booking-email-intent-ensure.sql and
 * tests/db/booking-email-intent-settle-generation.sql.
 */
function createIntentStore(options: { failEnsure?: boolean } = {}) {
  const intents = new Map<string, Intent>();
  let seq = 0;
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === 'ensure_booking_email_intent') {
      if (options.failEnsure) return { data: null, error: { code: '08006' } };
      const key = args.p_dedupe_key as string;
      const existing = intents.get(key);
      if (existing) {
        return {
          data: [{ intent_id: existing.id, created: false, intent_status: existing.status }],
          error: null,
        };
      }
      seq += 1;
      const intent: Intent = {
        id: `intent-${seq}`,
        dedupe_key: key,
        booking_id: args.p_booking_id as string,
        restaurant_id: args.p_restaurant_id as string,
        email_type: args.p_email_type as string,
        status: 'pending',
        attempts_made: 0,
        max_attempts: 5,
        claim_generation: 0,
        scheduled_for: (args.p_scheduled_for as string | null) ?? 'now',
      };
      intents.set(key, intent);
      return {
        data: [{ intent_id: intent.id, created: true, intent_status: 'pending' }],
        error: null,
      };
    }
    if (name === 'claim_booking_email_intent') {
      const intent = intents.get(args.p_dedupe_key as string);
      if (!intent || intent.restaurant_id !== args.p_restaurant_id || intent.status !== 'pending') {
        return { data: [], error: null };
      }
      intent.status = 'processing';
      intent.attempts_made += 1;
      intent.claim_generation += 1;
      return { data: [{ ...intent }], error: null };
    }
    if (name === 'settle_booking_email_intent_v2') {
      const intent = [...intents.values()].find((row) => row.id === args.p_intent_id);
      // Fenced on the claim generation, like the SQL function.
      if (
        !intent ||
        intent.status !== 'processing' ||
        intent.claim_generation !== args.p_claim_generation
      ) {
        return { data: null, error: null };
      }
      intent.status = args.p_outcome === 'retry' ? 'pending' : (args.p_outcome as string);
      return { data: intent.status, error: null };
    }
    return { data: null, error: { code: 'PGRST202' } };
  });
  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            email_send_review_request: false,
            google_review_url: null,
            timezone: 'Europe/London',
          },
          error: null,
        }),
      })),
    })),
  }));
  return { client: { rpc, from } as never, intents, rpc };
}

const confirmedBooking = {
  id: 'booking-1',
  restaurant_id: 'rest-1',
  customer_id: 'customer-1',
  booking_date: '2099-04-12',
  start_time: '19:00:00',
  end_time: '20:30:00',
  start_at: '2099-04-12T18:00:00.000Z',
  end_at: '2099-04-12T19:30:00.000Z',
  booking_type: 'dinner',
  seating_preference: 'any',
  status: 'confirmed',
  party_size: 2,
  customer_name: 'Guest Example',
  customer_email: 'guest@example.com',
  customer_phone: '+447700900000',
  notes: null,
  source: 'api',
  loyalty_points_awarded: 0,
  created_at: '2099-04-11T15:00:00.000Z',
  updated_at: '2099-04-11T15:00:00.000Z',
  reference: 'TESTREF',
} as const;

const payload = (replay = false) => ({
  booking: confirmedBooking,
  idempotencyKey: 'idem-1',
  restaurantId: 'rest-1',
  emailProvided: true,
  ...(replay ? { replay: true } : {}),
});

const emailCalls = () =>
  sendFirstBookingConfirmationNotificationsMock.mock.calls.filter(
    ([, options]) => (options as { allowEmail?: boolean }).allowEmail === true,
  );
const confirmationIntents = (intents: Map<string, Intent>) =>
  [...intents.values()].filter((intent) => intent.email_type === 'confirmation');

describe('booking created side effects: durable, idempotent confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emailQueueEnabled.value = true;
    recordBookingCreatedEventMock.mockResolvedValue(undefined);
    enqueueEmailJobMock.mockResolvedValue(undefined);
    sendFirstBookingConfirmationNotificationsMock.mockResolvedValue({
      alreadySent: false,
      emailSent: true,
      smsSent: true,
    });
  });

  it('a replay after a failed confirmation send retries it and leaves exactly one confirmation intent', async () => {
    const store = createIntentStore();
    sendFirstBookingConfirmationNotificationsMock.mockImplementation(
      async (_booking, options: { allowEmail: boolean }) => {
        if (options.allowEmail && emailCalls().length === 1) {
          throw new Error('provider timeout');
        }
        return { alreadySent: false, emailSent: options.allowEmail, smsSent: !options.allowEmail };
      },
    );

    await expect(
      enqueueBookingCreatedSideEffects(payload(), { supabase: store.client }),
    ).resolves.toMatchObject({ failures: ['confirmation_email'] });
    expect(confirmationIntents(store.intents)).toEqual([
      expect.objectContaining({ status: 'pending', attempts_made: 1 }),
    ]);

    await enqueueBookingCreatedSideEffects(payload(true), { supabase: store.client });

    expect(confirmationIntents(store.intents)).toEqual([
      expect.objectContaining({
        dedupe_key: 'email__confirmation__booking-1',
        status: 'sent',
        attempts_made: 2,
      }),
    ]);
    expect(emailCalls()).toHaveLength(2);
    // Analytics are not idempotent, so a replay does not record a second creation.
    expect(recordBookingCreatedEventMock).toHaveBeenCalledTimes(1);
  });

  it('a replay after a successful send does not send the confirmation again', async () => {
    const store = createIntentStore();

    await enqueueBookingCreatedSideEffects(payload(), { supabase: store.client });
    await enqueueBookingCreatedSideEffects(payload(true), { supabase: store.client });
    await enqueueBookingCreatedSideEffects(payload(true), { supabase: store.client });

    expect(emailCalls()).toHaveLength(1);
    expect(confirmationIntents(store.intents)).toEqual([
      expect.objectContaining({ status: 'sent', attempts_made: 1 }),
    ]);
    // Reminders are ensured under their existing keys, once each.
    expect([...store.intents.keys()].sort()).toEqual([
      'email__confirmation__booking-1',
      'reminder_24h__booking-1',
      'reminder_short__booking-1',
    ]);
    expect(enqueueEmailJobMock).not.toHaveBeenCalled();
  });

  it('never rejects when every side effect fails after the booking committed', async () => {
    const store = createIntentStore({ failEnsure: true });
    const failingClient = {
      rpc: store.rpc,
      from: vi.fn(() => {
        throw new Error('connection reset');
      }),
    };
    recordBookingCreatedEventMock.mockRejectedValue(new Error('analytics down'));
    sendFirstBookingConfirmationNotificationsMock.mockRejectedValue(new Error('provider down'));

    const result = await enqueueBookingCreatedSideEffects(payload(), {
      supabase: failingClient as never,
    });

    expect(result.failures).toEqual(
      expect.arrayContaining([
        'email_prefs',
        'analytics',
        'confirmation_email',
        'confirmation_sms',
      ]),
    );
    expect(loggerMock.error).toHaveBeenCalled();
    expect(JSON.stringify(loggerMock.error.mock.calls)).not.toContain('guest@example.com');
    expect(JSON.stringify(loggerMock.warn.mock.calls)).not.toContain('+447700900000');
  });

  it('never rejects even when the service client cannot be created', async () => {
    getServiceSupabaseClientMock.mockImplementation(() => {
      throw new Error('missing service role configuration');
    });

    await expect(enqueueBookingCreatedSideEffects(payload())).resolves.toMatchObject({
      queued: false,
      failures: ['client'],
    });
  });

  it('keeps the claim-guarded inline send when the durable email queue is disabled', async () => {
    emailQueueEnabled.value = false;
    const store = createIntentStore();

    await enqueueBookingCreatedSideEffects(payload(), { supabase: store.client });

    expect(store.rpc).not.toHaveBeenCalledWith('ensure_booking_email_intent', expect.anything());
    expect(emailCalls()).toHaveLength(1);
  });
});

describe('booking updated side effects: pending to confirmed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emailQueueEnabled.value = true;
    enqueueEmailJobMock.mockResolvedValue(undefined);
    sendFirstBookingConfirmationNotificationsMock.mockResolvedValue({
      alreadySent: false,
      emailSent: true,
      smsSent: true,
    });
  });

  it('shares the confirmation intent with the create path, so a repeated event sends once', async () => {
    const store = createIntentStore();
    const previous = { ...confirmedBooking, status: 'pending' };
    const event = {
      previous,
      current: confirmedBooking,
      restaurantId: 'rest-1',
    };

    await enqueueBookingUpdatedSideEffects(event, { supabase: store.client });
    await enqueueBookingUpdatedSideEffects(event, { supabase: store.client });

    expect(emailCalls()).toHaveLength(1);
    expect(confirmationIntents(store.intents)).toEqual([
      expect.objectContaining({ dedupe_key: 'email__confirmation__booking-1', status: 'sent' }),
    ]);
  });
});
