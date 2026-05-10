/**
 * Runtime rollback controls for high-risk dual-sync flows.
 *
 * The dual-sync API and settings workspace are always available. These
 * controls only block specific write families before Core or Google data
 * can be mutated.
 */

export interface DualSyncFlagInput {
  readonly restaurantId: string;
}

export interface DualSyncRuntimeFlags {
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

export function getDualSyncRuntimeFlags(_input?: DualSyncFlagInput): DualSyncRuntimeFlags {
  return {
    importEnabled: readEnvBoolean('GBP_IMPORT_ENABLED') ?? true,
    exportEnabled: readEnvBoolean('GBP_EXPORT_ENABLED') ?? true,
    autoCandidatesEnabled: readEnvBoolean('GBP_AUTO_CANDIDATES_ENABLED') ?? true,
    highRiskExportsEnabled: readEnvBoolean('GBP_HIGH_RISK_EXPORTS_ENABLED') ?? true,
    menuSyncEnabled: readEnvBoolean('GBP_MENU_SYNC_ENABLED') ?? true,
    attributesSyncEnabled: readEnvBoolean('GBP_ATTRIBUTES_SYNC_ENABLED') ?? true,
    scheduledRefreshEnabled: readEnvBoolean('GBP_SCHEDULED_REFRESH_ENABLED') ?? true,
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
