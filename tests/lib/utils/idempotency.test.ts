import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateIdempotencyKey } from '@/lib/utils/idempotency';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('generateIdempotencyKey', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses crypto.randomUUID when available', () => {
    expect(generateIdempotencyKey()).toMatch(UUID_V4);
  });

  it('builds a v4 uuid from crypto.getRandomValues when randomUUID is missing, never Math.random', () => {
    const mathRandom = vi.spyOn(Math, 'random');
    vi.stubGlobal('crypto', {
      getRandomValues: <T extends ArrayBufferView>(array: T) => {
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        bytes.forEach((_, index) => {
          bytes[index] = (index * 37 + 11) & 0xff;
        });
        return array;
      },
    });

    const key = generateIdempotencyKey();

    expect(key).toMatch(UUID_V4);
    expect(mathRandom).not.toHaveBeenCalled();
  });

  it('refuses to fall back to a non-cryptographic key', () => {
    vi.stubGlobal('crypto', undefined);
    expect(() => generateIdempotencyKey()).toThrow(/secure random/i);
  });
});
