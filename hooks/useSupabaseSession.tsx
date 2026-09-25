'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { setSupabaseSessionSnapshot } from '@/lib/supabase/session-store';

import type { Session, User } from '@supabase/supabase-js';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

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
// True once the browser client has confirmed the session. `initialSession={null}` renders
// "unauthenticated" immediately (no guest skeleton), but that is an assumption until confirmed.
const SupabaseSessionResolvedContext = createContext(false);

const log = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[useSupabaseSession]', ...args);
  }
};

export function SupabaseSessionProvider({
  children,
  initialSession,
}: SupabaseSessionProviderProps) {
  const supabase = getSupabaseBrowserClient();
  const hasHydratedFromInitialRef = useRef(false);
  const lastAccessTokenRef = useRef<string | null>(null);
  const lastUserRef = useRef<User | null>(null);

  const [state, setState] = useState<SupabaseSessionState>(() => {
    let nextState: SupabaseSessionState;
    if (initialSession) {
      // Avoid trusting user from session; hydrate user via getUser().
      nextState = { session: initialSession, user: null, status: 'loading' };
    } else if (initialSession === null) {
      nextState = { session: null, user: null, status: 'unauthenticated' };
    } else {
      nextState = { session: null, user: null, status: 'loading' };
    }
    setSupabaseSessionSnapshot(nextState);
    return nextState;
  });
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    setSupabaseSessionSnapshot(state);
    lastUserRef.current = state.user;
    lastAccessTokenRef.current = state.session?.access_token ?? null;
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
      .catch((error) => log('Failed to hydrate session', error));
  }, [initialSession, supabase]);

  // Fetch current session on mount (uses getSession, not getUser)
  useEffect(() => {
    let active = true;

    const commitState = (nextState: SupabaseSessionState) => {
      setState(nextState);
      setResolved(true);
    };

    const setUnauthenticated = () => {
      commitState({ session: null, user: null, status: 'unauthenticated' });
    };

    const resolveUser = async (session: Session | null, options?: { allowCached?: boolean }) => {
      if (!session) {
        setUnauthenticated();
        return;
      }

      const accessToken = session.access_token ?? null;
      const canUseCached =
        options?.allowCached &&
        lastUserRef.current &&
        accessToken &&
        accessToken === lastAccessTokenRef.current;
      if (canUseCached) {
        commitState({ session, user: lastUserRef.current, status: 'authenticated' });
        return;
      }

      try {
        const { data, error } = await supabase.auth.getUser();

        if (!active) return;

        if (error || !data.user) {
          log('getUser error', error?.message ?? 'no user');
          setUnauthenticated();
          return;
        }

        lastAccessTokenRef.current = accessToken;
        lastUserRef.current = data.user;
        commitState({ session, user: data.user, status: 'authenticated' });
      } catch (error) {
        if (!active) return;
        log('getUser unexpected error', error);
        setUnauthenticated();
      }
    };

    const syncSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!active) return;

        if (error) {
          log('getSession error', error.message);
          setUnauthenticated();
          return;
        }

        if (data.session) {
          await resolveUser(data.session, { allowCached: true });
        } else {
          setUnauthenticated();
        }
      } catch (error) {
        if (!active) return;
        log('getSession unexpected error', error);
        setUnauthenticated();
      }
    };

    void syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === 'SIGNED_OUT' || !session) {
        setUnauthenticated();
        return;
      }

      if (event === 'TOKEN_REFRESHED' && lastUserRef.current) {
        lastAccessTokenRef.current = session.access_token ?? null;
        commitState({ session, user: lastUserRef.current, status: 'authenticated' });
        return;
      }

      // SIGNED_IN, USER_UPDATED, INITIAL_SESSION, etc.
      void resolveUser(session, { allowCached: true });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo(() => state, [state]);

  return (
    <SupabaseSessionContext.Provider value={value}>
      <SupabaseSessionResolvedContext.Provider value={resolved}>
        {children}
      </SupabaseSessionResolvedContext.Provider>
    </SupabaseSessionContext.Provider>
  );
}

export function useSupabaseSessionResolved(): boolean {
  return useContext(SupabaseSessionResolvedContext);
}

export function useSupabaseSession(): SupabaseSessionState {
  const ctx = useContext(SupabaseSessionContext);
  if (ctx) return ctx;

  // Fallback (should not occur if provider is set)
  return { user: null, session: null, status: 'loading' };
}
