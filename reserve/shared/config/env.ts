import { z } from 'zod';

import { runtime } from '@shared/config/runtime';

const envSchema = z.object({
  API_BASE_URL: z.string().min(1),
  API_TIMEOUT_MS: z.number().int().positive(),
  RESERVE_V2_ENABLED: z.boolean(),
  ROUTER_BASE_PATH: z.string().min(1),
});

const sanitizeBasePath = (value: string | null | undefined): string => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return '/reserve';
  }

  if (trimmed === '/') {
    return '/';
  }

  const withoutSlashes = trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
  return `/${withoutSlashes}`;
};

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

const routerBasePathRaw = runtime.readString('RESERVE_ROUTER_BASE_PATH', {
  alternatives: ['NEXT_PUBLIC_RESERVE_ROUTER_BASE_PATH', 'ROUTER_BASE_PATH'],
});

const routerBasePath = sanitizeBasePath(routerBasePathRaw);

const API_FALLBACK = '/api';

const raw = {
  API_BASE_URL: apiBaseUrlRaw ?? API_FALLBACK,
  API_TIMEOUT_MS: apiTimeoutRaw ?? 15_000,
  RESERVE_V2_ENABLED: reserveV2Raw ?? false,
  ROUTER_BASE_PATH: routerBasePath,
};

const parsed = envSchema.safeParse(raw);

if (!parsed.success) {
  throw new Error(`reserve env validation failed: ${parsed.error.message}`);
}

// Only throw error if we're in production AND no API base URL is available at all
if (!apiBaseUrlRaw && !raw.API_BASE_URL && !(runtime.isDev || runtime.isTest)) {
  throw new Error(
    '[reserve env] Missing RESERVE_API_BASE_URL (or NEXT_PUBLIC_RESERVE_API_BASE_URL) for production build',
  );
}

if (!apiBaseUrlRaw && runtime.isDev) {
  console.warn('[reserve env] Using fallback API base URL "/api" because no env var was found.');
}

if (routerBasePathRaw && routerBasePathRaw !== routerBasePath && runtime.isDev) {
  console.warn(
    `[reserve env] Normalized RESERVE_ROUTER_BASE_PATH from "${routerBasePathRaw}" to "${routerBasePath}".`,
  );
}

export const env = parsed.data;
