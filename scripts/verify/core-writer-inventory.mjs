import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const CANONICAL_TABLES = [
  'restaurant_business_details',
  'restaurant_addresses',
  'restaurant_phone_numbers',
  'restaurant_links',
  'restaurant_categories',
  'restaurant_service_areas',
  'restaurant_hours',
  'restaurant_attributes',
  'restaurant_service_items',
];
const TRIGGER_TABLES = [
  ...CANONICAL_TABLES,
  'restaurants',
  'restaurant_operating_hours',
  'restaurant_service_periods',
];

const RPC_TARGETS = {
  apply_gbp_profile_import_to_core_v1: ['restaurants'],
  replace_restaurant_business_context_core: CANONICAL_TABLES.filter(
    (table) =>
      !['restaurant_addresses', 'restaurant_phone_numbers', 'restaurant_hours'].includes(table),
  ),
  replace_gbp_canonical_business_info: CANONICAL_TABLES,
  replace_restaurant_operating_hours: ['restaurant_operating_hours'],
  replace_restaurant_service_periods: ['restaurant_service_periods'],
  save_restaurant_availability: [
    'restaurant_operating_hours',
    'restaurant_service_periods',
    'restaurants',
  ],
  update_restaurant_profile_v1: ['restaurants', 'restaurant_business_details'],
};

async function walk(root, relative = '') {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || ['node_modules', 'tests'].includes(entry.name)) continue;
      files.push(...(await walk(root, child)));
    } else if (/\.(?:ts|tsx|mts|cts|js|mjs|cjs|sql)$/.test(entry.name)) {
      files.push(child);
    }
  }
  return files;
}

function lineAt(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

function record(pathname, table, operation, symbol, line) {
  return { path: pathname, line, table, operation, symbol };
}

function scanDirect(pathname, source) {
  const found = [];
  const fromPattern = /\.from\(['"](restaurants|restaurant_[a-z_]+)['"]\)([\s\S]*?);/g;
  for (const match of source.matchAll(fromPattern)) {
    const table = match[1];
    if (!TRIGGER_TABLES.includes(table)) continue;
    const mutation = /\.(insert|update|upsert|delete)\s*\(([^)]*)/.exec(match[2]);
    if (table === 'restaurants' && mutation && mutation[1] !== 'delete') {
      const argument = mutation[2].trim();
      const explicitObject = argument.startsWith('{') && !argument.includes('...');
      const relevantColumn =
        /\b(name|contact_phone|address|google_map_url|google_review_url)\s*:/.test(argument);
      if (explicitObject && !relevantColumn) continue;
    }
    if (mutation) {
      const operationOffset = match.index + match[0].indexOf(`.${mutation[1]}`);
      found.push(
        record(pathname, table, mutation[1], `from:${table}`, lineAt(source, operationOffset)),
      );
    }
  }
  const sqlPattern =
    /\b(insert\s+into|update|delete\s+from)\s+(?:public\.)?(restaurants|restaurant_[a-z_]+)\b/gi;
  for (const match of source.matchAll(sqlPattern)) {
    const table = match[2].toLowerCase();
    if (!TRIGGER_TABLES.includes(table)) continue;
    const operation = match[1].toLowerCase().replace(/\s+/g, '_');
    found.push(record(pathname, table, operation, `sql:${table}`, lineAt(source, match.index)));
  }
  return found;
}

function scanRpcs(pathname, source) {
  const found = [];
  for (const [rpc, tables] of Object.entries(RPC_TARGETS)) {
    const pattern = new RegExp(`[\\s'"]${rpc}[\\s'"]`, 'g');
    for (const match of source.matchAll(pattern)) {
      for (const table of tables) {
        found.push(record(pathname, table, 'replace', `rpc:${rpc}`, lineAt(source, match.index)));
      }
    }
  }
  return found;
}

function key(item) {
  return `${item.path}#${item.table}:${item.operation}:${item.symbol}`;
}

export async function buildCoreWriterInventory({ root, manifestPath }) {
  const manifest = JSON.parse(await readFile(path.resolve(root, manifestPath), 'utf8'));
  const files = await walk(root);
  const observed = [];
  let migrationText = '';
  for (const pathname of files) {
    if (pathname.startsWith('scripts/verify/')) continue;
    const source = await readFile(path.join(root, pathname), 'utf8');
    if (pathname.startsWith('supabase/migrations/')) migrationText += `\n${source}`;
    if (pathname.startsWith('supabase/migrations/')) continue;
    observed.push(...scanDirect(pathname, source), ...scanRpcs(pathname, source));
  }
  const counts = new Map();
  for (const item of observed) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  const expected = new Map(manifest.entries.map((item) => [key(item), item]));
  const unknown = observed.filter((item) => !expected.has(key(item)));
  const stale = manifest.entries
    .map((item) => ({ ...item, actualCount: counts.get(key(item)) ?? 0 }))
    .filter((item) => item.actualCount !== item.expectedCount);
  const triggerGaps = TRIGGER_TABLES.filter(
    (table) =>
      !new RegExp(
        `create\\s+trigger\\s+${table}_gbp_core_outbox[\\s\\S]{0,180}?on\\s+public\\.${table}\\b`,
        'i',
      ).test(migrationText),
  );
  return {
    version: 1,
    canonicalTables: CANONICAL_TABLES,
    triggerTables: TRIGGER_TABLES,
    observed: observed.map((item) => ({ ...expected.get(key(item)), ...item })),
    unknown,
    stale,
    triggerGaps,
  };
}

if (process.argv[1]?.endsWith('core-writer-inventory.mjs')) {
  const rootIndex = process.argv.indexOf('--root');
  const manifestIndex = process.argv.indexOf('--manifest');
  const root = path.resolve(rootIndex >= 0 ? process.argv[rootIndex + 1] : '.');
  const manifestPath =
    manifestIndex >= 0
      ? process.argv[manifestIndex + 1]
      : 'scripts/verify/core-writer-inventory.manifest.json';
  try {
    const report = await buildCoreWriterInventory({ root, manifestPath });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode =
      report.unknown.length || report.stale.length || report.triggerGaps.length ? 1 : 0;
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`,
    );
    process.exitCode = 2;
  }
}
