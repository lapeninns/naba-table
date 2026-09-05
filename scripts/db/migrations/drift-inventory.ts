import path from 'node:path';

/**
 * Extended schema drift inspection.
 *
 * `supabase db diff --linked --schema public` covers the public schema as a whole, but its
 * output is a generated SQL script that operators have to read. This inventory turns the
 * security-relevant catalog state (functions, grants, RLS policies, constraints, table
 * RLS flags, role settings and default privileges) into a deterministic JSON document that
 * can be compared field by field against a reviewed baseline recorded from staging.
 *
 * The baseline is evidence: when it is missing the extended check fails closed.
 */

export const SCHEMA_INVENTORY_RELATIVE_PATH = path.join('config', 'db', 'schema-inventory.json');

export const INVENTORY_SECTIONS = [
  'tables',
  'functions',
  'policies',
  'grants',
  'constraints',
  'roleSettings',
  'defaultPrivileges',
] as const;

export type InventorySection = (typeof INVENTORY_SECTIONS)[number];

export type SchemaInventory = Readonly<Record<InventorySection, readonly string[]>>;

export type InventoryBaseline = {
  readonly schemaVersion: 1;
  readonly target: 'staging';
  readonly recordedAt: string;
  readonly inventory: SchemaInventory;
};

export type InventoryDifference = {
  readonly section: InventorySection;
  readonly added: readonly string[];
  readonly removed: readonly string[];
};

export type InventoryComparison = {
  readonly ok: boolean;
  readonly differences: readonly InventoryDifference[];
};

/**
 * Single-row query returning one jsonb column named `inventory`. Every section is an array
 * of objects ordered inside the database so the output is stable across runs.
 */
export const INVENTORY_SQL = `
SELECT jsonb_build_object(
  'tables', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', c.relname,
      'kind', c.relkind::text,
      'rlsEnabled', c.relrowsecurity,
      'rlsForced', c.relforcerowsecurity,
      'owner', pg_get_userbyid(c.relowner)
    ) ORDER BY c.relname)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
  ), '[]'::jsonb),
  'functions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'signature', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
      'returns', pg_get_function_result(p.oid),
      'securityDefiner', p.prosecdef,
      'language', l.lanname,
      'owner', pg_get_userbyid(p.proowner),
      'config', COALESCE(to_jsonb(p.proconfig), '[]'::jsonb),
      'bodyDigest', md5(p.prosrc)
    ) ORDER BY p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public'
  ), '[]'::jsonb),
  'policies', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'table', pol.tablename,
      'name', pol.policyname,
      'permissive', pol.permissive,
      'roles', to_jsonb(pol.roles),
      'command', pol.cmd,
      'using', pol.qual,
      'withCheck', pol.with_check
    ) ORDER BY pol.tablename, pol.policyname)
    FROM pg_policies pol
    WHERE pol.schemaname = 'public'
  ), '[]'::jsonb),
  'grants', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'table', g.table_name,
      'grantee', g.grantee,
      'privilege', g.privilege_type,
      'grantable', g.is_grantable
    ) ORDER BY g.table_name, g.grantee, g.privilege_type)
    FROM information_schema.role_table_grants g
    WHERE g.table_schema = 'public'
      AND g.grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ), '[]'::jsonb),
  'constraints', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'table', r.relname,
      'name', c.conname,
      'type', c.contype::text,
      'definition', pg_get_constraintdef(c.oid),
      'validated', c.convalidated
    ) ORDER BY r.relname, c.conname)
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public'
  ), '[]'::jsonb),
  'roleSettings', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'role', r.rolname,
      'config', COALESCE(to_jsonb(r.rolconfig), '[]'::jsonb),
      'bypassRls', r.rolbypassrls,
      'superuser', r.rolsuper
    ) ORDER BY r.rolname)
    FROM pg_roles r
    WHERE r.rolname IN ('anon', 'authenticated', 'service_role', 'authenticator', 'postgres')
  ), '[]'::jsonb),
  'defaultPrivileges', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'owner', pg_get_userbyid(d.defaclrole),
      'schema', COALESCE(n.nspname, ''),
      'objectType', d.defaclobjtype::text,
      'acl', COALESCE(to_jsonb(d.defaclacl::text[]), '[]'::jsonb)
    ) ORDER BY pg_get_userbyid(d.defaclrole), COALESCE(n.nspname, ''), d.defaclobjtype::text)
    FROM pg_default_acl d
    LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
    WHERE n.nspname IS NULL OR n.nspname = 'public'
  ), '[]'::jsonb)
) AS inventory;
`.trim();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (isRecord(value)) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = canonicalize(value[key]);
    }
    return sorted;
  }
  return value;
}

/** Each section becomes a sorted list of canonical JSON strings so comparison is set-like. */
export function normalizeInventory(raw: unknown): SchemaInventory {
  if (!isRecord(raw)) {
    throw new Error('Schema inventory must be a JSON object.');
  }
  const sections: Partial<Record<InventorySection, readonly string[]>> = {};
  for (const section of INVENTORY_SECTIONS) {
    const entries = raw[section];
    if (!Array.isArray(entries)) {
      throw new Error(`Schema inventory section "${section}" must be an array.`);
    }
    sections[section] = entries.map((entry) => JSON.stringify(canonicalize(entry))).sort();
  }
  return sections as SchemaInventory;
}

export function parseInventoryBaseline(text: string): InventoryBaseline {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Schema inventory baseline is not valid JSON.');
  }
  if (!isRecord(raw) || raw.schemaVersion !== 1 || raw.target !== 'staging') {
    throw new Error('Schema inventory baseline must have schemaVersion 1 and target staging.');
  }
  if (typeof raw.recordedAt !== 'string' || Number.isNaN(Date.parse(raw.recordedAt))) {
    throw new Error('Schema inventory baseline recordedAt must be a timestamp.');
  }
  if (!isRecord(raw.inventory)) {
    throw new Error('Schema inventory baseline inventory must be an object.');
  }
  const inventoryRaw: Record<string, unknown> = {};
  for (const section of INVENTORY_SECTIONS) {
    const entries = raw.inventory[section];
    if (!Array.isArray(entries) || !entries.every((entry) => typeof entry === 'string')) {
      throw new Error(`Schema inventory baseline section "${section}" must be a string array.`);
    }
    inventoryRaw[section] = entries.map((entry) => JSON.parse(entry));
  }
  return {
    schemaVersion: 1,
    target: 'staging',
    recordedAt: raw.recordedAt,
    inventory: normalizeInventory(inventoryRaw),
  };
}

export function compareInventory(
  baseline: SchemaInventory,
  actual: SchemaInventory,
): InventoryComparison {
  const differences: InventoryDifference[] = [];
  for (const section of INVENTORY_SECTIONS) {
    const expected = new Set(baseline[section]);
    const observed = new Set(actual[section]);
    const added = actual[section].filter((entry) => !expected.has(entry));
    const removed = baseline[section].filter((entry) => !observed.has(entry));
    if (added.length > 0 || removed.length > 0) {
      differences.push({ section, added, removed });
    }
  }
  return { ok: differences.length === 0, differences };
}

export function renderInventoryBaseline(inventory: SchemaInventory, recordedAt: string): string {
  const baseline: InventoryBaseline = {
    schemaVersion: 1,
    target: 'staging',
    recordedAt,
    inventory,
  };
  return `${JSON.stringify(baseline, null, 2)}\n`;
}

export function renderInventoryDifferences(comparison: InventoryComparison): string {
  const lines: string[] = [];
  for (const difference of comparison.differences) {
    for (const entry of difference.added) {
      lines.push(`drift: ${difference.section} + ${entry}`);
    }
    for (const entry of difference.removed) {
      lines.push(`drift: ${difference.section} - ${entry}`);
    }
  }
  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}

export type InventoryQuery = (sql: string) => Promise<readonly Record<string, unknown>[]>;

export async function inspectSchemaInventory(query: InventoryQuery): Promise<SchemaInventory> {
  const rows = await query(INVENTORY_SQL);
  const first = rows[0];
  if (rows.length !== 1 || !first || !('inventory' in first)) {
    throw new Error('Schema inventory query did not return exactly one inventory row.');
  }
  const raw = first.inventory;
  return normalizeInventory(typeof raw === 'string' ? JSON.parse(raw) : raw);
}
