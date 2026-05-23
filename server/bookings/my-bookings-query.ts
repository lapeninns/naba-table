import { z } from 'zod';

export const myBookingsStatusFilterSchema = z.union([
  z.enum(['pending', 'pending_allocation', 'confirmed', 'cancelled']),
  z.literal('active'),
]);

export const myBookingsQuerySchema = z.object({
  restaurantId: z.string().uuid().optional(),
  me: z.literal('1'),
  status: myBookingsStatusFilterSchema.optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export type MyBookingsQueryParams = z.infer<typeof myBookingsQuerySchema>;

export type MyBookingsQuery = MyBookingsQueryParams & {
  offset: number;
  fromIso?: string;
  toIso?: string;
};

export type MyBookingsQueryParseResult =
  | { ok: true; query: MyBookingsQuery }
  | { ok: false; kind: 'validation'; error: z.ZodError }
  | { ok: false; kind: 'date_range' };

export function getMyBookingsRawQuery(searchParams: URLSearchParams) {
  return {
    me: searchParams.get('me'),
    status: searchParams.get('status') ?? undefined,
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    sort: searchParams.get('sort') ?? undefined,
    page: searchParams.get('page') ?? undefined,
    pageSize: searchParams.get('pageSize') ?? undefined,
    restaurantId: searchParams.get('restaurantId') ?? undefined,
  };
}

export function coerceMyBookingsIsoDateRange(params: Pick<MyBookingsQueryParams, 'from' | 'to'>): {
  fromIso?: string;
  toIso?: string;
} {
  return {
    fromIso: params.from ? toIsoStringOrThrow(params.from) : undefined,
    toIso: params.to ? toIsoStringOrThrow(params.to) : undefined,
  };
}

export function parseMyBookingsQuery(searchParams: URLSearchParams): MyBookingsQueryParseResult {
  const parsed = myBookingsQuerySchema.safeParse(getMyBookingsRawQuery(searchParams));

  if (!parsed.success) {
    return { ok: false, kind: 'validation', error: parsed.error };
  }

  try {
    const dateRange = coerceMyBookingsIsoDateRange(parsed.data);
    const page = parsed.data.page;
    const pageSize = parsed.data.pageSize;

    return {
      ok: true,
      query: {
        ...parsed.data,
        ...dateRange,
        offset: (page - 1) * pageSize,
      },
    };
  } catch {
    return { ok: false, kind: 'date_range' };
  }
}

function toIsoStringOrThrow(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }
  return date.toISOString();
}
