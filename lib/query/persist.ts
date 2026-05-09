'use client';

import {
  persistQueryClient,
  type PersistedClient,
  type Persister,
} from '@tanstack/query-persist-client-core';

import type { Query, QueryClient, QueryKey } from '@tanstack/react-query';

const STORAGE_PREFIX = 'query-cache';
const DEFAULT_MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours
const DEFAULT_BUSTER = 'v1';

type ConfigureOptions = {
  storageKey: string;
  maxAge?: number;
  buster?: string;
};

function keyPart(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function isVolatileOpsIntegrationQueryKey(queryKey: QueryKey): boolean {
  const first = keyPart(queryKey[0]);
  if (!first) return false;

  if (
    first === 'dual-sync-state' ||
    first === 'dual-sync-operations' ||
    first === 'dual-sync-publish-jobs' ||
    first === 'dual-sync-publish-job-detail'
  ) {
    return true;
  }

  if (first !== 'ops') {
    return false;
  }

  if (queryKey[1] === 'restaurants' && queryKey[3] === 'google-business-profile') {
    return true;
  }

  if (queryKey[1] === 'food-menus') {
    return true;
  }

  return false;
}

export function shouldPersistQuery(query: Query): boolean {
  if (query.meta?.persist === false) {
    return false;
  }
  return !isVolatileOpsIntegrationQueryKey(query.queryKey);
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createStoragePersister(storageKey: string): Persister | null {
  const storage = getStorage();
  if (!storage) return null;

  return {
    persistClient: async (client) => {
      try {
        storage.setItem(storageKey, JSON.stringify(client));
      } catch {
        // Ignore storage write failures (quota, privacy mode).
      }
    },
    restoreClient: async () => {
      try {
        const cached = storage.getItem(storageKey);
        if (!cached) return undefined;
        return JSON.parse(cached) as PersistedClient;
      } catch {
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        storage.removeItem(storageKey);
      } catch {
        // Ignore storage removal failures.
      }
    },
  };
}

export function buildQueryStorageKey(userId: string | null): string {
  return `${STORAGE_PREFIX}:${userId ?? 'anonymous'}`;
}

export function clearPersistedQueryCache(storageKey: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKey);
  } catch {
    // Ignore storage removal failures.
  }
}

export function configureQueryPersistence(
  queryClient: QueryClient,
  { storageKey, maxAge = DEFAULT_MAX_AGE, buster = DEFAULT_BUSTER }: ConfigureOptions,
): () => void {
  const persister = createStoragePersister(storageKey);
  if (!persister) {
    return () => {};
  }

  const [unsubscribe, restorePromise] = persistQueryClient({
    queryClient,
    persister,
    maxAge,
    buster,
    dehydrateOptions: {
      shouldDehydrateQuery: shouldPersistQuery,
    },
  });

  void restorePromise.catch(() => {});

  return () => {
    unsubscribe();
  };
}
