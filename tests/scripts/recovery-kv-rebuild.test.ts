import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  activeLinksQuery,
  buildRewarmEntries,
  parseKvKeyList,
  READINESS_SENTINEL_KEY,
  runKvRebuild,
} from '../../scripts/cloudflare/recovery/kv-rebuild';

import type { WranglerRunner } from '../../scripts/cloudflare/recovery/shared';
import type { Logger } from '../../scripts/db/backup/log';

const logger: Logger = { info: () => undefined, warn: () => undefined, error: () => undefined };
const NOW = new Date('2026-09-04T12:00:00.000Z');

function fakeWrangler(): WranglerRunner & { readonly calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    async run(_dir, args) {
      calls.push([...args]);
      if (args[0] === 'kv' && args[1] === 'key') {
        return {
          status: 0,
          stdout: JSON.stringify([{ name: 'readiness:sentinel' }, { name: 'link:old' }]),
          stderr: '',
        };
      }
      if (args[0] === 'd1') {
        return {
          status: 0,
          stdout: JSON.stringify([
            {
              results: [
                {
                  token: 'live1',
                  destination_url: 'https://nabatable.com/b/1',
                  destination_host: 'nabatable.com',
                  purpose: 'booking_manage',
                  booking_id: 'b1',
                  restaurant_id: 'r1',
                  created_at: '2026-09-01T00:00:00Z',
                  expires_at: '2026-09-10T00:00:00Z',
                  created_by: 'guest_confirmation_sms',
                },
                {
                  token: 'expired',
                  destination_url: 'https://nabatable.com/b/2',
                  destination_host: 'nabatable.com',
                  purpose: 'booking_manage',
                  booking_id: null,
                  restaurant_id: null,
                  created_at: '2026-08-01T00:00:00Z',
                  expires_at: '2026-08-02T00:00:00Z',
                  created_by: 'ops',
                },
              ],
            },
          ]),
          stderr: '',
        };
      }
      return { status: 0, stdout: '', stderr: '' };
    },
  };
}

describe('KV rebuild', () => {
  it('parses key lists and builds rewarm entries with the sentinel first and expirations from D1', () => {
    expect(parseKvKeyList('Some banner\n[{"name":"a"},{"name":"b","expiration":1}]')).toEqual([
      { name: 'a' },
      { name: 'b' },
    ]);
    const entries = buildRewarmEntries(
      [
        {
          token: 'live1',
          destination_url: 'https://nabatable.com/b/1',
          destination_host: 'nabatable.com',
          purpose: 'booking_manage',
          booking_id: 'b1',
          restaurant_id: 'r1',
          created_at: '2026-09-01T00:00:00Z',
          expires_at: '2026-09-10T00:00:00Z',
          created_by: 'guest_confirmation_sms',
        },
        {
          token: 'expired',
          destination_url: 'https://x',
          destination_host: 'x',
          purpose: 'p',
          booking_id: null,
          restaurant_id: null,
          created_at: '',
          expires_at: '2026-08-02T00:00:00Z',
          created_by: 'ops',
        },
        { token: '', destination_url: 'https://x', expires_at: '2026-09-10T00:00:00Z' },
      ],
      NOW,
    );
    expect(entries[0]?.key).toBe(READINESS_SENTINEL_KEY);
    expect(entries).toHaveLength(2);
    expect(entries[1]).toMatchObject({
      key: 'link:live1',
      expiration: Math.floor(Date.parse('2026-09-10T00:00:00Z') / 1000),
    });
    expect(JSON.parse(entries[1]?.value ?? '{}')).toMatchObject({
      token: 'live1',
      destinationUrl: 'https://nabatable.com/b/1',
      revokedAt: null,
    });
    expect(activeLinksQuery(NOW.toISOString())).toContain(
      "expires_at > '2026-09-04T12:00:00.000Z'",
    );
  });

  it('plans without mutating and only deletes/rewarms with --confirm', async () => {
    const planner = fakeWrangler();
    const plan = await runKvRebuild(
      { envName: 'production', repoRoot: process.cwd(), confirm: false, now: NOW },
      { wrangler: planner, logger, tempDir: () => '/nonexistent' },
    );
    expect(plan).toEqual({
      worker: 'booking-short-links',
      environment: 'production',
      namespaceId: 'e5ca786cf59c426c9f745f15a96529c8',
      keysToDelete: 2,
      entriesToWrite: 2,
      mode: 'plan',
    });
    expect(planner.calls.some((args) => args[1] === 'bulk')).toBe(false);

    const applier = fakeWrangler();
    const tempDir = await import('node:fs').then((fs) => fs.mkdtempSync('/tmp/nabatable-kv-test-'));
    const applied = await runKvRebuild(
      { envName: 'production', repoRoot: process.cwd(), confirm: true, now: NOW },
      { wrangler: applier, logger, tempDir: () => tempDir },
    );
    expect(applied.mode).toBe('applied');
    const bulk = applier.calls.filter((args) => args[1] === 'bulk').map((args) => args[2]);
    expect(bulk).toEqual(['delete', 'put']);
    expect(applier.calls.find((args) => args[2] === 'delete')).toContain('--force');
  });

  it('refuses staging while the namespace id is a placeholder', async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kv-unconfigured-'));
    const configDir = path.join(repoRoot, 'cloudflare', 'booking-short-links');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'wrangler.jsonc'),
      JSON.stringify({
        env: { staging: { name: 'short-links-staging', kv_namespaces: [{ id: 'REPLACE_ME_KV' }] } },
      }),
    );
    const wrangler = fakeWrangler();
    try {
      await expect(
        runKvRebuild(
          { envName: 'staging', repoRoot, confirm: true, now: NOW },
          { wrangler, logger, tempDir: () => '/nonexistent' },
        ),
      ).rejects.toThrow(/unconfigured/);
      expect(wrangler.calls).toEqual([]);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
