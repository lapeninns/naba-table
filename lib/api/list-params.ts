export type ListParams = {
  page: number;
  limit: number;
  offset: number;
  sortBy?: string;
  order: 'asc' | 'desc';
  q?: string;
  filter?: unknown;
  fields?: unknown;
  include?: unknown;
  expand?: unknown;
};

function parseIntSafe(value: string | null | undefined, fallback: number): number {
  const n = parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function parseListParamsFromUrl(url: URL, options?: { defaultLimit?: number; maxLimit?: number }): ListParams {
  const defaultLimit = Math.max(1, options?.defaultLimit ?? 50);
  const maxLimit = Math.max(defaultLimit, options?.maxLimit ?? 100);

  const page = Math.max(1, parseIntSafe(url.searchParams.get('page'), 1));
  // Support `limit` and compatibility key `pageSize`
  const limitRaw = url.searchParams.get('limit') ?? url.searchParams.get('pageSize');
  const limitParsed = Math.max(1, parseIntSafe(limitRaw, defaultLimit));
  const limit = Math.min(limitParsed, maxLimit);
  const offset = url.searchParams.get('offset')
    ? Math.max(0, parseIntSafe(url.searchParams.get('offset'), 0))
    : (page - 1) * limit;
  const sortBy = typeof url.searchParams.get('sortBy') === 'string' ? url.searchParams.get('sortBy') ?? undefined : undefined;
  const orderParam = (url.searchParams.get('order') ?? 'asc').toLowerCase();
  const order: 'asc' | 'desc' = orderParam === 'desc' ? 'desc' : 'asc';
  const q = url.searchParams.get('q') ?? url.searchParams.get('search') ?? undefined;

  const filter = url.searchParams.get('filter') ?? undefined;
  const fields = url.searchParams.get('fields') ?? undefined;
  const include = url.searchParams.get('include') ?? undefined;
  const expand = url.searchParams.get('expand') ?? undefined;

  return { page, limit, offset, sortBy, order, q, filter, fields, include, expand };
}

