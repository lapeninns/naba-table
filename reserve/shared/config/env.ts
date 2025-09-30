import { z } from 'zod';

import { runtime } from '@shared/config/runtime';

const envSchema = z.object({
  API_BASE_URL: z.string().min(1),
  API_TIMEOUT_MS: z.number().int().positive(),
  RESERVE_V2_ENABLED: z.boolean(),
});

const apiBaseUrlRaw = runtime.readString('RESERVE_API_BASE_URL', {
  alternatives: ['NEXT_PUBLIC_RESERVE_API_BASE_URL', 'API_BASE_URL'],
});

const apiTimeoutRaw = runtime.readNumber('RESERVE_API_TIMEOUT_MS', {
  alternatives: ['NEXT_PUBLIC_RESERVE_API_TIMEOUT_MS', 'RESERVE_API_TIMEOUT'],
  fallback: 15_000,
});

const reserveV2Raw = runtime.readBoolean('RESERVE_V2_ENABLED', {
  alternatives: ['NEXT_PUBLIC_RESERVE_V2', 'RESERVE_V2_FLAG'],
  fallback: false,
});

const raw = {
  API_BASE_URL: apiBaseUrlRaw ?? '/api',
  API_TIMEOUT_MS: apiTimeoutRaw ?? 15_000,
  RESERVE_V2_ENABLED: reserveV2Raw ?? false,
};

const parsed = envSchema.safeParse(raw);

if (!parsed.success) {
  throw new Error(`reserve env validation failed: ${parsed.error.message}`);
}

if (!apiBaseUrlRaw && !(runtime.isDev || runtime.isTest)) {
  throw new Error(
    '[reserve env] Missing RESERVE_API_BASE_URL (or NEXT_PUBLIC_RESERVE_API_BASE_URL) for production build',
  );
}

if (!apiBaseUrlRaw && runtime.isDev) {
  console.warn('[reserve env] Using fallback API base URL "/api" because no env var was found.');
}

export const env = parsed.data;
