import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260904150000_review_growth_engine.sql',
);

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8');
}

describe('review growth engine migration', () => {
  it('creates a tenant-scoped journey and immutable idempotent event ledger @contract @security @local-only', () => {
    const source = readMigration();

    expect(source).toContain('CREATE TABLE IF NOT EXISTS public.review_requests');
    expect(source).toContain('UNIQUE (restaurant_id, booking_id)');
    expect(source).toContain('CREATE TABLE IF NOT EXISTS public.review_request_events');
    expect(source).toContain('idempotency_key text NOT NULL UNIQUE');
    expect(source).toContain('ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY');
    expect(source).toContain('ALTER TABLE public.review_request_events ENABLE ROW LEVEL SECURITY');
    expect(source).toContain('REVOKE ALL ON TABLE public.review_requests FROM authenticated');
    expect(source).toContain('REVOKE ALL ON TABLE public.review_request_events FROM authenticated');
    expect(source).toContain(
      'GRANT SELECT, INSERT ON TABLE public.review_request_events TO service_role',
    );
    expect(source).not.toContain('GRANT ALL ON TABLE public.review_request_events TO service_role');
  });

  it('enforces one journey, a 90-day guest cooldown, and WhatsApp-first sequencing atomically @contract @local-only', () => {
    const source = readMigration();

    expect(source).toContain('CREATE OR REPLACE FUNCTION public.schedule_review_request_v1');
    expect(source).toContain("interval '90 days'");
    expect(source).toContain("v_primary_channel := 'whatsapp'");
    expect(source).toContain("v_followup_scheduled_for := p_scheduled_for + interval '48 hours'");
    expect(source).toContain("v_suppression_reason := 'guest_cooldown'");
    expect(source).toContain('pg_advisory_xact_lock');
    expect(source).toContain('TO service_role');
  });

  it('records events idempotently and stops follow-ups after click or observed review @contract @local-only', () => {
    const source = readMigration();

    expect(source).toContain('CREATE OR REPLACE FUNCTION public.record_review_request_event_v1');
    expect(source).toContain('ON CONFLICT DO NOTHING');
    expect(source).toContain("p_event_type IN ('link_clicked', 'review_observed')");
    expect(source).toContain('CREATE OR REPLACE FUNCTION public.can_send_review_request_v1');
    expect(source).toContain(
      "request.state NOT IN ('clicked', 'observed', 'suppressed', 'expired')",
    );
    expect(source).toContain('request.total_asks < 2');
    expect(source).toContain(
      'CREATE OR REPLACE FUNCTION public.accelerate_review_email_followup_v1',
    );
    expect(source).toContain("intent.email_type = 'review_request'");
  });

  it('links existing delivery ledgers and exposes a restaurant-scoped dashboard aggregate @contract @local-only', () => {
    const source = readMigration();

    expect(source).toContain('ADD COLUMN IF NOT EXISTS review_request_id uuid');
    expect(source).toContain('mobile_notifications_review_request_idx');
    expect(source).toContain('email_dispatch_intents_review_request_idx');
    expect(source).toContain('email_delivery_log_review_request_idx');
    expect(source).toContain('CREATE OR REPLACE FUNCTION public.get_review_growth_dashboard_v1');
    expect(source).toContain('p_restaurant_id uuid');
    expect(source).toContain('p_from timestamptz');
    expect(source).toContain('p_to timestamptz');
    expect(source).toMatch(
      /count\(\*\) FILTER \(WHERE EXISTS \(\s*SELECT 1 FROM scoped_events event\s*WHERE event\.review_request_id = request\.id AND event\.event_type = 'link_clicked'\s*\)\)::integer AS clicked/,
    );
  });

  it('deduplicates Google review observations without storing review text or reviewer PII @contract @security @local-only', () => {
    const source = readMigration();

    expect(source).toContain('CREATE TABLE IF NOT EXISTS public.review_provider_events');
    expect(source).toContain('provider_event_hash text NOT NULL');
    expect(source).toContain('UNIQUE (restaurant_id, provider, provider_event_hash)');
    expect(source).toContain(
      'CREATE OR REPLACE FUNCTION public.record_google_review_notification_v1',
    );
    expect(source).not.toMatch(/reviewer_(name|email|phone)/i);
    expect(source).not.toMatch(/review_text/i);
  });
});
