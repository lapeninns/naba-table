/**
 * Phase 4 of the dual-sync rollout.
 *
 * Client-readable mirror of `server/dual-sync/flag.ts`. The dual-sync
 * UI surface is gated by `NEXT_PUBLIC_NABATABLE_DUAL_SYNC_ENABLED` with
 * the same default-on semantics: any deploy that has applied the
 * `dual_sync_*` migration sees the shell on the three settings pages,
 * but operators can disable the surface via the env var.
 *
 * Server-side API routes still gate independently via
 * `isDualSyncEnabled` so a misconfigured client cannot bypass the
 * server check.
 */

function readEnvBoolean(raw: string | undefined | null): boolean | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  return null;
}

export function isDualSyncUiEnabled(): boolean {
  // Public env vars must be inlined at build time, so we deliberately
  // reference the literal name. `process.env` is available in both the
  // browser bundle (replaced at build) and on the server.
  const raw =
    typeof process !== 'undefined' && process.env
      ? process.env.NEXT_PUBLIC_NABATABLE_DUAL_SYNC_ENABLED
      : undefined;
  return readEnvBoolean(raw) ?? true;
}
