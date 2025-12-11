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

    if (!user && process.env.NODE_ENV === "development") {
      // Log only in development without exposing full PII
      console.warn("[AuthPort] getUser returned null", error?.message ?? "no error message");
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
