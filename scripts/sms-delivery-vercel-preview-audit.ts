import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  extractSupabaseProjectRefFromApiUrl,
  extractSupabaseProjectRefFromDatabaseUrl,
} from './sms-delivery-readiness';

const projectRoot = process.cwd();
const DEFAULT_BRANCH = 'codex/sms-delivery-rollout-clean';
const DEFAULT_EXPECTED_STAGING_PROJECT_REF = 'ndxmivcrehsacuerwxtm';
const REQUIRED_TWILIO_ENV = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_API_KEY_SID',
  'TWILIO_API_KEY_SECRET',
  'TWILIO_MESSAGING_SERVICE_SID',
] as const;
const REQUIRED_PREVIEW_URL_ENV = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SITE_URL',
  'BASE_URL',
] as const;
const CALLBACK_BASE_URL_ENV = ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SITE_URL'] as const;
const AUDITED_ENV_KEYS = [
  ...REQUIRED_TWILIO_ENV,
  ...REQUIRED_PREVIEW_URL_ENV,
  'STAGING_SUPABASE_PROJECT_REF',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_DB_URL',
  'DATABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

type Args = {
  branch: string;
  expectedStagingProjectRef: string;
  metadataOnly: boolean;
};

type PreviewAuditReport = {
  ok: boolean;
  checkedAt: string;
  branch: string;
  expectedStagingProjectRef: string;
  twilio: {
    keysPresent: string[];
    keysMissing: string[];
  };
  urlEnv: {
    requiredKeys: string[];
    keysPresent: string[];
    validConcreteKeys: string[];
    vercelRuntimeResolvableKeys: string[];
    invalidPresentKeys: string[];
    callbackBaseUrlSatisfied: boolean;
  };
  supabase: {
    apiProjectRef: string | null;
    databaseProjectRef: string | null;
    serviceRolePresent: boolean;
    apiMatchesExpected: boolean;
    databaseMatchesExpected: boolean;
  };
  metadata: {
    genericPreviewKeysPresent: string[];
    branchPreviewKeysPresent: string[];
  };
  blockers: string[];
};

type PreviewMetadataReport = {
  ok: boolean;
  checkedAt: string;
  branch: string;
  mode: 'metadata-only';
  requiredKeys: string[];
  genericPreviewKeysPresent: string[];
  branchPreviewKeysPresent: string[];
  effectivePreviewKeysPresent: string[];
  effectivePreviewKeysMissing: string[];
  blockers: string[];
};

export function parseVercelPreviewAuditArgs(argv: string[]): Args {
  const args: Args = {
    branch: process.env.SMS_DELIVERY_VERCEL_GIT_BRANCH?.trim() || DEFAULT_BRANCH,
    expectedStagingProjectRef:
      process.env.STAGING_SUPABASE_PROJECT_REF?.trim() || DEFAULT_EXPECTED_STAGING_PROJECT_REF,
    metadataOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index] ?? '';
    if (raw === '--metadata-only') {
      args.metadataOnly = true;
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

    const branch = takeValue('--branch');
    if (branch) {
      args.branch = branch.trim();
      continue;
    }

    const expectedStagingProjectRef = takeValue('--expected-staging-project-ref');
    if (expectedStagingProjectRef) {
      args.expectedStagingProjectRef = expectedStagingProjectRef.trim();
    }
  }

  return args;
}

function prepareTempLinkedProject(): string {
  const projectJsonPath = path.join(projectRoot, '.vercel', 'project.json');
  if (!fs.existsSync(projectJsonPath)) {
    throw new Error('.vercel/project.json is required to audit Vercel Preview env.');
  }

  const tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nabatable-vercel-env-audit-'));
  const tempVercelDir = path.join(tempProjectDir, '.vercel');
  fs.mkdirSync(tempVercelDir, { recursive: true });
  fs.copyFileSync(projectJsonPath, path.join(tempVercelDir, 'project.json'));
  return tempProjectDir;
}

function parseJsonMarker(stdout: string): Record<string, unknown> {
  const marker = '__SMS_PREVIEW_ENV_AUDIT__';
  const line = stdout.split(/\r?\n/).find((candidate) => candidate.trim().startsWith(marker));
  if (!line) {
    throw new Error('Vercel Preview env audit did not return a JSON marker.');
  }
  return JSON.parse(line.trim().slice(marker.length)) as Record<string, unknown>;
}

function parseVercelEnvListJson(raw: string): Set<string> {
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    throw new Error('Vercel env list did not return JSON output.');
  }
  const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as {
    envs?: Array<{ key?: unknown }>;
  };
  return new Set(
    (parsed.envs ?? [])
      .map((item) => item.key)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  );
}

function listPreviewEnvKeys(input: { tempProjectDir: string; branch: string | null }): Set<string> {
  const args = ['vercel', '--cwd', input.tempProjectDir, 'env', 'ls', 'preview'];
  if (input.branch) args.push(input.branch);
  args.push('--format', 'json');
  const result = spawnSync('npx', args, {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`;
    throw new Error(
      `vercel env ls preview${input.branch ? ` ${input.branch}` : ''} failed: ${detail}`,
    );
  }

  return parseVercelEnvListJson(result.stdout);
}

function readPreviewEnvMetadata(branch: string): PreviewAuditReport['metadata'] {
  const tempProjectDir = prepareTempLinkedProject();
  try {
    const genericKeys = listPreviewEnvKeys({ tempProjectDir, branch: null });
    const branchKeys = listPreviewEnvKeys({ tempProjectDir, branch });
    return {
      genericPreviewKeysPresent: AUDITED_ENV_KEYS.filter((key) => genericKeys.has(key)),
      branchPreviewKeysPresent: AUDITED_ENV_KEYS.filter((key) => branchKeys.has(key)),
    };
  } finally {
    fs.rmSync(tempProjectDir, { recursive: true, force: true });
  }
}

function readPreviewEnvSnapshot(branch: string): Record<string, unknown> {
  const tempProjectDir = prepareTempLinkedProject();
  const inlineScript = `
const keys = ${JSON.stringify(AUDITED_ENV_KEYS)};
const snapshot = {};
for (const key of keys) snapshot[key] = process.env[key] || null;
console.log('__SMS_PREVIEW_ENV_AUDIT__' + JSON.stringify(snapshot));
`;

  try {
    const result = spawnSync(
      'npx',
      [
        'vercel',
        '--cwd',
        tempProjectDir,
        'env',
        'run',
        '--environment',
        'preview',
        '--git-branch',
        branch,
        '--',
        'node',
        '-e',
        inlineScript,
      ],
      {
        cwd: projectRoot,
        encoding: 'utf8',
      },
    );

    if (result.error) throw result.error;
    if (result.status !== 0) {
      const detail = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`;
      throw new Error(`vercel env run preview ${branch} failed: ${detail}`);
    }

    return parseJsonMarker(result.stdout);
  } finally {
    fs.rmSync(tempProjectDir, { recursive: true, force: true });
  }
}

function valueAsString(snapshot: Record<string, unknown>, key: string): string | null {
  const value = snapshot[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isConcreteHttpUrl(value: string | null): boolean {
  if (!value || value.includes('${')) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isVercelRuntimeResolvableHttpUrl(value: string | null): boolean {
  if (!value || !value.includes('${VERCEL_URL}')) return false;
  return isConcreteHttpUrl(value.replaceAll('${VERCEL_URL}', 'preview.example.vercel.app'));
}

export function buildPreviewAuditReport(
  args: Args,
  snapshot: Record<string, unknown>,
  metadata: PreviewAuditReport['metadata'] = {
    genericPreviewKeysPresent: [],
    branchPreviewKeysPresent: [],
  },
): PreviewAuditReport {
  const keysPresent = REQUIRED_TWILIO_ENV.filter((key) => Boolean(valueAsString(snapshot, key)));
  const keysMissing = REQUIRED_TWILIO_ENV.filter((key) => !keysPresent.includes(key));
  const urlKeysPresent = REQUIRED_PREVIEW_URL_ENV.filter((key) =>
    Boolean(valueAsString(snapshot, key)),
  );
  const validConcreteUrlKeys = REQUIRED_PREVIEW_URL_ENV.filter((key) =>
    isConcreteHttpUrl(valueAsString(snapshot, key)),
  );
  const vercelRuntimeResolvableUrlKeys = REQUIRED_PREVIEW_URL_ENV.filter((key) =>
    isVercelRuntimeResolvableHttpUrl(valueAsString(snapshot, key)),
  );
  const usableUrlKeys = new Set([...validConcreteUrlKeys, ...vercelRuntimeResolvableUrlKeys]);
  const invalidPresentUrlKeys = REQUIRED_PREVIEW_URL_ENV.filter(
    (key) => urlKeysPresent.includes(key) && !usableUrlKeys.has(key),
  );
  const callbackBaseUrlSatisfied = CALLBACK_BASE_URL_ENV.some((key) => usableUrlKeys.has(key));
  const apiProjectRef = extractSupabaseProjectRefFromApiUrl(
    valueAsString(snapshot, 'NEXT_PUBLIC_SUPABASE_URL'),
  );
  const databaseProjectRef = extractSupabaseProjectRefFromDatabaseUrl(
    valueAsString(snapshot, 'SUPABASE_DB_URL') || valueAsString(snapshot, 'DATABASE_URL'),
  );
  const serviceRolePresent = Boolean(valueAsString(snapshot, 'SUPABASE_SERVICE_ROLE_KEY'));
  const apiMatchesExpected = apiProjectRef === args.expectedStagingProjectRef;
  const databaseMatchesExpected = databaseProjectRef === args.expectedStagingProjectRef;

  const blockers = [
    keysMissing.length > 0
      ? `Vercel Preview env for branch ${args.branch} missing SMS keys: ${keysMissing.join(', ')}`
      : null,
    invalidPresentUrlKeys.length > 0
      ? `Vercel Preview env for branch ${args.branch} has invalid build URL keys: ${invalidPresentUrlKeys.join(', ')}`
      : null,
    !callbackBaseUrlSatisfied
      ? `Vercel Preview env for branch ${args.branch} needs one valid callback base URL key: ${CALLBACK_BASE_URL_ENV.join(' or ')}`
      : null,
    !apiMatchesExpected
      ? `NEXT_PUBLIC_SUPABASE_URL project ref mismatch: expected ${args.expectedStagingProjectRef}, received ${apiProjectRef || 'missing'}.`
      : null,
    !databaseMatchesExpected
      ? `SUPABASE_DB_URL project ref mismatch: expected ${args.expectedStagingProjectRef}, received ${databaseProjectRef || 'missing'}.`
      : null,
    !serviceRolePresent ? 'SUPABASE_SERVICE_ROLE_KEY is missing from Vercel Preview env.' : null,
  ].filter((value): value is string => Boolean(value));

  return {
    ok: blockers.length === 0,
    checkedAt: new Date().toISOString(),
    branch: args.branch,
    expectedStagingProjectRef: args.expectedStagingProjectRef,
    twilio: {
      keysPresent,
      keysMissing,
    },
    urlEnv: {
      requiredKeys: [...REQUIRED_PREVIEW_URL_ENV],
      keysPresent: urlKeysPresent,
      validConcreteKeys: validConcreteUrlKeys,
      vercelRuntimeResolvableKeys: vercelRuntimeResolvableUrlKeys,
      invalidPresentKeys: invalidPresentUrlKeys,
      callbackBaseUrlSatisfied,
    },
    supabase: {
      apiProjectRef,
      databaseProjectRef,
      serviceRolePresent,
      apiMatchesExpected,
      databaseMatchesExpected,
    },
    metadata,
    blockers,
  };
}

export function buildPreviewMetadataReport(
  branch: string,
  metadata: PreviewAuditReport['metadata'],
): PreviewMetadataReport {
  const requiredKeys = [...REQUIRED_TWILIO_ENV, 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_DB_URL'];
  const effectiveKeys = new Set([
    ...metadata.genericPreviewKeysPresent,
    ...metadata.branchPreviewKeysPresent,
  ]);
  const effectivePreviewKeysPresent = requiredKeys.filter((key) => effectiveKeys.has(key));
  const effectivePreviewKeysMissing = requiredKeys.filter((key) => !effectiveKeys.has(key));
  const blockers =
    effectivePreviewKeysMissing.length > 0
      ? [
          `Vercel Preview metadata for branch ${branch} is missing required key names: ${effectivePreviewKeysMissing.join(', ')}`,
        ]
      : [];

  return {
    ok: blockers.length === 0,
    checkedAt: new Date().toISOString(),
    branch,
    mode: 'metadata-only',
    requiredKeys,
    genericPreviewKeysPresent: metadata.genericPreviewKeysPresent.filter((key) =>
      requiredKeys.includes(key),
    ),
    branchPreviewKeysPresent: metadata.branchPreviewKeysPresent.filter((key) =>
      requiredKeys.includes(key),
    ),
    effectivePreviewKeysPresent,
    effectivePreviewKeysMissing,
    blockers,
  };
}

function main() {
  const args = parseVercelPreviewAuditArgs(process.argv.slice(2));
  const metadata = readPreviewEnvMetadata(args.branch);
  if (args.metadataOnly) {
    const report = buildPreviewMetadataReport(args.branch, metadata);
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) {
      process.exit(1);
    }
    return;
  }

  const snapshot = readPreviewEnvSnapshot(args.branch);
  const report = buildPreviewAuditReport(args, snapshot, metadata);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(
      '[sms-delivery-vercel-preview-audit] failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
