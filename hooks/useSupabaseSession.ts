"use client";

import { useEffect, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

import type { User } from "@supabase/supabase-js";


export type SupabaseSessionState = {
  user: User | null;
  status: "loading" | "ready";
};

export function useSupabaseSession(): SupabaseSessionState {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowserClient();

    const syncSession = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!isMounted) {
          return;
        }

        if (error) {
          console.error("[useSupabaseSession] failed to load user", error.message);
        }

        setUser(user ?? null);
        setStatus("ready");
      } catch (error) {
        if (!isMounted) {
          return;
        }
        console.error("[useSupabaseSession] unexpected error", error);
        setUser(null);
        setStatus("ready");
      }
    };

    void syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      if (!isMounted) {
        return;
      }

      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          console.error("[useSupabaseSession] auth change user load failed", error.message);
        }

        setUser(user ?? null);
      } catch (error) {
        console.error("[useSupabaseSession] auth change unexpected error", error);
        setUser(null);
      } finally {
        setStatus("ready");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, status };
}
