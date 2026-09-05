import { readFileSync } from 'node:fs';
import path from 'node:path';

import { isRecord } from './evidence';

/** Workers on the customer path: they carry guest traffic and provider deliveries. */
export const CUSTOMER_WORKERS = [
  'booking-short-links',
  'email-queue-gateway',
  'sms-summary-gateway',
] as const;

/** Control-plane Workers: no guest traffic, but deployed and separated the same way. */
export const OPERATIONAL_WORKERS = ['operational-control'] as const;

/** Every Worker `deploy:workers` and `deploy:validate-separation` know about. */
export const DEPLOYABLE_WORKERS = [...CUSTOMER_WORKERS, ...OPERATIONAL_WORKERS] as const;

export type CustomerWorker = (typeof DEPLOYABLE_WORKERS)[number];

export function isCustomerWorker(value: string): value is CustomerWorker {
  return (DEPLOYABLE_WORKERS as readonly string[]).includes(value);
}

export function wranglerConfigPath(rootDir: string, worker: CustomerWorker): string {
  return path.join(rootDir, 'cloudflare', worker, 'wrangler.jsonc');
}

/**
 * Removes `//` and `/* *\/` comments from JSONC without touching string contents, then
 * strips trailing commas so the result is strict JSON.
 */
export function stripJsonComments(source: string): string {
  let output = '';
  let index = 0;
  let inString = false;
  while (index < source.length) {
    const char = source[index] ?? '';
    const next = source[index + 1] ?? '';
    if (inString) {
      output += char;
      if (char === '\\') {
        output += next;
        index += 2;
        continue;
      }
      if (char === '"') inString = false;
      index += 1;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      index += 1;
      continue;
    }
    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }
    output += char;
    index += 1;
  }
  return output.replace(/,(\s*[}\]])/gu, '$1');
}

export function parseJsonc(source: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonComments(source)) as unknown;
  } catch (error) {
    throw new Error(
      `${label}: invalid JSONC (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  if (!isRecord(parsed)) throw new Error(`${label}: expected a JSON object at the top level`);
  return parsed;
}

export function readWranglerConfig(filePath: string): Record<string, unknown> {
  return parseJsonc(readFileSync(filePath, 'utf8'), filePath);
}

/** Top-level config minus the `env` map: this is what wrangler deploys without `--env`. */
export function productionSection(config: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(config).filter(([key]) => key !== 'env'));
}

export function environmentSection(
  config: Record<string, unknown>,
  environment: string,
): Record<string, unknown> | null {
  const env = config.env;
  if (!isRecord(env)) return null;
  const section = env[environment];
  return isRecord(section) ? section : null;
}

export function workerNameFor(config: Record<string, unknown>, environment: string | null): string {
  const base = typeof config.name === 'string' ? config.name : '';
  if (!environment) return base;
  const section = environmentSection(config, environment);
  const explicit = section && typeof section.name === 'string' ? section.name : '';
  return explicit || `${base}-${environment}`;
}

export type FlattenedLeaf = { readonly path: string; readonly value: string | number | boolean };

/** Flattens nested config into dotted paths (`d1_databases[0].database_id`). */
export function flattenLeaves(value: unknown, prefix = ''): FlattenedLeaf[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => flattenLeaves(entry, `${prefix}[${index}]`));
  }
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, entry]) =>
      flattenLeaves(entry, prefix ? `${prefix}.${key}` : key),
    );
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [{ path: prefix, value }];
  }
  return [];
}
