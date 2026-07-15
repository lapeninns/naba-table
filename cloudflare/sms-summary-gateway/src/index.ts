import { SERVICE_NAME } from './contracts';
import { json } from './gateway-http';
import { handleManualDispatch } from './manual-dispatch';
import { processQueueBatch } from './queue-consumer';
import { selectDueDispatches } from './scheduling';
import { listRestaurantDailySummaryTargets } from './supabase';
import { observeWorkerRequest, writeStructuredLog } from '../../shared/observability';

import type { DailySummaryQueueMessage } from './contracts';
import type { SmsSummaryWorkerEnv } from './worker-env';

export { DailyBookingSummaryState } from './daily-booking-summary-state';

const worker = {
  async fetch(
    request: Request,
    env: SmsSummaryWorkerEnv,
    ctx?: ExecutionContext,
  ): Promise<Response> {
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
      handler: async () => {
        const url = new URL(request.url);
        if (request.method === 'GET' && url.pathname === '/health') {
          return json({ ok: true, service: SERVICE_NAME });
        }
        if (request.method === 'POST' && url.pathname === '/internal/dispatch-daily-summary') {
          return handleManualDispatch(request, env);
        }
        return json({ error: 'Not found' }, { status: 404 });
      },
    });
  },

  async scheduled(_controller: ScheduledController, env: SmsSummaryWorkerEnv): Promise<void> {
    const targets = await listRestaurantDailySummaryTargets(env);
    const dueDispatches = selectDueDispatches(targets, new Date());

    writeStructuredLog({
      level: 'info',
      event: 'daily_summary.schedule_evaluated',
      service: SERVICE_NAME,
      fields: {
        targetCount: targets.length,
        dueCount: dueDispatches.length,
        deploySha: env.DEPLOY_SHA,
      },
    });

    await Promise.all(
      dueDispatches.map((target) =>
        env.DAILY_BOOKING_SUMMARY_QUEUE.send({
          restaurantId: target.restaurantId,
          localDate: target.localDate,
          recipient: target.recipient,
          timezone: target.timezone,
          dryRun: false,
          whatsappFirst: target.whatsappFirst,
        }),
      ),
    );
  },

  async queue(
    batch: MessageBatch<DailySummaryQueueMessage>,
    env: SmsSummaryWorkerEnv,
  ): Promise<void> {
    await processQueueBatch(batch, env);
  },
};

export default worker;
