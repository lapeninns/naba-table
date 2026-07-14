import { SERVICE_NAME, type CreateShortLinkRequest, type ShortLinkRecord } from './contracts';
import {
  createBookingShortLink,
  parseAllowedHosts,
  parseAllowedReviewHosts,
  resolveBookingShortLink,
  validateShortLinkRequest,
} from './core';
import { createShortLinkRepository } from './storage';

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
};

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

const worker = {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
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
        const result = await createBookingShortLink({
          repository,
          request: {
            ...body,
            destinationUrl: validation.destinationUrl.toString(),
          },
          shortBaseUrl: env.SHORT_LINKS_PUBLIC_BASE_URL,
        });

        return json(result, { status: 201 });
      } catch (error) {
        console.error('[booking-short-links] failed to create link', {
          bookingId: body.bookingId,
          createdBy: body.createdBy,
          error: error instanceof Error ? error.message : String(error),
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

      const result = await resolveBookingShortLink({
        repository,
        token,
        purpose: 'booking_manage',
      });

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

      const result = await resolveBookingShortLink({ repository, token, purpose: 'review' });
      if (result.status !== 'redirect') {
        return json({ error: 'Not found' }, { status: 404 });
      }

      return Response.redirect(result.record.destinationUrl, 302);
    }

    if (request.method === 'GET' && url.pathname === '/') {
      return json({
        service: SERVICE_NAME,
        status: 'ok',
      });
    }

    return json({ error: 'Not found' }, { status: 404 });
  },
};

export default worker;
