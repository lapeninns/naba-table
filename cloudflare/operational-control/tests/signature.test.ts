import { describe, expect, it } from 'vitest';

import { WEBHOOK_SECRET } from './helpers/fixtures';
import { computeWebhookSignature, verifyWebhookSignature } from '../src/signature';

const bytes = (value: string): Uint8Array => new TextEncoder().encode(value);

describe('webhook signature verification', () => {
  it('accepts a signature computed over the exact raw bytes', async () => {
    const rawBody = bytes('{"action":"completed","check_run":{"id":1}}');
    const header = await computeWebhookSignature(WEBHOOK_SECRET, rawBody);
    expect(header).toMatch(/^sha256=[0-9a-f]{64}$/u);
    await expect(
      verifyWebhookSignature({ secret: WEBHOOK_SECRET, rawBody, signatureHeader: header }),
    ).resolves.toBe(true);
    await expect(
      verifyWebhookSignature({
        secret: WEBHOOK_SECRET,
        rawBody,
        signatureHeader: ` ${header.replace('sha256=', 'SHA256=').toUpperCase()} `,
      }),
    ).resolves.toBe(true);
  });

  it('rejects when the received bytes differ from the signed bytes even if JSON-equivalent', async () => {
    const signedOver = bytes('{"a": 1}');
    const received = bytes('{"a":1}');
    const header = await computeWebhookSignature(WEBHOOK_SECRET, signedOver);
    await expect(
      verifyWebhookSignature({
        secret: WEBHOOK_SECRET,
        rawBody: received,
        signatureHeader: header,
      }),
    ).resolves.toBe(false);
  });

  it('rejects a signature produced with a different secret', async () => {
    const rawBody = bytes('{"a":1}');
    const header = await computeWebhookSignature('another-secret-with-enough-length', rawBody);
    await expect(
      verifyWebhookSignature({ secret: WEBHOOK_SECRET, rawBody, signatureHeader: header }),
    ).resolves.toBe(false);
  });

  it('rejects missing or malformed signature headers', async () => {
    const rawBody = bytes('{"a":1}');
    for (const signatureHeader of [
      null,
      '',
      'sha1=abcdef',
      'sha256=',
      'sha256=abc',
      `sha256=${'z'.repeat(64)}`,
      `sha256=${'a'.repeat(63)}`,
      `sha256=${'a'.repeat(65)}`,
    ]) {
      await expect(
        verifyWebhookSignature({ secret: WEBHOOK_SECRET, rawBody, signatureHeader }),
      ).resolves.toBe(false);
    }
  });

  it('fails closed when the secret is unconfigured, too short, or a placeholder', async () => {
    const rawBody = bytes('{"a":1}');
    for (const secret of [undefined, '', 'short', 'REPLACE_ME_WEBHOOK_SECRET_VALUE']) {
      const header = await computeWebhookSignature(secret || 'x', rawBody);
      await expect(
        verifyWebhookSignature({ secret, rawBody, signatureHeader: header }),
      ).resolves.toBe(false);
    }
  });
});
