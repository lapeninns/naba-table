import { describe, expect, it } from 'vitest';

import {
  computeContentTtlDays,
  inheritProviderObservation,
  retentionReadiness,
  runContentRetention,
  scrubMixedFields,
} from '@/server/dual-sync/retention';

describe('GBP content retention', () => {
  it('computes the backup-aware TTL without a fallback', () => {
    expect(computeContentTtlDays(1)).toBe(28);
    expect(computeContentTtlDays(10)).toBe(19);
    expect(() => computeContentTtlDays(29)).toThrow('practical positive TTL');
  });

  it('blocks writes when current attested evidence is absent or stale', () => {
    const now = new Date('2026-08-09T12:00:00.000Z');
    expect(retentionReadiness(null, now)).toEqual({ eligible: false, reason: 'evidence_missing' });
    expect(
      retentionReadiness(
        {
          backupWindowDays: 1,
          liveContentTtlDays: 28,
          backupRestoreVerifiedAt: '2026-08-01T00:00:00.000Z',
          pitrVerifiedAt: '2026-08-01T00:00:00.000Z',
          policyApprovedAt: '2026-08-01T00:00:00.000Z',
          transformedContentApprovedAt: null,
          validUntil: '2026-08-10T00:00:00.000Z',
          evidenceHash: 'a'.repeat(64),
        },
        now,
      ),
    ).toEqual({ eligible: false, reason: 'transformed_content_policy_missing' });
  });

  it('inherits the original observation and expiry when content is copied', () => {
    const original = {
      observedAt: '2026-08-01T00:00:00.000Z',
      expiresAt: '2026-08-29T00:00:00.000Z',
      externalProfileRowId: 'profile-1',
      connectionGeneration: 4,
      consentEpoch: 7,
    };
    expect(inheritProviderObservation(original)).toEqual(original);
  });

  it('scrubs only expired Google fields from a mixed row', () => {
    const row = { name: 'Owner name', description: 'Google description', phone: 'Owner phone' };
    expect(scrubMixedFields(row, ['description'])).toEqual({
      name: 'Owner name',
      description: null,
      phone: 'Owner phone',
    });
  });

  it('runs a real dry-run census without invoking mutation', async () => {
    const calls: string[] = [];
    const result = await runContentRetention({
      port: {
        census: async () => {
          calls.push('census');
          return [
            {
              storeKey: 'snapshots',
              action: 'delete',
              matchedCount: 2,
              mutatedCount: 0,
              oldestExpiresAt: '2026-08-08T00:00:00.000Z',
              moreLikely: false,
            },
          ];
        },
        purge: async () => {
          calls.push('purge');
          return [];
        },
      },
      now: new Date('2026-08-09T00:00:00.000Z'),
      dryRun: true,
      limit: 500,
      timeBudgetMs: 10_000,
    });
    expect(calls).toEqual(['census']);
    expect(result.totals).toEqual({ matched: 2, mutated: 0 });
    expect(JSON.stringify(result)).not.toContain('Google description');
  });

  it('caps work and reports warning and paging thresholds from the oldest expiry', async () => {
    const seen: Array<{ limit: number; timeBudgetMs: number }> = [];
    const port = {
      census: async () => [],
      purge: async (run: { limit: number; timeBudgetMs: number }) => {
        seen.push(run);
        return [
          {
            storeKey: 'snapshots',
            action: 'delete' as const,
            matchedCount: 5_000,
            mutatedCount: 5_000,
            oldestExpiresAt: '2026-08-07T23:59:59.999Z',
            moreLikely: true,
          },
        ];
      },
    };
    const result = await runContentRetention({
      port,
      now: new Date('2026-08-09T00:00:00.000Z'),
      dryRun: false,
      limit: 50_000,
      timeBudgetMs: 500_000,
    });
    expect(seen).toEqual([expect.objectContaining({ limit: 5_000, timeBudgetMs: 60_000 })]);
    expect(result.level).toBe('page');
    expect(result.moreLikely).toBe(true);
  });
});
