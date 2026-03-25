"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { withRedirectedFrom } from "@/lib/url/withRedirectedFrom";

import { createClientBookingsPort } from "./adapters/bookings.client";
import { createClientProfilePort } from "./adapters/profile.client";

import type { GuestServices } from "./ports";
import type { SupabaseSessionState } from "@/hooks/useSupabaseSession";

type GuestServicesProviderProps = {
  children: ReactNode;
  services?: Partial<GuestServices>;
  sessionStateOverride?: SupabaseSessionState;
};

const GuestServicesContext = createContext<GuestServices | null>(null);
const GuestSessionContext = createContext<SupabaseSessionState | null>(null);

export function GuestServicesProvider({
  children,
  services,
  sessionStateOverride,
}: GuestServicesProviderProps) {
  const sessionState = useSupabaseSession();
  const resolvedSessionState = sessionStateOverride ?? sessionState;

  const bookingsPort = useMemo(() => services?.bookings ?? createClientBookingsPort(), [services?.bookings]);
  const profilePort = useMemo(() => services?.profile ?? createClientProfilePort(), [services?.profile]);

  const authPort = useMemo(() => {
    if (services?.auth) return services.auth;

    return {
      getUser: async () => resolvedSessionState.user ?? null,
      requireUser: async ({ redirectTo = "/auth/signin", redirectedFrom }) => {
        if (resolvedSessionState.user) {
          return resolvedSessionState.user;
        }

        const target = withRedirectedFrom(redirectTo, redirectedFrom ?? redirectTo);
        if (typeof window !== "undefined") {
          window.location.assign(target);
        }
        throw new Error("Redirecting to sign-in");
      },
    } satisfies GuestServices["auth"];
  }, [resolvedSessionState.user, services?.auth]);

  const value = useMemo<GuestServices>(
    () => ({
      auth: authPort,
      bookings: bookingsPort,
      profile: profilePort,
    }),
    [authPort, bookingsPort, profilePort],
  );

  return (
    <GuestSessionContext.Provider value={resolvedSessionState}>
      <GuestServicesContext.Provider value={value}>{children}</GuestServicesContext.Provider>
    </GuestSessionContext.Provider>
  );
}

export const useGuestServices = (): GuestServices => {
  const ctx = useContext(GuestServicesContext);
  if (!ctx) {
    throw new Error("GuestServicesProvider is missing in the component tree");
  }
  return ctx;
};

export const useGuestSessionState = (): SupabaseSessionState => {
  const ctx = useContext(GuestSessionContext);
  if (!ctx) {
    return { user: null, session: null, status: "loading" };
  }
  return ctx;
};
