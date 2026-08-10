/**
 * Runtime rollback controls for high-risk dual-sync flows.
 *
 * The dual-sync API and settings workspace are always available. These
 * controls only block specific write families before Core or Google data
 * can be mutated.
 */

import { getEnv } from '@/lib/env';

export interface DualSyncRuntimeControlInput {
  readonly restaurantId: string;
}

export interface DualSyncRuntimeControls {
  readonly importEnabled: boolean;
  readonly exportEnabled: boolean;
  readonly autoCandidatesEnabled: boolean;
  readonly highRiskExportsEnabled: boolean;
  readonly menuSyncEnabled: boolean;
  readonly attributesSyncEnabled: boolean;
  readonly scheduledRefreshEnabled: boolean;
  readonly pubsubIngestEnabled: boolean;
  readonly writeRolloutMode: 'off' | 'canary' | 'allowlist' | 'on';
  readonly canaryRestaurantId: string | null;
}

export interface DualSyncDecisionControlInput {
  readonly action: 'import_from_google' | 'export_to_google' | 'ignore';
  readonly sectionKey: string;
  readonly riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  readonly requiresManualReview?: boolean;
}

export function getDualSyncRuntimeControls(
  _input?: DualSyncRuntimeControlInput,
): DualSyncRuntimeControls {
  const parsed = getEnv();

  return {
    importEnabled: parsed.GBP_IMPORT_ENABLED,
    exportEnabled: parsed.GBP_EXPORT_ENABLED,
    autoCandidatesEnabled: parsed.GBP_AUTO_CANDIDATES_ENABLED,
    highRiskExportsEnabled: parsed.GBP_HIGH_RISK_EXPORTS_ENABLED,
    menuSyncEnabled: parsed.GBP_MENU_SYNC_ENABLED,
    attributesSyncEnabled: parsed.GBP_ATTRIBUTES_SYNC_ENABLED,
    scheduledRefreshEnabled: parsed.GBP_SCHEDULED_REFRESH_ENABLED,
    pubsubIngestEnabled: parsed.GBP_PUBSUB_INGEST_ENABLED,
    writeRolloutMode: parsed.GBP_WRITE_ROLLOUT_MODE,
    canaryRestaurantId: parsed.GBP_CANARY_RESTAURANT_ID ?? null,
  };
}

export function isDualSyncAutoCandidatesEnabled(input?: DualSyncRuntimeControlInput): boolean {
  return getDualSyncRuntimeControls(input).autoCandidatesEnabled;
}

export function isDualSyncScheduledRefreshEnabled(input?: DualSyncRuntimeControlInput): boolean {
  return getDualSyncRuntimeControls(input).scheduledRefreshEnabled;
}

export function getDualSyncDecisionDisabledReason(
  input: DualSyncDecisionControlInput,
  controls: DualSyncRuntimeControls = getDualSyncRuntimeControls(),
): string | null {
  if (input.action === 'ignore') return null;
  if (input.sectionKey === 'foodMenus' && !controls.menuSyncEnabled) {
    return 'Food menu sync is disabled for this deployment.';
  }
  if (input.sectionKey === 'businessContext.attributes' && !controls.attributesSyncEnabled) {
    return 'Google attribute sync is disabled for this deployment.';
  }
  if (input.action === 'import_from_google' && !controls.importEnabled) {
    return 'Google imports are disabled for this deployment.';
  }
  if (input.action === 'export_to_google') {
    if (!controls.exportEnabled) return 'Google exports are disabled for this deployment.';
    const highRisk =
      input.requiresManualReview === true ||
      input.riskLevel === 'high' ||
      input.riskLevel === 'critical';
    if (highRisk && !controls.highRiskExportsEnabled) {
      return 'High-risk Google exports are disabled for this deployment.';
    }
  }
  return null;
}
