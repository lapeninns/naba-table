import { routeGatewayRequest } from './gateway-router';
import { observeWorkerRequest } from '../../shared/observability';
import {
  createDurableObjectProbe,
  handleReadinessRequest,
  isReadinessRequest,
} from '../../shared/readiness';

import type { EmailQueueGatewayEnv } from './contracts';
import type { ReadinessEnv } from '../../shared/readiness';

export type EmailQueueGatewayWorkerEnv = EmailQueueGatewayEnv & ReadinessEnv;

function handleGatewayRequest(
  request: Request,
  env: EmailQueueGatewayWorkerEnv,
): Promise<Response> {
  if (isReadinessRequest(request)) {
    return handleReadinessRequest({
      request,
      env,
      service: 'email-queue-gateway',
      probes: [
        createDurableObjectProbe(env.EMAIL_QUEUE_STATE, {
          name: 'email-queue-state',
          objectName: 'primary',
          path: '/health',
        }),
        createDurableObjectProbe(env.CAPACITY_VERSION_STATE, {
          name: 'capacity-version-state',
          objectName: 'primary',
          path: '/health',
        }),
      ],
    });
  }
  return routeGatewayRequest(request, env);
}

export { CapacityVersionState } from './capacity-version-state';
export { EmailQueueState } from './email-queue-state';
export { RateLimitState } from './rate-limit-state';

const worker = {
  async fetch(
    request: Request,
    env: EmailQueueGatewayWorkerEnv,
    ctx?: ExecutionContext,
  ): Promise<Response> {
    const waitUntil = (promise: Promise<unknown>): void => ctx?.waitUntil(promise);

    return observeWorkerRequest({
      request,
      service: 'email-queue-gateway',
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
      handler: () => handleGatewayRequest(request, env),
    });
  },
};

export default worker;
