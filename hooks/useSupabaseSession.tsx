"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { setSupabaseSessionSnapshot } from "@/lib/supabase/session-store";

import type { Session, User } from "@supabase/supabase-js";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export type SupabaseSessionState = {
  user: User | null;
  session: Session | null;
  status: SessionStatus;
};

type SupabaseSessionProviderProps = {
  children: ReactNode;
  initialSession?: Session | null;
};

const SupabaseSessionContext = createContext<SupabaseSessionState | null>(null);

const log = (...args: unknown[]) => {
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log("[useSupabaseSession]", ...args);
  }
};

export function SupabaseSessionProvider({ children, initialSession }: SupabaseSessionProviderProps) {
  const supabase = getSupabaseBrowserClient();
  const hasHydratedFromInitialRef = useRef(false);

  const [state, setState] = useState<SupabaseSessionState>(() => {
    let nextState: SupabaseSessionState;
    if (initialSession?.user) {
      nextState = { session: initialSession, user: initialSession.user, status: "authenticated" };
    } else if (initialSession === null) {
      nextState = { session: null, user: null, status: "unauthenticated" };
    } else {
      nextState = { session: null, user: null, status: "loading" };
    }
    setSupabaseSessionSnapshot(nextState);
    return nextState;
  });

  useEffect(() => {
    setSupabaseSessionSnapshot(state);
  }, [state]);

  // Hydrate browser client with server-issued session if present
  useEffect(() => {
    if (!initialSession || hasHydratedFromInitialRef.current) return;
    hasHydratedFromInitialRef.current = true;

    void supabase.auth
      .setSession({
        access_token: initialSession.access_token,
        refresh_token: initialSession.refresh_token,
      })
      .catch((error) => log("Failed to hydrate session", error));
  }, [initialSession, supabase]);

  // Fetch current session on mount (uses getSession, not getUser)
  useEffect(() => {
    let active = true;

    const syncSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!active) return;

        if (error) {
          log("getSession error", error.message);
          setState((prev) => ({ ...prev, status: "unauthenticated", user: null, session: null }));
          return;
        }

        if (data.session?.user) {
          setState({ session: data.session, user: data.session.user, status: "authenticated" });
        } else {
          setState({ session: null, user: null, status: "unauthenticated" });
        }
      } catch (error) {
        if (!active) return;
        log("getSession unexpected error", error);
        setState({ session: null, user: null, status: "unauthenticated" });
      }
    };

    void syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "SIGNED_OUT" || !session?.user) {
        setState({ session: null, user: null, status: "unauthenticated" });
        return;
      }

      // SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION, etc.
      setState({ session, user: session.user ?? null, status: session.user ? "authenticated" : "unauthenticated" });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo(() => state, [state]);

  return <SupabaseSessionContext.Provider value={value}>{children}</SupabaseSessionContext.Provider>;
}

export function useSupabaseSession(): SupabaseSessionState {
  const ctx = useContext(SupabaseSessionContext);
  if (ctx) return ctx;

  // Fallback (should not occur if provider is set)
  return { user: null, session: null, status: "loading" };
}
