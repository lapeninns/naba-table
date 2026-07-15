import { SERVICE_NAME } from './contracts';
import { isAuthorized, isValidLocalDate, json, readJson } from './gateway-http';
import { getIdempotencyClient } from './idempotency-client';
import { resolveDueDispatch } from './scheduling';
import { buildDailySummaryPreview, getRestaurantDailySummaryTarget } from './supabase';

import type { DailySummaryQueueMessage } from './contracts';
import type { SmsSummaryWorkerEnv } from './worker-env';

export async function handleManualDispatch(
  request: Request,
  env: SmsSummaryWorkerEnv,
): Promise<Response> {
  if (!isAuthorized(request, env.INTERNAL_TRIGGER_TOKEN)) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await readJson(request);
  const restaurantId = typeof body?.restaurantId === 'string' ? body.restaurantId.trim() : '';
  const requestedDate = body?.date;
  const dryRun = body?.dryRun !== false;
  const force = body?.force === true;

  if (!restaurantId) {
    return json({ error: 'restaurantId is required' }, { status: 400 });
  }
  if (requestedDate !== undefined && !isValidLocalDate(requestedDate)) {
    return json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }

  const target = await getRestaurantDailySummaryTarget(env, restaurantId);
  if (!target) {
    return json({ error: 'Restaurant daily SMS summary target not found' }, { status: 404 });
  }
  if (!target.enabled) {
    return json({ error: 'Restaurant daily SMS summary is disabled' }, { status: 409 });
  }

  const dueDispatch = resolveDueDispatch({ now: new Date(), timezone: target.timezone });
  const localDate =
    typeof requestedDate === 'string' && requestedDate.length > 0
      ? requestedDate
      : dueDispatch.localDate;
  const payload: DailySummaryQueueMessage = {
    restaurantId: target.restaurantId,
    localDate,
    recipient: target.recipient,
    timezone: target.timezone,
    dryRun,
    whatsappFirst: target.whatsappFirst,
  };
  const preview = await buildDailySummaryPreview(env, {
    restaurantId: target.restaurantId,
    localDate,
    timezone: target.timezone,
  });
  const idempotency = getIdempotencyClient(env, payload);
  if (force) {
    await idempotency.reset();
  }
  const idempotencyStatus = await idempotency.status();
  const responseBody = {
    ok: true,
    service: SERVICE_NAME,
    force,
    payload,
    dueState: {
      dueNow: dueDispatch.dueNow,
      localDate: dueDispatch.localDate,
      sendAtIso: dueDispatch.sendAtIso,
      windowEndsIso: dueDispatch.windowEndsIso,
    },
    idempotency: idempotencyStatus,
    preview,
  };

  if (dryRun) {
    return json({ ...responseBody, dryRun: true });
  }

  await env.DAILY_BOOKING_SUMMARY_QUEUE.send(payload);
  return json({ ...responseBody, queued: true }, { status: 202 });
}
