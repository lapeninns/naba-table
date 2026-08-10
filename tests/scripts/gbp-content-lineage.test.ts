import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const scanner = path.resolve('scripts/verify/gbp-content-lineage.mjs');

async function fixture(sql: string, entries: readonly object[]) {
  const root = await mkdtemp(path.join(tmpdir(), 'gbp-lineage-'));
  await mkdir(path.join(root, 'supabase/migrations'), { recursive: true });
  await writeFile(path.join(root, 'supabase/migrations/fixture.sql'), sql);
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify({ version: 1, entries }));
  return root;
}

const entry = {
  storeKey: 'snapshots',
  location: 'db:gbp_snapshots',
  owner: 'runtime',
  tenantKey: 'restaurant_id',
  contentFields: ['raw_payload'],
  provenance: 'fresh_provider_fetch',
  parents: [],
  expirySource: 'fresh_fetch_only',
  readFilter: 'expires_at > now',
  purgeAction: 'delete',
  notes: 'temporary content',
};

function run(root: string) {
  return spawnSync(process.execPath, [scanner, '--root', root, '--manifest', 'manifest.json'], {
    encoding: 'utf8',
  });
}

describe('GBP content-lineage scanner', () => {
  it('fails when a classified store gains an unknown content column', async () => {
    const root = await fixture(
      'create table public.gbp_snapshots (raw_payload jsonb, provider_value text\n);',
      [entry],
    );
    try {
      const result = run(root);
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).unknowns).toEqual([
        expect.objectContaining({ kind: 'column', column: 'provider_value' }),
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails unknown copy parents and stale stores', async () => {
    const root = await fixture('select 1;', [
      { ...entry, parents: ['missing'], expirySource: 'inherit_parent' },
    ]);
    try {
      const result = run(root);
      expect(result.status).toBe(2);
      expect(JSON.parse(result.stdout).error).toContain('unknown copy parent');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails when a copied producer resets provider expiry', async () => {
    const root = await fixture('create table public.gbp_snapshots (raw_payload jsonb\n);', [entry]);
    await writeFile(
      path.join(root, 'copy.ts'),
      ['const row = { retention_expires_at:', 'new Date() };\n'].join(' '),
    );
    try {
      const result = run(root);
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).unknowns).toEqual([
        expect.objectContaining({ kind: 'copy_extends_expiry', path: 'copy.ts' }),
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('passes a complete classified store', async () => {
    const root = await fixture('create table public.gbp_snapshots (raw_payload jsonb\n);', [entry]);
    try {
      const result = run(root);
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout).ok).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
