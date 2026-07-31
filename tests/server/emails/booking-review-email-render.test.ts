import { describe, expect, it, vi } from 'vitest';

vi.mock('@/config', () => ({
  default: { email: { supportEmail: 'support@example.com' } },
}));
vi.mock('@/lib/site-url', () => ({
  getTrustedAppOrigin: () => 'https://app.nabatable.com',
  getTrustedSiteOrigin: () => 'https://nabatable.com',
}));
vi.mock('@/libs/resend', () => ({
  createEmailIdempotencyKey: vi.fn(() => 'idempotency-key'),
  sendEmail: vi.fn(),
  isEmailRecipientSuppressedError: vi.fn(() => false),
}));
vi.mock('@/server/bookings/manage-url', () => ({
  buildBookingManageUrl: () => 'https://nabatable.com/bookings/manage/booking-1',
}));
vi.mock('@/server/supabase', () => ({ getServiceSupabaseClient: vi.fn() }));
vi.mock('@/server/emails/email-delivery-log', () => ({
  findLatestEmailDeliveryByMessageId: vi.fn(),
  hasRecentEmailDelivery: vi.fn(),
  recordEmailDeliveryLog: vi.fn(),
}));

import { renderHtml } from '@/server/emails/bookings';

const REVIEW_URL = 'https://g.page/r/example/review';

const booking = {
  id: 'booking-1',
  restaurant_id: 'rest-1',
  status: 'completed',
  party_size: 2,
  reference: 'TESTREF',
  start_at: '2026-07-12T12:00:00.000Z',
  end_at: '2026-07-12T13:30:00.000Z',
  notes: null,
  customer_name: 'Guest Example',
  customer_email: 'guest@example.com',
} as never;

const venue = {
  name: 'Old Crown',
  address: '1 High Street, London',
  phone: '+44 20 7946 0000',
  timezone: 'Europe/London',
} as never;

const summary = { date: 'Sat 12 Jul', startTime: '1:00 PM', endTime: '2:30 PM', party: '2 People' };

function renderReviewEmail(overrides: { ctaUrl?: string; emailType?: string } = {}) {
  return renderHtml({
    booking,
    venue,
    summary,
    subject: 'How was your visit to Old Crown?',
    preheader: 'A quick review helps and only takes a moment.',
    headline: 'How was everything?',
    intro: 'Thanks for visiting Old Crown on Sat 12 Jul.',
    cue: '',
    ask: '',
    ctaLabel: 'Leave a Review',
    ctaUrl: REVIEW_URL,
    emailType: 'review_request',
    ...overrides,
  });
}

describe('review-request email rendering', () => {
  it('renders five same-destination star links with a caption @contract', () => {
    const html = renderReviewEmail();
    expect(html).toContain('Tap a star to rate your visit');
    expect(html.split('&#9733;').length - 1).toBe(5);
    // 5 star links + 1 CTA button, all pointing at the review destination.
    expect(html.split('g.page/r/example/review').length - 1).toBeGreaterThanOrEqual(6);
    expect(html).toContain('aria-label="Rate 5 stars"');
  });

  it('omits the star row when the CTA is not a review destination @contract', () => {
    const html = renderReviewEmail({ ctaUrl: undefined });
    expect(html).not.toContain('Tap a star to rate your visit');
    expect(html).not.toContain('&#9733;');
  });

  it('omits the star row on non-review emails even with a review-looking URL @contract', () => {
    const html = renderReviewEmail({ emailType: 'created' });
    expect(html).not.toContain('Tap a star to rate your visit');
  });

  it('renders no photo/ask note blocks when cue and ask are empty @contract', () => {
    const html = renderReviewEmail();
    expect(html).not.toContain('📸');
    expect(html).not.toContain('⭐');
  });
});
