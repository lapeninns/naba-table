/**
 * In-page instrumentation for the opt-in restaurant-settings performance spec
 * (`tests/e2e/settings-perf.spec.ts`). Everything here is implementation-agnostic so the same
 * spec measures both the current and an optimised build:
 *
 * - React commits: a minimal `__REACT_DEVTOOLS_GLOBAL_HOOK__` stub installed before React loads.
 *   React DOM calls `onCommitFiberRoot` once per commit; React Refresh (Next dev) wraps the stub
 *   and still forwards to it.
 * - Component renders: for each tracked component the fiber pair (fiber + alternate) is sampled
 *   after every commit. A render produces a brand-new `(memoizedProps, memoizedState)` pair; a
 *   bailout only copies an already-known pair between the two fibers. Limitation: a component
 *   whose props object is reused and that holds no hook state is not detected.
 * - QueryClient instances: distinct `memoizedProps.client` objects (anything with
 *   `getQueryCache()`) found on mounted fibers.
 * - Persister writers: per client, the number of QueryCache listeners whose source mentions
 *   `persistQueryClientSave` (the listener `persistQueryClientSubscribe` installs). Writes to the
 *   `query-cache*` localStorage keys are also attributed to a client by wrapping each client's
 *   `QueryCache#getAll` (called synchronously by `dehydrate` right before an unthrottled
 *   `setItem`); a throttled persister would show up as unattributed writes instead.
 * - Keystroke latency: keydown `event.timeStamp` to the task after the next animation frame
 *   (rAF + MessageChannel), plus Event Timing entries (>= 16 ms threshold).
 * - Long tasks: `PerformanceObserver({ type: 'longtask' })`.
 * - PostHog: count of `[PostHog]` console warnings (the provider warns once per init attempt
 *   when no key is configured) and whether `window.posthog` was set.
 *
 * Nothing recorded here contains guest data, storage values or keys; only sizes and timings.
 */

export type PerfStorageWrite = { t: number; bytes: number; writer: number | null };
export type PerfLongTask = { start: number; duration: number };
export type PerfEventEntry = {
  name: string;
  start: number;
  duration: number;
  interactionId: number;
};

export type PerfScanResult = {
  queryClientCount: number;
  queryClients: Array<{
    index: number;
    queryCount: number;
    cacheListenerCount: number;
    persisterListenerCount: number;
  }>;
  persisterWriterCount: number;
  componentCounts: Record<string, number>;
  posthogWarnings: number;
  posthogGlobalPresent: boolean;
};

export type PerfTrackedRenders = Record<string, number>;

export type PerfPageApi = {
  storageWrites: PerfStorageWrite[];
  longTasks: PerfLongTask[];
  eventEntries: PerfEventEntry[];
  keyLatencies: number[];
  keyTimingActive: boolean;
  commits: number;
  hookInjected: boolean;
  scan: (componentNames: string[]) => PerfScanResult;
  track: (componentNames: string[]) => number;
  trackedRenders: () => PerfTrackedRenders;
  resetTracked: () => void;
};

/**
 * Serialised by Playwright into `page.addInitScript`, so it must be fully self-contained: no
 * imports or outer-scope references.
 */
export function installSettingsPerfInstrumentation(): void {
  type FiberLike = {
    tag: number;
    type: unknown;
    child: FiberLike | null;
    sibling: FiberLike | null;
    return: FiberLike | null;
    alternate: FiberLike | null;
    memoizedProps: unknown;
    memoizedState: unknown;
  };
  type FiberRootLike = { current: FiberLike };
  type QueryCacheLike = {
    getAll: () => unknown[];
    listeners?: Set<unknown>;
  };
  type QueryClientLike = { getQueryCache: () => QueryCacheLike };
  type Pair = { props: unknown; state: unknown };
  type Tracker = {
    name: string;
    fiber: FiberLike;
    root: FiberRootLike;
    known: Pair[];
    renders: number;
  };
  type EventTimingEntry = PerformanceEntry & { interactionId?: number };
  type PerfWindow = Window & {
    __settingsPerf?: PerfPageApi;
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown;
    posthog?: unknown;
  };

  const w = window as PerfWindow;
  if (w.__settingsPerf) return;

  const roots = new Set<FiberRootLike>();
  const clients: QueryClientLike[] = [];
  let trackers: Tracker[] = [];
  let currentWriter: number | null = null;
  let posthogWarnings = 0;

  const fiberName = (type: unknown): string | null => {
    if (typeof type === 'function') {
      const fn = type as { displayName?: string; name?: string };
      return fn.displayName ?? (fn.name || null);
    }
    if (type && typeof type === 'object') {
      const obj = type as { displayName?: string; type?: unknown; render?: unknown };
      if (obj.displayName) return obj.displayName;
      if (obj.type) return fiberName(obj.type);
      if (obj.render) return fiberName(obj.render);
    }
    return null;
  };

  const walk = (root: FiberRootLike, visit: (fiber: FiberLike) => void) => {
    const stack: FiberLike[] = [root.current];
    while (stack.length > 0) {
      const fiber = stack.pop();
      if (!fiber) continue;
      visit(fiber);
      if (fiber.sibling) stack.push(fiber.sibling);
      if (fiber.child) stack.push(fiber.child);
    }
  };

  const pairOf = (fiber: FiberLike | null): Pair | null =>
    fiber ? { props: fiber.memoizedProps, state: fiber.memoizedState } : null;

  const isKnown = (pair: Pair, known: Pair[]) =>
    known.some((candidate) => candidate.props === pair.props && candidate.state === pair.state);

  const updateTrackers = (root: FiberRootLike) => {
    for (const tracker of trackers) {
      if (tracker.root !== root) continue;
      const pairs = [pairOf(tracker.fiber), pairOf(tracker.fiber.alternate)].filter(
        (pair): pair is Pair => pair !== null,
      );
      if (pairs.some((pair) => !isKnown(pair, tracker.known))) {
        tracker.renders += 1;
      }
      tracker.known = pairs;
    }
  };

  const api: PerfPageApi = {
    storageWrites: [],
    longTasks: [],
    eventEntries: [],
    keyLatencies: [],
    keyTimingActive: false,
    commits: 0,
    hookInjected: false,
    scan: (componentNames) => {
      const componentCounts: Record<string, number> = {};
      for (const name of componentNames) componentCounts[name] = 0;
      for (const root of roots) {
        walk(root, (fiber) => {
          const name = fiberName(fiber.type);
          if (name && name in componentCounts) componentCounts[name] += 1;
          const props = fiber.memoizedProps;
          if (props && typeof props === 'object' && 'client' in props) {
            const client = (props as { client: unknown }).client;
            if (
              client &&
              typeof client === 'object' &&
              typeof (client as QueryClientLike).getQueryCache === 'function' &&
              !clients.includes(client as QueryClientLike)
            ) {
              clients.push(client as QueryClientLike);
            }
          }
        });
      }

      const queryClients = clients.map((client, index) => {
        const cache = client.getQueryCache();
        const listeners = cache.listeners instanceof Set ? [...cache.listeners] : [];
        const persisterListenerCount = listeners.filter(
          (listener) =>
            typeof listener === 'function' &&
            Function.prototype.toString.call(listener).includes('persistQueryClientSave'),
        ).length;
        const marker = cache as QueryCacheLike & { __perfWrapped?: boolean };
        if (!marker.__perfWrapped) {
          const originalGetAll = cache.getAll;
          cache.getAll = function wrappedGetAll(this: QueryCacheLike) {
            currentWriter = index;
            queueMicrotask(() => {
              currentWriter = null;
            });
            return originalGetAll.call(this);
          };
          marker.__perfWrapped = true;
        }
        return {
          index,
          queryCount: originalCount(cache),
          cacheListenerCount: listeners.length,
          persisterListenerCount,
        };
      });

      return {
        queryClientCount: clients.length,
        queryClients,
        persisterWriterCount: queryClients.filter((client) => client.persisterListenerCount > 0)
          .length,
        componentCounts,
        posthogWarnings,
        posthogGlobalPresent: typeof w.posthog !== 'undefined',
      };
    },
    track: (componentNames) => {
      trackers = [];
      for (const root of roots) {
        walk(root, (fiber) => {
          const name = fiberName(fiber.type);
          if (!name || !componentNames.includes(name)) return;
          // Skip the stale twin of a fiber that is already tracked.
          if (trackers.some((tracker) => tracker.fiber === fiber.alternate)) return;
          const known = [pairOf(fiber), pairOf(fiber.alternate)].filter(
            (pair): pair is Pair => pair !== null,
          );
          trackers.push({ name, fiber, root, known, renders: 0 });
        });
      }
      return trackers.length;
    },
    trackedRenders: () => {
      const result: PerfTrackedRenders = {};
      for (const tracker of trackers) {
        result[tracker.name] = Math.max(result[tracker.name] ?? 0, tracker.renders);
      }
      return result;
    },
    resetTracked: () => {
      for (const tracker of trackers) tracker.renders = 0;
    },
  };

  function originalCount(cache: QueryCacheLike): number {
    const saved = currentWriter;
    const count = cache.getAll().length;
    currentWriter = saved;
    return count;
  }

  w.__settingsPerf = api;

  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function patchedSetItem(this: Storage, key: string, value: string) {
    if (String(key).startsWith('query-cache')) {
      api.storageWrites.push({
        t: performance.now(),
        bytes: String(value).length,
        writer: currentWriter,
      });
    }
    return originalSetItem.call(this, key, value);
  };

  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith('[PostHog]')) posthogWarnings += 1;
    originalWarn(...args);
  };

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        api.longTasks.push({ start: entry.startTime, duration: entry.duration });
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    // Long Task API unavailable.
  }

  try {
    const eventOptions: PerformanceObserverInit & { durationThreshold: number } = {
      type: 'event',
      buffered: true,
      durationThreshold: 16,
    };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const timing = entry as EventTimingEntry;
        api.eventEntries.push({
          name: timing.name,
          start: timing.startTime,
          duration: timing.duration,
          interactionId: timing.interactionId ?? 0,
        });
      }
    }).observe(eventOptions);
  } catch {
    // Event Timing API unavailable.
  }

  document.addEventListener(
    'keydown',
    (event) => {
      if (!api.keyTimingActive) return;
      const start = event.timeStamp;
      requestAnimationFrame(() => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          api.keyLatencies.push(performance.now() - start);
        };
        channel.port2.postMessage(null);
      });
    },
    { capture: true },
  );

  const renderers = new Map<number, unknown>();
  let nextRendererId = 1;
  w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers,
    supportsFiber: true,
    isDisabled: false,
    inject(renderer: unknown) {
      const id = nextRendererId;
      nextRendererId += 1;
      renderers.set(id, renderer);
      api.hookInjected = true;
      return id;
    },
    onScheduleFiberRoot() {},
    onCommitFiberRoot(_rendererId: number, root: FiberRootLike) {
      api.commits += 1;
      roots.add(root);
      if (trackers.length > 0) updateTrackers(root);
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
  };
}
