export const queryKeys = {
  bookings: {
    all: ['bookings'] as const,
    list: (params: Record<string, unknown> = {}) => ['bookings', 'list', params] as const,
    detail: (id: string) => ['bookings', 'detail', id] as const,
  },
};

export type QueryKey = ReturnType<(typeof queryKeys)['bookings']['list']> | ReturnType<(typeof queryKeys)['bookings']['detail']>;
