import { vi } from 'vitest';

type PostgresFilter = {
  event?: string;
  schema?: string;
  table?: string;
  filter?: string;
};

type Handler = {
  type: string;
  filter: PostgresFilter & Record<string, unknown>;
  callback: (payload?: unknown) => void;
};

type SubscribeCallback = (status: string, error?: Error) => void;

export type FakeRealtimeChannel = {
  name: string;
  options: unknown;
  handlers: Handler[];
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  emitStatus: (status: string, error?: Error) => void;
  emitPostgresChange: (table: string, payload?: unknown) => void;
  emitBroadcast: (payload?: unknown) => void;
};

export function createFakeRealtimeChannel(name: string, options?: unknown): FakeRealtimeChannel {
  const handlers: Handler[] = [];
  const subscribeCallbacks: SubscribeCallback[] = [];

  const channel: FakeRealtimeChannel = {
    name,
    options,
    handlers,
    on: vi.fn((type: string, filter: Handler['filter'], callback: Handler['callback']) => {
      handlers.push({ type, filter, callback });
      return channel;
    }),
    subscribe: vi.fn((callback?: SubscribeCallback) => {
      if (callback) subscribeCallbacks.push(callback);
      return channel;
    }),
    unsubscribe: vi.fn(),
    emitStatus: (status, error) => {
      subscribeCallbacks.forEach((callback) => callback(status, error));
    },
    emitPostgresChange: (table, payload) => {
      handlers
        .filter((handler) => handler.type === 'postgres_changes' && handler.filter.table === table)
        .forEach((handler) => handler.callback(payload));
    },
    emitBroadcast: (payload) => {
      handlers
        .filter((handler) => handler.type === 'broadcast')
        .forEach((handler) => handler.callback(payload));
    },
  };

  return channel;
}

export function createFakeRealtimeClient() {
  const channels: FakeRealtimeChannel[] = [];
  return {
    channels,
    channel: vi.fn((name: string, options?: unknown) => {
      const created = createFakeRealtimeChannel(name, options);
      channels.push(created);
      return created;
    }),
    removeChannel: vi.fn(),
  };
}

export type FakeRealtimeClient = ReturnType<typeof createFakeRealtimeClient>;
