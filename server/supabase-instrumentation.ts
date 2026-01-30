import { logger } from '@/lib/logger';

type SeenEntry = {
  firstSeenMs: number;
  count: number;
};

const supabaseInstrumentationLogger = logger.child({ module: 'supabase', feature: 'n_plus_one' });

// Heuristic N+1 detector: if the same request signature repeats many times
// within a short window, emit a warning.
const WINDOW_MS = 5000;
const REPEAT_THRESHOLD = 25;
const seen = new Map<string, SeenEntry>();
const HASH_SAMPLE_LIMIT = 2048;
const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;
const PRUNE_INTERVAL_MS = 1000;
const MAX_TRACKED_SIGNATURES = 2000;
let lastPruneMs = 0;

function nowMs(): number {
  return Date.now();
}

function normalizeUrl(raw: string): string {
  // Avoid exploding cardinality on signed URLs by trimming common volatile query params.
  // Keep this conservative.
  try {
    const url = new URL(raw);
    for (const key of ['token', 'access_token', 'expires', 'signature']) {
      url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return raw;
  }
}

function fnv1aHash(value: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function buildBodyHash(body: unknown): string {
  if (typeof body !== 'string') {
    return '';
  }
  if (body.length === 0) {
    return '';
  }
  // Cap hashing cost.
  const sample = body.length > HASH_SAMPLE_LIMIT ? body.slice(0, HASH_SAMPLE_LIMIT) : body;
  return fnv1aHash(sample);
}

function pruneSeenEntries(now: number): void {
  if (seen.size === 0) {
    return;
  }

  if (now - lastPruneMs < PRUNE_INTERVAL_MS && seen.size <= MAX_TRACKED_SIGNATURES) {
    return;
  }

  lastPruneMs = now;

  for (const [signature, entry] of seen) {
    if (now - entry.firstSeenMs > WINDOW_MS) {
      seen.delete(signature);
    }
  }

  if (seen.size <= MAX_TRACKED_SIGNATURES) {
    return;
  }

  for (const signature of seen.keys()) {
    if (seen.size <= MAX_TRACKED_SIGNATURES) {
      break;
    }
    seen.delete(signature);
  }
}

function requestSignature(input: RequestInfo | URL, init?: RequestInit): string {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
  const normalizedUrl = normalizeUrl(url);
  const bodyHash = buildBodyHash(init?.body);
  return bodyHash ? `${method} ${normalizedUrl} body=${bodyHash}` : `${method} ${normalizedUrl}`;
}

function recordSignature(signature: string): void {
  const ts = nowMs();
  pruneSeenEntries(ts);
  const current = seen.get(signature);

  if (!current || ts - current.firstSeenMs > WINDOW_MS) {
    seen.set(signature, { firstSeenMs: ts, count: 1 });
    return;
  }

  current.count += 1;
  if (current.count === REPEAT_THRESHOLD) {
    supabaseInstrumentationLogger.warn('possible N+1 query pattern (repeated Supabase request)', {
      signature,
      windowMs: WINDOW_MS,
      repeats: current.count,
    });
  }
}

export const instrumentedSupabaseFetch: typeof fetch = async (input, init) => {
  try {
    recordSignature(requestSignature(input, init));
  } catch {
    // Best-effort only.
  }
  return fetch(input, init);
};
