import { getServerComponentSupabaseClient } from "@/server/supabase";

import { createServerAuthPort } from "./adapters/auth.server";
import { createServerBookingsPort } from "./adapters/bookings.server";
import { createServerProfilePort } from "./adapters/profile.server";

import type { GuestServices } from "./ports";
import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GuestServerServices = GuestServices & {
  supabasePromise: Promise<SupabaseClient<Database>>;
};

export const createGuestServerServices = async (): Promise<GuestServerServices> => {
  const supabasePromise = getServerComponentSupabaseClient();

  return {
    auth: createServerAuthPort(supabasePromise),
    bookings: createServerBookingsPort(),
    profile: createServerProfilePort(supabasePromise),
    supabasePromise,
  };
};
