'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';

import { createClientBookingsPort } from './adapters/bookings.client';
import { createClientProfilePort } from './adapters/profile.client';

import type { GuestServices } from './ports';

type GuestServicesProviderProps = {
  children: ReactNode;
  services?: Partial<GuestServices>;
};

const GuestServicesContext = createContext<GuestServices | null>(null);

export function GuestServicesProvider({ children, services }: GuestServicesProviderProps) {
  if (services?.auth) {
    return (
      <InjectedGuestServicesProvider services={services}>{children}</InjectedGuestServicesProvider>
    );
  }

  return (
    <DefaultGuestServicesProvider services={services}>{children}</DefaultGuestServicesProvider>
  );
}

function InjectedGuestServicesProvider({ children, services }: GuestServicesProviderProps) {
  const bookingsPort = useMemo(
    () => services?.bookings ?? createClientBookingsPort(),
    [services?.bookings],
  );
  const profilePort = useMemo(
    () => services?.profile ?? createClientProfilePort(),
    [services?.profile],
  );

  const value = useMemo<GuestServices>(
    () => ({
      auth: services?.auth as GuestServices['auth'],
      bookings: bookingsPort,
      profile: profilePort,
    }),
    [bookingsPort, profilePort, services?.auth],
  );

  return <GuestServicesContext.Provider value={value}>{children}</GuestServicesContext.Provider>;
}

function DefaultGuestServicesProvider({ children, services }: GuestServicesProviderProps) {
  const sessionState = useSupabaseSession();

  const bookingsPort = useMemo(
    () => services?.bookings ?? createClientBookingsPort(),
    [services?.bookings],
  );
  const profilePort = useMemo(
    () => services?.profile ?? createClientProfilePort(),
    [services?.profile],
  );

  const authPort = useMemo(() => {
    if (services?.auth) return services.auth;

    return {
      getUser: async () => sessionState.user ?? null,
      requireUser: async ({ redirectTo = '/auth/signin', redirectedFrom }) => {
        if (sessionState.user) {
          return sessionState.user;
        }

        const target = withRedirectedFrom(redirectTo, redirectedFrom ?? redirectTo);
        if (typeof window !== 'undefined') {
          window.location.assign(target);
        }
        throw new Error('Redirecting to sign-in');
      },
    } satisfies GuestServices['auth'];
  }, [services?.auth, sessionState.user]);

  const value = useMemo<GuestServices>(
    () => ({
      auth: authPort,
      bookings: bookingsPort,
      profile: profilePort,
    }),
    [authPort, bookingsPort, profilePort],
  );

  return <GuestServicesContext.Provider value={value}>{children}</GuestServicesContext.Provider>;
}

export const useGuestServices = (): GuestServices => {
  const ctx = useContext(GuestServicesContext);
  if (!ctx) {
    throw new Error('GuestServicesProvider is missing in the component tree');
  }
  return ctx;
};
