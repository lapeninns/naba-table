import { describe, expect, it, vi } from 'vitest';

import { createShortLinkRepository } from '../src/storage';

describe('booking short-link query budget', () => {
  it('uses one D1 query per token lookup regardless of record shape @contract', async () => {
    const first = vi.fn().mockResolvedValue(null);
    const prepare = vi.fn(() => ({
      bind: vi.fn(() => ({ first, run: vi.fn() })),
    }));
    const repository = createShortLinkRepository({ db: { prepare } });

    await repository.getLinkByToken('OpaqueToken123');

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });
});
