/**
 * App-wide TanStack Query `meta` shapes (contract C3). Registering them types `meta` on every
 * `useQuery`/`useMutation` call and on `query.meta`/`mutation.meta` in the caches.
 */

/** Copy for the global error toast, resolved by `toUserMessage`. */
export type MutationErrorFeedback = {
  /** Per error code copy, e.g. `{ BOOKING_STATE_CONFLICT: 'Someone else updated this booking.' }`. */
  copy?: Partial<Record<string, string>>;
  /** Shown when neither the code copy nor a safe 4xx server message applies. */
  fallback?: string;
};

export type MutationFeedback = {
  /**
   * Success toast text. A function receives the mutation data and variables; returning `null`
   * (or an empty string) skips the toast. Omit it for no success toast.
   */
  success?: string | ((data: unknown, variables: unknown) => string | null);
  /**
   * Error toast. Omitted: `toUserMessage(error)`. `false`: no toast, the call site shows the
   * error inline. A string: that exact text. An object: `toUserMessage(error, { copy, fallback })`.
   */
  error?: false | string | MutationErrorFeedback;
};

export type AppMutationMeta = {
  /** Opt-in: the global MutationCache shows one toast per settled mutation only when set. */
  feedback?: MutationFeedback;
  /**
   * Legacy marker on PII-carrying booking mutations. Mutations are never persisted
   * (lib/query/persist.ts), so it has no effect; kept so existing call sites stay typed.
   */
  persist?: boolean;
};

export type AppQueryMeta = Record<string, unknown> & {
  /** `false` keeps the query out of the localStorage cache (see lib/query/persist.ts). */
  persist?: boolean;
};

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: AppMutationMeta;
    queryMeta: AppQueryMeta;
  }
}
