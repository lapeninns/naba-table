import { NextResponse, type NextRequest } from 'next/server';

import { apiError, internalError } from '@/lib/api/errors';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

const ROUTE = '/api/events';

type AnalyticsUser = {
  anonId: unknown;
  emailHash?: unknown;
};

type AnalyticsContext = {
  route: unknown;
  version: unknown;
};

type IncomingEvent = {
  name: unknown;
  ts: unknown;
  user: AnalyticsUser;
  context: AnalyticsContext;
  props: unknown;
};

type ParsedBody = { events?: IncomingEvent[] } | IncomingEvent | null;

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coerceToEvents(body: ParsedBody): IncomingEvent[] | null {
  if (!body) return null;
  if (Array.isArray((body as { events?: IncomingEvent[] }).events)) {
    return (body as { events?: IncomingEvent[] }).events ?? null;
  }
  if (Array.isArray(body)) {
    return body as IncomingEvent[];
  }
  if (isPlainObject(body)) {
    return [body as IncomingEvent];
  }
  return null;
}

function isValidEvent(event: IncomingEvent): event is Required<IncomingEvent> {
  if (!isPlainObject(event)) return false;
  if (!isString(event.name) || !isString(event.ts)) return false;

  if (!isPlainObject(event.user)) return false;
  if (!isString(event.user.anonId)) return false;
  if (event.user.emailHash != null && !isString(event.user.emailHash)) return false;

  if (!isPlainObject(event.context)) return false;
  if (!isString(event.context.route) || !isString(event.context.version)) return false;

  if (!isPlainObject(event.props)) return false;

  return true;
}

export async function POST(req: NextRequest) {
  try {
    let parsed: ParsedBody = null;
    try {
      parsed = await req.json();
    } catch {
      parsed = null;
    }

    const events = coerceToEvents(parsed);

    if (!events || events.length === 0 || !events.every(isValidEvent)) {
      return apiError(400, 'INVALID_ANALYTICS_PAYLOAD', 'Invalid analytics payload.');
    }

    if (env.node.env !== 'production') {
      logger.debug('[events]', { route: ROUTE, count: events.length });
    }

    return NextResponse.json({ ok: true, count: events.length }, { status: 202 });
  } catch (error) {
    return internalError(error, { route: ROUTE }, 'Unable to record event');
  }
}

export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
