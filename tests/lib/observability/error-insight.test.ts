import { describe, expect, it } from 'vitest';

import {
  buildGitHubDispatchRequest,
  isAuthorizedInsightRequest,
  parseErrorInsight,
} from '@/lib/observability/error-insight';

describe('error insight receiver contract', () => {
  it('accepts only bounded Worker metadata and drops raw error text', () => {
    expect(
      parseErrorInsight({
        timestamp: '2026-07-15T16:00:00.000Z',
        service: 'sms-summary-gateway',
        event: 'http.request.failed',
        fields: {
          traceId: 'trace-123',
          deploySha: 'abc123',
          requestId: 'request-123',
          method: 'POST',
          path: '/internal/dispatch-daily-summary',
          error: 'guest@example.com should never reach GitHub',
        },
      }),
    ).toEqual({
      service: 'sms-summary-gateway',
      traceId: 'trace-123',
      deploySha: 'abc123',
      requestId: 'request-123',
      method: 'POST',
      path: '/internal/dispatch-daily-summary',
      fingerprint: 'sms-summary-gateway:POST:/internal/dispatch-daily-summary',
    });
  });

  it('requires an exact bearer token', () => {
    expect(isAuthorizedInsightRequest('receiver-secret', 'Bearer receiver-secret')).toBe(true);
    expect(isAuthorizedInsightRequest('receiver-secret', 'Bearer receiver-secret-extra')).toBe(
      false,
    );
    expect(isAuthorizedInsightRequest('receiver-secret', null)).toBe(false);
  });

  it('builds a repository dispatch without raw exception data', async () => {
    const request = buildGitHubDispatchRequest(
      {
        service: 'email-queue-gateway',
        traceId: 'trace-123',
        deploySha: 'abc123',
        requestId: 'request-123',
        method: 'POST',
        path: '/internal/process',
        fingerprint: 'email-queue-gateway:POST:/internal/process',
      },
      {
        token: 'github-token',
        repository: 'lapeninns/nabatable',
      },
    );

    expect(request.url).toBe('https://api.github.com/repos/lapeninns/nabatable/dispatches');
    expect(new Headers(request.init.headers).get('authorization')).toBe('Bearer github-token');
    await expect(new Response(request.init.body).json()).resolves.toEqual({
      event_type: 'runtime-error',
      client_payload: {
        service: 'email-queue-gateway',
        trace_id: 'trace-123',
        deploy_sha: 'abc123',
        request_id: 'request-123',
        method: 'POST',
        path: '/internal/process',
        fingerprint: 'email-queue-gateway:POST:/internal/process',
      },
    });
  });
});
