#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ACTIONS = new Set(['delete', 'scrub', 'stop_persisting', 'metadata_only', 'external_gate']);
const CONTENT_COLUMN =
  /(?:(?:raw|canonical|projected|request|response|source)_?payload|(?:nabatable|google|canonical)_snapshot$|summary|proposed_value$|provider_value$|google_value$|gbp_value$|error_message|dead_letter_reason|display_name|business_name|menu_label|google_metadata|google_path|source_revision)/i;
const STORE_NAME = /(?:gbp|google|dual_sync|external_profile|food_menu)/i;

async function filesBelow(root, directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await filesBelow(root, absolute)));
    else found.push(path.relative(root, absolute).split(path.sep).join('/'));
  }
  return found;
}

function parseArgs(argv) {
  const rootIndex = argv.indexOf('--root');
  const manifestIndex = argv.indexOf('--manifest');
  return {
    root: path.resolve(rootIndex >= 0 ? (argv[rootIndex + 1] ?? '.') : '.'),
    manifest:
      manifestIndex >= 0
        ? argv[manifestIndex + 1]
        : 'scripts/verify/gbp-content-lineage.manifest.json',
  };
}

function validateManifest(parsed) {
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) {
    throw new Error('manifest must contain version 1 and entries');
  }
  const entries = new Map();
  for (const entry of parsed.entries) {
    const requiredStrings = [
      'storeKey',
      'location',
      'owner',
      'tenantKey',
      'provenance',
      'expirySource',
      'readFilter',
      'notes',
    ];
    const valid =
      requiredStrings.every((key) => typeof entry[key] === 'string' && entry[key].length > 0) &&
      Array.isArray(entry.contentFields) &&
      Array.isArray(entry.parents) &&
      ACTIONS.has(entry.purgeAction);
    if (!valid || entries.has(entry?.storeKey))
      throw new Error(`invalid or duplicate entry: ${entry?.storeKey ?? 'unknown'}`);
    entries.set(entry.storeKey, entry);
  }
  for (const entry of entries.values()) {
    for (const parent of entry.parents) {
      if (!entries.has(parent))
        throw new Error(`unknown copy parent ${parent} for ${entry.storeKey}`);
    }
    if (entry.expirySource.startsWith('inherit') && entry.parents.length === 0) {
      throw new Error(`inherited expiry requires a copy parent: ${entry.storeKey}`);
    }
  }
  return entries;
}

function physicalTables(entries) {
  const tables = new Map();
  for (const entry of entries.values()) {
    if (!entry.location.startsWith('db:')) continue;
    for (const table of entry.location.slice(3).split('|')) tables.set(table, entry);
  }
  return tables;
}

function scanSql(relativePath, source, tables, discovered, unknowns) {
  const tablePattern = /create table(?: if not exists)? public\.([a-z0-9_]+)\s*\(([\s\S]*?)\n\);/gi;
  for (const match of source.matchAll(tablePattern)) {
    const table = match[1];
    const body = match[2] ?? '';
    if (!table) continue;
    const contentColumns = [
      ...body.matchAll(/(?:^|,)\s*([a-z][a-z0-9_]*)\s+(?:jsonb?|text|varchar)/gim),
    ]
      .map((column) => column[1])
      .filter((column) => column && CONTENT_COLUMN.test(column));
    const entry = tables.get(table);
    if (!entry && STORE_NAME.test(table) && contentColumns.length > 0) {
      unknowns.push({ kind: 'store', table, path: relativePath, contentFields: contentColumns });
      continue;
    }
    if (!entry) continue;
    discovered.add(entry.storeKey);
    const allowed = new Set(entry.contentFields);
    for (const column of contentColumns) {
      if (!allowed.has(column))
        unknowns.push({ kind: 'column', table, column, path: relativePath });
    }
  }
}

function scanCopyExpiry(relativePath, source, unknowns) {
  const reset =
    /(?:retention_expires_at|content_expires_at|provider_expires_at)\s*:\s*(?:new Date\s*\(|Date\.now\s*\(|now\s*\()/g;
  for (const match of source.matchAll(reset)) {
    unknowns.push({ kind: 'copy_extends_expiry', path: relativePath, offset: match.index ?? 0 });
  }
}

async function scan(root, manifestPath) {
  const parsed = JSON.parse(await readFile(path.resolve(root, manifestPath), 'utf8'));
  const entries = validateManifest(parsed);
  const tables = physicalTables(entries);
  const discovered = new Set();
  const unknowns = [];
  const files = await filesBelow(root, root);
  for (const relativePath of files) {
    if (!/\.(?:sql|ts|tsx)$/.test(relativePath)) continue;
    const source = await readFile(path.join(root, relativePath), 'utf8');
    if (relativePath.endsWith('.sql')) scanSql(relativePath, source, tables, discovered, unknowns);
    else scanCopyExpiry(relativePath, source, unknowns);
  }
  const stale = [...entries.values()]
    .filter(
      (entry) =>
        entry.location.startsWith('db:') &&
        !discovered.has(entry.storeKey) &&
        !entry.location.includes('provider-definition-dictionaries'),
    )
    .map((entry) => ({ storeKey: entry.storeKey, location: entry.location }));
  return {
    ok: unknowns.length === 0 && stale.length === 0,
    counts: {
      entries: entries.size,
      physicalTables: tables.size,
      unknown: unknowns.length,
      stale: stale.length,
    },
    unknowns,
    stale,
    methodology:
      'Fail-closed manifest schema and copy-parent DAG validation plus SQL provider-store/content-column census and copy-expiry reset detection.',
  };
}

try {
  const args = parseArgs(process.argv.slice(2));
  const result = await scan(args.root, args.manifest);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'unknown error' }, null, 2)}\n`,
  );
  process.exitCode = 2;
}
