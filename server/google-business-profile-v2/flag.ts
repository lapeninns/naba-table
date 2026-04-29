/**
 * Phase 6 cutover of the GBP Dual-Sync V2 architecture.
 *
 * V2 is now the canonical sync surface. This compatibility helper remains so
 * older route modules and tests do not need broad import churn, but it no
 * longer reads rollout environment flags.
 */

export interface GbpSyncV2FlagInput {
  readonly restaurantId: string;
}

export function isGbpSyncV2Enabled(_input: GbpSyncV2FlagInput): boolean {
  return true;
}
