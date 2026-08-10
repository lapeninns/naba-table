import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const routeMap = path.resolve('docs/ops/gbp-route-map.md');
const runbook = path.resolve('docs/ops/dual-sync-runbooks.md');
const checklist = path.resolve('docs/ops/gbp-production-wiring-checklist.md');

describe('GBP operations document contract', () => {
  it('documents all seven source-scheduled dual-sync cron routes', () => {
    // Given
    const source = readFileSync(routeMap, 'utf8');

    // When
    const routes = [
      '/api/cron/dual-sync/auto-export',
      '/api/cron/dual-sync/queue',
      '/api/cron/dual-sync/core-outbox',
      '/api/cron/dual-sync/health',
      '/api/cron/dual-sync/refresh',
      '/api/cron/dual-sync/notifications',
      '/api/cron/dual-sync/request-log-retention',
    ];

    // Then
    expect(routes.every((route) => source.includes(route))).toBe(true);
  });

  it('requires permit-aware rollback and explicit flag containment', () => {
    // Given
    const source = readFileSync(runbook, 'utf8');

    // When
    const requiredControls = [
      'last **permit-aware binary**',
      'GBP_WRITE_ROLLOUT_MODE=off',
      'GBP_AUTO_CANDIDATES_ENABLED=false',
      'GBP_PUBSUB_INGEST_ENABLED=false',
    ];

    // Then
    expect(requiredControls.every((control) => source.includes(control))).toBe(true);
  });

  it('requires external Pub/Sub, canary, rotation, retention, and backup artifacts', () => {
    // Given
    const source = readFileSync(checklist, 'utf8');

    // When
    const requiredGates = [
      'dead-letter topic and subscription',
      'two exact remote grants',
      'staging dry-run',
      'Backup/PITR proof',
      'gbp-release-readiness.mjs',
    ];

    // Then
    expect(requiredGates.every((gate) => source.includes(gate))).toBe(true);
  });
});
