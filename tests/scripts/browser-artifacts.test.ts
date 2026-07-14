import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createQaRunId, ensureQaRunId, getQaArtifactDirs, isValidQaRunId } from '@/scripts/qa';

describe('QA run id and artifact directories', () => {
  it('generates and stores a path-safe QA_RUN_ID when one is absent', () => {
    const env: Record<string, string | undefined> = {};

    const runId = ensureQaRunId(env, {
      now: () => new Date('2026-05-16T12:34:56.789Z'),
      randomUUID: () => '12345678-90ab-cdef-1234-567890abcdef',
    });

    expect(runId).toBe('qa-20260516T123456789Z-1234567890ab');
    expect(env.QA_RUN_ID).toBe(runId);
    expect(isValidQaRunId(runId)).toBe(true);
  });

  it('rejects unsafe user-provided QA_RUN_ID values before building paths', () => {
    const env = { QA_RUN_ID: '../prod' };

    expect(() => ensureQaRunId(env)).toThrow(/path-safe/);
  });

  it('resolves deterministic per-run artifact directories', () => {
    const projectRoot = path.resolve('/repo/nabatableLP');
    const dirs = getQaArtifactDirs({
      env: { QA_RUN_ID: 'qa-local-123' },
      projectRoot,
    });

    expect(dirs).toEqual({
      apiDir: path.join(projectRoot, 'test-results/qa/qa-local-123/api'),
      browserDir: path.join(projectRoot, 'test-results/qa/qa-local-123/browser'),
      cleanupRegistryPath: path.join(
        projectRoot,
        'test-results/qa/qa-local-123/cleanup-registry.json',
      ),
      logsDir: path.join(projectRoot, 'test-results/qa/qa-local-123/logs'),
      rootDir: path.join(projectRoot, 'test-results/qa'),
      runDir: path.join(projectRoot, 'test-results/qa/qa-local-123'),
      runId: 'qa-local-123',
    });
  });

  it('does not allow artifact roots outside the project', () => {
    expect(() =>
      getQaArtifactDirs({
        env: { QA_ARTIFACT_ROOT: '../outside', QA_RUN_ID: 'qa-local-123' },
        projectRoot: '/repo/nabatableLP',
      }),
    ).toThrow(/inside the project root/);
  });

  it('creates unique run ids by default', () => {
    expect(createQaRunId()).not.toBe(createQaRunId());
  });
});
