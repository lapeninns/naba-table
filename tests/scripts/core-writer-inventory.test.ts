import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const scanner = path.resolve('scripts/verify/core-writer-inventory.mjs');
const tables = [
  'restaurant_business_details',
  'restaurant_addresses',
  'restaurant_phone_numbers',
  'restaurant_links',
  'restaurant_categories',
  'restaurant_service_areas',
  'restaurant_hours',
  'restaurant_attributes',
  'restaurant_service_items',
  'restaurants',
  'restaurant_operating_hours',
  'restaurant_service_periods',
] as const;

async function fixture(source: string, entries: readonly object[], missingTrigger?: string) {
  const root = await mkdtemp(path.join(tmpdir(), 'nabatable-core-writers-'));
  await mkdir(path.join(root, 'server'), { recursive: true });
  await mkdir(path.join(root, 'supabase/migrations'), { recursive: true });
  await writeFile(path.join(root, 'server/writer.ts'), source);
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify({ version: 1, entries }));
  await writeFile(
    path.join(root, 'supabase/migrations/triggers.sql'),
    tables
      .filter((table) => table !== missingTrigger)
      .map(
        (table) =>
          `create trigger ${table}_gbp_core_outbox after insert or update or delete on public.${table} for each row execute function public.enqueue_gbp_core_change_v1();`,
      )
      .join('\n'),
  );
  return root;
}

function scan(root: string) {
  return spawnSync(process.execPath, [scanner, '--root', root, '--manifest', 'manifest.json'], {
    encoding: 'utf8',
  });
}

describe('canonical Core writer inventory', () => {
  it('rejects direct writers to every specialized Core trigger source', async () => {
    // Given
    const root = await fixture(
      [
        "client.from('restaurants').update({ name: 'changed' }).eq('id', id);",
        "client.from('restaurant_operating_hours').insert(hours);",
        "client.from('restaurant_service_periods').delete().eq('restaurant_id', id);",
      ].join('\n'),
      [],
    );
    try {
      // When
      const result = scan(root);

      // Then
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).unknown).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ table: 'restaurants', operation: 'update', line: 1 }),
          expect.objectContaining({ table: 'restaurant_operating_hours', operation: 'insert' }),
          expect.objectContaining({ table: 'restaurant_service_periods', operation: 'delete' }),
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('ignores an explicit restaurants update that cannot touch an outbox field', async () => {
    // Given
    const root = await fixture(
      "client.from('restaurants').update({ email_send_review_request: true }).eq('id', id);",
      [],
    );
    try {
      // When
      const result = scan(root);

      // Then
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout).observed).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('reports an unknown specialized writer beside an exact allowlisted writer', async () => {
    // Given
    const known = {
      owner: 'fixture',
      path: 'server/writer.ts',
      table: 'restaurants',
      operation: 'update',
      symbol: 'from:restaurants',
      classification: 'core-writer',
      expectedCount: 1,
    };
    const root = await fixture(
      [
        "client.from('restaurants').update({ address: 'changed' }).eq('id', id);",
        "client.from('restaurant_service_periods').insert(periods);",
      ].join('\n'),
      [known],
    );
    try {
      // When
      const result = scan(root);
      const report = JSON.parse(result.stdout);

      // Then
      expect(result.status).toBe(1);
      expect(report.stale).toEqual([]);
      expect(report.observed).toContainEqual(expect.objectContaining(known));
      expect(report.unknown).toEqual([
        expect.objectContaining({ table: 'restaurant_service_periods', operation: 'insert' }),
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails on an unknown direct writer', async () => {
    // Given
    const root = await fixture(
      "client.from('restaurant_hours').delete().eq('restaurant_id', id);",
      [],
    );
    try {
      // When
      const result = scan(root);

      // Then
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).unknown).toEqual([
        expect.objectContaining({ table: 'restaurant_hours', operation: 'delete' }),
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails on stale writers and trigger gaps', async () => {
    // Given
    const expected = {
      owner: 'fixture',
      path: 'server/writer.ts',
      table: 'restaurant_hours',
      operation: 'delete',
      symbol: 'from:restaurant_hours',
      classification: 'core-writer',
      expectedCount: 2,
    };
    const root = await fixture(
      "client.from('restaurant_hours').delete().eq('restaurant_id', id);",
      [expected],
      'restaurant_attributes',
    );
    try {
      // When
      const result = scan(root);
      const report = JSON.parse(result.stdout);

      // Then
      expect(result.status).toBe(1);
      expect(report.stale).toEqual([expect.objectContaining({ actualCount: 1 })]);
      expect(report.triggerGaps).toEqual(['restaurant_attributes']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
