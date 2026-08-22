import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const foundationPath = path.join(
  repoRoot,
  'supabase/migrations/20260809120000_gbp_write_safety_foundation.sql',
);
const repairPath = path.join(
  repoRoot,
  'supabase/migrations/20260822210500_repair_gbp_digest_search_paths.sql',
);

function digestBackedFunctionNames(source: string): readonly string[] {
  return source
    .split(/(?=create or replace function public\.)/)
    .map((functionSource) => {
      const functionEnd = functionSource.indexOf('$$;');
      return functionEnd === -1 ? functionSource : functionSource.slice(0, functionEnd + 3);
    })
    .filter(
      (functionSource) =>
        functionSource.includes('set search_path = public as $$') &&
        functionSource.includes('digest('),
    )
    .map(
      (functionSource) =>
        /^create or replace function public\.([a-z0-9_]+)\(/.exec(functionSource)?.[1],
    )
    .filter((name): name is string => name !== undefined)
    .sort();
}

describe('GBP digest search-path repair migration', () => {
  it('adds the pgcrypto extension schema to every digest-backed GBP function', () => {
    const foundation = fs.readFileSync(foundationPath, 'utf8').toLowerCase();
    const repair = fs.readFileSync(repairPath, 'utf8').toLowerCase();
    const affectedFunctions = digestBackedFunctionNames(foundation);

    expect(affectedFunctions).toEqual([
      'cancel_gbp_claimed_bundle_before_dispatch_v1',
      'claim_gbp_write_bundle_v1',
      'dispatch_gbp_write_bundle_v1',
      'dispatch_gbp_write_grant_v1',
      'enqueue_gbp_core_change_v1',
      'enqueue_gbp_operating_hours_change_v1',
      'enqueue_gbp_restaurants_change_v1',
      'enqueue_gbp_service_period_change_v1',
      'finalize_gbp_write_bundle_v1',
      'finalize_gbp_write_grant_v1',
      'persist_gbp_dual_sync_snapshot_run_v1',
      'persist_gbp_external_profile_snapshot_v1',
      'persist_gbp_food_menu_snapshot_v1',
      'record_gbp_grant_created_v1',
      'recover_stale_gbp_dispatched_grants_v1',
      'set_gbp_readiness_hash_v1',
    ]);
    expect(repair).toContain("namespace.nspname = 'public'");
    expect(repair).toContain('set search_path = public, extensions');

    for (const functionName of affectedFunctions) {
      expect(repair).toContain(`'${functionName}'`);
    }
  });
});
