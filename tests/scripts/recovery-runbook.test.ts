import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  loadWranglerConfig,
  parseJsonc,
  resolveWorkerBindings,
} from '../../scripts/cloudflare/recovery/shared';

const runbook = fs.readFileSync(path.join('docs', 'runbooks', 'recovery.md'), 'utf8');

describe('docs/runbooks/recovery.md', () => {
  it.each([
    'RPO',
    '24 h',
    'RTO',
    '4 h',
    'every 12 h',
    'DB_BACKUP_ROLE_URL',
    'REPLACE_ME_ENCRYPTED_BACKUP_BUCKET',
    'disabled_optional',
    'never rendered as enabled',
    'Effective recovery window',
    'server/dual-sync/retention/policy.ts',
    'A Supabase-only drill does not establish platform recovery',
    'kv-rebuild',
    'do-state.md',
    'queue-reconcile',
    'd1-backup.ts',
    'vrdiqfudmwydclqpydee',
    'ndxmivcrehsacuerwxtm',
    'recovery:evidence:check',
    'activeRuntime: node22',
    // Workflow, schedule, environments and variable names must match the committed workflows.
    '`backup.yml` schedule (`23 */12 * * *`)',
    '`Backup` environment (`backup.yml`',
    '`Recovery` environment (`recovery-drill.yml`',
    'RECOVERY_DRILL_PROJECT_REF',
    'RECOVERY_SUPABASE_MANAGEMENT_TOKEN',
    'BACKUP_S3_WRITE_*',
    'BACKUP_S3_DRILL_*',
  ])('states %s', (phrase) => {
    expect(runbook).toContain(phrase);
  });

  it('matches the committed backup and drill workflows instead of stale names', () => {
    const backup = fs.readFileSync(path.join('.github', 'workflows', 'backup.yml'), 'utf8');
    const drill = fs.readFileSync(path.join('.github', 'workflows', 'recovery-drill.yml'), 'utf8');
    expect(runbook).not.toContain('db-backup.yml');
    expect(runbook).not.toContain('0 */12 * * *');
    expect(backup).toContain("cron: '23 */12 * * *'");
    expect(backup).toContain('environment: Backup');
    expect(drill).toContain('environment: Recovery');
    expect(drill).toContain(
      'RECOVERY_DRILL_PROJECT_REF: ${{ secrets.RECOVERY_DRILL_PROJECT_REF }}',
    );
    // The backup identity never sits in the drill environment's table and vice versa.
    const backupSection = runbook.slice(
      runbook.indexOf('### `Backup` environment'),
      runbook.indexOf('### `Recovery` environment'),
    );
    expect(backupSection).toContain('DB_BACKUP_ROLE_URL');
    expect(backupSection).not.toContain('RECOVERY_DRILL_PROJECT_REF');
  });

  it('never claims PITR is enabled', () => {
    expect(runbook).not.toMatch(/PITR is enabled/i);
  });

  it('ships the Cloudflare recovery procedures', () => {
    const kv = fs.readFileSync(
      path.join('scripts', 'cloudflare', 'recovery', 'kv-rebuild.md'),
      'utf8',
    );
    const doState = fs.readFileSync(
      path.join('scripts', 'cloudflare', 'recovery', 'do-state.md'),
      'utf8',
    );
    expect(kv).toContain('rebuildable cache');
    expect(kv).toContain('--confirm');
    expect(doState).toContain('DailyBookingSummaryState');
    expect(doState).toMatch(/Authoritative/);
    expect(doState).toMatch(/Rebuildable/);
  });
});

describe('wrangler.jsonc binding resolution', () => {
  it('parses every worker config and resolves production bindings', () => {
    for (const worker of ['booking-short-links', 'email-queue-gateway', 'sms-summary-gateway']) {
      const config = loadWranglerConfig(path.join('cloudflare', worker));
      const resolution = resolveWorkerBindings(config, 'production');
      expect(resolution.kind, worker).toBe('configured');
    }
    const shortLinks = resolveWorkerBindings(
      loadWranglerConfig(path.join('cloudflare', 'booking-short-links')),
      'production',
    );
    if (shortLinks.kind !== 'configured') throw new Error('expected configured');
    expect(shortLinks.bindings.d1[0]).toMatchObject({
      binding: 'BOOKING_SHORT_LINKS_DB',
      databaseName: 'nabatable-booking-short-links',
      migrationsDir: 'migrations',
    });
    expect(shortLinks.bindings.kv[0]?.binding).toBe('BOOKING_SHORT_LINKS_CACHE');
    const sms = resolveWorkerBindings(
      loadWranglerConfig(path.join('cloudflare', 'sms-summary-gateway')),
      'production',
    );
    if (sms.kind !== 'configured') throw new Error('expected configured');
    expect(sms.bindings.queueConsumers[0]).toEqual({
      queue: 'nabatable-sms-daily-summary',
      deadLetterQueue: 'nabatable-sms-daily-summary-dlq',
      maxRetries: 5,
    });
    expect(sms.bindings.durableObjectClasses).toEqual(['DailyBookingSummaryState']);
  });

  it('reports staging as unconfigured while REPLACE_ME_ ids remain, naming each placeholder', () => {
    const staging = resolveWorkerBindings(
      {
        env: {
          staging: {
            name: 'short-links-staging',
            d1_databases: [{ database_id: 'REPLACE_ME_D1' }],
            kv_namespaces: [{ id: 'REPLACE_ME_KV' }],
          },
        },
      },
      'staging',
    );
    expect(staging.kind).toBe('unconfigured');
    if (staging.kind === 'unconfigured') {
      expect(staging.placeholders).toEqual(['d1_databases[0].database_id', 'kv_namespaces[0].id']);
    }
  });

  it('parses JSONC with comments, strings containing slashes and trailing commas', () => {
    expect(parseJsonc('{\n // c\n "a": "http://x/y", /* b */ "b": [1, 2,],\n}')).toEqual({
      a: 'http://x/y',
      b: [1, 2],
    });
    expect(() => resolveWorkerBindings({ name: 'x' }, 'staging')).toThrow(/no env.staging/);
  });
});
