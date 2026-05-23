import { createHash } from 'node:crypto';

import type { Json } from '@/types/supabase';

export function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeStringArray(
  value: Array<string | null | undefined> | null | undefined,
): string[] {
  return (value ?? [])
    .map((item) => normalizeText(item))
    .filter((item): item is string => Boolean(item));
}

export function toJson(value: unknown): Json {
  return value as Json;
}

export function uniqueStrings(values: string[]): string[] {
  return values.filter((value, index, all) => all.indexOf(value) === index);
}

export function normalizeRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function pickNestedText(
  record: Record<string, unknown> | null,
  keys: string[],
): string | null {
  let current: unknown = record;
  for (const key of keys) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === 'string' ? normalizeText(current) : null;
}

export function normalizeJsonArray<T>(value: unknown, mapItem: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => mapItem(item)).filter((item): item is T => item !== null);
}

export function buildPayloadHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
