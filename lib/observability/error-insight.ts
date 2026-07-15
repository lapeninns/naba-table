import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const SERVICE_NAMES = [
  'nabatable-booking-short-links',
  'nabatable-email-queue-gateway',
  'nabatable-sms-summary-gateway',
] as const;

const safeIdentifier = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9._:/-]+$/u);
const workerEnvelopeSchema = z.object({
  service: z.enum(SERVICE_NAMES),
  event: z.literal('http.request.failed'),
  fields: z.object({
    traceId: safeIdentifier,
    deploySha: safeIdentifier,
    requestId: safeIdentifier,
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']),
    path: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/u),
  }),
});

export type WorkerErrorInsight = {
  readonly service: (typeof SERVICE_NAMES)[number];
  readonly traceId: string;
  readonly deploySha: string;
  readonly requestId: string;
  readonly method: string;
  readonly path: string;
  readonly fingerprint: string;
};

export function parseWorkerErrorInsight(value: unknown): WorkerErrorInsight | null {
  const parsed = workerEnvelopeSchema.safeParse(value);
  if (!parsed.success) return null;

  const { service, fields } = parsed.data;
  return {
    service,
    traceId: fields.traceId,
    deploySha: fields.deploySha,
    requestId: fields.requestId,
    method: fields.method,
    path: fields.path,
    fingerprint: `${service}:${fields.method}:${fields.path}`,
  };
}

export function isAuthorizedInsightRequest(
  expectedToken: string,
  authorization: string | null,
): boolean {
  const suppliedToken = authorization?.match(/^Bearer ([^\s]+)$/u)?.[1] ?? '';
  const expected = Buffer.from(expectedToken);
  const supplied = Buffer.from(suppliedToken);
  return (
    expected.length > 0 &&
    expected.length === supplied.length &&
    timingSafeEqual(expected, supplied)
  );
}

export function buildGitHubDispatchRequest(
  insight: WorkerErrorInsight,
  config: { readonly token: string; readonly repository: string },
): { url: string; init: RequestInit } {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(config.repository)) {
    throw new Error('Invalid GitHub repository slug.');
  }

  return {
    url: `https://api.github.com/repos/${config.repository}/dispatches`,
    init: {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${config.token}`,
        'content-type': 'application/json',
        'user-agent': 'nabatable-error-insight-receiver',
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify({
        event_type: 'worker-error',
        client_payload: {
          service: insight.service,
          trace_id: insight.traceId,
          deploy_sha: insight.deploySha,
          request_id: insight.requestId,
          method: insight.method,
          path: insight.path,
          fingerprint: insight.fingerprint,
        },
      }),
    },
  };
}
