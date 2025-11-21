import { QueryClient, dehydrate } from '@tanstack/react-query';

import { configureQueryPersistence } from '@/lib/query/persist';

const STORAGE_KEY = 'query-persist-test-cache';

const createSilentClient = () =>
  new QueryClient({
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  });

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('configureQueryPersistence', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('drops unsafe queries (pending, non-idle, or persist=false) before hydrating', async () => {
    const seedClient = createSilentClient();
    const safeKey = ['reservations', 'schedule', 'white-horse', '2025-11-18'] as const;
    const pendingKey = ['reservations', 'schedule', 'white-horse', '2025-11-19'] as const;
    const inflightKey = ['reservations', 'schedule', 'white-horse', '2025-11-20'] as const;
    const noPersistKey = ['reservations', 'schedule', 'white-horse', '2025-11-21'] as const;

    seedClient.setQueryData(safeKey, { slots: [] });
    seedClient.setQueryData(pendingKey, { slots: [] });
    seedClient.setQueryData(inflightKey, { slots: [] });
    seedClient.setQueryData(noPersistKey, { slots: [] });

    const persistedState = dehydrate(seedClient);

    const findQuery = (key: readonly unknown[]) =>
      persistedState.queries.find(
        (query) => JSON.stringify(query.queryKey) === JSON.stringify(key),
      );

    const pendingQuery = findQuery(pendingKey);
    const inflightQuery = findQuery(inflightKey);
    const persistDisabledQuery = findQuery(noPersistKey);

    if (pendingQuery) {
      pendingQuery.state.status = 'pending';
      pendingQuery.state.fetchStatus = 'fetching';
      pendingQuery.state.data = undefined;
    }

    if (inflightQuery) {
      inflightQuery.state.fetchStatus = 'fetching';
    }

    if (persistDisabledQuery) {
      persistDisabledQuery.meta = { persist: false };
    }

    const persistedClient = {
      buster: 'test-buster',
      timestamp: Date.now(),
      clientState: persistedState,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedClient));

    const queryClient = createSilentClient();
    const cleanup = configureQueryPersistence(queryClient, {
      storageKey: STORAGE_KEY,
      buster: 'test-buster',
    });

    await flushPromises();

    const restoredSafe = queryClient.getQueryCache().find({ queryKey: safeKey });
    const restoredPending = queryClient.getQueryCache().find({ queryKey: pendingKey });
    const restoredInflight = queryClient.getQueryCache().find({ queryKey: inflightKey });
    const restoredNoPersist = queryClient.getQueryCache().find({ queryKey: noPersistKey });

    expect(restoredSafe).toBeDefined();
    expect(restoredPending).toBeUndefined();
    expect(restoredInflight).toBeUndefined();
    expect(restoredNoPersist).toBeUndefined();

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.clientState?.queries ?? []).toHaveLength(1);

    cleanup();
  });
});
