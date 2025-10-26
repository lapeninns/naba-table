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
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        if (error) {
          console.error("[useSupabaseSession] failed to load session", error.message);
        }

        setUser(session?.user ?? null);
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }

      setUser(session?.user ?? null);
      setStatus("ready");
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, status };
}
