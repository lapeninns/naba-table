process.env.CRON_SECRET ??= "test-cron-secret";

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { GET } from "./route";

const sendBookingConfirmationEmailMock = vi.fn();
const sendBookingReminderEmailMock = vi.fn();
const sendBookingReviewRequestEmailMock = vi.fn();
const sendBookingUpdateEmailMock = vi.fn();
const sendBookingCancellationEmailMock = vi.fn();
const sendRestaurantCancellationEmailMock = vi.fn();
const sendBookingRejectedEmailMock = vi.fn();

vi.mock("@/server/emails/bookings", () => ({
  sendBookingConfirmationEmail: (...args: unknown[]) => sendBookingConfirmationEmailMock(...args),
  sendBookingReminderEmail: (...args: unknown[]) => sendBookingReminderEmailMock(...args),
  sendBookingReviewRequestEmail: (...args: unknown[]) => sendBookingReviewRequestEmailMock(...args),
  sendBookingUpdateEmail: (...args: unknown[]) => sendBookingUpdateEmailMock(...args),
  sendBookingCancellationEmail: (...args: unknown[]) => sendBookingCancellationEmailMock(...args),
  sendRestaurantCancellationEmail: (...args: unknown[]) =>
    sendRestaurantCancellationEmailMock(...args),
  sendBookingRejectedEmail: (...args: unknown[]) => sendBookingRejectedEmailMock(...args),
}));

const getEmailQueueMock = vi.fn();
vi.mock("@/server/queue/email", () => ({
  getEmailQueue: () => getEmailQueueMock(),
}));

const getServiceSupabaseClientMock = vi.fn();
vi.mock("@/server/supabase", () => ({
  getServiceSupabaseClient: () => getServiceSupabaseClientMock(),
}));

type BookingRecord = {
  id: string;
  status: string;
  customer_email: string | null;
};

type JobData = {
  bookingId: string;
  restaurantId: string | null;
  type: string;
};

function createSupabaseStub(bookings: Map<string, BookingRecord | null>) {
  return {
    from: () => ({
      select: () => ({
        eq: (_field: string, bookingId: string) => ({
          maybeSingle: () =>
            Promise.resolve({
              data: bookings.get(bookingId) ?? null,
              error: null,
            }),
        }),
      }),
    }),
  };
}

function makeJob(params: {
  id: string;
  bookingId: string;
  type?: string;
  timestamp: number;
  delay?: number;
}) {
  return {
    id: params.id,
    data: {
      bookingId: params.bookingId,
      restaurantId: null,
      type: params.type ?? "confirmation",
    } as JobData,
    timestamp: params.timestamp,
    opts: { delay: params.delay ?? 0 },
    remove: vi.fn().mockResolvedValue(undefined),
  };
}

function createRequest() {
  return new Request("http://localhost/api/cron/process-emails", {
    headers: {
      authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("/api/cron/process-emails", () => {
  it("returns early when no jobs are pending", async () => {
    const queue = {
      getJobCounts: vi.fn().mockResolvedValue({ wait: 0, delayed: 0 }),
      getWaiting: vi.fn(),
      getDelayed: vi.fn(),
    };

    getEmailQueueMock.mockReturnValue(queue);
    getServiceSupabaseClientMock.mockReturnValue(createSupabaseStub(new Map()));

    const response = await GET(createRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.processed).toBe(0);
    expect(queue.getWaiting).not.toHaveBeenCalled();
    expect(queue.getDelayed).not.toHaveBeenCalled();
  });

  it("prioritizes waiting jobs and skips delayed fetch when full", async () => {
    const now = Date.now();
    const bookings = new Map<string, BookingRecord>();
    const jobs = Array.from({ length: 10 }, (_, idx) => {
      const bookingId = `booking-${idx}`;
      bookings.set(bookingId, {
        id: bookingId,
        status: "confirmed",
        customer_email: "guest@example.com",
      });
      return makeJob({ id: `job-${index}`, bookingId, timestamp: now });
    });

    const queue = {
      getJobCounts: vi.fn().mockResolvedValue({ wait: 10, delayed: 0 }),
      getWaiting: vi.fn().mockResolvedValue(jobs),
      getDelayed: vi.fn(),
    };

    getEmailQueueMock.mockReturnValue(queue);
    getServiceSupabaseClientMock.mockReturnValue(createSupabaseStub(bookings));

    const response = await GET(createRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.stats.sent).toBe(10);
    expect(queue.getDelayed).not.toHaveBeenCalled();
    jobs.forEach((job) => {
      expect(job.remove).toHaveBeenCalledOnce();
    });
    expect(sendBookingConfirmationEmailMock).toHaveBeenCalledTimes(10);
  });

  it("fills from delayed jobs when waiting is insufficient", async () => {
    const now = Date.now();
    const bookings = new Map<string, BookingRecord>();
    const waitingJobs = ["w1", "w2"].map((id) => {
      const bookingId = `booking-${id}`;
      bookings.set(bookingId, {
        id: bookingId,
        status: "confirmed",
        customer_email: "guest@example.com",
      });
      return makeJob({ id, bookingId, timestamp: now });
    });

    const delayedReady = makeJob({
      id: "d-ready",
      bookingId: "booking-d-ready",
      timestamp: now - 20_000,
      delay: 5_000,
    });
    const delayedNotReady = makeJob({
      id: "d-not-ready",
      bookingId: "booking-d-not-ready",
      timestamp: now,
      delay: 20_000,
    });

    bookings.set("booking-d-ready", {
      id: "booking-d-ready",
      status: "confirmed",
      customer_email: "guest@example.com",
    });
    bookings.set("booking-d-not-ready", {
      id: "booking-d-not-ready",
      status: "confirmed",
      customer_email: "guest@example.com",
    });

    const queue = {
      getJobCounts: vi.fn().mockResolvedValue({ wait: 2, delayed: 2 }),
      getWaiting: vi.fn().mockResolvedValue(waitingJobs),
      getDelayed: vi.fn().mockResolvedValue([delayedReady, delayedNotReady]),
    };

    getEmailQueueMock.mockReturnValue(queue);
    getServiceSupabaseClientMock.mockReturnValue(createSupabaseStub(bookings));

    const response = await GET(createRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.stats.sent).toBe(3);
    expect(queue.getDelayed).toHaveBeenCalledOnce();
    expect(sendBookingConfirmationEmailMock).toHaveBeenCalledTimes(3);
    expect(delayedReady.remove).toHaveBeenCalledOnce();
    expect(delayedNotReady.remove).not.toHaveBeenCalled();
  });
});
