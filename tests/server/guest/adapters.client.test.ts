import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";


import { createClientBookingsPort } from "@/guest/services/adapters/bookings.client";
import { createClientProfilePort } from "@/guest/services/adapters/profile.client";

import type { Mock } from "vitest";

vi.mock("@/lib/http/fetchJson", () => ({
  fetchJson: vi.fn(),
}));

const { fetchJson } = await import("@/lib/http/fetchJson");

describe("client adapters", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("bookings adapter calls API with defaults", async () => {
    (fetchJson as unknown as Mock).mockResolvedValue({
      items: [],
      pageInfo: { page: 1, pageSize: 10, total: 0, hasNext: false },
    });

    const port = createClientBookingsPort();
    await port.list();

    expect(fetchJson).toHaveBeenCalledWith("/api/bookings?me=1&page=1&pageSize=10");
  });

  it("profile adapter parses profile payload", async () => {
    const profile = {
      id: "user-1",
      email: "test@example.com",
      name: "Tester",
      phone: null,
      image: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    (fetchJson as unknown as Mock).mockResolvedValue({ profile });

    const port = createClientProfilePort();
    const result = await port.getSelf();

    expect(result).toMatchObject({ id: "user-1", email: "test@example.com", name: "Tester" });
  });
});
