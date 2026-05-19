import crypto from 'node:crypto';

export const QA_RUN_ID_ENV = 'QA_RUN_ID';

export type QaRunIdEnv = Record<string, string | undefined>;

export type QaRunIdDeps = {
  now?: () => Date;
  randomUUID?: () => string;
};

const QA_RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,95}$/;

export function isValidQaRunId(value: string): boolean {
  return QA_RUN_ID_PATTERN.test(value);
}

export function createQaRunId(deps: QaRunIdDeps = {}): string {
  const now = deps.now ?? (() => new Date());
  const randomUUID = deps.randomUUID ?? (() => crypto.randomUUID());
  const timestamp = now().toISOString().replace(/[-:.]/g, '');
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12);

  return `qa-${timestamp}-${suffix}`;
}

export function ensureQaRunId(env: QaRunIdEnv = process.env, deps: QaRunIdDeps = {}): string {
  const existing = env[QA_RUN_ID_ENV]?.trim();

  if (existing) {
    if (!isValidQaRunId(existing)) {
      throw new Error(
        `${QA_RUN_ID_ENV} must be 3-96 path-safe characters using letters, numbers, dot, underscore, or dash.`,
      );
    }
    return existing;
  }

  const generated = createQaRunId(deps);
  env[QA_RUN_ID_ENV] = generated;
  return generated;
}
