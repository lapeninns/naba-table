import { ensureQaRunId, type QaRunIdEnv } from './run-id';

export type QaTargetClass = 'ci-ephemeral' | 'local' | 'staging-like';

export type QaEnvironmentGuardInput = {
  destructive?: boolean;
  env?: QaRunIdEnv;
  externalMutation?: boolean;
  requiredEnv?: readonly string[];
  targetUrls?: readonly string[];
};

export type QaEnvironmentGuardResult = {
  destructiveAllowed: boolean;
  externalMutationMode: string | null;
  qaRunId: string;
  targetClass: QaTargetClass;
  targetUrls: readonly string[];
};

export type QaEnvironmentGuardErrorCode =
  | 'QA_DESTRUCTIVE_NOT_ALLOWED'
  | 'QA_EXTERNAL_MUTATION_NOT_SAFE'
  | 'QA_MISSING_CREDENTIAL'
  | 'QA_PRODUCTION_ENV'
  | 'QA_PRODUCTION_URL'
  | 'QA_UNKNOWN_TARGET';

export class QaEnvironmentGuardError extends Error {
  readonly code: QaEnvironmentGuardErrorCode;

  constructor(code: QaEnvironmentGuardErrorCode, message: string) {
    super(message);
    this.name = 'QaEnvironmentGuardError';
    this.code = code;
  }
}

const ACTIVE_TARGET_URL_ENV_KEYS = [
  'QA_TARGET_URL',
  'PLAYWRIGHT_BASE_URL',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_APP_URL',
  'RESERVE_API_BASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_DB_URL',
] as const;

const TARGET_ENV_KEYS = ['QA_TARGET_ENV', 'DB_TARGET_ENV', 'APP_ENV', 'VERCEL_ENV'] as const;
const PRODUCTION_SUPABASE_PROJECT_REF = 'vrdiqfudmwydclqpydee';
const NABATABLE_VERCEL_OWNER_SUFFIX = '-lapen-inns-projects.vercel.app';

const SAFE_EXTERNAL_MUTATION_MODES = new Set(['dry-run', 'mock', 'sandbox', 'test-sink']);
const EXTERNAL_SAFETY_FLAG_KEYS = [
  'QA_DRY_RUN',
  'QA_USE_MOCKS',
  'QA_USE_SANDBOX',
  'QA_USE_TEST_SINK',
  'RESEND_USE_MOCK',
  'TWILIO_USE_MOCK',
  'EMAIL_USE_MOCK',
  'SMS_USE_MOCK',
] as const;

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function truthy(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(normalize(value));
}

function collectTargetUrls(env: QaRunIdEnv, targetUrls: readonly string[] = []): string[] {
  return [
    ...targetUrls.map((value) => value.trim()).filter(Boolean),
    ...ACTIVE_TARGET_URL_ENV_KEYS.map((key) => env[key]?.trim()).filter((value): value is string =>
      Boolean(value),
    ),
  ];
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    if (/^[A-Za-z0-9.-]+(?::\d+)?(?:\/.*)?$/.test(value.trim())) {
      try {
        return new URL(`https://${value.trim()}`);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized.endsWith('.localhost')
  );
}

function isProductionLikeVercelHost(hostname: string): boolean {
  if (hostname === 'nabatable.vercel.app') return true;
  if (!hostname.endsWith(NABATABLE_VERCEL_OWNER_SUFFIX)) return false;

  const deploymentPrefix = hostname.slice(0, -NABATABLE_VERCEL_OWNER_SUFFIX.length);
  if (deploymentPrefix === 'nabatable') return true;
  if (!deploymentPrefix.startsWith('nabatable-')) return false;

  const deploymentMarker = deploymentPrefix.slice('nabatable-'.length);
  const branchOrAlias = deploymentMarker.startsWith('git-')
    ? deploymentMarker.slice('git-'.length)
    : deploymentMarker;

  return /^(?:main|prod|production|aman-?main)(?:-|$)/.test(branchOrAlias);
}

function isProductionLikeUrl(value: string): boolean {
  const parsed = parseUrl(value);
  if (!parsed) return false;

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'nabatable.com' || hostname.endsWith('.nabatable.com')) {
    return true;
  }
  if (isProductionLikeVercelHost(hostname)) return true;

  const username = decodeURIComponent(parsed.username).toLowerCase();
  return (
    hostname.includes(PRODUCTION_SUPABASE_PROJECT_REF) ||
    username.includes(PRODUCTION_SUPABASE_PROJECT_REF)
  );
}

function describeBlockedTarget(value: string): string {
  const parsed = parseUrl(value);
  if (!parsed) return '[unparseable-target]';

  const credentialsPrefix = parsed.username || parsed.password ? '[credentials-redacted]@' : '';
  const pathSuffix = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
  return `${parsed.protocol}//${credentialsPrefix}${parsed.hostname.toLowerCase()}${pathSuffix}`;
}

function assertNotProductionEnv(env: QaRunIdEnv): void {
  for (const key of TARGET_ENV_KEYS) {
    if (normalize(env[key]) === 'production' || normalize(env[key]) === 'prod') {
      throw new QaEnvironmentGuardError(
        'QA_PRODUCTION_ENV',
        `${key}=production is not allowed for automated QA.`,
      );
    }
  }
}

function assertNotProductionUrls(urls: readonly string[]): void {
  const blocked = urls.filter(isProductionLikeUrl);
  if (blocked.length > 0) {
    throw new QaEnvironmentGuardError(
      'QA_PRODUCTION_URL',
      `Automated QA refused production-like target URL(s): ${blocked
        .map(describeBlockedTarget)
        .join(', ')}`,
    );
  }
}

function hasRemoteTarget(urls: readonly string[]): boolean {
  return urls.some((value) => {
    const parsed = parseUrl(value);
    return Boolean(parsed && !isLocalHostname(parsed.hostname));
  });
}

function classifyTarget(env: QaRunIdEnv, urls: readonly string[]): QaTargetClass {
  const explicit = normalize(env.QA_TARGET_ENV);
  const remoteTarget = hasRemoteTarget(urls);

  if (remoteTarget) return 'staging-like';
  if (['local', 'test', 'development'].includes(explicit)) return 'local';
  if (['ci', 'ci-ephemeral'].includes(explicit)) return 'ci-ephemeral';
  if (['preview', 'staging', 'staging-like'].includes(explicit)) return 'staging-like';
  if (explicit) {
    throw new QaEnvironmentGuardError(
      'QA_UNKNOWN_TARGET',
      `Unsupported QA_TARGET_ENV="${env.QA_TARGET_ENV}". Use local, ci-ephemeral, or staging-like.`,
    );
  }

  const appEnv = normalize(env.APP_ENV);
  if (['preview', 'staging'].includes(appEnv)) return 'staging-like';
  if (normalize(env.VERCEL_ENV) === 'preview') return 'staging-like';
  if (['local', 'test', 'development'].includes(appEnv)) return 'local';
  if (truthy(env.CI)) return 'ci-ephemeral';
  return 'local';
}

function assertRequiredEnv(env: QaRunIdEnv, requiredEnv: readonly string[]): void {
  const missing = requiredEnv.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new QaEnvironmentGuardError(
      'QA_MISSING_CREDENTIAL',
      `Missing required QA credential env var(s): ${missing.join(', ')}`,
    );
  }
}

function destructivePermissionTokens(env: QaRunIdEnv): Set<string> {
  return new Set(
    normalize(env.QA_ALLOW_DESTRUCTIVE)
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean),
  );
}

function isDestructiveAllowed(targetClass: QaTargetClass, env: QaRunIdEnv): boolean {
  const tokens = destructivePermissionTokens(env);
  if (tokens.size === 0) return false;
  if (targetClass === 'local') return tokens.has('local');
  if (targetClass === 'ci-ephemeral') return tokens.has('ci-ephemeral') || tokens.has('local');
  return tokens.has('staging-like') || tokens.has('staging') || tokens.has('preview');
}

function resolveExternalMutationMode(env: QaRunIdEnv): string | null {
  const explicitMode = normalize(env.QA_EXTERNAL_MUTATION_MODE);
  if (explicitMode) {
    return SAFE_EXTERNAL_MUTATION_MODES.has(explicitMode) ? explicitMode : null;
  }

  const matchedFlag = EXTERNAL_SAFETY_FLAG_KEYS.find((key) => truthy(env[key]));
  return matchedFlag ? matchedFlag.toLowerCase() : null;
}

export function assertQaEnvironment(input: QaEnvironmentGuardInput = {}): QaEnvironmentGuardResult {
  const env = input.env ?? process.env;
  const urls = collectTargetUrls(env, input.targetUrls);

  assertNotProductionEnv(env);
  assertNotProductionUrls(urls);
  assertRequiredEnv(env, input.requiredEnv ?? []);

  const targetClass = classifyTarget(env, urls);
  const destructiveAllowed = isDestructiveAllowed(targetClass, env);
  if (input.destructive && !destructiveAllowed) {
    throw new QaEnvironmentGuardError(
      'QA_DESTRUCTIVE_NOT_ALLOWED',
      `Destructive QA requires QA_ALLOW_DESTRUCTIVE=${targetClass === 'staging-like' ? 'staging-like' : targetClass}.`,
    );
  }

  const externalMutationMode = resolveExternalMutationMode(env);
  if (input.externalMutation && !externalMutationMode) {
    throw new QaEnvironmentGuardError(
      'QA_EXTERNAL_MUTATION_NOT_SAFE',
      'External mutation QA requires QA_EXTERNAL_MUTATION_MODE=mock|dry-run|sandbox|test-sink or an approved mock/dry-run flag.',
    );
  }

  return {
    destructiveAllowed,
    externalMutationMode,
    qaRunId: ensureQaRunId(env),
    targetClass,
    targetUrls: urls,
  };
}
