import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { parseCsv } from '../backup/csv';
import { decryptBuffer, parseBackupHeader, keyIdFor } from '../backup/encrypt';
import { backupManifestKey, validateBackupManifest, type BackupManifest } from '../backup/manifest';
import type { CommandEnv, CommandRunner } from '../backup/pg-dump';
import type { RecoveryPolicy } from '../backup/policy';
import type { FetchLike, S3Client } from '../backup/s3';
import { parseStorageObjectsManifest, verifyStorageObjectsBackup } from '../backup/storage-objects';
import { sqlLiteral, type SqlRunner } from './sql-runner';

/**
 * Default implementations of the ten drill steps. Everything external is injected
 * (S3 client, SQL runner, process runner, project destroyer) so the orchestration can
 * be tested with fakes and the CLI can refuse when any dependency is unconfigured.
 */

export type RestoreContext = {
  readonly backupId: string;
  readonly tempProjectRef: string;
  readonly expectedSourceRef: string;
  readonly policy: RecoveryPolicy;
  readonly now: () => Date;
};

export type VerifyBackupResult = { readonly manifest: BackupManifest; readonly ageHours: number };
export type DisableOutboundResult = {
  readonly cronUnscheduled: number;
  readonly killSwitches: readonly string[];
};
export type RestoreDataResult = { readonly restoredParts: readonly string[] };
export type SchemaVerification = {
  readonly migrationHead: string;
  readonly tablesWithoutRls: readonly string[];
  readonly missingGrants: number;
  readonly invalidConstraints: number;
  readonly invalidIndexes: number;
  readonly functionCount: number;
  readonly missingExtensions: readonly string[];
  readonly activeCronJobs: number;
};
export type DataVerification = {
  readonly tablesCompared: number;
  readonly countMismatches: readonly string[];
  readonly foreignKeyViolations: readonly string[];
  /** Restored row counts per public table (as verified on the drill database). */
  readonly rowCounts: Readonly<Record<string, number>>;
};
export type StorageVerification = {
  readonly objectsChecked: number;
  readonly failures: readonly string[];
  readonly encryptedDataRecovered: boolean;
};
export type IsolationProofs = {
  readonly source: 'fixtures' | 'embedded';
  readonly proofs: readonly { readonly name: string; readonly passed: boolean }[];
};
export type DestroyResult = {
  readonly resourcesDestroyed: readonly string[];
  readonly credentialsRevoked: readonly string[];
};

export type RestoreSteps = {
  verifyBackup(ctx: RestoreContext): Promise<VerifyBackupResult>;
  disableOutbound(ctx: RestoreContext): Promise<DisableOutboundResult>;
  restoreData(ctx: RestoreContext, manifest: BackupManifest): Promise<RestoreDataResult>;
  verifySchema(ctx: RestoreContext, manifest: BackupManifest): Promise<SchemaVerification>;
  verifyData(ctx: RestoreContext, manifest: BackupManifest): Promise<DataVerification>;
  verifyStorage(ctx: RestoreContext, manifest: BackupManifest): Promise<StorageVerification>;
  runIsolationProofs(ctx: RestoreContext): Promise<IsolationProofs>;
  destroy(ctx: RestoreContext): Promise<DestroyResult>;
};

export class RestoreStepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RestoreStepError';
  }
}

export type ProjectDestroyer = {
  destroyProject(projectRef: string): Promise<void>;
};

export const SUPABASE_MANAGEMENT_TOKEN_ENV = 'SUPABASE_MANAGEMENT_TOKEN';

/** Supabase Management API destroyer; refuses anything but the temp ref it was built for. */
export function createSupabaseProjectDestroyer(config: {
  readonly token: string;
  readonly fetch: FetchLike;
  readonly allowedRef: string;
}): ProjectDestroyer {
  return {
    async destroyProject(projectRef) {
      if (projectRef !== config.allowedRef) {
        throw new RestoreStepError(
          'Destroyer refuses to delete a project other than the drill target.',
        );
      }
      const response = await config.fetch(`https://api.supabase.com/v1/projects/${projectRef}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${config.token}` },
      });
      if (!response.ok && response.status !== 404) {
        throw new RestoreStepError(`Project deletion failed with status ${response.status}.`);
      }
    },
  };
}

export const KILL_SWITCH_SETTINGS: readonly string[] = [
  'GBP_EXPORT_ENABLED=false',
  'GBP_IMPORT_ENABLED=false',
  'GBP_SCHEDULED_REFRESH_ENABLED=false',
  'GBP_PUBSUB_INGEST_ENABLED=false',
  'GBP_WRITE_ROLLOUT_MODE=off',
  'RECOVERY_DRILL=true',
];

type ArtifactCache = Map<string, Buffer>;

export type DefaultStepsDeps = {
  readonly s3: S3Client;
  readonly key: Buffer;
  readonly sql: SqlRunner;
  readonly runner: CommandRunner;
  readonly libpqEnv: CommandEnv;
  readonly destroyer: ProjectDestroyer;
  readonly revokeCredentials: () => Promise<readonly string[]>;
  readonly fixturesDir: string | null;
};

function hoursBetween(from: string, to: Date): number {
  return (to.getTime() - Date.parse(from)) / 3_600_000;
}

async function fetchArtifact(
  deps: DefaultStepsDeps,
  cache: ArtifactCache,
  manifest: BackupManifest,
  id: string,
): Promise<Buffer> {
  const cached = cache.get(id);
  if (cached) return cached;
  const artifact = manifest.artifacts.find((entry) => entry.id === id);
  if (!artifact) throw new RestoreStepError(`Artifact ${id} is not in the manifest.`);
  const encrypted = await deps.s3.getObject(artifact.objectKey);
  if (!encrypted) throw new RestoreStepError(`Artifact ${id} is missing from the bucket.`);
  if (createHash('sha256').update(encrypted).digest('hex') !== artifact.sha256) {
    throw new RestoreStepError(`Artifact ${id} digest mismatch.`);
  }
  const plaintext = decryptBuffer(deps.key, encrypted);
  cache.set(id, plaintext);
  return plaintext;
}

export function parseForeignKeyDefinition(definition: string): {
  readonly columns: readonly string[];
  readonly referencedTable: string;
  readonly referencedColumns: readonly string[];
} | null {
  const match = definition.match(/FOREIGN KEY \(([^)]+)\) REFERENCES ([^\s(]+)\(([^)]+)\)/i);
  if (!match) return null;
  const split = (value: string) =>
    value.split(',').map((column) => column.trim().replace(/"/g, ''));
  return {
    columns: split(match[1] ?? ''),
    referencedTable: (match[2] ?? '').replace(/"/g, ''),
    referencedColumns: split(match[3] ?? ''),
  };
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function quoteQualified(name: string): string {
  return name.split('.').map(quoteIdent).join('.');
}

export function createDefaultRestoreSteps(deps: DefaultStepsDeps): RestoreSteps {
  const cache: ArtifactCache = new Map();

  return {
    async verifyBackup(ctx) {
      const raw = await deps.s3.getObject(backupManifestKey(ctx.backupId));
      if (!raw) throw new RestoreStepError(`Backup ${ctx.backupId} has no manifest.`);
      const manifest = validateBackupManifest(JSON.parse(raw.toString('utf8')));
      if (manifest.backupId !== ctx.backupId)
        throw new RestoreStepError('Manifest backupId mismatch.');
      if (manifest.sourceRef !== ctx.expectedSourceRef) {
        throw new RestoreStepError(
          'Manifest sourceRef does not match the expected source project.',
        );
      }
      if (manifest.sourceRef === ctx.tempProjectRef) {
        throw new RestoreStepError('Refusing to restore a backup onto its own source project.');
      }
      const ageHours = hoursBetween(manifest.createdAt, ctx.now());
      if (ageHours < 0 || ageHours > ctx.policy.independentBackup.maxAgeHours) {
        throw new RestoreStepError(
          `Backup is ${ageHours.toFixed(1)}h old; exceeds the ${ctx.policy.independentBackup.maxAgeHours}h maximum.`,
        );
      }
      if (manifest.encryption.keyId !== keyIdFor(deps.key).toString('hex')) {
        throw new RestoreStepError(
          'Backup was encrypted with a different key than the one provided.',
        );
      }
      for (const artifact of manifest.artifacts) {
        const head = await deps.s3.headObject(artifact.objectKey);
        if (!head || head.size !== artifact.sizeBytes) {
          throw new RestoreStepError(
            `Artifact ${artifact.id} is missing or has an unexpected size.`,
          );
        }
      }
      return { manifest, ageHours };
    },

    async disableOutbound(ctx) {
      const hasCron = await deps.sql.query(
        "select 1 as present from pg_extension where extname = 'pg_cron'",
      );
      let cronUnscheduled = 0;
      if (hasCron.length > 0) {
        const jobs = await deps.sql.query('select jobid from cron.job');
        for (const job of jobs) {
          if (job.jobid) {
            await deps.sql.execute(`select cron.unschedule(${Number.parseInt(job.jobid, 10)});`);
            cronUnscheduled += 1;
          }
        }
      }
      const settings = [
        `alter database postgres set app.recovery_drill = 'on';`,
        `alter database postgres set app.outbound_disabled = 'on';`,
        `alter database postgres set app.drill_temp_ref = ${sqlLiteral(ctx.tempProjectRef)};`,
      ];
      await deps.sql.execute(settings.join('\n'));
      return { cronUnscheduled, killSwitches: KILL_SWITCH_SETTINGS };
    },

    async restoreData(_ctx, manifest) {
      const restoredParts: string[] = [];
      const dumpArtifacts = manifest.artifacts.filter((artifact) =>
        artifact.id.startsWith('dump_'),
      );
      if (dumpArtifacts.length === 0) throw new RestoreStepError('Manifest has no dump artifacts.');
      for (const artifact of dumpArtifacts) {
        const plaintext = await fetchArtifact(deps, cache, manifest, artifact.id);
        if (plaintext.subarray(0, 5).toString('ascii') !== 'PGDMP') {
          throw new RestoreStepError(`Artifact ${artifact.id} is not a pg_dump custom archive.`);
        }
        const args = ['--no-password', '--exit-on-error', '--no-owner', '--dbname=postgres'];
        if (artifact.id === 'dump_auth_data') args.push('--data-only', '--disable-triggers');
        const result = await deps.runner.runWithInput('pg_restore', args, plaintext, deps.libpqEnv);
        if (result.status !== 0) {
          throw new RestoreStepError(
            `pg_restore ${artifact.id} failed with status ${String(result.status)}.`,
          );
        }
        restoredParts.push(artifact.id);
      }
      return { restoredParts };
    },

    async verifySchema(_ctx, manifest) {
      const head = await deps.sql.query(
        'select max(version) as version from supabase_migrations.schema_migrations',
      );
      const migrationHead = head[0]?.version ?? '';
      if (migrationHead !== manifest.migrationLedgerHead) {
        throw new RestoreStepError(
          `Migration ledger head ${migrationHead || 'missing'} does not match manifest ${manifest.migrationLedgerHead}.`,
        );
      }
      const rlsRows = await deps.sql.query(
        "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1",
      );
      const tablesWithoutRls = rlsRows.map((row) => row.relname ?? '');
      const grantsCsv = (await fetchArtifact(deps, cache, manifest, 'export_grants')).toString(
        'utf8',
      );
      const expectedGrants = parseCsv(grantsCsv);
      const actualGrants = await deps.sql.query(
        "select grantee, table_schema, table_name, privilege_type from information_schema.role_table_grants where table_schema in ('public') order by 1,2,3,4",
      );
      const actualSet = new Set(
        actualGrants.map(
          (row) => `${row.grantee}|${row.table_schema}|${row.table_name}|${row.privilege_type}`,
        ),
      );
      const missingGrants = expectedGrants.filter(
        (row) =>
          !actualSet.has(
            `${row.grantee}|${row.table_schema}|${row.table_name}|${row.privilege_type}`,
          ),
      ).length;
      const invalidConstraints = Number.parseInt(
        (await deps.sql.query('select count(*) as n from pg_constraint where not convalidated'))[0]
          ?.n ?? '0',
        10,
      );
      const invalidIndexes = Number.parseInt(
        (await deps.sql.query('select count(*) as n from pg_index where not indisvalid'))[0]?.n ??
          '0',
        10,
      );
      const functionCount = Number.parseInt(
        (
          await deps.sql.query(
            "select count(*) as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'",
          )
        )[0]?.n ?? '0',
        10,
      );
      const extensionsCsv = (
        await fetchArtifact(deps, cache, manifest, 'export_extensions')
      ).toString('utf8');
      const actualExtensions = new Set(
        (await deps.sql.query('select extname from pg_extension')).map((row) => row.extname),
      );
      const missingExtensions = parseCsv(extensionsCsv)
        .map((row) => row.extname ?? '')
        .filter((name) => name && !actualExtensions.has(name));
      const cronPresent = await deps.sql.query(
        "select 1 as present from pg_extension where extname = 'pg_cron'",
      );
      const activeCronJobs = cronPresent.length
        ? Number.parseInt(
            (await deps.sql.query('select count(*) as n from cron.job where active'))[0]?.n ?? '0',
            10,
          )
        : 0;
      const result: SchemaVerification = {
        migrationHead,
        tablesWithoutRls,
        missingGrants,
        invalidConstraints,
        invalidIndexes,
        functionCount,
        missingExtensions,
        activeCronJobs,
      };
      const coreWithoutRls = tablesWithoutRls.filter((table) =>
        ['restaurants', 'bookings', 'customers', 'restaurant_memberships'].includes(table),
      );
      if (coreWithoutRls.length > 0)
        throw new RestoreStepError(
          `Core tables without RLS after restore: ${coreWithoutRls.join(', ')}.`,
        );
      if (missingGrants > 0)
        throw new RestoreStepError(`${missingGrants} grants missing after restore.`);
      if (invalidConstraints > 0 || invalidIndexes > 0)
        throw new RestoreStepError('Invalid constraints or indexes after restore.');
      if (functionCount === 0)
        throw new RestoreStepError('No functions restored in public schema.');
      if (activeCronJobs > 0)
        throw new RestoreStepError('Active cron jobs exist on the drill database.');
      return result;
    },

    async verifyData(_ctx, manifest) {
      const countsCsv = (await fetchArtifact(deps, cache, manifest, 'export_row_counts')).toString(
        'utf8',
      );
      const expected = parseCsv(countsCsv);
      const countMismatches: string[] = [];
      const rowCounts: Record<string, number> = {};
      for (const row of expected) {
        const table = row.table_name ?? '';
        if (!table) continue;
        const actual = await deps.sql.query(
          `select count(*) as n from ${quoteQualified(`public.${table}`)}`,
        );
        const actualCount = actual[0]?.n ?? '';
        if (actualCount !== (row.row_count ?? '')) countMismatches.push(table);
        const parsed = Number.parseInt(actualCount, 10);
        rowCounts[table] = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      }
      const fks = await deps.sql.query(
        "select conrelid::regclass::text as table_name, pg_get_constraintdef(oid) as definition from pg_constraint where contype = 'f' and connamespace = 'public'::regnamespace",
      );
      const foreignKeyViolations: string[] = [];
      for (const fk of fks) {
        const parsed = parseForeignKeyDefinition(fk.definition ?? '');
        if (!parsed) continue;
        const notNull = parsed.columns
          .map((column) => `c.${quoteIdent(column)} is not null`)
          .join(' and ');
        const join = parsed.columns
          .map(
            (column, index) =>
              `p.${quoteIdent(parsed.referencedColumns[index] ?? '')} = c.${quoteIdent(column)}`,
          )
          .join(' and ');
        const sql = `select count(*) as n from ${quoteQualified(fk.table_name ?? '')} c where ${notNull} and not exists (select 1 from ${quoteQualified(parsed.referencedTable)} p where ${join})`;
        const result = await deps.sql.query(sql);
        if ((result[0]?.n ?? '0') !== '0')
          foreignKeyViolations.push(`${fk.table_name} -> ${parsed.referencedTable}`);
      }
      if (countMismatches.length > 0)
        throw new RestoreStepError(`Row count mismatches: ${countMismatches.join(', ')}.`);
      if (foreignKeyViolations.length > 0)
        throw new RestoreStepError(
          `Relational integrity violations: ${foreignKeyViolations.join(', ')}.`,
        );
      return { tablesCompared: expected.length, countMismatches, foreignKeyViolations, rowCounts };
    },

    async verifyStorage(_ctx, manifest) {
      const first = manifest.artifacts.find((artifact) => artifact.id.startsWith('dump_'));
      let encryptedDataRecovered = false;
      if (first) {
        const encrypted = await deps.s3.getObject(first.objectKey);
        if (encrypted) {
          parseBackupHeader(encrypted);
          const plaintext = decryptBuffer(deps.key, encrypted);
          encryptedDataRecovered = plaintext.subarray(0, 5).toString('ascii') === 'PGDMP';
        }
      }
      if (!encryptedDataRecovered)
        throw new RestoreStepError('Encrypted data recovery check failed.');
      if (!manifest.storageObjects) {
        return {
          objectsChecked: 0,
          failures: ['storage objects were not part of this backup'],
          encryptedDataRecovered,
        };
      }
      const raw = await deps.s3.getObject(manifest.storageObjects.manifestKey);
      if (!raw) throw new RestoreStepError('Storage manifest is missing.');
      const storageManifest = parseStorageObjectsManifest(JSON.parse(raw.toString('utf8')));
      const verification = await verifyStorageObjectsBackup({
        manifest: storageManifest,
        s3: deps.s3,
        key: deps.key,
      });
      if (!verification.ok)
        throw new RestoreStepError(
          `Storage object verification failed: ${verification.failures.join('; ')}.`,
        );
      return {
        objectsChecked: verification.checked,
        failures: verification.failures,
        encryptedDataRecovered,
      };
    },

    async runIsolationProofs() {
      const proofs: { name: string; passed: boolean }[] = [];
      // Fixture proofs: every SQL file under the fixtures directory (tests/db/fixtures)
      // runs inside a transaction that is always rolled back, so the drill database is
      // left exactly as restored and nothing can be enqueued for delivery.
      const fixtures =
        deps.fixturesDir && fs.existsSync(deps.fixturesDir)
          ? fs
              .readdirSync(deps.fixturesDir)
              .filter((name) => name.endsWith('.sql'))
              .sort()
          : [];
      for (const name of fixtures) {
        const sql = fs.readFileSync(path.join(deps.fixturesDir ?? '', name), 'utf8');
        try {
          await deps.sql.execute(`begin;\n${sql}\nrollback;`);
          proofs.push({ name: `fixture:${name}`, passed: true });
        } catch {
          proofs.push({ name: `fixture:${name}`, passed: false });
        }
      }
      // Embedded proofs always run: tenant isolation, booking ownership, idempotency.
      const tenant = await deps.sql.query(
        "select count(*) as n from information_schema.columns col join pg_class c on c.relname = col.table_name join pg_namespace n on n.oid = c.relnamespace and n.nspname = col.table_schema where col.table_schema = 'public' and col.column_name = 'restaurant_id' and c.relkind = 'r' and not c.relrowsecurity",
      );
      const booking = await deps.sql.query(
        'select count(*) as n from public.bookings b where not exists (select 1 from public.restaurants r where r.id = b.restaurant_id)',
      );
      const idempotency = await deps.sql.query(
        "select count(*) as n from pg_indexes where schemaname = 'public' and indexdef ilike '%unique%' and indexdef ilike '%idempotency_key%'",
      );
      proofs.push(
        { name: 'tenant_tables_have_rls', passed: (tenant[0]?.n ?? '1') === '0' },
        { name: 'bookings_belong_to_restaurants', passed: (booking[0]?.n ?? '1') === '0' },
        {
          name: 'idempotency_keys_are_unique',
          passed: Number.parseInt(idempotency[0]?.n ?? '0', 10) > 0,
        },
      );
      if (proofs.some((proof) => !proof.passed)) {
        throw new RestoreStepError(
          `Isolation proofs failed: ${proofs
            .filter((proof) => !proof.passed)
            .map((proof) => proof.name)
            .join(', ')}.`,
        );
      }
      return { source: fixtures.length > 0 ? 'fixtures' : 'embedded', proofs };
    },

    async destroy(ctx) {
      const resourcesDestroyed: string[] = [];
      let destroyError: unknown = null;
      try {
        await deps.destroyer.destroyProject(ctx.tempProjectRef);
        resourcesDestroyed.push(`supabase-project:${ctx.tempProjectRef}`);
      } catch (error) {
        destroyError = error;
      }
      const credentialsRevoked = await deps.revokeCredentials();
      cache.clear();
      if (destroyError) {
        throw new RestoreStepError(
          destroyError instanceof Error ? destroyError.message : 'Project destroy failed.',
        );
      }
      return { resourcesDestroyed, credentialsRevoked };
    },
  };
}
