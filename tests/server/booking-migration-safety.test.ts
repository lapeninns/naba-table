import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readMigration(name: string): string {
  return fs.readFileSync(path.join(process.cwd(), 'supabase/migrations', name), 'utf8');
}

/** The SQL a migration executes: line comments removed, so header prose never matches. */
function executableSql(sql: string): string {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

describe('20260927100000 booking create idempotency: locking', () => {
  const sql = executableSql(readMigration('20260927100000_booking_create_idempotency.sql'));

  it('fails fast on a busy bookings table instead of queueing writers behind the lock', () => {
    expect(sql).toMatch(/SET LOCAL lock_timeout = '5s';/);
    expect(sql).toMatch(/SET LOCAL statement_timeout = '\d+s';/);
    expect(sql.indexOf('SET LOCAL lock_timeout')).toBeLessThan(sql.indexOf('LOCK TABLE'));
  });

  it('takes the bookings lock only after every definition, for the dedupe and index build', () => {
    const lockAt = sql.indexOf('LOCK TABLE public.bookings IN SHARE ROW EXCLUSIVE MODE;');
    expect(lockAt).toBeGreaterThan(-1);
    for (const definition of [
      'CREATE TABLE IF NOT EXISTS public.booking_idempotency_key_dedupe_audit',
      'CREATE OR REPLACE FUNCTION public.booking_create_idempotent_replay_result',
      'CREATE OR REPLACE FUNCTION public.create_booking_with_capacity_check',
    ]) {
      expect(sql.indexOf(definition)).toBeGreaterThan(-1);
      expect(sql.indexOf(definition)).toBeLessThan(lockAt);
    }
    // Dedupe runs under the lock, and the unique index is built after it, before COMMIT.
    const dedupeAt = sql.indexOf('WITH ranked AS (');
    const indexAt = sql.indexOf(
      'CREATE UNIQUE INDEX IF NOT EXISTS bookings_restaurant_idempotency_key_unique',
    );
    expect(dedupeAt).toBeGreaterThan(lockAt);
    expect(indexAt).toBeGreaterThan(dedupeAt);
    expect(sql.indexOf('COMMIT;')).toBeGreaterThan(indexAt);
    expect(sql).not.toMatch(/CONCURRENTLY/);
  });
});

describe('20260927250000 booking owner backfill: operator-run only', () => {
  const sql = executableSql(readMigration('20260927250000_backfill_booking_owner_binding.sql'));

  it('defines the audit table and the function but never runs the backfill itself', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.booking_owner_backfill_audit');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.backfill_booking_owner_binding_v1');
    // The migration only defines it; an operator runs it after the project check.
    expect(sql).not.toMatch(
      /(SELECT|PERFORM|CALL)\s+public\.backfill_booking_owner_binding_v1\s*\(/i,
    );
  });

  it('keeps the function operator-only', () => {
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.backfill_booking_owner_binding_v1(uuid) FROM PUBLIC, anon, authenticated, service_role;',
    );
    expect(sql).not.toMatch(/SECURITY DEFINER/i);
  });
});
