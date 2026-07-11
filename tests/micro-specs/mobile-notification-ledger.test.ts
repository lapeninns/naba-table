import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260711143000_whatsapp_first_mobile_notifications.sql',
);

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8');
}

describe('WhatsApp-first mobile notification ledger migration', () => {
  it('stores versioned booking and manager consent against the approved phone snapshot', () => {
    const source = readMigration();

    expect(source).toContain('whatsapp_opt_in boolean NOT NULL DEFAULT false');
    expect(source).toContain('whatsapp_consent_phone text');
    expect(source).toContain('whatsapp_consent_source text');
    expect(source).toContain('whatsapp_consent_version text');
    expect(source).toContain('whatsapp_consent_actor_id uuid');
    expect(source).toContain('manager_whatsapp_enabled boolean NOT NULL DEFAULT false');
    expect(source).toContain('manager_whatsapp_consent_phone text');
  });

  it('separates logical notifications from WhatsApp and SMS attempts', () => {
    const source = readMigration();

    expect(source).toContain('CREATE TABLE IF NOT EXISTS public.mobile_notifications');
    expect(source).toContain('logical_key text NOT NULL');
    expect(source).toContain('UNIQUE (restaurant_id, logical_key)');
    expect(source).toContain('CREATE TABLE IF NOT EXISTS public.mobile_notification_attempts');
    expect(source).toContain("channel text NOT NULL CHECK (channel IN ('whatsapp', 'sms'))");
    expect(source).toContain('UNIQUE (notification_id, channel)');
    expect(source).toContain('fallback_for_attempt_id uuid');
  });

  it('exposes one service-only atomic fallback claim and protects both ledgers with RLS', () => {
    const source = readMigration();

    expect(source).toContain('CREATE OR REPLACE FUNCTION public.claim_mobile_notification_fallback');
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
