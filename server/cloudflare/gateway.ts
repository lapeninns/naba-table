import { env } from '@/lib/env';

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

export function isCloudflareGatewayConfigured(): boolean {
  return Boolean(env.cloudflare.emailQueueGatewayUrl && env.cloudflare.emailQueueGatewayToken);
}

export function getCloudflareGatewayConfig(): { url: string; token: string } {
  const url = env.cloudflare.emailQueueGatewayUrl;
  const token = env.cloudflare.emailQueueGatewayToken;

  if (!url || !token) {
    throw new Error(
      'Cloudflare gateway is not configured. Set CLOUDFLARE_EMAIL_QUEUE_GATEWAY_URL and CLOUDFLARE_EMAIL_QUEUE_GATEWAY_TOKEN.',
    );
  }

  return {
    url: url.replace(/\/+$/, ''),
    token,
  };
}

function createAbortSignal(timeoutMs: number): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return AbortSignal.timeout(timeoutMs);
  }
  return undefined;
}

export async function requestCloudflareGateway<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ response: Response; body: T | null }> {
  const { url, token } = getCloudflareGatewayConfig();
  const timeoutMs = init.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const headers = new Headers(init.headers);

  headers.set('authorization', `Bearer ${token}`);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(`${url}${path}`, {
    ...init,
    headers,
    signal: init.signal ?? createAbortSignal(timeoutMs),
  });

  const raw = await response.text();
  if (!raw) {
    return { response, body: null };
  }

  try {
    return { response, body: JSON.parse(raw) as T };
  } catch {
    return { response, body: null };
  }
}

export function extractCloudflareGatewayError(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') {
    return fallback;
  }

  const candidate = body as { error?: unknown; message?: unknown };
  if (typeof candidate.error === 'string' && candidate.error.trim().length > 0) {
    return candidate.error;
  }
  if (typeof candidate.message === 'string' && candidate.message.trim().length > 0) {
    return candidate.message;
  }
  return fallback;
}
