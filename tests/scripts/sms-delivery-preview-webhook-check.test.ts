import { describe, expect, it } from 'vitest';

import { parsePreviewWebhookHttpResponse } from '@/scripts/sms-delivery-preview-webhook-check';

describe('parsePreviewWebhookHttpResponse', () => {
  it('extracts the status code and matched path from a Vercel route response', () => {
    const response = [
      'HTTP/2 503',
      'content-type: application/json',
      'x-matched-path: /api/webhook/twilio/sms-status',
      '',
      '{"error":"Webhook not configured"}',
    ].join('\n');

    expect(parsePreviewWebhookHttpResponse(response, 'POST')).toEqual({
      method: 'POST',
      statusCode: 503,
      matchedPath: '/api/webhook/twilio/sms-status',
      bodySnippet: '{"error":"Webhook not configured"}',
      error: null,
    });
  });

  it('ignores wrapper output before the first HTTP response line', () => {
    const response = [
      'Retrieving project...',
      'HTTP/2 405',
      'x-matched-path: /api/webhook/twilio/sms-status',
      '',
      '',
    ].join('\n');

    expect(parsePreviewWebhookHttpResponse(response, 'GET')).toMatchObject({
      method: 'GET',
      statusCode: 405,
      matchedPath: '/api/webhook/twilio/sms-status',
      bodySnippet: null,
      error: null,
    });
  });
});
