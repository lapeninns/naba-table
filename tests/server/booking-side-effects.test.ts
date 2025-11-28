import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import {
  processBookingCreatedSideEffects,
  processBookingUpdatedSideEffects,
} from "@/server/jobs/booking-side-effects";

import type { BookingRecord } from "@/server/bookings";

const sendBookingReminderEmail = vi.fn();
const sendBookingReviewRequestEmail = vi.fn();
const sendBookingConfirmationEmail = vi.fn();
const sendBookingUpdateEmail = vi.fn();
const enqueueEmailJob = vi.fn();

vi.mock("@/server/emails/bookings", () => ({
  sendBookingCancellationEmail: vi.fn(),
  sendBookingConfirmationEmail: (...args: unknown[]) => sendBookingConfirmationEmail(...args),
  sendBookingReminderEmail: (...args: unknown[]) => sendBookingReminderEmail(...args),
  sendBookingReviewRequestEmail: (...args: unknown[]) => sendBookingReviewRequestEmail(...args),
  sendBookingUpdateEmail: (...args: unknown[]) => sendBookingUpdateEmail(...args),
  sendRestaurantCancellationEmail: vi.fn(),
}));

vi.mock("@/server/feature-flags", () => ({
  isEmailQueueEnabled: () => false,
  isAutoAssignOnBookingEnabled: () => false,
  getAutoAssignCreatedEmailDeferMinutes: () => 0,
}));

vi.mock("@/server/queue/email", () => ({
  enqueueEmailJob: (...args: unknown[]) => enqueueEmailJob(...args),
}));

vi.mock("@/server/analytics", () => ({
  recordBookingCreatedEvent: vi.fn(),
  recordBookingCancelledEvent: vi.fn(),
}));

vi.mock("@/server/observability", () => ({
  recordObservabilityEvent: vi.fn(),
}));

const restaurantPrefs = {
  email_send_reminder_24h: true,
  email_send_reminder_short: true,
  email_send_review_request: true,
};

function createSupabaseStub() {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: restaurantPrefs, error: null }),
              };
            },
          };
        },
      };
    },
  } as const;
}

function buildBooking(overrides: Partial<BookingRecord> = {}): BookingRecord {
  const now = Date.now();
  return {
    id: "booking-1",
    restaurant_id: "restaurant-1",
    customer_id: "customer-1",
    booking_date: new Date(now).toISOString().slice(0, 10),
    start_time: "18:00",
    end_time: "19:00",
    start_at: new Date(now + 25 * 60 * 60 * 1000).toISOString(),
    end_at: new Date(now + 26 * 60 * 60 * 1000).toISOString(),
    booking_type: "dinner",
    seating_preference: "indoor",
    status: "confirmed",
    party_size: 2,
    customer_name: "Jane Doe",
    customer_email: "jane@example.com",
    customer_phone: "123-456",
    notes: null,
    marketing_opt_in: false,
    source: "api",
    reference: "REF123",
    client_request_id: "req-1",
    pending_ref: null,
    loyalty_points_awarded: 0,
    idempotency_key: null,
    details: null,
    created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
    auth_user_id: null,
    booking_table_assignments: [],
    booking_date_timezone: null,
    booking_payment_status: null,
    booking_payment_reference: null,
    booking_user_agent: null,
    cancellation_reason: null,
    cancellation_source: null,
    cancelled_at: null,
    channel: null,
    customers: null,
    end_time_timezone: null,
    hold_released_at: null,
    is_held: false,
    no_show_at: null,
    restaurant_booking_reference: null,
    seating_notes: null,
    start_time_timezone: null,
    table_hold_id: null,
    total_amount: null,
    total_paid: null,
    ...overrides,
  } as BookingRecord;
}

describe("booking email side-effects (queue disabled)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("falls back to inline timers for reminder emails when queue is disabled", async () => {
    const booking = buildBooking({
      start_at: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
      end_at: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
      status: "confirmed",
    });

    await processBookingCreatedSideEffects(
      {
        booking,
        idempotencyKey: null,
        restaurantId: booking.restaurant_id!,
        emailProvided: true,
      },
      createSupabaseStub(),
    );

    expect(enqueueEmailJob).not.toHaveBeenCalled();
    expect(sendBookingReminderEmail).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(sendBookingReminderEmail).toHaveBeenCalledTimes(2);
    const variants = sendBookingReminderEmail.mock.calls.map(([, opts]) => opts.variant).sort();
    expect(variants).toEqual(["short", "standard"]);
  });

  it("falls back to inline timer for review-request email when queue is disabled", async () => {
    const booking = buildBooking({
      status: "completed",
      start_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      end_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    });

    await processBookingUpdatedSideEffects(
      {
        previous: { ...booking, status: "confirmed" },
        current: booking,
        restaurantId: booking.restaurant_id!,
      },
      createSupabaseStub(),
    );

    expect(enqueueEmailJob).not.toHaveBeenCalled();
    expect(sendBookingReviewRequestEmail).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(sendBookingReviewRequestEmail).toHaveBeenCalledTimes(1);
  });
});
