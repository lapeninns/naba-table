import { persistQueryClient, type PersistedClient, type Persister } from '@tanstack/query-persist-client-core';
import { onlineManager } from '@tanstack/react-query';

import type { QueryClient as ReactQueryClient } from '@tanstack/react-query';

const STORAGE_KEY = 'reserve.query-cache';
const STORAGE_VERSION = 'v1';
const DEFAULT_MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours

const safeParse = <T>(value: string | null): T | undefined => {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[query-persist] failed to parse persisted client', error);
    }
    return undefined;
  }
};

type PersistableQueryLike = {
  state?: {
    status?: string;
    fetchStatus?: string;
  };
  meta?: Record<string, unknown>;
};

const isPersistableQuery = (query: PersistableQueryLike | undefined): boolean => {
  if (!query) return false;
  if (query.meta?.persist === false) return false;
  if (query.state?.status === 'pending') return false;
  if (query.state?.fetchStatus && query.state.fetchStatus !== 'idle') return false;
  return true;
};

const sanitizePersistedClient = (client: PersistedClient | undefined): PersistedClient | undefined => {
  if (!client?.clientState?.queries) {
    return client;
  }

  const filtered = client.clientState.queries.filter((query) => isPersistableQuery(query));
  if (filtered.length === client.clientState.queries.length) {
    return client;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.warn('[query-persist] removed unsafe queries from persisted cache', {
      removed: client.clientState.queries.length - filtered.length,
    });
  }

  return {
    ...client,
    clientState: {
      ...client.clientState,
      queries: filtered,
    },
  };
};

const createLocalStoragePersister = (key: string): Persister => ({
  persistClient: async (client) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(client));
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[query-persist] failed to persist client', error);
      }
    }
  },
  restoreClient: async () => {
    const parsed = safeParse<PersistedClient>(window.localStorage.getItem(key));
    const sanitized = sanitizePersistedClient(parsed);

    if (sanitized && sanitized !== parsed) {
      try {
        window.localStorage.setItem(key, JSON.stringify(sanitized));
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[query-persist] failed to rewrite sanitized cache', error);
        }
      }
    }

    return sanitized;
  },
  removeClient: async () => {
    window.localStorage.removeItem(key);
  },
});

export type QueryPersistenceOptions = {
  storageKey?: string;
  buster?: string;
  maxAge?: number;
};

/**
 * Configure TanStack Query persistence and online detection. Returns a cleanup function.
 */
type PersistPayload = Parameters<typeof persistQueryClient>[0];
type CoreQueryClient = PersistPayload['queryClient'];

export function configureQueryPersistence(
  queryClient: CoreQueryClient | ReactQueryClient,
  options: QueryPersistenceOptions = {},
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const persister = createLocalStoragePersister(options.storageKey ?? STORAGE_KEY);
  const [unsubscribePersistence, restorePromise] = persistQueryClient({
    queryClient: queryClient as CoreQueryClient,
    persister,
    buster: options.buster ?? STORAGE_VERSION,
    maxAge: options.maxAge ?? DEFAULT_MAX_AGE,
    dehydrateOptions: {
      // Avoid persisting transient, in-flight, or opt-out queries to prevent hydration errors.
      shouldDehydrateQuery: (query) => isPersistableQuery(query),
    },
  });

  void restorePromise.catch((error) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[query-persist] failed to restore persisted cache', error);
    }
  });

  const unsubscribe = onlineManager.setEventListener((setOnline) => {
    const listener = () => setOnline(window.navigator.onLine);
    window.addEventListener('online', listener);
    window.addEventListener('offline', listener);
    return () => {
      window.removeEventListener('online', listener);
      window.removeEventListener('offline', listener);
    };
  });

  return () => {
    (unsubscribePersistence as (() => void) | undefined)?.();
    (unsubscribe as (() => void) | undefined)?.();
  };
}
