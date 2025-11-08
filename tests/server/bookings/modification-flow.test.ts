import { afterEach, describe, expect, it, vi } from "vitest";

import { beginBookingModificationFlow } from "@/server/bookings/modification-flow";

import type { Tables } from "@/types/supabase";

vi.mock("@/lib/env", () => ({
  env: {
    node: { env: "test" },
    featureFlags: {
      holds: { enabled: true, strictConflicts: true },
    },
  },
}));

const updateBookingRecordMock = vi.fn();
const clearBookingTableAssignmentsMock = vi.fn();
const sendBookingModificationPendingEmailMock = vi.fn();
const recordObservabilityEventMock = vi.fn();
const autoAssignAndConfirmIfPossibleMock = vi.fn();

vi.mock("@/server/bookings", () => ({
  updateBookingRecord: (...args: unknown[]) => updateBookingRecordMock(...args),
  clearBookingTableAssignments: (...args: unknown[]) => clearBookingTableAssignmentsMock(...args),
}));

vi.mock("@/server/emails/bookings", () => ({
  sendBookingModificationPendingEmail: (...args: unknown[]) => sendBookingModificationPendingEmailMock(...args),
}));

vi.mock("@/server/observability", () => ({
  recordObservabilityEvent: (...args: unknown[]) => recordObservabilityEventMock(...args),
}));

vi.mock("@/server/jobs/auto-assign", () => ({
  autoAssignAndConfirmIfPossible: (...args: unknown[]) => autoAssignAndConfirmIfPossibleMock(...args),
}));

const fakeClient = {} as unknown as ReturnType<typeof vi.fn>;

const existingBooking = {
  id: "booking-1",
  restaurant_id: "rest-1",
  booking_date: "2025-10-10",
  start_time: "19:00",
  end_time: "21:00",
  party_size: 2,
  status: "confirmed",
  customer_email: "guest@example.com",
} as unknown as Tables<"bookings">;

describe("beginBookingModificationFlow", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("updates the booking to pending, clears assignments, emails guest, and schedules auto-assign", async () => {
    const pendingBooking = { ...existingBooking, status: "pending", party_size: 4 };
    updateBookingRecordMock.mockResolvedValue(pendingBooking);
    clearBookingTableAssignmentsMock.mockResolvedValue(1);

    const result = await beginBookingModificationFlow({
      client: fakeClient,
      bookingId: existingBooking.id,
      existingBooking,
      source: "ops",
      payload: {
        booking_date: "2025-10-11",
        start_time: "20:00",
        end_time: "22:00",
        party_size: 4,
        notes: "Updated",
      },
    });

    expect(updateBookingRecordMock).toHaveBeenCalledWith(
      fakeClient,
      existingBooking.id,
      expect.objectContaining({
        status: "pending",
        party_size: 4,
      }),
    );
    expect(clearBookingTableAssignmentsMock).toHaveBeenCalledWith(fakeClient, existingBooking.id);
    expect(sendBookingModificationPendingEmailMock).toHaveBeenCalledWith(pendingBooking);
    expect(autoAssignAndConfirmIfPossibleMock).toHaveBeenCalledWith(existingBooking.id, {
      bypassFeatureFlag: true,
      reason: "modification",
      emailVariant: "modified",
    });
    expect(recordObservabilityEventMock).toHaveBeenCalled();
    expect(result).toEqual(pendingBooking);
  });
});
