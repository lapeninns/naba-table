import { hashCanonicalJson } from '../hashing';

import type { Json } from '@/types/supabase';

const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_]{0,99}$/;
const SHA_256 = /^[a-f0-9]{64}$/;

function valueShape(value: unknown): Json {
  if (value === null) return { kind: 'null' };
  if (Array.isArray(value)) return { kind: 'array', count: value.length };
  if (typeof value === 'object') return { kind: 'object', fieldCount: Object.keys(value).length };
  return { kind: typeof value };
}

export function metadataOnlySummary(value: unknown): Json {
  if (isMetadataOnlySummary(value)) return value;
  return {
    sha256: hashCanonicalJson(value),
    shape: valueShape(value),
  };
}

export function metadataOnlyRecord(value: unknown): Record<string, unknown> {
  return metadataOnlySummary(value) as Record<string, unknown>;
}

function isMetadataOnlySummary(value: unknown): value is Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== 2 ||
    typeof record.sha256 !== 'string' ||
    !SHA_256.test(record.sha256) ||
    !record.shape ||
    typeof record.shape !== 'object' ||
    Array.isArray(record.shape)
  ) {
    return false;
  }
  const shape = record.shape as Record<string, unknown>;
  if (typeof shape.kind !== 'string') return false;
  if (shape.kind === 'array') {
    return (
      Object.keys(shape).length === 2 &&
      typeof shape.count === 'number' &&
      Number.isSafeInteger(shape.count) &&
      shape.count >= 0
    );
  }
  if (shape.kind === 'object') {
    return (
      Object.keys(shape).length === 2 &&
      typeof shape.fieldCount === 'number' &&
      Number.isSafeInteger(shape.fieldCount) &&
      shape.fieldCount >= 0
    );
  }
  return (
    Object.keys(shape).length === 1 &&
    ['null', 'string', 'number', 'boolean', 'undefined', 'bigint', 'symbol', 'function'].includes(
      shape.kind,
    )
  );
}

export function safePersistenceErrorCode(code: string | null | undefined): string | null {
  return typeof code === 'string' && SAFE_ERROR_CODE.test(code) ? code : null;
}
