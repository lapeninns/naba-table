import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260711143000_whatsapp_first_mobile_notifications.sql',
);
const reviewMigrationPath = join(
  process.cwd(),
  'supabase/migrations/20260712204500_add_whatsapp_review_notification_ledger.sql',
);
const reviewProofPath = join(
  process.cwd(),
  'supabase/tests/whatsapp_review_notification_ledger.sql',
);

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8');
}

function readReviewMigration(): string {
  return readFileSync(reviewMigrationPath, 'utf8');
}

function readReviewProof(): string {
  return readFileSync(reviewProofPath, 'utf8');
}

describe('WhatsApp-first mobile notification ledger migration', () => {
  it('stores versioned booking and manager consent against the approved phone snapshot @contract @local-only', () => {
    const source = readMigration();

    expect(source).toContain('whatsapp_opt_in boolean NOT NULL DEFAULT false');
    expect(source).toContain('whatsapp_consent_phone text');
    expect(source).toContain('whatsapp_consent_source text');
    expect(source).toContain('whatsapp_consent_version text');
    expect(source).toContain('whatsapp_consent_actor_id uuid');
    expect(source).toContain('manager_whatsapp_enabled boolean NOT NULL DEFAULT false');
    expect(source).toContain('manager_whatsapp_consent_phone text');
  });

  it('separates logical notifications from WhatsApp and SMS attempts @contract @local-only', () => {
    const source = readMigration();

    expect(source).toContain('CREATE TABLE IF NOT EXISTS public.mobile_notifications');
    expect(source).toContain('logical_key text NOT NULL');
    expect(source).toContain('UNIQUE (restaurant_id, logical_key)');
    expect(source).toContain('CREATE TABLE IF NOT EXISTS public.mobile_notification_attempts');
    expect(source).toContain("channel text NOT NULL CHECK (channel IN ('whatsapp', 'sms'))");
    expect(source).toContain('UNIQUE (notification_id, channel)');
    expect(source).toContain('fallback_for_attempt_id uuid');
  });

  it('exposes one service-only atomic fallback claim and protects both ledgers with RLS @contract @security @local-only', () => {
    const source = readMigration();

    expect(source).toContain(
      'CREATE OR REPLACE FUNCTION public.claim_mobile_notification_fallback',
    );
    expect(source).toContain("wa.status IN ('delivered', 'read')");
    expect(source).toContain('ON CONFLICT (notification_id, channel) DO NOTHING');
    expect(source).toContain('ALTER TABLE public.mobile_notifications ENABLE ROW LEVEL SECURITY');
    expect(source).toContain(
      'ALTER TABLE public.mobile_notification_attempts ENABLE ROW LEVEL SECURITY',
    );
    expect(source).toContain('GRANT EXECUTE ON FUNCTION public.claim_mobile_notification_fallback');
    expect(source).toContain('TO service_role');
    expect(source).toContain('REVOKE ALL ON FUNCTION public.claim_mobile_notification_fallback');
  });
});

describe('WhatsApp review notification ledger migration', () => {
  it('adds one booking review notification for each booking and recipient snapshot @contract @local-only', () => {
    // Given: the review ledger expansion migration.
    const source = readReviewMigration();

    // When: its notification constraints are inspected.
    const reviewNotificationType = "'booking_review_request'";

    // Then: the type and one-shot booking-recipient key are explicit.
    expect(source).toContain(reviewNotificationType);
    expect(source).toContain('mobile_notifications_one_review_per_booking_recipient_idx');
    expect(source).toMatch(
      /\(\s*restaurant_id,\s*booking_id,\s*notification_type,\s*recipient_phone\s*\)/,
    );
  });

  it('rejects direct and fallback SMS attempts for a review notification @contract @security @local-only', () => {
    // Given: the review ledger expansion migration.
    const source = readReviewMigration();

    // When: its attempt policy and atomic fallback function are inspected.
    const reviewNotificationType = "'booking_review_request'";

    // Then: both write paths refuse an SMS channel for reviews.
    expect(source).toContain('guard_mobile_notification_attempt_policy');
    expect(source).toContain("NEW.channel = 'sms'");
    expect(source.match(new RegExp(reviewNotificationType, 'g'))?.length ?? 0).toBeGreaterThan(2);
    expect(source).toContain('Review notifications do not permit SMS attempts');
  });

  it('keeps review notifications tenant-attributable and migration replay-safe @contract @security @local-only', () => {
    // Given: the review ledger expansion migration.
    const source = readReviewMigration();

    // When: its tenant guard and DDL form are inspected.
    const normalized = source.toUpperCase();

    // Then: booking ownership is enforced and every replacement is idempotent.
    expect(source).toContain('guard_mobile_review_notification_tenant');
    expect(source).toContain('booking.restaurant_id = NEW.restaurant_id');
    expect(source).toContain('DROP TRIGGER IF EXISTS');
    expect(source).toContain('CREATE OR REPLACE FUNCTION');
    expect(normalized).toContain('CREATE UNIQUE INDEX IF NOT EXISTS');
  });

  it('proves an attempt cannot change the review recipient snapshot @contract @security @local-only', () => {
    // Given: the transactional staging invariant proof.
    const source = readReviewProof();

    // When: its attempt recipient mismatch case is inspected.
    const mismatchedRecipient = '+447000000099';

    // Then: the mismatch is expected to fail with a check violation.
    expect(source).toContain(mismatchedRecipient);
    expect(source).toContain('Attempt recipient mismatch was accepted');
  });
});
