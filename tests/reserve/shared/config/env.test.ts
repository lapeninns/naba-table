import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// env.ts resolves its values at import time, so each case re-imports a fresh
// copy after stubbing the environment.
async function importEnv() {
  vi.resetModules();
  const module = await import('@shared/config/env');
  return module.env;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('reserve env defaults', () => {
  it('falls back to /api and /reserve when nothing is configured @contract', async () => {
    const env = await importEnv();

    expect(env.API_BASE_URL).toBe('/api');
    expect(env.API_TIMEOUT_MS).toBe(15_000);
    expect(env.RESERVE_V2_ENABLED).toBe(false);
    expect(env.ROUTER_BASE_PATH).toBe('/reserve');
  });
});

describe('reserve env overrides', () => {
  it('reads the API base URL from RESERVE_API_BASE_URL @contract', async () => {
    vi.stubEnv('RESERVE_API_BASE_URL', 'https://api.example.test');
    const env = await importEnv();
    expect(env.API_BASE_URL).toBe('https://api.example.test');
  });

  it('reads the NEXT_PUBLIC_ alternative for the API base URL @contract', async () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVE_API_BASE_URL', 'https://public.example.test');
    const env = await importEnv();
    expect(env.API_BASE_URL).toBe('https://public.example.test');
  });

  it('parses the timeout and v2 flag @contract', async () => {
    vi.stubEnv('RESERVE_API_TIMEOUT_MS', '20000');
    vi.stubEnv('RESERVE_V2_ENABLED', 'true');
    const env = await importEnv();
    expect(env.API_TIMEOUT_MS).toBe(20_000);
    expect(env.RESERVE_V2_ENABLED).toBe(true);
  });
});

describe('router base path sanitization', () => {
  it.each([
    ['reserve/v2/', '/reserve/v2'],
    ['/reserve/v2', '/reserve/v2'],
    ['//reserve//', '/reserve'],
    ['/', '/'],
    ['   ', '/reserve'],
  ])('normalizes %j to %j @contract', async (raw, expected) => {
    vi.stubEnv('RESERVE_ROUTER_BASE_PATH', raw);
    const env = await importEnv();
    expect(env.ROUTER_BASE_PATH).toBe(expected);
  });
});
