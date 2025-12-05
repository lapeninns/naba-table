import { redirect } from "next/navigation";

import { withRedirectedFrom } from "@/lib/url/withRedirectedFrom";
import { getServerComponentSupabaseClient } from "@/server/supabase";

import type { AuthPort, RedirectSpec } from "../ports";
import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export const createServerAuthPort = (
  supabasePromise: Promise<SupabaseClient<Database>> = getServerComponentSupabaseClient(),
): AuthPort => {

  const getUser = async () => {
    const supabase = await supabasePromise;
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (!user) {
      console.log('❌ [AuthPort] getUser failed. User is null. Error:', error?.message);
    } else {
      console.log('✅ [AuthPort] getUser success:', user.email);
    }

    return user ?? null;
  };

  const requireUser = async ({ redirectTo = "/auth/signin", redirectedFrom }: RedirectSpec) => {
    const user = await getUser();
    if (!user) {
      const target = withRedirectedFrom(redirectTo, redirectedFrom ?? redirectTo);
      redirect(target);
    }
    return user;
  };

  return { getUser, requireUser };
};
