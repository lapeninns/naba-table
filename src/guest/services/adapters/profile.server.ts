import { ensureProfileRow, normalizeProfileRow } from "@/lib/profile/server";
import { getServerComponentSupabaseClient } from "@/server/supabase";

import type { ProfilePort } from "../ports";
import type { Database } from "@/types/supabase";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export const createServerProfilePort = (
  supabasePromise: Promise<SupabaseClient<Database>> = getServerComponentSupabaseClient(),
): ProfilePort => {
  const ensure = async (user: User) => {
    const supabase = await supabasePromise;
    const row = await ensureProfileRow(supabase, user);
    return normalizeProfileRow(row, user.email ?? null);
  };

  const getSelf: ProfilePort["getSelf"] = async () => {
    const supabase = await supabasePromise;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Unauthenticated");
    }

    return ensure(user);
  };

  return {
    getSelf,
    ensureForUser: ensure,
  };
};
