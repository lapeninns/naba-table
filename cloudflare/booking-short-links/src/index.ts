import { createCircuitBreaker } from './circuit-breaker';
import { SERVICE_NAME, type CreateShortLinkRequest, type ShortLinkRecord } from './contracts';
import {
  createBookingShortLink,
  parseAllowedHosts,
  parseAllowedReviewHosts,
  resolveBookingShortLink,
  validateShortLinkRequest,
} from './core';
import { createShortLinkRepository } from './storage';
import { observeWorkerRequest, writeStructuredLog } from '../../shared/observability';
import {
  createD1Probe,
  createKvProbe,
  handleReadinessRequest,
  isReadinessRequest,
} from '../../shared/readiness';

type WorkerEnv = {
  BOOKING_SHORT_LINKS_DB: {
    prepare: (query: string) => {
      bind: (...args: unknown[]) => {
        first: <T>() => Promise<T | null>;
        run: () => Promise<unknown>;
      };
    };
  };
  BOOKING_SHORT_LINKS_CACHE?: {
    get: (key: string, type: 'json') => Promise<ShortLinkRecord | null>;
    put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
  };
  INTERNAL_LINKS_TOKEN: string;
  SHORT_LINKS_PUBLIC_BASE_URL: string;
  BOOKING_SITE_URL: string;
  ALLOWED_DESTINATION_HOSTS?: string;
  ALLOWED_REVIEW_DESTINATION_HOSTS?: string;
  DEPLOY_SHA?: string;
  ERROR_INSIGHT_TOKEN?: string;
  ERROR_INSIGHT_WEBHOOK_URL?: string;
  REVIEW_TRACKING_WEBHOOK_URL?: string;
  POSTHOG_PROJECT_API_KEY?: string;
  POSTHOG_HOST?: string;
  CF_VERSION_METADATA?: { id: string; tag: string; timestamp: string };
  MONITORING_TOKEN?: string;
};

const storageCircuitBreaker = createCircuitBreaker({
  failureThreshold: 5,
  cooldownMs: 30_000,
  timeoutMs: 2_000,
});

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length).trim() || null;
}

function isAuthorized(request: Request, expectedToken: string): boolean {
  return Boolean(expectedToken) && getBearerToken(request) === expectedToken;
}

function buildRecoverErrorRedirect(baseUrl: string, code: string): string {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/bookings/recover/error`);
  url.searchParams.set('code', code);
  return url.toString();
}

function isOpaqueToken(value: string): boolean {
  return /^[0-9A-Za-z]{8,24}$/.test(value);
}

async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

async function notifyReviewAccess(
  env: WorkerEnv,
  record: ShortLinkRecord,
  accessEventId: string,
): Promise<void> {
  if (
    !env.REVIEW_TRACKING_WEBHOOK_URL ||
    !env.INTERNAL_LINKS_TOKEN ||
    !record.bookingId ||
    !record.restaurantId
  ) {
    return;
  }
  const response = await fetch(env.REVIEW_TRACKING_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.INTERNAL_LINKS_TOKEN}`,
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      eventId: accessEventId,
      bookingId: record.bookingId,
      restaurantId: record.restaurantId,
      channel: record.createdBy === 'guest_review_email' ? 'email' : 'whatsapp',
      occurredAt: new Date().toISOString(),
    }),
  });
  if (!response.ok) {
    throw new Error(`Review tracking webhook returned ${response.status}.`);
  }
}

async function handleRequest(
  request: Request,
  env: WorkerEnv,
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<Response> {
  const url = new URL(request.url);
  const repository = createShortLinkRepository({
    db: env.BOOKING_SHORT_LINKS_DB,
    cache: env.BOOKING_SHORT_LINKS_CACHE,
  });

  if (request.method === 'GET' && url.pathname === '/health') {
    return json({
      status: 'ok',
      service: SERVICE_NAME,
    });
  }

  if (isReadinessRequest(request)) {
    return handleReadinessRequest({
      request,
      env,
      service: SERVICE_NAME,
      probes: [
        createD1Probe(env.BOOKING_SHORT_LINKS_DB, { name: 'd1' }),
        createKvProbe(env.BOOKING_SHORT_LINKS_CACHE, { name: 'kv-cache' }),
      ],
    });
  }

  if (request.method === 'POST' && url.pathname === '/internal/booking-links') {
    if (!isAuthorized(request, env.INTERNAL_LINKS_TOKEN)) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await readJsonBody<CreateShortLinkRequest>(request);
    if (!body) {
      return json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const allowedHosts = parseAllowedHosts(env.ALLOWED_DESTINATION_HOSTS);
    const allowedReviewHosts = parseAllowedReviewHosts(env.ALLOWED_REVIEW_DESTINATION_HOSTS);
    const validation = validateShortLinkRequest(body, allowedHosts, allowedReviewHosts);
    if (!validation.ok) {
      return json({ error: validation.error }, { status: 400 });
    }

    try {
      const result = await storageCircuitBreaker.execute(() =>
        createBookingShortLink({
          repository,
          request: {
            ...body,
            destinationUrl: validation.destinationUrl.toString(),
          },
          shortBaseUrl: env.SHORT_LINKS_PUBLIC_BASE_URL,
        }),
      );

      writeStructuredLog({
        level: 'info',
        event: 'product.booking_short_link.created',
        service: SERVICE_NAME,
        fields: { purpose: body.purpose, createdBy: body.createdBy },
      });

      return json(result, { status: 201 });
    } catch (error) {
      writeStructuredLog({
        level: 'error',
        event: 'booking_short_link.create_failed',
        service: SERVICE_NAME,
        fields: {
          bookingId: body.bookingId,
          createdBy: body.createdBy,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      return json({ error: 'Failed to create short link.' }, { status: 500 });
    }
  }

  if (request.method === 'GET' && url.pathname.startsWith('/m/')) {
    const token = url.pathname.slice('/m/'.length).trim();
    if (!token) {
      return Response.redirect(
        buildRecoverErrorRedirect(env.BOOKING_SITE_URL, 'INVALID_ACCESS_TOKEN'),
        302,
      );
    }

    const result = await storageCircuitBreaker.execute(() =>
      resolveBookingShortLink({
        repository,
        token,
        purpose: 'booking_manage',
      }),
    );

    if (result.status === 'redirect') {
      return Response.redirect(result.record.destinationUrl, 302);
    }

    const code = result.status === 'expired' ? 'INVALID_ACCESS_TOKEN' : 'INVALID_ACCESS_TOKEN';
    return Response.redirect(buildRecoverErrorRedirect(env.BOOKING_SITE_URL, code), 302);
  }

  if (request.method === 'GET' && url.pathname.startsWith('/r/')) {
    const token = url.pathname.slice('/r/'.length).trim();
    if (!isOpaqueToken(token)) {
      return json({ error: 'Not found' }, { status: 404 });
    }

    const result = await storageCircuitBreaker.execute(() =>
      resolveBookingShortLink({ repository, token, purpose: 'review' }),
    );
    if (result.status !== 'redirect') {
      return json({ error: 'Not found' }, { status: 404 });
    }

    const tracking = notifyReviewAccess(env, result.record, result.accessEventId).catch((error) => {
      writeStructuredLog({
        level: 'error',
        event: 'booking_short_link.review_tracking_failed',
        service: SERVICE_NAME,
        fields: { error: error instanceof Error ? error.message : String(error) },
      });
    });
    if (waitUntil) waitUntil(tracking);
    else await tracking;

    return Response.redirect(result.record.destinationUrl, 302);
  }

  if (request.method === 'GET' && url.pathname === '/') {
    return json({
      service: SERVICE_NAME,
      status: 'ok',
    });
  }

  return json({ error: 'Not found' }, { status: 404 });
}

const worker = {
  async fetch(request: Request, env: WorkerEnv, ctx?: ExecutionContext): Promise<Response> {
    const waitUntil = (promise: Promise<unknown>): void => ctx?.waitUntil(promise);

    return observeWorkerRequest({
      request,
      service: SERVICE_NAME,
      deploySha: env.DEPLOY_SHA ?? env.CF_VERSION_METADATA?.id,
      errorInsight: {
        url: env.ERROR_INSIGHT_WEBHOOK_URL,
        token: env.ERROR_INSIGHT_TOKEN,
        waitUntil,
      },
      posthog: {
        apiKey: env.POSTHOG_PROJECT_API_KEY,
        host: env.POSTHOG_HOST,
        waitUntil,
      },
      handler: () => handleRequest(request, env, waitUntil),
    });
  },
};

export default worker;
