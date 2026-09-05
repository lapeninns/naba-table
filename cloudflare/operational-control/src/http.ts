import { PLACEHOLDER_PATTERN } from './contracts';

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

export function timingSafeEqualStrings(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  // Compare against self on length mismatch to keep the loop cost independent of the input.
  const other = a.length === b.length ? b : a;
  let diff = a.length === b.length ? 0 : 1;
  for (let index = 0; index < a.length; index += 1) {
    diff |= (a[index] ?? 0) ^ (other[index] ?? 0);
  }
  return diff === 0;
}

export function isBearerAuthorized(request: Request, expectedToken: string | undefined): boolean {
  if (!expectedToken || expectedToken.length < 16 || PLACEHOLDER_PATTERN.test(expectedToken)) {
    return false;
  }
  const supplied = getBearerToken(request);
  if (!supplied) return false;
  return timingSafeEqualStrings(supplied, expectedToken);
}

export async function readBoundedBody(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; reason: 'too_large' | 'unreadable' }> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, reason: 'too_large' };
  try {
    const buffer = await request.arrayBuffer();
    if (buffer.byteLength > maxBytes) return { ok: false, reason: 'too_large' };
    return { ok: true, bytes: new Uint8Array(buffer) };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}

export function parseJsonBytes(bytes: Uint8Array): unknown | undefined {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes));
  } catch {
    return undefined;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms.`)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
