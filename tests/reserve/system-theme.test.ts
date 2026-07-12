import { describe, expect, it, vi } from 'vitest';

import { synchronizeSystemTheme } from '../../reserve/system-theme';

describe('synchronizeSystemTheme', () => {
  it('applies and reacts to the system dark preference @contract', () => {
    let listener: ((event: { matches: boolean }) => void) | undefined;
    const media = {
      matches: true,
      addEventListener: vi.fn((_type: string, next: (event: { matches: boolean }) => void) => {
        listener = next;
      }),
      removeEventListener: vi.fn(),
    };
    const root = document.createElement('html');

    const cleanup = synchronizeSystemTheme(root, media);
    expect(root).toHaveClass('dark');

    listener?.({ matches: false });
    expect(root).not.toHaveClass('dark');

    cleanup();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', listener);
  });
});
