import type { PostgrestError } from '@supabase/supabase-js';

const UNDEFINED_COLUMN_CODE = '42703';
const LOGO_COLUMN_NAME = 'logo_url';

export function isLogoUrlColumnMissing(error: PostgrestError | null | undefined): boolean {
  if (!error) {
    return false;
  }

  return error.code === UNDEFINED_COLUMN_CODE && typeof error.message === 'string' && error.message.includes(LOGO_COLUMN_NAME);
}

type LogoCompatibleRecord = Record<string, unknown>;

export function ensureLogoColumnOnRow<T extends LogoCompatibleRecord | null | undefined>(row: T): T {
  if (!row || typeof row !== 'object') {
    return row;
  }

  if (!(LOGO_COLUMN_NAME in row)) {
    return { ...(row as LogoCompatibleRecord), [LOGO_COLUMN_NAME]: null } as T;
  }

  return row;
}

export function ensureLogoColumnOnRows<T extends LogoCompatibleRecord | null | undefined>(rows: T[] | null | undefined): T[] | null | undefined {
  if (!rows) {
    return rows;
  }

  return rows.map((row) => ensureLogoColumnOnRow(row));
}

export function logLogoColumnFallback(context: string): void {
  console.warn(`[logo_url][compat] ${context} falling back because column is missing in the connected database.`);
}
