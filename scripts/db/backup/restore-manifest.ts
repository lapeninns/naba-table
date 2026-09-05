import fs from 'node:fs';
import path from 'node:path';

import { parse } from 'yaml';

/** Loader/validator for config/recovery/restore-manifest.yaml. */

export const DEFAULT_RESTORE_MANIFEST_PATH = path.join(
  'config',
  'recovery',
  'restore-manifest.yaml',
);

export type SchemaMode = 'schema_and_data' | 'data_only_required_tables' | 'definitions_only';

export type ManifestSchema = {
  readonly name: string;
  readonly mode: SchemaMode;
  readonly purpose: string;
  readonly tables: readonly string[];
};

export type ManifestSqlExport = {
  readonly id: string;
  readonly query: string;
  readonly optional: boolean;
};

export type ProviderManagedSchema = {
  readonly name: string;
  readonly restore: string;
};

export type RestoreManifest = {
  readonly manifestVersion: number;
  readonly schemas: readonly ManifestSchema[];
  readonly sqlExports: readonly ManifestSqlExport[];
  readonly providerManaged: readonly ProviderManagedSchema[];
  readonly storageBuckets: readonly string[];
};

export class RestoreManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RestoreManifestError';
  }
}

const IDENT = /^[a-z_][a-z0-9_]*$/;
const SCHEMA_MODES: readonly SchemaMode[] = [
  'schema_and_data',
  'data_only_required_tables',
  'definitions_only',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireIdent(value: unknown, field: string): string {
  if (typeof value !== 'string' || !IDENT.test(value)) {
    throw new RestoreManifestError(`${field} must be a lowercase SQL identifier.`);
  }
  return value;
}

function requireArray(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new RestoreManifestError(`${field} must be a non-empty array.`);
  }
  return value;
}

function parseSchema(value: unknown, index: number): ManifestSchema {
  if (!isRecord(value)) throw new RestoreManifestError(`schemas[${index}] must be an object.`);
  const name = requireIdent(value.name, `schemas[${index}].name`);
  const mode = value.mode;
  if (typeof mode !== 'string' || !SCHEMA_MODES.includes(mode as SchemaMode)) {
    throw new RestoreManifestError(`schemas[${index}].mode is invalid.`);
  }
  if (typeof value.purpose !== 'string' || value.purpose.trim() === '') {
    throw new RestoreManifestError(`schemas[${index}].purpose is required.`);
  }
  const tables = Array.isArray(value.tables)
    ? value.tables.map((table, tableIndex) =>
        requireIdent(table, `schemas[${index}].tables[${tableIndex}]`),
      )
    : [];
  if (mode === 'data_only_required_tables' && tables.length === 0) {
    throw new RestoreManifestError(
      `schemas[${index}] with data_only_required_tables needs tables.`,
    );
  }
  return { name, mode: mode as SchemaMode, purpose: value.purpose.trim(), tables };
}

function parseSqlExport(value: unknown, index: number): ManifestSqlExport {
  if (!isRecord(value)) throw new RestoreManifestError(`sqlExports[${index}] must be an object.`);
  const id = requireIdent(value.id, `sqlExports[${index}].id`);
  if (typeof value.query !== 'string' || !/^\s*select\b/i.test(value.query)) {
    throw new RestoreManifestError(`sqlExports[${index}].query must be a single SELECT.`);
  }
  if (value.query.includes(';')) {
    throw new RestoreManifestError(`sqlExports[${index}].query must not contain ';'.`);
  }
  const optional = value.optional === true;
  return { id, query: value.query.trim(), optional };
}

function parseProviderManaged(value: unknown, index: number): ProviderManagedSchema {
  if (!isRecord(value))
    throw new RestoreManifestError(`providerManaged[${index}] must be an object.`);
  const name = requireIdent(value.name, `providerManaged[${index}].name`);
  if (
    typeof value.restore !== 'string' ||
    !value.restore.startsWith('restore via supported procedure')
  ) {
    throw new RestoreManifestError(
      `providerManaged[${index}].restore must start with "restore via supported procedure".`,
    );
  }
  return { name, restore: value.restore };
}

export function parseRestoreManifest(raw: unknown): RestoreManifest {
  if (!isRecord(raw)) throw new RestoreManifestError('restore manifest must be an object.');
  if (raw.manifestVersion !== 1) {
    throw new RestoreManifestError('manifestVersion must be 1.');
  }
  const schemas = requireArray(raw.schemas, 'schemas').map(parseSchema);
  const sqlExports = requireArray(raw.sqlExports, 'sqlExports').map(parseSqlExport);
  const providerManaged = requireArray(raw.providerManaged, 'providerManaged').map(
    parseProviderManaged,
  );
  const storageBuckets = requireArray(raw.storageBuckets, 'storageBuckets').map((bucket, index) => {
    if (typeof bucket !== 'string' || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(bucket)) {
      throw new RestoreManifestError(`storageBuckets[${index}] must be a bucket id.`);
    }
    return bucket;
  });

  const schemaNames = new Set(schemas.map((schema) => schema.name));
  for (const provider of providerManaged) {
    if (schemaNames.has(provider.name)) {
      throw new RestoreManifestError(
        `Schema ${provider.name} cannot be both dumped and provider-managed.`,
      );
    }
  }
  for (const required of ['public', 'supabase_migrations']) {
    if (!schemaNames.has(required)) {
      throw new RestoreManifestError(`schemas must include ${required}.`);
    }
  }
  const exportIds = new Set(sqlExports.map((entry) => entry.id));
  for (const required of ['grants', 'extensions', 'migration_ledger']) {
    if (!exportIds.has(required)) {
      throw new RestoreManifestError(`sqlExports must include ${required}.`);
    }
  }

  return { manifestVersion: 1, schemas, sqlExports, providerManaged, storageBuckets };
}

export function loadRestoreManifest(manifestPath = DEFAULT_RESTORE_MANIFEST_PATH): RestoreManifest {
  const resolved = path.isAbsolute(manifestPath)
    ? manifestPath
    : path.join(process.cwd(), manifestPath);
  let text: string;
  try {
    text = fs.readFileSync(resolved, 'utf8');
  } catch {
    throw new RestoreManifestError(`Restore manifest not found at ${resolved}.`);
  }
  return parseRestoreManifest(parse(text));
}
