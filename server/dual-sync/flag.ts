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

export interface DualSyncRuntimeFlags {
  readonly syncEnabled: boolean;
  readonly importEnabled: boolean;
  readonly exportEnabled: boolean;
  readonly autoCandidatesEnabled: boolean;
  readonly highRiskExportsEnabled: boolean;
  readonly menuSyncEnabled: boolean;
  readonly attributesSyncEnabled: boolean;
  readonly scheduledRefreshEnabled: boolean;
}

export interface DualSyncDecisionFlagInput {
  readonly action: 'import_from_google' | 'export_to_google' | 'ignore';
  readonly sectionKey: string;
  readonly riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  readonly requiresManualReview?: boolean;
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

function readFirstEnvBoolean(names: ReadonlyArray<string>): boolean | null {
  for (const name of names) {
    const value = readEnvBoolean(name);
    if (value !== null) return value;
  }
  return null;
}

export function isDualSyncEnabled(_input?: DualSyncFlagInput): boolean {
  const override = readFirstEnvBoolean(['GBP_SYNC_ENABLED', 'NABATABLE_DUAL_SYNC_ENABLED']);
  return override ?? true;
}

export function getDualSyncRuntimeFlags(input?: DualSyncFlagInput): DualSyncRuntimeFlags {
  const syncEnabled = isDualSyncEnabled(input);
  return {
    syncEnabled,
    importEnabled: syncEnabled && (readEnvBoolean('GBP_IMPORT_ENABLED') ?? true),
    exportEnabled: syncEnabled && (readEnvBoolean('GBP_EXPORT_ENABLED') ?? true),
    autoCandidatesEnabled: syncEnabled && (readEnvBoolean('GBP_AUTO_CANDIDATES_ENABLED') ?? true),
    highRiskExportsEnabled:
      syncEnabled && (readEnvBoolean('GBP_HIGH_RISK_EXPORTS_ENABLED') ?? true),
    menuSyncEnabled: syncEnabled && (readEnvBoolean('GBP_MENU_SYNC_ENABLED') ?? true),
    attributesSyncEnabled: syncEnabled && (readEnvBoolean('GBP_ATTRIBUTES_SYNC_ENABLED') ?? true),
    scheduledRefreshEnabled:
      syncEnabled && (readEnvBoolean('GBP_SCHEDULED_REFRESH_ENABLED') ?? true),
  };
}

export function isDualSyncAutoCandidatesEnabled(input?: DualSyncFlagInput): boolean {
  return getDualSyncRuntimeFlags(input).autoCandidatesEnabled;
}

export function isDualSyncScheduledRefreshEnabled(input?: DualSyncFlagInput): boolean {
  return getDualSyncRuntimeFlags(input).scheduledRefreshEnabled;
}

export function getDualSyncDecisionDisabledReason(
  input: DualSyncDecisionFlagInput,
  flags: DualSyncRuntimeFlags = getDualSyncRuntimeFlags(),
): string | null {
  if (input.action === 'ignore') return null;
  if (!flags.syncEnabled) return 'Dual-sync is disabled for this deployment.';
  if (input.sectionKey === 'foodMenus' && !flags.menuSyncEnabled) {
    return 'Food menu sync is disabled for this deployment.';
  }
  if (input.sectionKey === 'businessContext.attributes' && !flags.attributesSyncEnabled) {
    return 'Google attribute sync is disabled for this deployment.';
  }
  if (input.action === 'import_from_google' && !flags.importEnabled) {
    return 'Google imports are disabled for this deployment.';
  }
  if (input.action === 'export_to_google') {
    if (!flags.exportEnabled) return 'Google exports are disabled for this deployment.';
    const highRisk =
      input.requiresManualReview === true ||
      input.riskLevel === 'high' ||
      input.riskLevel === 'critical';
    if (highRisk && !flags.highRiskExportsEnabled) {
      return 'High-risk Google exports are disabled for this deployment.';
    }
  }
  return null;
}
