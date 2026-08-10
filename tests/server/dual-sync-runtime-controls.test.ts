import { afterEach, describe, expect, it } from 'vitest';

import { resetEnvCache } from '@/lib/env';
import {
  getDualSyncDecisionDisabledReason,
  getDualSyncRuntimeControls,
  isDualSyncAutoCandidatesEnabled,
  isDualSyncScheduledRefreshEnabled,
} from '@/server/dual-sync/runtime-controls';

const FLAG_NAMES = [
  'GBP_IMPORT_ENABLED',
  'GBP_EXPORT_ENABLED',
  'GBP_AUTO_CANDIDATES_ENABLED',
  'GBP_HIGH_RISK_EXPORTS_ENABLED',
  'GBP_MENU_SYNC_ENABLED',
  'GBP_ATTRIBUTES_SYNC_ENABLED',
  'GBP_SCHEDULED_REFRESH_ENABLED',
  'GBP_PUBSUB_INGEST_ENABLED',
  'GBP_WRITE_ROLLOUT_MODE',
  'GBP_CANARY_RESTAURANT_ID',
] as const;

const originalEnv = new Map<string, string | undefined>(
  FLAG_NAMES.map((name) => [name, process.env[name]]),
);

afterEach(() => {
  for (const name of FLAG_NAMES) {
    const original = originalEnv.get(name);
    if (original === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = original;
    }
  }
  resetEnvCache();
});

describe('dual-sync runtime controls', () => {
  it('defaults write controls to fail closed while retaining candidate discovery', () => {
    for (const name of FLAG_NAMES) {
      delete process.env[name];
    }

    expect(isDualSyncAutoCandidatesEnabled()).toBe(true);
    expect(isDualSyncScheduledRefreshEnabled()).toBe(false);
    expect(getDualSyncRuntimeControls()).toMatchObject({
      importEnabled: false,
      exportEnabled: false,
      autoCandidatesEnabled: true,
      highRiskExportsEnabled: false,
      menuSyncEnabled: false,
      attributesSyncEnabled: false,
      scheduledRefreshEnabled: false,
      pubsubIngestEnabled: false,
      writeRolloutMode: 'off',
      canaryRestaurantId: null,
    });
  });

  it('supports granular rollback controls for risky decision families', () => {
    process.env.GBP_EXPORT_ENABLED = 'false';
    process.env.GBP_HIGH_RISK_EXPORTS_ENABLED = 'false';
    process.env.GBP_MENU_SYNC_ENABLED = 'false';
    process.env.GBP_ATTRIBUTES_SYNC_ENABLED = 'false';

    expect(
      getDualSyncDecisionDisabledReason({
        action: 'export_to_google',
        sectionKey: 'profile',
        riskLevel: 'critical',
        requiresManualReview: true,
      }),
    ).toBe('Google exports are disabled for this deployment.');
    expect(
      getDualSyncDecisionDisabledReason({
        action: 'import_from_google',
        sectionKey: 'foodMenus',
        riskLevel: 'high',
      }),
    ).toBe('Food menu sync is disabled for this deployment.');
    expect(
      getDualSyncDecisionDisabledReason({
        action: 'export_to_google',
        sectionKey: 'businessContext.attributes',
        riskLevel: 'high',
      }),
    ).toBe('Google attribute sync is disabled for this deployment.');
  });

  it('uses high-risk export rollback when general exports remain enabled', () => {
    process.env.GBP_EXPORT_ENABLED = 'true';
    process.env.GBP_HIGH_RISK_EXPORTS_ENABLED = 'false';

    expect(
      getDualSyncDecisionDisabledReason({
        action: 'export_to_google',
        sectionKey: 'profile',
        riskLevel: 'critical',
        requiresManualReview: true,
      }),
    ).toBe('High-risk Google exports are disabled for this deployment.');
  });
});
