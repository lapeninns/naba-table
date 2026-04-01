import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildTemplateDtoMock = vi.hoisted(() => vi.fn());
const buildTemplateGroupsMock = vi.hoisted(() => vi.fn());
const ensureTemplateReadAccessMock = vi.hoisted(() => vi.fn());
const ensureTemplateWriteAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const resolveTemplateKeyParamMock = vi.hoisted(() => vi.fn());
const upsertRestaurantEmailTemplateMock = vi.hoisted(() => vi.fn());
const resetRestaurantEmailTemplateMock = vi.hoisted(() => vi.fn());
const renderRestaurantBookingEmailPreviewMock = vi.hoisted(() => vi.fn());
const sendRestaurantBookingEmailTestMock = vi.hoisted(() => vi.fn());

vi.mock('@/src/app/api/ops/restaurants/[id]/email-templates/_shared', () => ({
  buildTemplateDto: buildTemplateDtoMock,
  buildTemplateGroups: buildTemplateGroupsMock,
  ensureTemplateReadAccess: ensureTemplateReadAccessMock,
  ensureTemplateWriteAccess: ensureTemplateWriteAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
  resolveTemplateKeyParam: resolveTemplateKeyParamMock,
}));

vi.mock('@/server/restaurants/emailTemplates', () => ({
  upsertRestaurantEmailTemplate: upsertRestaurantEmailTemplateMock,
  resetRestaurantEmailTemplate: resetRestaurantEmailTemplateMock,
}));

vi.mock('@/server/emails/bookings', () => ({
  renderRestaurantBookingEmailPreview: renderRestaurantBookingEmailPreviewMock,
  sendRestaurantBookingEmailTest: sendRestaurantBookingEmailTestMock,
}));

import { GET as getTemplates } from '@/src/app/api/ops/restaurants/[id]/email-templates/route';
import { PATCH as patchTemplate, DELETE as deleteTemplate } from '@/src/app/api/ops/restaurants/[id]/email-templates/[templateKey]/route';
import { POST as previewTemplate } from '@/src/app/api/ops/restaurants/[id]/email-templates/[templateKey]/preview/route';
import { POST as testSendTemplate } from '@/src/app/api/ops/restaurants/[id]/email-templates/[templateKey]/test-send/route';

function buildRouteParams() {
  return {
    params: Promise.resolve({
      id: 'rest-1',
      templateKey: 'confirmation',
    }),
  };
}

describe('restaurant email template routes', () => {
  beforeEach(() => {
    buildTemplateDtoMock.mockReset();
    buildTemplateGroupsMock.mockReset();
    ensureTemplateReadAccessMock.mockReset();
    ensureTemplateWriteAccessMock.mockReset();
    resolveRestaurantIdMock.mockReset();
    resolveTemplateKeyParamMock.mockReset();
    upsertRestaurantEmailTemplateMock.mockReset();
    resetRestaurantEmailTemplateMock.mockReset();
    renderRestaurantBookingEmailPreviewMock.mockReset();
    sendRestaurantBookingEmailTestMock.mockReset();

    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    resolveTemplateKeyParamMock.mockResolvedValue('confirmation');
    ensureTemplateReadAccessMock.mockResolvedValue({
      canEdit: true,
      venue: {
        id: 'rest-1',
        slug: 'demo-venue',
        name: 'Demo Venue',
        timezone: 'Europe/London',
        address: '1 Example Street',
        phone: '+44 7000 000000',
        email: 'ops@example.com',
        policy: '',
        logoUrl: null,
        googleMapUrl: null,
        googleReviewUrl: null,
        emailTemplates: null,
      },
    });
    ensureTemplateWriteAccessMock.mockResolvedValue({
      id: 'rest-1',
      slug: 'demo-venue',
      name: 'Demo Venue',
      timezone: 'Europe/London',
      address: '1 Example Street',
      phone: '+44 7000 000000',
      email: 'ops@example.com',
      policy: '',
      logoUrl: null,
      googleMapUrl: null,
      googleReviewUrl: null,
      emailTemplates: null,
    });
  });

  it('returns grouped template data from the list route', async () => {
    buildTemplateGroupsMock.mockReturnValue([
      {
        key: 'confirmation',
        title: 'Confirmation',
        description: 'Confirmed reservations',
        templates: [],
      },
    ]);

    const response = await getTemplates(new NextRequest('https://www.nabatable.com/api/ops/restaurants/rest-1/email-templates'), buildRouteParams());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      restaurantId: 'rest-1',
      canEdit: true,
      groups: [{ key: 'confirmation' }],
    });
  });

  it('rejects invalid template payloads before saving', async () => {
    const response = await patchTemplate(
      new NextRequest('https://www.nabatable.com/api/ops/restaurants/rest-1/email-templates/confirmation', {
        method: 'PATCH',
        body: JSON.stringify({
          variants: [
            {
              id: 'variant-1',
              name: 'Only variant',
              headline: 'Hello',
              intro: 'World',
              ctaLabel: 'Open',
              isActive: false,
              order: 0,
            },
          ],
        }),
      }),
      buildRouteParams(),
    );

    expect(response.status).toBe(400);
    expect(upsertRestaurantEmailTemplateMock).not.toHaveBeenCalled();
  });

  it('persists a valid template update and returns the refreshed dto', async () => {
    upsertRestaurantEmailTemplateMock.mockResolvedValue({ id: 'rest-1', name: 'Demo Venue' });
    buildTemplateDtoMock.mockReturnValue({
      key: 'confirmation',
      title: 'Confirmation',
      description: 'Confirmed reservations',
      groupKey: 'confirmation',
      supportsCtaLabel: true,
      status: 'custom',
      activeVariantCount: 1,
      variants: [],
      defaultVariants: [],
    });

    const response = await patchTemplate(
      new NextRequest('https://www.nabatable.com/api/ops/restaurants/rest-1/email-templates/confirmation', {
        method: 'PATCH',
        body: JSON.stringify({
          variants: [
            {
              id: 'variant-1',
              name: 'Only variant',
              headline: 'Hello',
              intro: 'World',
              ctaLabel: 'Open',
              isActive: true,
              order: 0,
            },
          ],
        }),
      }),
      buildRouteParams(),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(upsertRestaurantEmailTemplateMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      templateKey: 'confirmation',
      variants: [
        {
          id: 'variant-1',
          name: 'Only variant',
          headline: 'Hello',
          intro: 'World',
          ctaLabel: 'Open',
          isActive: true,
          order: 0,
        },
      ],
    });
    expect(payload.template.status).toBe('custom');
  });

  it('resets a template override back to default', async () => {
    resetRestaurantEmailTemplateMock.mockResolvedValue({ id: 'rest-1', name: 'Demo Venue' });
    buildTemplateDtoMock.mockReturnValue({
      key: 'confirmation',
      title: 'Confirmation',
      description: 'Confirmed reservations',
      groupKey: 'confirmation',
      supportsCtaLabel: true,
      status: 'default',
      activeVariantCount: 3,
      variants: [],
      defaultVariants: [],
    });

    const response = await deleteTemplate(
      new NextRequest('https://www.nabatable.com/api/ops/restaurants/rest-1/email-templates/confirmation', {
        method: 'DELETE',
      }),
      buildRouteParams(),
    );

    expect(response.status).toBe(200);
    expect(resetRestaurantEmailTemplateMock).toHaveBeenCalledWith('rest-1', 'confirmation');
  });

  it('renders a preview for the selected variant', async () => {
    renderRestaurantBookingEmailPreviewMock.mockReturnValue({
      templateKey: 'confirmation',
      selectedVariantId: 'variant-1',
      headline: 'Preview headline',
      intro: 'Preview intro',
      ctaLabel: 'Manage',
      ctaUrl: 'https://example.com',
      subject: 'Preview headline - Demo Venue',
      html: '<html></html>',
      text: 'Preview text',
    });

    const response = await previewTemplate(
      new NextRequest('https://www.nabatable.com/api/ops/restaurants/rest-1/email-templates/confirmation/preview', {
        method: 'POST',
        body: JSON.stringify({ preferredVariantId: 'variant-1' }),
      }),
      buildRouteParams(),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.preview.selectedVariantId).toBe('variant-1');
  });

  it('sends a test email using the rendered preview', async () => {
    sendRestaurantBookingEmailTestMock.mockResolvedValue({
      provider: 'mock',
      messageId: 'mock-123',
      preview: {
        templateKey: 'confirmation',
        selectedVariantId: 'variant-1',
        headline: 'Preview headline',
        intro: 'Preview intro',
        ctaLabel: 'Manage',
        ctaUrl: 'https://example.com',
        subject: 'Preview headline - Demo Venue',
        html: '<html></html>',
        text: 'Preview text',
      },
    });

    const response = await testSendTemplate(
      new NextRequest('https://www.nabatable.com/api/ops/restaurants/rest-1/email-templates/confirmation/test-send', {
        method: 'POST',
        body: JSON.stringify({
          toEmail: 'preview@example.com',
          preferredVariantId: 'variant-1',
        }),
      }),
      buildRouteParams(),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      provider: 'mock',
      messageId: 'mock-123',
      preview: {
        selectedVariantId: 'variant-1',
      },
    });
  });

  it('returns auth failures from the shared access helper', async () => {
    ensureTemplateReadAccessMock.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    );

    const response = await getTemplates(
      new NextRequest('https://www.nabatable.com/api/ops/restaurants/rest-1/email-templates'),
      buildRouteParams(),
    );

    expect(response.status).toBe(403);
  });
});
