import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const checker = path.resolve('scripts/verify/gbp-release-readiness.mjs');

const requiredArtifactIds = [
  'deployment-readback',
  'migration-readback',
  'environment-presence-readback',
  'cron-scheduler-readback',
  'canonical-route-smoke',
  'legacy-route-traffic-baseline',
  'write-grant-readback',
  'canary-set-readback',
  'canary-readback',
  'canary-restore-readback',
  'pubsub-topic-readback',
  'pubsub-subscription-readback',
  'pubsub-dlq-readback',
  'pubsub-iam-readback',
  'key-rotation-dry-run',
  'retention-census',
  'backup-pitr-census',
  'legacy-retirement-traffic-evidence',
] as const;

function validArtifact(id: string) {
  return {
    id,
    status: 'verified',
    recordedAt: '2026-08-10T12:00:00.000Z',
    source: 'external-readback',
    reference: `artifact-${id}`,
    sha256: 'a'.repeat(64),
  };
}

async function fixture(input: object): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'nabatable-gbp-release-readiness-'));
  await writeFile(path.join(root, 'readiness.json'), JSON.stringify(input));
  return root;
}

function run(root: string) {
  return spawnSync(process.execPath, [checker, '--input', path.join(root, 'readiness.json')], {
    encoding: 'utf8',
  });
}

describe('GBP release readiness checker', () => {
  it('fails closed when required external artifact metadata is absent', async () => {
    // Given
    const root = await fixture({ version: 1, release: { environment: 'staging' }, artifacts: [] });

    try {
      // When
      const result = run(root);

      // Then
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: false,
        counts: { required: requiredArtifactIds.length, verified: 0 },
        missing: requiredArtifactIds,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('accepts only a complete metadata-only external evidence set', async () => {
    // Given
    const root = await fixture({
      version: 1,
      release: {
        environment: 'staging',
        deploySha: '0123456789abcdef0123456789abcdef01234567',
        recordedAt: '2026-08-10T12:00:00.000Z',
      },
      artifacts: requiredArtifactIds.map(validArtifact),
    });

    try {
      // When
      const result = run(root);

      // Then
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        ok: true,
        counts: { required: requiredArtifactIds.length, verified: requiredArtifactIds.length },
        missing: [],
        invalid: [],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('does not echo potentially sensitive external artifact metadata on failure', async () => {
    // Given
    const root = await fixture({
      version: 1,
      release: {
        environment: 'production',
        deploySha: '0123456789abcdef0123456789abcdef01234567',
        recordedAt: '2026-08-10T12:00:00.000Z',
      },
      artifacts: [
        {
          ...validArtifact('deployment-readback'),
          reference: 'do-not-print-this-artifact-reference',
          sha256: 'not-a-digest',
        },
      ],
    });

    try {
      // When
      const result = run(root);

      // Then
      expect(result.status).toBe(1);
      expect(result.stdout).not.toContain('do-not-print-this-artifact-reference');
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: false,
        invalid: ['deployment-readback'],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
