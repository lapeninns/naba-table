import { config as loadEnv } from 'dotenv';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

loadEnv({ path: '.env.local', override: false });

const MIGRATION_VERSION = '20260502190006';
const MIGRATION_NAME = 'add_gbp_foodmenus_sync_storage';

const EXPECTED_TABLES = [
  'restaurant_gbp_food_menu_import_reviews',
  'restaurant_gbp_food_menu_projected_identities',
  'restaurant_gbp_food_menu_publish_attempts',
  'restaurant_gbp_food_menu_snapshots',
] as const;

const EXPECTED_INDEXES = [
  'restaurant_gbp_food_menu_import_reviews_item_idx',
  'restaurant_gbp_food_menu_import_reviews_pending_path_idx',
  'restaurant_gbp_food_menu_import_reviews_restaurant_status_idx',
  'restaurant_gbp_food_menu_projected_identities_item_idx',
  'restaurant_gbp_food_menu_projected_identities_path_idx',
  'restaurant_gbp_food_menu_projected_identities_stable_idx',
  'restaurant_gbp_food_menu_publish_attempts_restaurant_idx',
  'restaurant_gbp_food_menu_publish_attempts_status_idx',
  'restaurant_gbp_food_menu_snapshots_hash_idx',
  'restaurant_gbp_food_menu_snapshots_kind_status_idx',
  'restaurant_gbp_food_menu_snapshots_restaurant_idx',
] as const;

const EXPECTED_TRIGGERS = [
  'restaurant_gbp_food_menu_import_reviews_updated_at',
  'restaurant_gbp_food_menu_publish_attempts_updated_at',
] as const;

type Args = {
  projectRef: string;
  expect: 'applied' | 'missing' | 'any';
  outPath: string | null;
};

type VerificationResult = {
  verifiedAt: string;
  target: {
    projectRef: string;
    source: 'Supabase Management API read-only database/query';
  };
  migration: {
    version: string;
    expectedName: string;
    ledgerRows: Array<Record<string, unknown>>;
  };
  schema: {
    tables: string[];
    missingTables: string[];
    secondaryIndexes: string[];
    missingIndexes: string[];
    triggers: Array<{ table_name: string; trigger_name: string }>;
    missingTriggers: string[];
    rls: Array<{ table_name: string; rls_enabled: boolean }>;
    serviceRolePolicyCount: number;
    policies: Array<Record<string, unknown>>;
  };
  conclusion:
    | 'foodmenus_storage_applied'
    | 'foodmenus_storage_missing_or_incomplete'
    | 'foodmenus_storage_partial';
};

function usage(): never {
  console.error(
    [
      'Usage:',
      '  pnpm -s tsx scripts/verify-gbp-foodmenus-storage.ts --project-ref <ref> [--expect applied|missing|any] [--out <path>]',
      '',
      'Env:',
      '  SUPABASE_ACCESS_TOKEN',
      '',
      'Notes:',
      '  - Read-only verifier for the GBP FoodMenus storage migration.',
      '  - Executes fixed SELECT queries only; no caller-supplied SQL is accepted.',
      '  - Does not print secrets.',
    ].join('\n'),
  );
  process.exit(1);
}

function parseArgs(argv: string[]): Args {
  let projectRef: string | null = null;
  let expect: Args['expect'] = 'any';
  let outPath: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) continue;

    if (token === '--project-ref') {
      projectRef = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token.startsWith('--project-ref=')) {
      projectRef = token.slice('--project-ref='.length);
      continue;
    }

    if (token === '--expect') {
      const value = argv[index + 1] ?? null;
      if (value !== 'applied' && value !== 'missing' && value !== 'any') {
        usage();
      }
      expect = value;
      index += 1;
      continue;
    }

    if (token.startsWith('--expect=')) {
      const value = token.slice('--expect='.length);
      if (value !== 'applied' && value !== 'missing' && value !== 'any') {
        usage();
      }
      expect = value;
      continue;
    }

    if (token === '--out') {
      outPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token.startsWith('--out=')) {
      outPath = token.slice('--out='.length);
      continue;
    }
  }

  if (!projectRef) {
    usage();
  }

  return { projectRef, expect, outPath };
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlStringList(values: readonly string[]): string {
  return values.map(sqlString).join(', ');
}

async function runManagementQuery(
  projectRef: string,
  query: string,
): Promise<Array<Record<string, unknown>>> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error('Missing SUPABASE_ACCESS_TOKEN.');
  }

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  );

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase Management API query failed with HTTP ${response.status}: ${body}`);
  }

  return JSON.parse(body) as Array<Record<string, unknown>>;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function tableNamesFromRows(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => asObject(entry).table_name)
    .filter((entry): entry is string => typeof entry === 'string');
}

function indexNamesFromRows(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => asObject(entry).indexname)
    .filter((entry): entry is string => typeof entry === 'string');
}

function triggerNamesFromRows(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => asObject(entry).trigger_name)
    .filter((entry): entry is string => typeof entry === 'string');
}

function countServiceRolePolicies(value: unknown): number {
  if (!Array.isArray(value)) {
    return 0;
  }
  return value.filter((entry) => {
    const roles = asObject(entry).roles;
    if (typeof roles === 'string') {
      return roles.includes('service_role');
    }
    if (Array.isArray(roles)) {
      return roles.includes('service_role');
    }
    return false;
  }).length;
}

function conclusionFor(
  result: Omit<VerificationResult, 'conclusion'>,
): VerificationResult['conclusion'] {
  const ledgerRows = result.migration.ledgerRows.length;
  const hasAllTables = result.schema.missingTables.length === 0;
  const hasAllIndexes = result.schema.missingIndexes.length === 0;
  const hasAllTriggers = result.schema.missingTriggers.length === 0;
  const hasAllRls =
    result.schema.rls.length === EXPECTED_TABLES.length &&
    result.schema.rls.every((entry) => entry.rls_enabled);
  const hasAllPolicies = result.schema.serviceRolePolicyCount === EXPECTED_TABLES.length;

  if (
    ledgerRows > 0 &&
    hasAllTables &&
    hasAllIndexes &&
    hasAllTriggers &&
    hasAllRls &&
    hasAllPolicies
  ) {
    return 'foodmenus_storage_applied';
  }

  const hasAnySchema =
    ledgerRows > 0 ||
    result.schema.tables.length > 0 ||
    result.schema.secondaryIndexes.length > 0 ||
    result.schema.triggers.length > 0 ||
    result.schema.rls.length > 0 ||
    result.schema.serviceRolePolicyCount > 0;

  return hasAnySchema ? 'foodmenus_storage_partial' : 'foodmenus_storage_missing_or_incomplete';
}

function assertExpectation(result: VerificationResult, expect: Args['expect']) {
  if (expect === 'any') {
    return;
  }

  if (expect === 'applied' && result.conclusion !== 'foodmenus_storage_applied') {
    throw new Error(`Expected FoodMenus storage to be applied, got ${result.conclusion}.`);
  }

  if (expect === 'missing' && result.conclusion !== 'foodmenus_storage_missing_or_incomplete') {
    throw new Error(`Expected FoodMenus storage to be missing, got ${result.conclusion}.`);
  }
}

async function verify(projectRef: string): Promise<VerificationResult> {
  const rows = await runManagementQuery(
    projectRef,
    `
      SELECT json_build_object(
        'ledgerRows',
        (
          SELECT COALESCE(json_agg(row_to_json(m)), '[]'::json)
          FROM (
            SELECT version, name
            FROM supabase_migrations.schema_migrations
            WHERE version = ${sqlString(MIGRATION_VERSION)}
            ORDER BY version
          ) m
        ),
        'tables',
        (
          SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
          FROM (
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN (${sqlStringList(EXPECTED_TABLES)})
            ORDER BY table_name
          ) t
        ),
        'indexes',
        (
          SELECT COALESCE(json_agg(row_to_json(i)), '[]'::json)
          FROM (
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname IN (${sqlStringList(EXPECTED_INDEXES)})
            ORDER BY indexname
          ) i
        ),
        'triggers',
        (
          SELECT COALESCE(json_agg(row_to_json(tr)), '[]'::json)
          FROM (
            SELECT event_object_table AS table_name, trigger_name
            FROM information_schema.triggers
            WHERE trigger_schema = 'public'
              AND trigger_name IN (${sqlStringList(EXPECTED_TRIGGERS)})
            ORDER BY event_object_table, trigger_name
          ) tr
        ),
        'rls',
        (
          SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
          FROM (
            SELECT relname AS table_name, relrowsecurity AS rls_enabled
            FROM pg_class
            JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
            WHERE pg_namespace.nspname = 'public'
              AND relname IN (${sqlStringList(EXPECTED_TABLES)})
            ORDER BY relname
          ) r
        ),
        'policies',
        (
          SELECT COALESCE(json_agg(row_to_json(p)), '[]'::json)
          FROM (
            SELECT tablename, policyname, roles, cmd
            FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename IN (${sqlStringList(EXPECTED_TABLES)})
            ORDER BY tablename, policyname
          ) p
        )
      ) AS result;
    `,
  );

  const snapshot = asObject(rows[0]?.result);
  const ledgerRows = Array.isArray(snapshot.ledgerRows)
    ? (snapshot.ledgerRows as Array<Record<string, unknown>>)
    : [];
  const tables = tableNamesFromRows(snapshot.tables);
  const secondaryIndexes = indexNamesFromRows(snapshot.indexes);
  const triggers = Array.isArray(snapshot.triggers)
    ? (snapshot.triggers as Array<{ table_name: string; trigger_name: string }>)
    : [];
  const triggerNames = triggerNamesFromRows(snapshot.triggers);
  const rls = Array.isArray(snapshot.rls)
    ? (snapshot.rls as Array<{ table_name: string; rls_enabled: boolean }>)
    : [];
  const policies = Array.isArray(snapshot.policies)
    ? (snapshot.policies as Array<Record<string, unknown>>)
    : [];

  const withoutConclusion = {
    verifiedAt: new Date().toISOString(),
    target: {
      projectRef,
      source: 'Supabase Management API read-only database/query' as const,
    },
    migration: {
      version: MIGRATION_VERSION,
      expectedName: MIGRATION_NAME,
      ledgerRows,
    },
    schema: {
      tables,
      missingTables: EXPECTED_TABLES.filter((table) => !tables.includes(table)),
      secondaryIndexes,
      missingIndexes: EXPECTED_INDEXES.filter((index) => !secondaryIndexes.includes(index)),
      triggers,
      missingTriggers: EXPECTED_TRIGGERS.filter((trigger) => !triggerNames.includes(trigger)),
      rls,
      serviceRolePolicyCount: countServiceRolePolicies(policies),
      policies,
    },
  };

  return {
    ...withoutConclusion,
    conclusion: conclusionFor(withoutConclusion),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await verify(args.projectRef);
  const json = `${JSON.stringify(result, null, 2)}\n`;

  if (args.outPath) {
    await writeFile(path.resolve(args.outPath), json);
  }

  process.stdout.write(json);
  assertExpectation(result, args.expect);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
