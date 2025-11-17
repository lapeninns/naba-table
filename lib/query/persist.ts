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
  restoreClient: async () => safeParse<PersistedClient>(window.localStorage.getItem(key)),
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

  void persistQueryClient({
    queryClient: queryClient as CoreQueryClient,
    persister,
    buster: options.buster ?? STORAGE_VERSION,
    maxAge: options.maxAge ?? DEFAULT_MAX_AGE,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        // Avoid persisting transient/pending queries to prevent hydration errors.
        if (query.state.status === 'pending') return false;
        return query.meta?.persist !== false;
      },
    },
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
    (unsubscribe as (() => void) | undefined)?.();
  };
}
