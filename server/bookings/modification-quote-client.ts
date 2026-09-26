/**
 * Read overlay for quoting a booking modification before it is written.
 *
 * `quoteTablesForBooking` loads the booking row by id to decide the window and
 * party size it plans for. A modification must select its new tables BEFORE the
 * booking row changes (otherwise a failed search has already released the old
 * tables). This wraps a Supabase client so that every `bookings` row with the
 * target id that the planner reads carries the proposed values. Nothing is
 * written through the overlay: holds and other writes go to the real client, and
 * the hold admission RPC checks conflicts against committed data.
 *
 * The overlay only touches the result objects of `from('bookings')` queries. All
 * other tables, RPCs and query-builder methods pass through unchanged.
 */

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function overlayRow(row: unknown, bookingId: string, overlay: AnyRecord): unknown {
  if (isRecord(row) && row.id === bookingId) {
    return { ...row, ...overlay };
  }
  return row;
}

function overlayResult(result: unknown, bookingId: string, overlay: AnyRecord): unknown {
  if (!isRecord(result) || !('data' in result)) {
    return result;
  }
  const { data } = result;
  if (Array.isArray(data)) {
    return { ...result, data: data.map((row) => overlayRow(row, bookingId, overlay)) };
  }
  return { ...result, data: overlayRow(data, bookingId, overlay) };
}

function isThenable(value: unknown): value is PromiseLike<unknown> & object {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

function wrapQuery<T extends object>(query: T, bookingId: string, overlay: AnyRecord): T {
  return new Proxy(query, {
    get(target, property) {
      if (property === 'then') {
        if (!isThenable(target)) {
          return undefined;
        }
        return (
          onFulfilled?: ((value: unknown) => unknown) | null,
          onRejected?: ((reason: unknown) => unknown) | null,
        ) =>
          (target as unknown as PromiseLike<unknown>).then((value) => {
            const patched = overlayResult(value, bookingId, overlay);
            return onFulfilled ? onFulfilled(patched) : patched;
          }, onRejected ?? undefined);
      }
      const value: unknown = Reflect.get(target, property, target);
      if (typeof value !== 'function') {
        return value;
      }
      return (...args: unknown[]) => {
        const next: unknown = (value as (...fnArgs: unknown[]) => unknown).apply(target, args);
        return isThenable(next) ? wrapQuery(next, bookingId, overlay) : next;
      };
    },
  });
}

export function withBookingReadOverlay<C extends { from: (...args: never[]) => unknown }>(
  client: C,
  bookingId: string,
  overlay: AnyRecord,
): C {
  return new Proxy(client, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property, target);
      if (property === 'from' && typeof value === 'function') {
        return (...args: unknown[]) => {
          const query: unknown = (value as (...fnArgs: unknown[]) => unknown).apply(target, args);
          if (args[0] === 'bookings' && typeof query === 'object' && query !== null) {
            return wrapQuery(query, bookingId, overlay);
          }
          return query;
        };
      }
      return typeof value === 'function' ? (value as () => unknown).bind(target) : value;
    },
  });
}
