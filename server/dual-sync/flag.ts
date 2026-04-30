/**
 * Phase 3d of the unified dual-sync engine.
 *
 * Feature flag for the dual-sync settings surface.
 *
 * Default is `true`: any environment that has applied the
 * `dual_sync_*` migration will see the shell on the three restaurant
 * settings pages. Operators can disable it on a per-deploy basis by
 * setting `NABATABLE_DUAL_SYNC_ENABLED=false` (or `0`).
 *
 * The flag is intentionally environment-based rather than per-restaurant
 * during the rollout window; once the engine has shipped to all tenants
 * this helper can collapse into a constant `true`.
 */

export interface DualSyncFlagInput {
  readonly restaurantId: string;
}

function readEnvBoolean(name: string): boolean | null {
  const raw =
    (typeof process !== 'undefined' && process.env ? process.env[name] : undefined) ?? null;
  if (raw === null) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  return null;
}

export function isDualSyncEnabled(_input?: DualSyncFlagInput): boolean {
  const override = readEnvBoolean('NABATABLE_DUAL_SYNC_ENABLED');
  return override ?? true;
}
