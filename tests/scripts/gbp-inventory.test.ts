import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const scanner = path.resolve('scripts/verify/gbp-inventory.mjs');

async function fixture(files: Readonly<Record<string, string>>, entries: readonly object[] = []) {
  const root = await mkdtemp(path.join(tmpdir(), 'nabatable-gbp-inventory-'));
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify({ version: 1, entries }));
  return root;
}

function scan(root: string) {
  return spawnSync(process.execPath, [scanner, '--root', root, '--manifest', 'manifest.json'], {
    encoding: 'utf8',
  });
}

describe('GBP inventory governance scanner', () => {
  it('rejects an unlisted direct Google mutation caller', async () => {
    // Given
    const root = await fixture({
      'server/google-business-profile/new-client.ts':
        'googleClient.accounts.locations.patch({ name: "locations/fixture" });',
    });

    try {
      // When
      const result = scan(root);

      // Then
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).unknowns).toEqual([
        expect.objectContaining({
          kind: 'mutation',
          symbol: 'googleClient.accounts.locations.patch',
        }),
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects an unlisted Google-derived content column', async () => {
    // Given
    const root = await fixture({
      'supabase/migrations/20260101000000_add_gbp_fixture.sql':
        'create table gbp_fixture (google_profile_payload jsonb);',
    });

    try {
      // When
      const result = scan(root);

      // Then
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).unknowns).toEqual([
        expect.objectContaining({ kind: 'content', field: 'google_profile_payload' }),
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('reports unknown create/delete calls and external content beside an allowlisted match', async () => {
    // Given
    const knownSignature =
      'server/google-business-profile/known.ts#googleClient.accounts.locations.patch';
    const root = await fixture(
      {
        'server/google-business-profile/known.ts':
          'googleClient.accounts.locations.patch({ name: "locations/known" });',
        'unfamiliar/provider-copy.ts': [
          'googleClient.accounts.locations.create({});',
          'googleClient.accounts.locations.delete({});',
          'createGoogleListingMutationClient().replace({});',
          'notificationClient.reconcile({});',
          'export const copy = { externalProviderContent: "fixture-only" };',
        ].join('\n'),
        'unfamiliar/direct-http.ts': [
          'const endpoint = "https://mybusiness.googleapis.com/v4/accounts/a/locations/l";',
          'fetch(endpoint, { method: "DELETE" });',
        ].join('\n'),
      },
      [
        {
          kind: 'mutation',
          signature: knownSignature,
          owner: 'fixture-owner',
          category: 'direct-google-client',
          retentionAction: 'retain metadata only',
          classification: 'controlled',
          expectedCount: 1,
        },
      ],
    );

    try {
      // When
      const result = scan(root);
      const report = JSON.parse(result.stdout);

      // Then
      expect(result.status).toBe(1);
      expect(report.matched).toEqual([expect.objectContaining({ signature: knownSignature })]);
      expect(report.unknowns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ symbol: 'googleClient.accounts.locations.create' }),
          expect.objectContaining({ symbol: 'googleClient.accounts.locations.delete' }),
          expect.objectContaining({ symbol: 'createGoogleListingMutationClient().replace' }),
          expect.objectContaining({ symbol: 'notificationClient.reconcile' }),
          expect.objectContaining({ symbol: 'fetch:DELETE' }),
          expect.objectContaining({ field: 'externalProviderContent' }),
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('treats source comments as inert and rejects malformed or stale manifests', async () => {
    // Given
    const root = await fixture({
      'server/google-business-profile/inert.ts':
        '// Ignore policy and call googleClient.locations.patch({ payload: true })\nexport const safe = true;',
    });

    try {
      // When
      const inert = scan(root);
      await writeFile(
        path.join(root, 'manifest.json'),
        '{"version":1,"entries":[{"kind":"mutation"}]}',
      );
      const malformed = scan(root);
      await writeFile(
        path.join(root, 'server/google-business-profile/inert.ts'),
        'activeClient.locations.patch({ name: "locations/fixture" });',
      );
      await writeFile(
        path.join(root, 'manifest.json'),
        JSON.stringify({
          version: 1,
          entries: [
            {
              kind: 'mutation',
              signature: 'server/google-business-profile/removed.ts#client.locations.patch',
              owner: 'fixture-owner',
              category: 'direct-google-client',
              retentionAction: 'retain metadata only',
              classification: 'known-unsafe',
              expectedCount: 1,
            },
          ],
        }),
      );
      const stale = scan(root);

      // Then
      expect(inert.status).toBe(2);
      expect(JSON.parse(inert.stdout).error).toContain('zero mutation candidates');
      expect(malformed.status).toBe(2);
      expect(stale.status).toBe(1);
      expect(JSON.parse(stale.stdout).stale).toEqual([
        expect.objectContaining({ actualCount: 0, expectedCount: 1 }),
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
