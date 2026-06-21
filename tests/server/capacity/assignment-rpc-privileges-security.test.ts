import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Codex security findings triage-003/019/022/026/061 (confirmed) + triage-014/015/016/025/029
// (needs_review): SECURITY DEFINER assignment / booking-lifecycle RPCs that still exist in the
// deployed DB (types/supabase.ts) with no REVOKE in the repo migration tree, so the PostgreSQL
// default PUBLIC EXECUTE grant is likely still reachable via PostgREST by anon/authenticated.
//
// These functions were created by migrations later squashed/removed from the tree (commit
// 8ca36098 "Clean"); they persist only in the remote DB, often with multiple overloads. The
// hardening migration therefore loops over pg_proc by name to REVOKE EXECUTE from
// PUBLIC/anon/authenticated and GRANT only service_role for every overload, idempotently.

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260621120001_harden_assignment_rpc_privileges.sql',
);
const migration = readFileSync(migrationPath, 'utf8');
const compactMigration = migration.replace(/\s+/g, ' ');

const targetFunctions = [
  'assign_tables_atomic_v2',
  'assign_single_table',
  'assign_merged_tables',
  'assign_tables_atomic',
  'refresh_table_status',
  'update_booking_with_capacity_check',
  'apply_booking_state_transition',
  'sync_confirmed_assignment_windows',
  'confirm_hold_assignment_with_transition',
];

describe('assignment RPC execute-privilege hardening migration', () => {
  it('targets every confirmed/needs-review unprotected SECURITY DEFINER RPC by name', () => {
    for (const fn of targetFunctions) {
      expect(compactMigration, `migration must target ${fn}`).toContain(`'${fn}'`);
    }
  });

  it('revokes EXECUTE from PUBLIC/anon/authenticated and grants only service_role', () => {
    expect(compactMigration).toContain(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
    );
    expect(compactMigration).toContain('GRANT EXECUTE ON FUNCTION %s TO service_role');
  });

  it('never re-grants EXECUTE to anon or authenticated', () => {
    expect(compactMigration).not.toMatch(
      /GRANT EXECUTE ON FUNCTION[^;]*TO (anon|authenticated)\b/,
    );
  });

  it('is overload-safe and idempotent via a pg_proc existence loop (no bare CREATE FUNCTION)', () => {
    expect(compactMigration).toContain('pg_proc');
    expect(compactMigration).toMatch(/regprocedure/);
    expect(compactMigration).not.toMatch(/CREATE (OR REPLACE )?FUNCTION/i);
  });
});
