import assert from 'node:assert/strict';

import {
  runContentRetention,
  scrubMixedFields,
  type ContentRetentionPort,
  type RetentionRun,
  type RetentionStoreResult,
} from '../../server/dual-sync/retention/engine.ts';

const NOW = new Date('2026-08-09T12:00:00.000Z');
const EXPIRED_AT = '2026-08-08T00:00:00.000Z';

let snapshotPresent = true;
let mixed: { ownerName: string; googleDescription: string | null } = {
  ownerName: 'Core owner value',
  googleDescription: 'provider content',
};
let auditMetadataPresent = true;

function results(mutating: boolean): readonly RetentionStoreResult[] {
  return [
    {
      storeKey: 'snapshot',
      action: 'delete',
      matchedCount: snapshotPresent ? 1 : 0,
      mutatedCount: mutating && snapshotPresent ? 1 : 0,
      oldestExpiresAt: snapshotPresent ? EXPIRED_AT : null,
      moreLikely: false,
    },
    {
      storeKey: 'mixed',
      action: 'scrub',
      matchedCount: mixed.googleDescription ? 1 : 0,
      mutatedCount: mutating && mixed.googleDescription ? 1 : 0,
      oldestExpiresAt: mixed.googleDescription ? EXPIRED_AT : null,
      moreLikely: false,
    },
    {
      storeKey: 'audit',
      action: 'metadata_only',
      matchedCount: auditMetadataPresent ? 1 : 0,
      mutatedCount: 0,
      oldestExpiresAt: null,
      moreLikely: false,
    },
  ];
}

const port: ContentRetentionPort = {
  census: async (_run: RetentionRun) => results(false),
  purge: async (_run: RetentionRun) => {
    const before = results(true);
    snapshotPresent = false;
    const scrubbed = scrubMixedFields(mixed, ['googleDescription']);
    mixed = {
      ownerName: typeof scrubbed.ownerName === 'string' ? scrubbed.ownerName : '',
      googleDescription:
        typeof scrubbed.googleDescription === 'string' ? scrubbed.googleDescription : null,
    };
    auditMetadataPresent = true;
    return before;
  },
};

const dry = await runContentRetention({ port, now: NOW, dryRun: true, limit: 500 });
assert.equal(dry.totals.mutated, 0);
assert.equal(snapshotPresent, true);
assert.equal(mixed.googleDescription, 'provider content');

const live = await runContentRetention({ port, now: NOW, dryRun: false, limit: 500 });
assert.equal(snapshotPresent, false);
assert.equal(mixed.ownerName, 'Core owner value');
assert.equal(mixed.googleDescription, null);
assert.equal(auditMetadataPresent, true);
assert.equal(live.level, 'page');
assert.doesNotMatch(JSON.stringify(live), /provider content|Core owner value/);

process.stdout.write(
  `${JSON.stringify({ ok: true, dryRunMutated: dry.totals.mutated, liveMutated: live.totals.mutated, ownerPreserved: mixed.ownerName === 'Core owner value', contentInResult: false })}\n`,
);
