import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchJson } from "@/lib/http/fetchJson";
import { createBookingService } from "@/services/app/bookings";

vi.mock("@/lib/http/fetchJson", () => ({
  fetchJson: vi.fn(),
}));

describe("ops booking service", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("unassigns tables via the ops booking endpoint", async () => {
    const service = createBookingService();
    const fetchJsonMock = vi.mocked(fetchJson);
    fetchJsonMock.mockResolvedValueOnce({ tableAssignments: [] });

    await service.unassignTable({ bookingId: "booking-123", tableId: "table-456" });

    expect(fetchJsonMock).toHaveBeenCalledWith(
      "/api/app/bookings/booking-123/tables/table-456",
      { method: "DELETE" },
    );
  });
});
