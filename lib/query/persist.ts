'use client';

import {
  persistQueryClientRestore,
  type PersistedClient,
  type Persister,
} from '@tanstack/query-persist-client-core';
import { dehydrate } from '@tanstack/react-query';

import type { DehydratedState, Query, QueryClient, QueryKey } from '@tanstack/react-query';

const STORAGE_PREFIX = 'query-cache';
const DEFAULT_MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours
const DEFAULT_BUSTER = 'v1';
/** Trailing throttle window: at most one localStorage write per window. */
export const PERSIST_THROTTLE_MS = 1000;

const PERSISTED_CACHE_EVENTS: ReadonlySet<string> = new Set(['added', 'removed', 'updated']);

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

  if (queryKey[1] === 'sms-delivery') {
    return true;
  }

  if (queryKey[1] === 'bookings' && queryKey[3] === 'sms-delivery') {
    return true;
  }

  return false;
}

/**
 * Query families that carry staff, invitee or customer PII (or email templates) and must
 * never be written to localStorage. Their hooks also set `meta.persist: false`, but route
 * prefetchers (lib/prefetchers.ts, ops-shell/useOpsRoutePrefetch.ts) insert the same keys
 * without meta, so the key itself has to be denied.
 */
export function isPiiQueryKey(queryKey: QueryKey): boolean {
  const first = keyPart(queryKey[0]);

  // ['team', 'invitations', restaurantId, status]: invitee emails.
  if (first === 'team') {
    return queryKey[1] === 'invitations';
  }

  if (first !== 'ops') {
    return false;
  }

  // ['ops', 'customers', ...]: customer names, emails and phones.
  if (queryKey[1] === 'customers') {
    return true;
  }

  if (queryKey[1] === 'restaurants') {
    // ['ops', 'restaurants', 'detail', id]: manager name/phone, contact email/phone.
    if (queryKey[2] === 'detail') return true;
    // ['ops', 'restaurants', id, 'email-templates'].
    if (queryKey[3] === 'email-templates') return true;
  }

  return false;
}

export function shouldPersistQuery(query: Query): boolean {
  if (query.meta?.persist === false) {
    return false;
  }
  return !isVolatileOpsIntegrationQueryKey(query.queryKey) && !isPiiQueryKey(query.queryKey);
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createStoragePersister(storage: Storage, storageKey: string): Persister {
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

type ThrottledCacheWriter = {
  /** Schedule a trailing write unless one is already pending. */
  schedule: () => void;
  /** Write a pending change immediately (used when the page is being hidden or unloaded). */
  flush: () => void;
  /** Drop any pending write and forget the last written state. */
  cancel: () => void;
};

/**
 * Serialises the persistable cache at most once per {@link PERSIST_THROTTLE_MS} and skips
 * writes whose client state is identical to the last one written. Dehydration and
 * serialisation happen only when the trailing timer fires, not on every cache event.
 */
function createThrottledCacheWriter(
  queryClient: QueryClient,
  storage: Storage,
  storageKey: string,
  buster: string,
): ThrottledCacheWriter {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastClientState: string | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const write = () => {
    clearTimer();
    let clientState: DehydratedState;
    let comparable: string;
    try {
      clientState = dehydrate(queryClient, { shouldDehydrateQuery: shouldPersistQuery });
      // `dehydratedAt` is stamped with Date.now() on every dehydrate, so ignore it when
      // deciding whether anything worth persisting has changed.
      comparable = JSON.stringify({
        ...clientState,
        queries: clientState.queries.map((query) => ({ ...query, dehydratedAt: 0 })),
      });
    } catch {
      return;
    }
    if (comparable === lastClientState) {
      return;
    }
    const persistedClient: PersistedClient = { buster, timestamp: Date.now(), clientState };
    try {
      storage.setItem(storageKey, JSON.stringify(persistedClient));
      lastClientState = comparable;
    } catch {
      // Ignore storage write failures (quota, privacy mode).
    }
  };

  return {
    schedule: () => {
      if (timer === null) {
        timer = setTimeout(write, PERSIST_THROTTLE_MS);
      }
    },
    flush: () => {
      if (timer !== null) {
        write();
      }
    },
    cancel: () => {
      clearTimer();
      lastClientState = null;
    },
  };
}

const activeWriters = new Map<string, Set<ThrottledCacheWriter>>();

function registerWriter(storageKey: string, writer: ThrottledCacheWriter): () => void {
  const writers = activeWriters.get(storageKey) ?? new Set<ThrottledCacheWriter>();
  writers.add(writer);
  activeWriters.set(storageKey, writers);
  return () => {
    writers.delete(writer);
    if (writers.size === 0) {
      activeWriters.delete(storageKey);
    }
  };
}

export function buildQueryStorageKey(userId: string | null): string {
  return `${STORAGE_PREFIX}:${userId ?? 'anonymous'}`;
}

export function clearPersistedQueryCache(storageKey: string): void {
  // A pending throttled write must never resurrect a key that is being cleared.
  activeWriters.get(storageKey)?.forEach((writer) => writer.cancel());
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
  const storage = getStorage();
  if (!storage) {
    return () => {};
  }

  const persister = createStoragePersister(storage, storageKey);

  const writer = createThrottledCacheWriter(queryClient, storage, storageKey, buster);
  const unregisterWriter = registerWriter(storageKey, writer);
  let disposed = false;
  let detach: (() => void) | null = null;

  const subscribe = () => {
    const onCacheEvent = (event: { type: string }) => {
      if (PERSISTED_CACHE_EVENTS.has(event.type)) {
        writer.schedule();
      }
    };
    const onPageHide = () => writer.flush();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        writer.flush();
      }
    };

    const unsubscribeQueries = queryClient.getQueryCache().subscribe(onCacheEvent);
    const unsubscribeMutations = queryClient.getMutationCache().subscribe(onCacheEvent);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      unsubscribeQueries();
      unsubscribeMutations();
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  };

  // Mirror persistQueryClient: restore first, then start persisting cache changes.
  void persistQueryClientRestore({ queryClient, persister, maxAge, buster })
    .then(() => {
      if (!disposed) {
        detach = subscribe();
      }
    })
    .catch(() => {});

  return () => {
    disposed = true;
    writer.cancel();
    detach?.();
    detach = null;
    unregisterWriter();
  };
}
