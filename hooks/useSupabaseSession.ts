"use client";

import { useEffect, useRef, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

import type { User } from "@supabase/supabase-js";


export type SupabaseSessionState = {
  user: User | null;
  status: "loading" | "ready";
};

export function useSupabaseSession(): SupabaseSessionState {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  // Track if we've received a definitive auth state to prevent race conditions
  const hasDefinitiveAuthRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowserClient();

    const syncSession = async () => {
      try {
        console.log("[useSupabaseSession] Calling getUser...");
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!isMounted) {
          return;
        }

        if (error) {
          console.error("[useSupabaseSession] failed to load user", error.message);
          // Only set to null if we haven't received a definitive auth state
          if (!hasDefinitiveAuthRef.current) {
            setUser(null);
            setStatus("ready");
          }
        } else {
          console.log("[useSupabaseSession] getUser success:", user?.id, user?.email);
          hasDefinitiveAuthRef.current = true;
          setUser(user ?? null);
          setStatus("ready");
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        console.error("[useSupabaseSession] unexpected error", error);
        if (!hasDefinitiveAuthRef.current) {
          setUser(null);
          setStatus("ready");
        }
      }
    };

    void syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[useSupabaseSession] Auth state changed:", event, session?.user?.id);
      
      if (!isMounted) {
        console.log("[useSupabaseSession] Component unmounted, skipping state update");
        return;
      }

      // For SIGNED_IN or TOKEN_REFRESHED events with a session, use it directly
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
        console.log("[useSupabaseSession] Using session from event:", session.user.id, session.user.email);
        hasDefinitiveAuthRef.current = true;
        setUser(session.user);
        setStatus("ready");
        return;
      }

      // For SIGNED_OUT, clear the user
      if (event === "SIGNED_OUT") {
        console.log("[useSupabaseSession] User signed out");
        hasDefinitiveAuthRef.current = true;
        setUser(null);
        setStatus("ready");
        return;
      }

      // For other events, try getUser but don't overwrite if we already have definitive state
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          console.error("[useSupabaseSession] auth change user load failed", error.message);
          // Don't reset to null if we already have definitive auth state
          if (!hasDefinitiveAuthRef.current) {
            setUser(null);
          }
        } else {
          console.log("[useSupabaseSession] auth change getUser success:", user?.id, user?.email);
          hasDefinitiveAuthRef.current = true;
          setUser(user ?? null);
        }
      } catch (error) {
        console.error("[useSupabaseSession] auth change unexpected error", error);
        if (!hasDefinitiveAuthRef.current) {
          setUser(null);
        }
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
