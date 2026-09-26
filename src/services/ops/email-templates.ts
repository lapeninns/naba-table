import { fetchJson, type RequestSignalOptions } from '@/lib/http/fetchJson';

import { OPS_RESTAURANTS_BASE } from './restaurants';

import type {
  PreviewEmailTemplateInput,
  RestaurantEmailTemplatePreview,
  RestaurantService,
  SendTestEmailTemplateInput,
  SendTestEmailTemplateResponse,
} from './restaurants';
import type { RestaurantBookingEmailTemplateKey } from '@/lib/restaurants/email-templates';

/**
 * Standalone email-template calls that need more than `RestaurantService` offers: the live
 * preview takes an AbortSignal (a newer draft cancels the stale render) and the test send carries
 * a per-click Idempotency-Key. `RestaurantService` (owned elsewhere) keeps its methods; the page
 * hooks call these instead.
 */
export type EmailTemplatesTransport = {
  previewEmailTemplate(
    restaurantId: string,
    templateKey: RestaurantBookingEmailTemplateKey,
    payload: PreviewEmailTemplateInput,
    options?: RequestSignalOptions,
  ): Promise<RestaurantEmailTemplatePreview>;
  sendTestEmailTemplate(
    restaurantId: string,
    templateKey: RestaurantBookingEmailTemplateKey,
    payload: SendTestEmailTemplateInput,
    options: { idempotencyKey: string },
  ): Promise<SendTestEmailTemplateResponse>;
};

type EmailTemplatePreviewResponse = {
  restaurantId: string;
  preview: RestaurantEmailTemplatePreview;
};

function templateUrl(restaurantId: string, templateKey: RestaurantBookingEmailTemplateKey) {
  return `${OPS_RESTAURANTS_BASE}/${encodeURIComponent(restaurantId)}/email-templates/${encodeURIComponent(templateKey)}`;
}

export const httpEmailTemplatesTransport: EmailTemplatesTransport = {
  async previewEmailTemplate(restaurantId, templateKey, payload, options) {
    const response = await fetchJson<EmailTemplatePreviewResponse>(
      `${templateUrl(restaurantId, templateKey)}/preview`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: options?.signal,
      },
    );
    return response.preview;
  },

  async sendTestEmailTemplate(restaurantId, templateKey, payload, { idempotencyKey }) {
    return fetchJson<SendTestEmailTemplateResponse>(
      `${templateUrl(restaurantId, templateKey)}/test-send`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(payload),
      },
    );
  },
};

/**
 * Adapts an injected `RestaurantService` (dev harness, tests) to the transport. The service has
 * no signal or idempotency parameters, so those are dropped.
 */
export function emailTemplatesTransportFromService(
  service: Pick<RestaurantService, 'previewEmailTemplate' | 'sendTestEmailTemplate'>,
): EmailTemplatesTransport {
  return {
    previewEmailTemplate: (restaurantId, templateKey, payload) =>
      service.previewEmailTemplate(restaurantId, templateKey, payload),
    sendTestEmailTemplate: (restaurantId, templateKey, payload) =>
      service.sendTestEmailTemplate(restaurantId, templateKey, payload),
  };
}

/**
 * Stable 53-bit hash (cyrb53) of the preview input, used in the preview query key so an unchanged
 * draft reuses its cached render and every edit gets its own entry.
 */
export function hashEmailTemplatePreviewInput(payload: PreviewEmailTemplateInput): string {
  const variants = [...(payload.variants ?? [])]
    .sort((left, right) => left.order - right.order)
    .map((variant) => [
      variant.id,
      variant.name,
      variant.subject,
      variant.preheader,
      variant.headline,
      variant.intro,
      variant.cue,
      variant.ask,
      variant.ctaLabel,
      variant.isActive,
      variant.order,
    ]);
  const text = JSON.stringify([payload.preferredVariantId ?? null, variants]);

  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
