import { createHash } from 'node:crypto';

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

function buildBodyHash(body: unknown): string {
  if (typeof body !== 'string') {
    return '';
  }
  if (body.length === 0) {
    return '';
  }
  // Cap hashing cost.
  const sample = body.length > 2048 ? body.slice(0, 2048) : body;
  return createHash('sha1').update(sample).digest('hex');
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
