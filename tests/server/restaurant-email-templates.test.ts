import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildBookingTemplateTestIdempotencyParts,
  renderBookingEmailText,
} from '@/server/emails/booking-template-support';
import { upsertRestaurantEmailTemplate } from '@/server/restaurants/emailTemplates';

import type { RestaurantEmailTemplateVariant } from '@/lib/restaurants/email-templates';
import type { VenueDetails } from '@/lib/venue';
import type { BookingRecord } from '@/server/bookings';

function createVenue(overrides: Partial<VenueDetails> = {}): VenueDetails {
  return {
    id: overrides.id ?? 'rest-1',
    slug: overrides.slug ?? 'demo-venue',
    name: overrides.name ?? 'Demo Venue',
    address: overrides.address ?? '1 Example Street',
    phone: overrides.phone ?? '+44 7000 000000',
    email: overrides.email ?? 'ops@example.com',
    policy: overrides.policy ?? '',
    timezone: overrides.timezone ?? 'Europe/London',
    logoUrl: overrides.logoUrl ?? null,
    googleMapUrl: overrides.googleMapUrl ?? 'https://maps.example.com/demo-venue',
    googleReviewUrl: overrides.googleReviewUrl ?? 'https://reviews.example.com/demo-venue',
    emailTemplates: overrides.emailTemplates ?? null,
  };
}

function createBooking(overrides: Partial<BookingRecord> = {}): BookingRecord {
  return {
    id: overrides.id ?? 'booking-1',
    restaurant_id: overrides.restaurant_id ?? 'rest-1',
    assigned_zone_id: overrides.assigned_zone_id ?? null,
    assignment_state_version: overrides.assignment_state_version ?? 0,
    assignment_strategy: overrides.assignment_strategy ?? null,
    customer_id: overrides.customer_id ?? 'customer-1',
    booking_date: overrides.booking_date ?? '2026-04-08',
    start_time: overrides.start_time ?? '19:00',
    end_time: overrides.end_time ?? '20:30',
    start_at: overrides.start_at ?? '2026-04-08T18:00:00.000Z',
    end_at: overrides.end_at ?? '2026-04-08T19:30:00.000Z',
    reference: overrides.reference ?? 'PREVIEW42',
    party_size: overrides.party_size ?? 4,
    booking_type: overrides.booking_type ?? 'dining',
    seating_preference: overrides.seating_preference ?? 'indoor',
    status: overrides.status ?? 'confirmed',
    customer_name: overrides.customer_name ?? 'Alex Johnson',
    customer_email: overrides.customer_email ?? 'guest@example.com',
    customer_phone: overrides.customer_phone ?? '+447700900123',
    notes: overrides.notes ?? 'Window table if available.',
    marketing_opt_in: overrides.marketing_opt_in ?? true,
    source: overrides.source ?? 'ops-preview',
    client_request_id: overrides.client_request_id ?? 'preview-request',
    pending_ref: overrides.pending_ref ?? null,
    idempotency_key: overrides.idempotency_key ?? null,
    details: overrides.details ?? null,
    loyalty_points_awarded: overrides.loyalty_points_awarded ?? 0,
    created_at: overrides.created_at ?? '2026-04-08T18:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-04-08T18:00:00.000Z',
    auth_user_id: overrides.auth_user_id ?? null,
    auto_assign_idempotency_key: overrides.auto_assign_idempotency_key ?? null,
    auto_assign_last_result: overrides.auto_assign_last_result ?? null,
    checked_in_at: overrides.checked_in_at ?? null,
    checked_out_at: overrides.checked_out_at ?? null,
    confirmation_token: overrides.confirmation_token ?? null,
    confirmation_token_expires_at: overrides.confirmation_token_expires_at ?? null,
    confirmation_token_used_at: overrides.confirmation_token_used_at ?? null,
  } as BookingRecord;
}

function createVariant(
  id: string,
  overrides: Partial<RestaurantEmailTemplateVariant> = {},
): RestaurantEmailTemplateVariant {
  return {
    id,
    name: overrides.name ?? id,
    subject: overrides.subject ?? 'Headline - {{venue}}',
    preheader: overrides.preheader ?? 'Preview text',
    headline: overrides.headline ?? 'Headline',
    intro: overrides.intro ?? 'Intro copy',
    cue: overrides.cue ?? '',
    ask: overrides.ask ?? '',
    ctaLabel: overrides.ctaLabel ?? 'Open',
    isActive: overrides.isActive ?? true,
    order: overrides.order ?? 0,
  };
}

function createRestaurantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rest-1',
    name: 'Demo Venue',
    slug: 'demo-venue',
    timezone: 'Europe/London',
    capacity: null,
    contact_email: 'ops@example.com',
    contact_phone: '+44 7000 000000',
    address: '1 Example Street',
    google_map_url: 'https://maps.example.com/demo-venue',
    google_review_url: 'https://reviews.example.com/demo-venue',
    booking_policy: '',
    email_templates: null,
    email_send_reminder_24h: true,
    email_send_reminder_short: true,
    email_send_review_request: true,
    reservation_interval_minutes: 15,
    reservation_default_duration_minutes: 90,
    reservation_lifecycle_grace_minutes: 15,
    reservation_last_seating_buffer_minutes: 15,
    created_at: '2026-04-02T12:00:00.000Z',
    updated_at: '2026-04-02T12:00:00.000Z',
    logo_url: null,
    ...overrides,
  };
}

function createRestaurantClientMock(params: {
  selectRows: Array<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
  updateRows: Array<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
  updatePayloads: RestaurantEmailTemplateVariant[][] | Array<unknown>;
}) {
  const updatePayloads = params.updatePayloads;
  const updateFilters: Array<string | null> = [];

  const client = {
    from: vi.fn((table: string) => {
      if (table !== 'restaurants') {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => params.selectRows.shift() ?? { data: null, error: null }),
          })),
        })),
        update: vi.fn((payload: Record<string, unknown>) => {
          updatePayloads.push(payload);

          const withUpdatedAtFilter = {
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => params.updateRows.shift() ?? { data: null, error: null }),
            })),
          };

          return {
            eq: vi.fn((field: string, value: string) => {
              expect(field).toBe('id');
              expect(value).toBe('rest-1');

              return {
                eq: vi.fn((nextField: string, nextValue: string) => {
                  expect(nextField).toBe('updated_at');
                  updateFilters.push(nextValue);
                  return withUpdatedAtFilter;
                }),
                is: vi.fn((nextField: string, nextValue: null) => {
                  expect(nextField).toBe('updated_at');
                  updateFilters.push(nextValue);
                  return withUpdatedAtFilter;
                }),
                select: withUpdatedAtFilter.select,
              };
            }),
          };
        }),
      };
    }),
  };

  return {
    client,
    updateFilters,
  };
}

describe('restaurant email template server behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses a unique nonce when building template test idempotency parts', () => {
    const first = buildBookingTemplateTestIdempotencyParts({
      templateKey: 'review_request',
      recipientEmail: 'Guest@example.com',
    });
    const second = buildBookingTemplateTestIdempotencyParts({
      templateKey: 'review_request',
      recipientEmail: 'Guest@example.com',
    });

    expect(first[0]).toBe('review_request');
    expect(first[1]).toBe('guest@example.com');
    expect(second[1]).toBe('guest@example.com');
    expect(first[2]).not.toBe(second[2]);
  });

  it('keeps the text/plain CTA aligned with the resolved template CTA', () => {
    const text = renderBookingEmailText({
      booking: createBooking(),
      venue: createVenue(),
      summary: {
        date: 'Wed 8 Apr 2026',
        startTime: '19:00',
        party: '4 People',
      },
      headline: 'How was dinner?',
      intro: 'We hope you enjoyed your visit.',
      cue: '',
      ask: 'If you took any photos, adding one helps others too.',
      actionLabel: 'Leave a Review',
      actionUrl: 'https://reviews.example.com/demo-venue',
    });

    expect(text).toContain('Leave a Review: https://reviews.example.com/demo-venue');
    expect(text).toContain('REVIEW ASK:');
    expect(text).not.toContain('Manage your booking:');
  });

  it('retries template upserts against the latest persisted document on conflict', async () => {
    const firstReadRow = createRestaurantRow({
      updated_at: '2026-04-02T12:00:00.000Z',
      email_templates: {
        version: 1,
        templates: {
          confirmation: {
            variants: [createVariant('confirmation-original')],
          },
        },
      },
    });
    const secondReadRow = createRestaurantRow({
      updated_at: '2026-04-02T12:00:01.000Z',
      email_templates: {
        version: 1,
        templates: {
          confirmation: {
            variants: [createVariant('confirmation-original')],
          },
          cancelled: {
            variants: [createVariant('cancelled-live')],
          },
        },
      },
    });
    const mergedRow = createRestaurantRow({
      updated_at: '2026-04-02T12:00:02.000Z',
      email_templates: {
        version: 1,
        templates: {
          confirmation: {
            variants: [createVariant('confirmation-updated')],
          },
          cancelled: {
            variants: [createVariant('cancelled-live')],
          },
        },
      },
    });

    const capturedUpdatePayloads: Array<Record<string, unknown>> = [];
    const { client, updateFilters } = createRestaurantClientMock({
      selectRows: [
        { data: firstReadRow, error: null },
        { data: secondReadRow, error: null },
      ],
      updateRows: [
        { data: null, error: null },
        { data: mergedRow, error: null },
      ],
      updatePayloads: capturedUpdatePayloads,
    });

    const venue = await upsertRestaurantEmailTemplate(
      {
        restaurantId: 'rest-1',
        templateKey: 'confirmation',
        variants: [createVariant('confirmation-updated')],
      },
      client as never,
    );

    expect(capturedUpdatePayloads).toHaveLength(2);
    expect(updateFilters).toEqual([
      '2026-04-02T12:00:00.000Z',
      '2026-04-02T12:00:01.000Z',
    ]);

    const firstAttempt = capturedUpdatePayloads[0]?.email_templates as {
      templates: Record<string, { variants: RestaurantEmailTemplateVariant[] }>;
    };
    const secondAttempt = capturedUpdatePayloads[1]?.email_templates as {
      templates: Record<string, { variants: RestaurantEmailTemplateVariant[] }>;
    };

    expect(firstAttempt.templates.cancelled).toBeUndefined();
    expect(secondAttempt.templates.cancelled?.variants[0]?.id).toBe('cancelled-live');
    expect(secondAttempt.templates.confirmation?.variants[0]?.id).toBe('confirmation-updated');
    expect(venue.emailTemplates?.templates.cancelled?.variants[0]?.id).toBe('cancelled-live');
  });
});
