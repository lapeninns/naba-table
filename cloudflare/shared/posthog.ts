import { redactLogFields } from './redaction';

import type { LogFields } from './redaction';

export type PostHogCaptureInput = {
  readonly apiKey: string;
  readonly host: string;
  readonly event: string;
  readonly distinctId: string;
  readonly properties: LogFields;
};

export function buildPostHogCaptureRequest(input: PostHogCaptureInput): {
  url: string;
  init: RequestInit;
} {
  return {
    url: new URL('/capture/', input.host).toString(),
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: input.apiKey,
        event: input.event,
        properties: {
          distinct_id: input.distinctId,
          ...redactLogFields(input.properties),
        },
      }),
    },
  };
}

export async function capturePostHogEvent(
  input: PostHogCaptureInput & { readonly fetcher?: typeof fetch },
): Promise<void> {
  const request = buildPostHogCaptureRequest(input);
  const response = await (input.fetcher ?? fetch)(request.url, request.init);
  if (!response.ok) {
    throw new Error(`PostHog capture returned ${response.status}.`);
  }
}
