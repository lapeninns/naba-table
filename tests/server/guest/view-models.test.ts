import { buildGuestBookingsViewModel } from "@/guest/routes/bookings/view-model";

import type { BookingsPage } from "@/guest/services/ports";
import type { GuestServerServices } from "@/guest/services/server";
import type { ProfileResponse } from "@/lib/profile/schema";
import type { Database } from "@/types/supabase";
import type { SupabaseClient, User } from "@supabase/supabase-js";

const fakeUser: User = {
  id: "user-1",
  email: "guest@example.com",
  user_metadata: {},
  app_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

const supabaseClient = {} as SupabaseClient<Database>;

const bookingsPage: BookingsPage = {
  items: [
    {
      id: "b1",
      restaurantName: "Test Restaurant",
      partySize: 2,
      startIso: new Date("2025-12-05T18:00:00Z").toISOString(),
      endIso: new Date("2025-12-05T20:00:00Z").toISOString(),
      status: "confirmed",
    },
  ],
  pageInfo: { page: 1, pageSize: 10, total: 1, hasNext: false },
} as unknown as BookingsPage;

const profile: ProfileResponse = {
  id: "user-1",
  email: "guest@example.com",
  name: "Guest",
  phone: null,
  image: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const services: GuestServerServices = {
  auth: {
    getUser: async () => fakeUser,
    requireUser: async () => fakeUser,
  },
  bookings: {
    list: async () => bookingsPage,
  },
  profile: {
    ensureForUser: async () => profile,
    getSelf: async () => profile,
  },
  featureConfig: {
    getConfig: () => ({ experimentA: true }),
  },
  supabasePromise: Promise.resolve(supabaseClient),
};

describe("buildGuestBookingsViewModel", () => {
  it("hydrates bookings and profile data and normalizes tab", async () => {
    const viewModel = await buildGuestBookingsViewModel(services, { tab: "history" });

    expect(viewModel.initialTab).toBe("past");

    const bookingsQuery = viewModel.dehydratedState.queries.find((q) =>
      Array.isArray(q.queryKey) && q.queryKey[0] === "bookings",
    );
    expect(bookingsQuery?.state?.data).toMatchObject({ items: expect.any(Array) });

    const profileQuery = viewModel.dehydratedState.queries.find((q) =>
      Array.isArray(q.queryKey) && q.queryKey[0] === "profile",
    );
    expect(profileQuery?.state?.data).toMatchObject({ email: "guest@example.com" });
  });
});
