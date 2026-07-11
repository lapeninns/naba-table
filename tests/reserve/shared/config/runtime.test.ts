import { afterEach, describe, expect, it, vi } from 'vitest';

import { runtime } from '@shared/config/runtime';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('runtime mode', () => {
  it('resolves the vitest mode as test, not dev @contract', () => {
    expect(runtime.mode).toBe('test');
    expect(runtime.isTest).toBe(true);
    expect(runtime.isDev).toBe(false);
  });
});

describe('runtime.readString', () => {
  it('reads a plain env var @contract', () => {
    vi.stubEnv('RESERVE_TEST_SAMPLE', 'plain-value');
    expect(runtime.readString('RESERVE_TEST_SAMPLE')).toBe('plain-value');
  });

  it('expands bare keys to VITE_ and NEXT_PUBLIC_ candidates @contract', () => {
    vi.stubEnv('VITE_RESERVE_TEST_VITE', 'vite-value');
    expect(runtime.readString('RESERVE_TEST_VITE')).toBe('vite-value');

    vi.stubEnv('NEXT_PUBLIC_RESERVE_TEST_NEXT', 'next-value');
    expect(runtime.readString('RESERVE_TEST_NEXT')).toBe('next-value');
  });

  it('strips the NEXT_PUBLIC_ prefix when looking up bare fallbacks @contract', () => {
    vi.stubEnv('RESERVE_TEST_BARE', 'bare-value');
    expect(runtime.readString('NEXT_PUBLIC_RESERVE_TEST_BARE')).toBe('bare-value');
  });

  it('consults alternatives in order and falls back @contract', () => {
    vi.stubEnv('RESERVE_TEST_ALT_B', 'alt-b');
    expect(
      runtime.readString('RESERVE_TEST_ALT_A', { alternatives: ['RESERVE_TEST_ALT_B'] }),
    ).toBe('alt-b');
    expect(runtime.readString('RESERVE_TEST_MISSING', { fallback: 'fallback-value' })).toBe(
      'fallback-value',
    );
    expect(runtime.readString('RESERVE_TEST_MISSING')).toBeUndefined();
  });
});

describe('runtime.readBoolean', () => {
  it.each([
    ['true', true],
    ['TRUE', true],
    ['1', true],
    ['yes', true],
    ['false', false],
    ['0', false],
    ['no', false],
  ])('parses %s as %s @contract', (raw, expected) => {
    vi.stubEnv('RESERVE_TEST_BOOL', raw);
    expect(runtime.readBoolean('RESERVE_TEST_BOOL')).toBe(expected);
  });

  it('uses the fallback for unparseable or missing values @contract', () => {
    vi.stubEnv('RESERVE_TEST_BOOL', 'maybe');
    expect(runtime.readBoolean('RESERVE_TEST_BOOL', { fallback: true })).toBe(true);
    expect(runtime.readBoolean('RESERVE_TEST_BOOL_MISSING', { fallback: false })).toBe(false);
    expect(runtime.readBoolean('RESERVE_TEST_BOOL_MISSING')).toBeUndefined();
  });
});

describe('runtime.readNumber', () => {
  it('parses finite numbers @contract', () => {
    vi.stubEnv('RESERVE_TEST_NUM', '15000');
    expect(runtime.readNumber('RESERVE_TEST_NUM')).toBe(15_000);
  });

  it('falls back when the value is not numeric @contract', () => {
    vi.stubEnv('RESERVE_TEST_NUM', 'soon');
    expect(runtime.readNumber('RESERVE_TEST_NUM', { fallback: 250 })).toBe(250);
    expect(runtime.readNumber('RESERVE_TEST_NUM_MISSING')).toBeUndefined();
  });
});
