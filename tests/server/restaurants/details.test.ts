import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateRestaurantDetails } from "@/server/restaurants/details";
import { updateRestaurant } from "@/server/restaurants/update";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

vi.mock("@/server/restaurants/update", () => ({
  updateRestaurant: vi.fn(),
}));

vi.mock("@/server/supabase", () => ({
  getServiceSupabaseClient: vi.fn(),
}));

type MockClient = SupabaseClient<Database, "public", any>;

function createClient(options: { restaurant?: any }) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options.restaurant ?? {
      id: "rest-1",
      name: "Original Name",
      slug: "original-slug",
      timezone: "America/New_York",
      capacity: 120,
      contact_email: "ops@example.com",
      contact_phone: "+15551234",
      address: "100 Demo St",
      booking_policy: "Standard policy",
    },
    error: null,
  });

  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return {
    from,
  } as unknown as MockClient;
}

const mockedUpdateRestaurant = vi.mocked(updateRestaurant);

describe("updateRestaurantDetails", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockedUpdateRestaurant.mockReset();
  });

  it("sanitises inputs and forwards canonical payload to updateRestaurant", async () => {
    const client = createClient({
      restaurant: {
        id: "rest-1",
        name: "Original Name",
        slug: "original-slug",
        timezone: "America/Los_Angeles",
        capacity: 80,
        contact_email: "team@example.com",
        contact_phone: "555-0000",
        address: "1 Infinity Loop",
        booking_policy: "Legacy",
      },
    });

    mockedUpdateRestaurant.mockResolvedValue({
      id: "rest-1",
      name: "New Name",
      slug: "new-slug",
      timezone: "America/Los_Angeles",
      capacity: 90,
      contactEmail: null,
      contactPhone: "555-1234",
      address: "1 Infinity Loop",
      bookingPolicy: null,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-21T00:00:00Z",
    });

    const result = await updateRestaurantDetails(
      "rest-1",
      {
        name: "  New Name  ",
        slug: " new-slug ",
        timezone: "America/Los_Angeles",
        capacity: 90,
        contactEmail: "   ", // should coerce to null
        contactPhone: " 555-1234 ",
        address: "1 Infinity Loop",
        bookingPolicy: "\n\t",
      },
      client,
    );

    expect(mockedUpdateRestaurant).toHaveBeenCalledTimes(1);
    expect(mockedUpdateRestaurant).toHaveBeenCalledWith(
      "rest-1",
      {
        name: "New Name",
        slug: "new-slug",
        timezone: "America/Los_Angeles",
        capacity: 90,
        contactEmail: null,
        contactPhone: "555-1234",
        address: "1 Infinity Loop",
        bookingPolicy: null,
      },
      client,
    );
    expect(result).toMatchObject({
      restaurantId: "rest-1",
      name: "New Name",
      slug: "new-slug",
      contactEmail: null,
      contactPhone: "555-1234",
    });
  });

  it("rejects invalid timezone", async () => {
    const client = createClient({});

    await expect(
      updateRestaurantDetails(
        "rest-1",
        {
          timezone: "Invalid/Timezone",
        },
        client,
      ),
    ).rejects.toThrow(/Invalid timezone/i);

    expect(mockedUpdateRestaurant).not.toHaveBeenCalled();
  });

  it("rejects invalid slug format", async () => {
    const client = createClient({});

    await expect(
      updateRestaurantDetails(
        "rest-1",
        {
          slug: "Invalid Slug!",
          timezone: "America/New_York",
        },
        client,
      ),
    ).rejects.toThrow(/Slug must contain only lowercase letters/);
    expect(mockedUpdateRestaurant).not.toHaveBeenCalled();
  });

  it("rejects negative capacity", async () => {
    const client = createClient({});

    await expect(
      updateRestaurantDetails(
        "rest-1",
        {
          capacity: -10,
          timezone: "America/New_York",
        },
        client,
      ),
    ).rejects.toThrow(/Capacity must be a positive number/);
    expect(mockedUpdateRestaurant).not.toHaveBeenCalled();
  });
});
