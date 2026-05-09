import { afterEach, describe, expect, it } from 'vitest';

import {
  getDualSyncDecisionDisabledReason,
  getDualSyncRuntimeFlags,
  isDualSyncAutoCandidatesEnabled,
  isDualSyncEnabled,
  isDualSyncScheduledRefreshEnabled,
} from '@/server/dual-sync/flag';

const FLAG_NAMES = [
  'GBP_SYNC_ENABLED',
  'NABATABLE_DUAL_SYNC_ENABLED',
  'GBP_IMPORT_ENABLED',
  'GBP_EXPORT_ENABLED',
  'GBP_AUTO_CANDIDATES_ENABLED',
  'GBP_HIGH_RISK_EXPORTS_ENABLED',
  'GBP_MENU_SYNC_ENABLED',
  'GBP_ATTRIBUTES_SYNC_ENABLED',
  'GBP_SCHEDULED_REFRESH_ENABLED',
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
});

describe('dual-sync runtime flags', () => {
  it('defaults rollout flags to enabled', () => {
    for (const name of FLAG_NAMES) {
      delete process.env[name];
    }

    expect(isDualSyncEnabled()).toBe(true);
    expect(isDualSyncAutoCandidatesEnabled()).toBe(true);
    expect(isDualSyncScheduledRefreshEnabled()).toBe(true);
    expect(getDualSyncRuntimeFlags()).toMatchObject({
      syncEnabled: true,
      importEnabled: true,
      exportEnabled: true,
      autoCandidatesEnabled: true,
      highRiskExportsEnabled: true,
      menuSyncEnabled: true,
      attributesSyncEnabled: true,
      scheduledRefreshEnabled: true,
    });
  });

  it('supports granular rollback flags for risky decision families', () => {
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
