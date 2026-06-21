import { config as loadEnv } from 'dotenv';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';

import { getPgSslConfig } from './db/pg-ssl';

const projectRoot = process.cwd();
const MIGRATION_VERSION = '20260510110100';
const MIGRATION_NAME = 'add_sms_delivery_log_query_indexes';
const MIGRATION_PATH = path.join(
  projectRoot,
  'supabase',
  'migrations',
  `${MIGRATION_VERSION}_${MIGRATION_NAME}.sql`,
);

const EXPECTED_INDEXES = [
  'sms_delivery_log_recent_confirmation_idx',
  'sms_delivery_log_restaurant_occurred_id_idx',
  'sms_delivery_log_message_phone_occurred_idx',
  'sms_delivery_log_inflight_reconcile_idx',
] as const;

const REQUIRED_TWILIO_ENV = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_API_KEY_SID',
  'TWILIO_API_KEY_SECRET',
  'TWILIO_MESSAGING_SERVICE_SID',
] as const;

const VERCEL_PREVIEW_CALLBACK_ENV = ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SITE_URL'] as const;

type Target = 'staging' | 'production';

type Args = {
  target: Target | 'all';
  strict: boolean;
  checkVercelEnv: boolean;
  vercelGitBranch: string | null;
  skipPulledEnvFiles: boolean;
  skipLocalEnvFiles: boolean;
  expectedStagingProjectRef: string | null;
  expectedStagingProjectRefSource: 'env' | 'expected-arg' | null;
  callbackBaseUrl: string | null;
};

type EnvCheck = {
  key: string;
  present: boolean;
};

type ProjectRefSource = 'env' | 'expected-arg' | 'local-temp' | 'api-url' | 'missing';

type TargetReadiness = {
  target: Target;
  projectRef: string | null;
  projectRefSource: ProjectRefSource;
  supabaseProjectRefs: {
    apiUrl: string | null;
    databaseUrl: string | null;
  };
  env: EnvCheck[];
  migration: {
    checked: boolean;
    sourceExists: boolean;
    ledgerRecorded: boolean | null;
    indexesPresent: string[];
    indexesMissing: string[];
    error: string | null;
  };
};

type ReadinessReport = {
  ok: boolean;
  strict: boolean;
  checkedAt: string;
  localMigrationSource: {
    path: string;
    exists: boolean;
  };
  app: {
    callbackBaseUrl: string | null;
    callbackBaseUrlConcrete: boolean;
    callbackBaseUrlVercelRuntimeResolvable: boolean;
    statusCallbackConfigured: boolean;
    twilioAuthTokenPresent: boolean;
  };
  twilio: {
    sendConfigured: boolean;
    readConfigured: boolean;
    env: EnvCheck[];
  };
  vercelEnv: {
    checked: boolean;
    environment: 'preview' | null;
    gitBranch: string | null;
    keysPresent: string[];
    keysMissing: string[];
    callbackKeysPresent: string[];
    callbackKeySatisfied: boolean | null;
    error: string | null;
  };
  targets: TargetReadiness[];
  blockers: string[];
  warnings: string[];
};

export function parseSmsDeliveryReadinessArgs(argv: string[]): Args {
  const args: Args = {
    target: 'all',
    strict: false,
    checkVercelEnv: false,
    vercelGitBranch: process.env.SMS_DELIVERY_VERCEL_GIT_BRANCH?.trim() || null,
    skipPulledEnvFiles: false,
    skipLocalEnvFiles: false,
    expectedStagingProjectRef: process.env.STAGING_SUPABASE_PROJECT_REF?.trim() || null,
    expectedStagingProjectRefSource: process.env.STAGING_SUPABASE_PROJECT_REF?.trim()
      ? 'env'
      : null,
    callbackBaseUrl: process.env.SMS_DELIVERY_CALLBACK_BASE_URL?.trim() || null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index] ?? '';
    if (raw === '--strict') {
      args.strict = true;
      continue;
    }
    if (raw === '--check-vercel-env') {
      args.checkVercelEnv = true;
      continue;
    }
    if (raw === '--skip-pulled-env-files') {
      args.skipPulledEnvFiles = true;
      continue;
    }
    if (raw === '--skip-local-env-files') {
      args.skipLocalEnvFiles = true;
      continue;
    }

    const takeValue = (flag: string): string | null => {
      if (raw === flag) {
        const next = argv[index + 1];
        if (next) {
          index += 1;
          return next;
        }
      }
      if (raw.startsWith(`${flag}=`)) {
        return raw.slice(flag.length + 1);
      }
      return null;
    };

    const target = takeValue('--target');
    if (target === 'staging' || target === 'production' || target === 'all') {
      args.target = target;
      continue;
    }
    if (target) {
      throw new Error(`Unsupported --target value: ${target}`);
    }

    const vercelGitBranch = takeValue('--vercel-git-branch');
    if (vercelGitBranch) {
      args.vercelGitBranch = vercelGitBranch.trim();
      continue;
    }

    const expectedStagingProjectRef = takeValue('--expected-staging-project-ref');
    if (expectedStagingProjectRef) {
      args.expectedStagingProjectRef = expectedStagingProjectRef.trim();
      args.expectedStagingProjectRefSource = 'expected-arg';
      continue;
    }

    const callbackBaseUrl = takeValue('--callback-base-url');
    if (callbackBaseUrl) {
      args.callbackBaseUrl = callbackBaseUrl.trim();
      continue;
    }
  }
  return args;
}

function loadEnvFile(relativePath: string, override: boolean) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (fs.existsSync(absolutePath)) {
    loadEnv({ path: absolutePath, override, quiet: true });
  }
}

function loadEnvFiles(
  target: Args['target'],
  options: { skipPulledEnvFiles: boolean; skipLocalEnvFiles: boolean },
) {
  if (!options.skipLocalEnvFiles) {
    loadEnvFile('.env.local', false);
  }

  if (!options.skipPulledEnvFiles && (target === 'staging' || target === 'all')) {
    loadEnvFile('.env.vercel.preview', true);
  }

  if (!options.skipPulledEnvFiles && (target === 'production' || target === 'all')) {
    const envPaths = [
      '.env.vercel-production',
      '.env.vercel-production.live',
      '.env.tmp.production',
    ];
    for (const relativePath of envPaths) {
      loadEnvFile(relativePath, true);
    }
  }

  if (!options.skipLocalEnvFiles) {
    for (const relativePath of ['.env.sms-delivery-readiness.local']) {
      const absolutePath = path.join(projectRoot, relativePath);
      if (fs.existsSync(absolutePath)) {
        loadEnv({ path: absolutePath, override: true, quiet: true });
      }
    }
  }
}

function envPresent(keys: readonly string[]): EnvCheck[] {
  return keys.map((key) => ({
    key,
    present: Boolean(process.env[key]?.trim()),
  }));
}

function missingKeys(checks: readonly EnvCheck[]): string[] {
  return checks.filter((check) => !check.present).map((check) => check.key);
}

function parseVercelEnvListJson(raw: string): Set<string> {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd = trimmed.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    throw new Error('Vercel env list did not return JSON output.');
  }

  const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as {
    envs?: Array<{ key?: unknown }>;
  };
  return new Set(
    (parsed.envs ?? [])
      .map((item) => item.key)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  );
}

export function buildVercelPreviewEnvListArgs(gitBranch: string | null): string[] {
  const args = ['vercel', 'env', 'ls', 'preview'];
  if (gitBranch) {
    args.push(gitBranch);
  }
  args.push('--format', 'json');
  return args;
}

function checkVercelPreviewEnvMetadata(input: {
  requiredKeys: readonly string[];
  callbackKeys: readonly string[];
  gitBranch: string | null;
}) {
  const listKeys = (gitBranch: string | null): Set<string> => {
    const args = buildVercelPreviewEnvListArgs(gitBranch);
    const result = spawnSync('npx', args, {
      cwd: projectRoot,
      encoding: 'utf8',
    });

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      const detail = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`;
      throw new Error(`vercel env ls preview${gitBranch ? ` ${gitBranch}` : ''} failed: ${detail}`);
    }

    return parseVercelEnvListJson(result.stdout);
  };

  const keys = listKeys(null);
  if (input.gitBranch) {
    for (const key of listKeys(input.gitBranch)) {
      keys.add(key);
    }
  }

  const keysPresent = input.requiredKeys.filter((key) => keys.has(key));
  const keysMissing = input.requiredKeys.filter((key) => !keys.has(key));
  const callbackKeysPresent = input.callbackKeys.filter((key) => keys.has(key));
  const callbackKeySatisfied = callbackKeysPresent.length > 0;
  return { keysPresent, keysMissing, callbackKeysPresent, callbackKeySatisfied };
}

function hasTemplatePlaceholder(value: string): boolean {
  return /\$\{[^}]+\}/.test(value);
}

function resolveUrlTemplate(value: string | null): string | null {
  if (!value) return null;
  if (!value.includes('${VERCEL_URL}')) return value;

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (!vercelUrl || hasTemplatePlaceholder(vercelUrl)) return value;

  return value.replaceAll('${VERCEL_URL}', vercelUrl);
}

function isConcreteHttpUrl(value: string | null): boolean {
  if (!value || hasTemplatePlaceholder(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isVercelRuntimeResolvableUrl(value: string | null): boolean {
  if (!value || !value.includes('${VERCEL_URL}')) return false;
  return isConcreteHttpUrl(value.replaceAll('${VERCEL_URL}', 'preview.example.vercel.app'));
}

export function extractSupabaseProjectRefFromApiUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const [projectRef] = parsed.hostname.split('.');
    return projectRef || null;
  } catch {
    return null;
  }
}

export function extractSupabaseProjectRefFromDatabaseUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const hostParts = parsed.hostname.split('.');
    const dbHostIndex = hostParts.indexOf('db');
    if (dbHostIndex >= 0 && hostParts[dbHostIndex + 1]) {
      return hostParts[dbHostIndex + 1];
    }

    const userMatch = decodeURIComponent(parsed.username).match(/^postgres\.([a-z0-9]{20})$/i);
    return userMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

function readStagingProjectRef(): string | null {
  const tempRefPath = path.join(projectRoot, 'supabase', '.temp', 'project-ref');
  if (!fs.existsSync(tempRefPath)) return null;
  const value = fs.readFileSync(tempRefPath, 'utf8').trim();
  return value || null;
}

function getTargetProjectRefInfo(
  target: Target,
  options: {
    skipLocalProjectRef: boolean;
    expectedStagingProjectRef: string | null;
    expectedStagingProjectRefSource: 'env' | 'expected-arg' | null;
  },
): {
  projectRef: string | null;
  source: ProjectRefSource;
} {
  if (target === 'production') {
    const projectRef = process.env.PRODUCTION_SUPABASE_PROJECT_REF?.trim() || null;
    return { projectRef, source: projectRef ? 'env' : 'missing' };
  }

  const envProjectRef = options.expectedStagingProjectRef;
  if (envProjectRef) {
    return { projectRef: envProjectRef, source: options.expectedStagingProjectRefSource ?? 'env' };
  }

  if (!options.skipLocalProjectRef) {
    const localProjectRef = readStagingProjectRef();
    if (localProjectRef) return { projectRef: localProjectRef, source: 'local-temp' };
  }

  const apiProjectRef = extractSupabaseProjectRefFromApiUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null,
  );
  if (apiProjectRef) return { projectRef: apiProjectRef, source: 'api-url' };

  return { projectRef: null, source: 'missing' };
}

function getTargetProjectRef(
  target: Target,
  options: {
    skipLocalProjectRef: boolean;
    expectedStagingProjectRef: string | null;
    expectedStagingProjectRefSource: 'env' | 'expected-arg' | null;
  },
): string | null {
  return getTargetProjectRefInfo(target, options).projectRef;
}

function getTargetEnvChecks(
  target: Target,
  options: {
    skipLocalProjectRef: boolean;
    expectedStagingProjectRef: string | null;
    expectedStagingProjectRefSource: 'env' | 'expected-arg' | null;
  },
): EnvCheck[] {
  if (target === 'production') {
    return envPresent([
      'PRODUCTION_SUPABASE_PROJECT_REF',
      'PRODUCTION_SUPABASE_URL',
      'PRODUCTION_SUPABASE_DB_URL',
      'PRODUCTION_SUPABASE_SERVICE_ROLE_KEY',
    ]);
  }

  return [
    {
      key: options.skipLocalProjectRef
        ? 'STAGING_SUPABASE_PROJECT_REF or --expected-staging-project-ref or NEXT_PUBLIC_SUPABASE_URL'
        : 'STAGING_SUPABASE_PROJECT_REF or supabase/.temp/project-ref or NEXT_PUBLIC_SUPABASE_URL',
      present: Boolean(getTargetProjectRef('staging', options)),
    },
    ...envPresent(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']),
    {
      key: 'SUPABASE_ACCESS_TOKEN or SUPABASE_DB_URL',
      present: Boolean(
        process.env.SUPABASE_ACCESS_TOKEN?.trim() ||
        process.env.SUPABASE_DB_URL?.trim() ||
        process.env.DATABASE_URL?.trim(),
      ),
    },
  ];
}

function getTargetEnvironmentMismatchErrors(target: Target, projectRef: string | null): string[] {
  if (!projectRef) return [];

  const projectRefs = getTargetSupabaseProjectRefs(target);
  if (target === 'production') {
    return [
      projectRefs.apiUrl && projectRefs.apiUrl !== projectRef
        ? `PRODUCTION_SUPABASE_URL project ref mismatch: expected ${projectRef}, received ${projectRefs.apiUrl}.`
        : null,
      projectRefs.databaseUrl && projectRefs.databaseUrl !== projectRef
        ? `PRODUCTION_SUPABASE_DB_URL project ref mismatch: expected ${projectRef}, received ${projectRefs.databaseUrl}.`
        : null,
    ].filter((value): value is string => Boolean(value));
  }

  return [
    projectRefs.apiUrl && projectRefs.apiUrl !== projectRef
      ? `NEXT_PUBLIC_SUPABASE_URL project ref mismatch: expected ${projectRef}, received ${projectRefs.apiUrl}.`
      : null,
    projectRefs.databaseUrl && projectRefs.databaseUrl !== projectRef
      ? `SUPABASE_DB_URL project ref mismatch: expected ${projectRef}, received ${projectRefs.databaseUrl}.`
      : null,
  ].filter((value): value is string => Boolean(value));
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function querySupabaseManagement(projectRef: string, sql: string): Promise<unknown[]> {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new Error('SUPABASE_ACCESS_TOKEN is required for Supabase Management API readback.');
  }

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  );

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase Management API query failed (${response.status}): ${raw}`);
  }

  const parsed = raw ? (JSON.parse(raw) as unknown) : [];
  return Array.isArray(parsed) ? parsed : [];
}

function getTargetDatabaseUrl(target: Target): string | null {
  if (target === 'production') {
    return process.env.PRODUCTION_SUPABASE_DB_URL?.trim() || null;
  }
  return process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim() || null;
}

function getTargetSupabaseProjectRefs(target: Target): TargetReadiness['supabaseProjectRefs'] {
  if (target === 'production') {
    return {
      apiUrl: extractSupabaseProjectRefFromApiUrl(
        process.env.PRODUCTION_SUPABASE_URL?.trim() || null,
      ),
      databaseUrl: extractSupabaseProjectRefFromDatabaseUrl(getTargetDatabaseUrl(target)),
    };
  }

  return {
    apiUrl: extractSupabaseProjectRefFromApiUrl(
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null,
    ),
    databaseUrl: extractSupabaseProjectRefFromDatabaseUrl(getTargetDatabaseUrl(target)),
  };
}

async function querySupabaseDatabase(target: Target, sql: string): Promise<unknown[]> {
  const connectionString = getTargetDatabaseUrl(target);
  if (!connectionString) {
    throw new Error('SUPABASE_ACCESS_TOKEN or SUPABASE_DB_URL is required for readback.');
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    ssl: getPgSslConfig(),
  });

  try {
    const result = await pool.query(sql);
    return result.rows as unknown[];
  } finally {
    await pool.end();
  }
}

async function querySupabaseReadback(
  target: Target,
  projectRef: string,
  sql: string,
): Promise<unknown[]> {
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
    return querySupabaseManagement(projectRef, sql);
  }
  return querySupabaseDatabase(target, sql);
}

async function checkMigration(
  target: Target,
  projectRef: string | null,
): Promise<TargetReadiness['migration']> {
  const sourceExists = fs.existsSync(MIGRATION_PATH);
  const base = {
    checked: false,
    sourceExists,
    ledgerRecorded: null,
    indexesPresent: [],
    indexesMissing: [...EXPECTED_INDEXES],
    error: null,
  };

  if (!projectRef) {
    return {
      ...base,
      error: `${target} Supabase project ref is missing.`,
    };
  }

  if (!process.env.SUPABASE_ACCESS_TOKEN?.trim() && !getTargetDatabaseUrl(target)) {
    return {
      ...base,
      error: 'SUPABASE_ACCESS_TOKEN or SUPABASE_DB_URL is missing.',
    };
  }

  const databaseUrl = getTargetDatabaseUrl(target);
  const databaseProjectRef = extractSupabaseProjectRefFromDatabaseUrl(databaseUrl);
  if (
    !process.env.SUPABASE_ACCESS_TOKEN?.trim() &&
    databaseUrl &&
    databaseProjectRef !== projectRef
  ) {
    return {
      ...base,
      error: `SUPABASE_DB_URL project ref mismatch: expected ${projectRef}, received ${databaseProjectRef || 'unknown'}.`,
    };
  }

  const expectedList = EXPECTED_INDEXES.map(sqlLiteral).join(', ');
  const ledgerSql = `
select exists (
  select 1
  from supabase_migrations.schema_migrations
  where version = ${sqlLiteral(MIGRATION_VERSION)}
) as recorded;
`;
  const indexesSql = `
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'sms_delivery_log'
  and indexname in (${expectedList})
order by indexname;
`;

  try {
    const [ledgerRows, indexRows] = await Promise.all([
      querySupabaseReadback(target, projectRef, ledgerSql),
      querySupabaseReadback(target, projectRef, indexesSql),
    ]);
    const ledgerRow = ledgerRows[0] as { recorded?: unknown } | undefined;
    const indexesPresent = indexRows
      .map((row) => (row as { indexname?: unknown }).indexname)
      .filter((value): value is string => typeof value === 'string');
    const presentSet = new Set(indexesPresent);
    const indexesMissing = EXPECTED_INDEXES.filter((indexName) => !presentSet.has(indexName));

    return {
      checked: true,
      sourceExists,
      ledgerRecorded: ledgerRow?.recorded === true,
      indexesPresent,
      indexesMissing,
      error: null,
    };
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkTarget(
  target: Target,
  options: {
    skipLocalProjectRef: boolean;
    expectedStagingProjectRef: string | null;
    expectedStagingProjectRefSource: 'env' | 'expected-arg' | null;
  },
): Promise<TargetReadiness> {
  const projectRefInfo = getTargetProjectRefInfo(target, options);
  return {
    target,
    projectRef: projectRefInfo.projectRef,
    projectRefSource: projectRefInfo.source,
    supabaseProjectRefs: getTargetSupabaseProjectRefs(target),
    env: getTargetEnvChecks(target, options),
    migration: await checkMigration(target, projectRefInfo.projectRef),
  };
}

async function main() {
  const args = parseSmsDeliveryReadinessArgs(process.argv.slice(2));
  loadEnvFiles(args.target, {
    skipPulledEnvFiles: args.skipPulledEnvFiles,
    skipLocalEnvFiles: args.skipLocalEnvFiles,
  });

  const targetNames: Target[] = args.target === 'all' ? ['staging', 'production'] : [args.target];
  const twilioEnv = envPresent(REQUIRED_TWILIO_ENV);
  const targets = [];
  for (const target of targetNames) {
    targets.push(
      await checkTarget(target, {
        skipLocalProjectRef: args.skipLocalEnvFiles,
        expectedStagingProjectRef: args.expectedStagingProjectRef,
        expectedStagingProjectRefSource: args.expectedStagingProjectRefSource,
      }),
    );
  }

  const vercelEnv: ReadinessReport['vercelEnv'] = {
    checked: false,
    environment: null,
    gitBranch: null,
    keysPresent: [],
    keysMissing: [],
    callbackKeysPresent: [],
    callbackKeySatisfied: null,
    error: null,
  };
  if (args.checkVercelEnv) {
    vercelEnv.checked = true;
    vercelEnv.environment = 'preview';
    vercelEnv.gitBranch = args.vercelGitBranch;
    try {
      const metadata = checkVercelPreviewEnvMetadata({
        requiredKeys: REQUIRED_TWILIO_ENV,
        callbackKeys: VERCEL_PREVIEW_CALLBACK_ENV,
        gitBranch: args.vercelGitBranch,
      });
      vercelEnv.keysPresent = metadata.keysPresent;
      vercelEnv.keysMissing = metadata.keysMissing;
      vercelEnv.callbackKeysPresent = metadata.callbackKeysPresent;
      vercelEnv.callbackKeySatisfied = metadata.callbackKeySatisfied;
    } catch (error) {
      vercelEnv.error = error instanceof Error ? error.message : String(error);
    }
  }

  const rawCallbackBaseUrl =
    args.callbackBaseUrl ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    null;
  const callbackBaseUrl = resolveUrlTemplate(rawCallbackBaseUrl);
  const callbackBaseUrlConcrete = isConcreteHttpUrl(callbackBaseUrl);
  const callbackBaseUrlVercelRuntimeResolvable =
    args.checkVercelEnv && isVercelRuntimeResolvableUrl(rawCallbackBaseUrl);
  const twilioAuthTokenPresent = Boolean(process.env.TWILIO_AUTH_TOKEN?.trim());
  const statusCallbackConfigured = Boolean(
    (callbackBaseUrlConcrete || callbackBaseUrlVercelRuntimeResolvable) && twilioAuthTokenPresent,
  );
  const twilioReadConfigured = Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    (process.env.TWILIO_AUTH_TOKEN?.trim() ||
      (process.env.TWILIO_API_KEY_SID?.trim() && process.env.TWILIO_API_KEY_SECRET?.trim())),
  );
  const twilioSendConfigured = Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() &&
    (process.env.TWILIO_AUTH_TOKEN?.trim() ||
      (process.env.TWILIO_API_KEY_SID?.trim() && process.env.TWILIO_API_KEY_SECRET?.trim())),
  );

  const blockers: string[] = [];
  const warnings: string[] = [];
  const localMigrationExists = fs.existsSync(MIGRATION_PATH);

  if (!localMigrationExists) {
    blockers.push(`Missing local migration source: ${path.relative(projectRoot, MIGRATION_PATH)}`);
  }

  if (!callbackBaseUrl) {
    blockers.push(
      'NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL is required to build Twilio status callback URLs.',
    );
  }
  if (callbackBaseUrl && !callbackBaseUrlConcrete && !callbackBaseUrlVercelRuntimeResolvable) {
    blockers.push(
      'NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL must be a concrete http(s) URL without template placeholders for local callback verification.',
    );
  }
  if (!statusCallbackConfigured) {
    blockers.push(
      'TWILIO_AUTH_TOKEN and NEXT_PUBLIC_APP_URL/NEXT_PUBLIC_SITE_URL are required to generate and verify Twilio status callbacks.',
    );
  }
  if (!twilioReadConfigured) {
    blockers.push('Twilio read credentials are missing; live status/reconciler checks cannot run.');
  }
  if (!twilioSendConfigured) {
    blockers.push('Twilio send credentials are missing; live SMS send checks cannot run.');
  }
  if (vercelEnv.error) {
    blockers.push(`Vercel Preview env metadata check failed: ${vercelEnv.error}`);
  }
  if (vercelEnv.keysMissing.length > 0) {
    const branchLabel = vercelEnv.gitBranch ? ` for branch ${vercelEnv.gitBranch}` : '';
    blockers.push(
      `Vercel Preview env${branchLabel} missing SMS keys: ${vercelEnv.keysMissing.join(', ')}`,
    );
  }
  if (vercelEnv.callbackKeySatisfied === false) {
    const branchLabel = vercelEnv.gitBranch ? ` for branch ${vercelEnv.gitBranch}` : '';
    blockers.push(
      `Vercel Preview env${branchLabel} missing callback base URL key: one of ${VERCEL_PREVIEW_CALLBACK_ENV.join(', ')}`,
    );
  }

  for (const target of targets) {
    for (const key of missingKeys(target.env)) {
      blockers.push(`${target.target} env missing: ${key}`);
    }
    for (const error of getTargetEnvironmentMismatchErrors(target.target, target.projectRef)) {
      blockers.push(`${target.target} env target mismatch: ${error}`);
    }
    if (target.migration.error) {
      blockers.push(`${target.target} migration readback failed: ${target.migration.error}`);
      continue;
    }
    if (target.migration.ledgerRecorded !== true) {
      blockers.push(`${target.target} migration ${MIGRATION_VERSION} is not recorded.`);
    }
    if (target.migration.indexesMissing.length > 0) {
      blockers.push(
        `${target.target} missing SMS delivery indexes: ${target.migration.indexesMissing.join(', ')}`,
      );
    }
  }

  const report: ReadinessReport = {
    ok: blockers.length === 0,
    strict: args.strict,
    checkedAt: new Date().toISOString(),
    localMigrationSource: {
      path: path.relative(projectRoot, MIGRATION_PATH),
      exists: localMigrationExists,
    },
    app: {
      callbackBaseUrl,
      callbackBaseUrlConcrete,
      callbackBaseUrlVercelRuntimeResolvable,
      statusCallbackConfigured,
      twilioAuthTokenPresent,
    },
    twilio: {
      sendConfigured: twilioSendConfigured,
      readConfigured: twilioReadConfigured,
      env: twilioEnv,
    },
    vercelEnv,
    targets,
    blockers,
    warnings,
  };

  console.log(JSON.stringify(report, null, 2));
  if (args.strict && !report.ok) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      '[sms-delivery-readiness] failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  });
}
