import { SERVICE_NAME } from './contracts';
import { getIdempotencyClient } from './idempotency-client';
import {
  processDailySummaryDispatch,
  sendDailySummaryViaTwilio,
  sendDailySummaryViaWhatsApp,
} from './job';
import { buildDailySummaryPreview } from './supabase';
import { TerminalDispatchError } from './twilio';
import { writeStructuredLog } from '../../shared/observability';

import type { DailySummaryQueueMessage } from './contracts';
import type { SmsSummaryWorkerEnv } from './worker-env';

async function handleQueueMessage(
  env: SmsSummaryWorkerEnv,
  payload: DailySummaryQueueMessage,
): Promise<Record<string, unknown>> {
  return processDailySummaryDispatch({
    payload,
    idempotency: getIdempotencyClient(env, payload),
    loadPreview: (message) =>
      buildDailySummaryPreview(env, {
        restaurantId: message.restaurantId,
        localDate: message.localDate,
        timezone: message.timezone,
      }),
    sendSms: (params) =>
      sendDailySummaryViaTwilio({
        env,
        recipient: params.recipient,
        message: params.message,
      }),
    sendWhatsApp: (params) =>
      sendDailySummaryViaWhatsApp({
        env,
        callbackToken: params.callbackToken,
        restaurantId: payload.restaurantId,
        localDate: payload.localDate,
        recipient: params.recipient,
        message: params.message,
      }),
  });
}

export async function processQueueBatch(
  batch: MessageBatch<DailySummaryQueueMessage>,
  env: SmsSummaryWorkerEnv,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      const result = await handleQueueMessage(env, message.body);
      writeStructuredLog({
        level: 'info',
        event: 'product.daily_summary.processed',
        service: SERVICE_NAME,
        fields: { result, deploySha: env.DEPLOY_SHA ?? env.CF_VERSION_METADATA?.id },
      });
      message.ack?.();
    } catch (error) {
      writeStructuredLog({
        level: 'error',
        event: 'daily_summary.queue_failed',
        service: SERVICE_NAME,
        fields: {
          error: error instanceof Error ? error.message : String(error),
          payload: message.body,
          deploySha: env.DEPLOY_SHA,
        },
      });

      if (error instanceof TerminalDispatchError) {
        message.ack?.();
        continue;
      }
      message.retry?.();
    }
  }
}
