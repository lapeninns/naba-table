import { routeGatewayRequest } from './gateway-router';
import { observeWorkerRequest } from '../../shared/observability';

import type { EmailQueueGatewayEnv } from './contracts';

export { CapacityVersionState } from './capacity-version-state';
export { EmailQueueState } from './email-queue-state';
export { RateLimitState } from './rate-limit-state';

const worker = {
  async fetch(
    request: Request,
    env: EmailQueueGatewayEnv,
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
      handler: () => routeGatewayRequest(request, env),
    });
  },
};

export default worker;
