import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export type DeployTarget = 'staging' | 'production';

export const DEPLOY_TARGETS: readonly DeployTarget[] = ['staging', 'production'];

export function parseDeployTarget(value: string | undefined): DeployTarget {
  if (value === 'staging' || value === 'production') return value;
  throw new Error(`--env must be one of ${DEPLOY_TARGETS.join('|')}; received "${value ?? ''}"`);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function writeJsonEvidence(filePath: string, payload: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export function readJsonEvidence(filePath: string): unknown {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(
      `Evidence file ${filePath} could not be read (${
        error instanceof Error ? error.message : String(error)
      }); refusing to continue without evidence.`,
    );
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Evidence file ${filePath} is not valid JSON; refusing to continue.`);
  }
}

export function requireString(
  record: Record<string, unknown>,
  key: string,
  context: string,
): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${context}: missing or empty "${key}".`);
  }
  return value;
}

export function requireSha(record: Record<string, unknown>, key: string, context: string): string {
  const value = requireString(record, key, context);
  if (!/^[0-9a-f]{40}$/u.test(value)) {
    throw new Error(`${context}: "${key}" must be a 40-hex git SHA.`);
  }
  return value;
}
