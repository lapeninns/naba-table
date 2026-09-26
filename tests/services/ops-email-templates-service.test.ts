import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchJsonMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/http/fetchJson', () => ({
  fetchJson: fetchJsonMock,
}));

import {
  emailTemplatesTransportFromService,
  hashEmailTemplatePreviewInput,
  httpEmailTemplatesTransport,
} from '@/src/services/ops/email-templates';

import type { RestaurantEmailTemplateVariant } from '@/lib/restaurants/email-templates';

function variant(overrides: Partial<RestaurantEmailTemplateVariant> = {}) {
  return {
    id: 'v1',
    name: 'A',
    subject: 'S',
    preheader: 'P',
    headline: 'H',
    intro: 'I',
    cue: '',
    ask: '',
    ctaLabel: 'Go',
    isActive: true,
    order: 0,
    ...overrides,
  };
}

describe('email templates transport', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it('posts the preview with the abort signal and unwraps it', async () => {
    fetchJsonMock.mockResolvedValue({ restaurantId: 'r1', preview: { html: '<p/>' } });
    const controller = new AbortController();

    await expect(
      httpEmailTemplatesTransport.previewEmailTemplate(
        'r1',
        'confirmation',
        { variants: [variant()] },
        { signal: controller.signal },
      ),
    ).resolves.toEqual({ html: '<p/>' });

    expect(fetchJsonMock).toHaveBeenCalledWith(
      '/api/ops/restaurants/r1/email-templates/confirmation/preview',
      expect.objectContaining({ method: 'POST', signal: controller.signal }),
    );
  });

  it('sends the per-click Idempotency-Key with a test send', async () => {
    fetchJsonMock.mockResolvedValue({ ok: true });

    await httpEmailTemplatesTransport.sendTestEmailTemplate(
      'r1',
      'confirmation',
      { toEmail: 'ops@example.com' },
      { idempotencyKey: 'click-key-1' },
    );

    const [url, init] = fetchJsonMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/ops/restaurants/r1/email-templates/confirmation/test-send');
    expect(init.headers).toMatchObject({ 'Idempotency-Key': 'click-key-1' });
    expect(JSON.parse(String(init.body))).toEqual({ toEmail: 'ops@example.com' });
  });

  it('adapts an injected RestaurantService', async () => {
    const service = {
      previewEmailTemplate: vi.fn().mockResolvedValue({ html: 'dev' }),
      sendTestEmailTemplate: vi.fn().mockResolvedValue({ ok: true }),
    };
    const transport = emailTemplatesTransportFromService(service);

    await transport.previewEmailTemplate('r1', 'confirmation', {}, {});
    await transport.sendTestEmailTemplate('r1', 'confirmation', { toEmail: 'a@b.c' }, {
      idempotencyKey: 'k',
    });

    expect(service.previewEmailTemplate).toHaveBeenCalledWith('r1', 'confirmation', {});
    expect(service.sendTestEmailTemplate).toHaveBeenCalledWith('r1', 'confirmation', {
      toEmail: 'a@b.c',
    });
  });
});

describe('hashEmailTemplatePreviewInput', () => {
  it('is stable for the same draft regardless of variant order in the array', () => {
    const first = hashEmailTemplatePreviewInput({
      preferredVariantId: 'v1',
      variants: [variant(), variant({ id: 'v2', order: 1 })],
    });
    const second = hashEmailTemplatePreviewInput({
      preferredVariantId: 'v1',
      variants: [variant({ id: 'v2', order: 1 }), variant()],
    });

    expect(first).toBe(second);
  });

  it('changes when any rendered field or the preferred variant changes', () => {
    const base = hashEmailTemplatePreviewInput({ preferredVariantId: 'v1', variants: [variant()] });

    expect(
      hashEmailTemplatePreviewInput({
        preferredVariantId: 'v1',
        variants: [variant({ intro: 'I2' })],
      }),
    ).not.toBe(base);
    expect(
      hashEmailTemplatePreviewInput({ preferredVariantId: 'v2', variants: [variant()] }),
    ).not.toBe(base);
  });
});
