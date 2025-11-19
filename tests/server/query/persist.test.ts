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

  it('drops pending queries from persisted cache before hydrating', async () => {
    const seedClient = createSilentClient();
    const queryKey = ['reservations', 'schedule', 'white-horse', '2025-11-18'] as const;

    seedClient.setQueryData(queryKey, { slots: [] });
    const persistedState = dehydrate(seedClient);

    const pendingQuery = persistedState.queries[0];
    if (pendingQuery) {
      pendingQuery.state.status = 'pending';
      pendingQuery.state.fetchStatus = 'fetching';
      pendingQuery.state.data = undefined;
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

    const restored = queryClient.getQueryCache().find({ queryKey });
    expect(restored).toBeUndefined();

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.clientState?.queries ?? []).toHaveLength(0);

    cleanup();
  });
});
