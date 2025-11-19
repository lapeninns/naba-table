import { beforeEach, describe, expect, it, vi } from "vitest";

const analyticsMocks = {
  recordBookingCreatedEvent: vi.fn(),
  recordBookingCancelledEvent: vi.fn(),
};
vi.mock("@/server/analytics", () => analyticsMocks);

const emailMocks = {
  sendBookingConfirmationEmail: vi.fn(),
  sendBookingCancellationEmail: vi.fn(),
  sendBookingUpdateEmail: vi.fn(),
  sendRestaurantCancellationEmail: vi.fn(),
};
vi.mock("@/server/emails/bookings", () => emailMocks);

const featureFlagMocks = {
  getAutoAssignCreatedEmailDeferMinutes: vi.fn(() => 0),
  isAutoAssignOnBookingEnabled: vi.fn(() => false),
  isEmailQueueEnabled: vi.fn(() => false),
};
vi.mock("@/server/feature-flags", () => featureFlagMocks);

const queueMocks = {
  enqueueEmailJob: vi.fn().mockResolvedValue(undefined),
};
vi.mock("@/server/queue/email", () => queueMocks);

vi.mock("@/server/supabase", () => ({
  getServiceSupabaseClient: vi.fn(() => ({})),
}));

const sideEffectsModule = await import("@/server/jobs/booking-side-effects");
const {
  enqueueBookingCancelledSideEffects,
  enqueueBookingCreatedSideEffects,
  enqueueBookingUpdatedSideEffects,
  processBookingCancelledSideEffects,
  processBookingCreatedSideEffects,
  processBookingUpdatedSideEffects,
} = sideEffectsModule;

import { makeBookingRecord } from "@/tests/helpers/opsFactories";

const RESTAURANT_ID = "c1a5c4bb-f1d8-4fcb-9fbb-b7c463b2c4ec";

function bookingPayload() {
  return makeBookingRecord({
    restaurant_id: RESTAURANT_ID,
    id: "booking-123",
    customer_email: "alex@example.com",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("booking side-effects processing", () => {
  it("records analytics and sends confirmation email on booking creation", async () => {
    const payload = {
      booking: bookingPayload(),
      idempotencyKey: null,
      restaurantId: RESTAURANT_ID,
    } as const;

    const queued = await processBookingCreatedSideEffects(payload);

    expect(queued).toBe(false);
    expect(analyticsMocks.recordBookingCreatedEvent).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      bookingId: "booking-123",
      restaurantId: RESTAURANT_ID,
    }));
    expect(emailMocks.sendBookingConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({ id: "booking-123" }));
  });

  it("skips confirmation email when customer email absent", async () => {
    const payload = {
      booking: makeBookingRecord({ restaurant_id: RESTAURANT_ID, customer_email: "" }),
      idempotencyKey: null,
      restaurantId: RESTAURANT_ID,
    } as const;

    const queued = await processBookingCreatedSideEffects(payload);

    expect(queued).toBe(false);
    expect(emailMocks.sendBookingConfirmationEmail).not.toHaveBeenCalled();
  });

  it("skips confirmation email when contact email was not provided even if a placeholder exists", async () => {
    const payload = {
      booking: makeBookingRecord({
        restaurant_id: RESTAURANT_ID,
        customer_email: "walkin+abc123@system.local",
      }),
      idempotencyKey: null,
      restaurantId: RESTAURANT_ID,
      emailProvided: false,
    } as const;

    const queued = await processBookingCreatedSideEffects(payload);

    expect(queued).toBe(false);
    expect(emailMocks.sendBookingConfirmationEmail).not.toHaveBeenCalled();
  });

  it("enqueues email job when queue enabled", async () => {
    featureFlagMocks.isEmailQueueEnabled.mockReturnValueOnce(true);

    const payload = {
      booking: bookingPayload(),
      idempotencyKey: null,
      restaurantId: RESTAURANT_ID,
    } as const;

    const queued = await processBookingCreatedSideEffects(payload);

    expect(queued).toBe(true);
    expect(queueMocks.enqueueEmailJob).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "booking-123",
        type: "confirmation",
        restaurantId: RESTAURANT_ID,
        scheduledFor: null,
      }),
      expect.objectContaining({
        jobId: "confirmation:booking-123",
        delayMs: expect.any(Number),
      }),
    );
    expect(emailMocks.sendBookingConfirmationEmail).not.toHaveBeenCalled();
  });

  it("sends update email for booking updates", async () => {
    const previous = bookingPayload();
    const current = { ...previous, updated_at: new Date().toISOString() } as typeof previous;

    await processBookingUpdatedSideEffects({ previous, current, restaurantId: RESTAURANT_ID });

    expect(emailMocks.sendBookingUpdateEmail).toHaveBeenCalledWith(expect.objectContaining({ id: "booking-123" }));
  });

  it("records cancellation analytics and sends cancellation email", async () => {
    const previous = bookingPayload();
    const cancelled = { ...previous, status: "cancelled" };

    await processBookingCancelledSideEffects({ previous, cancelled, restaurantId: RESTAURANT_ID, cancelledBy: "staff" });

    expect(analyticsMocks.recordBookingCancelledEvent).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      bookingId: "booking-123",
      cancelledBy: "staff",
    }));
    expect(emailMocks.sendRestaurantCancellationEmail).toHaveBeenCalledWith(expect.objectContaining({ id: "booking-123" }));
  });

  it("uses guest-facing cancellation copy when customer cancels", async () => {
    const previous = bookingPayload();
    const cancelled = { ...previous, status: "cancelled" };

    await processBookingCancelledSideEffects({ previous, cancelled, restaurantId: RESTAURANT_ID, cancelledBy: "customer" });

    expect(emailMocks.sendBookingCancellationEmail).toHaveBeenCalledWith(expect.objectContaining({ id: "booking-123" }));
    expect(emailMocks.sendRestaurantCancellationEmail).not.toHaveBeenCalled();
  });
});

describe("enqueue booking side-effects", () => {
  const payload = {
    booking: bookingPayload(),
    idempotencyKey: null,
    restaurantId: RESTAURANT_ID,
  } as const;

  it("executes synchronously when async queue disabled", async () => {
    const result = await enqueueBookingCreatedSideEffects(payload);

    expect(result).toMatchObject({ queued: false });
    expect(analyticsMocks.recordBookingCreatedEvent).toHaveBeenCalled();
  });

  it("processes updates synchronously", async () => {
    await enqueueBookingUpdatedSideEffects({
      previous: bookingPayload(),
      current: bookingPayload(),
      restaurantId: RESTAURANT_ID,
    });

    expect(emailMocks.sendBookingUpdateEmail).toHaveBeenCalled();
  });

  it("processes cancellations synchronously", async () => {
    await enqueueBookingCancelledSideEffects({
      previous: bookingPayload(),
      cancelled: bookingPayload(),
      restaurantId: RESTAURANT_ID,
      cancelledBy: "system",
    });

    expect(emailMocks.sendRestaurantCancellationEmail).toHaveBeenCalled();
  });
});
