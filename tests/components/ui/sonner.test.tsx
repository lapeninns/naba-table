import { act, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it } from 'vitest';

import { Toaster } from '@/components/ui/sonner';

// The global matchMedia stub from tests/setup.ts is a vi.fn whose
// implementation is wiped by the config-level mockReset before each test;
// sonner reads matchMedia on mount, so pin a plain-function stub here.
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

describe('ui/sonner', () => {
  it('@smoke shows a fired toast inside the styled toaster container', async () => {
    render(<Toaster />);

    act(() => {
      toast('Booking saved');
    });

    expect(await screen.findByText('Booking saved')).toBeInTheDocument();
    const toaster = document.querySelector('[data-sonner-toaster]');
    expect(toaster).not.toBeNull();
    expect(toaster).toHaveClass('toaster');
  });

  it('@smoke forwards position overrides to sonner', async () => {
    render(<Toaster position="top-center" />);

    act(() => {
      toast('Placed up top');
    });
    await screen.findByText('Placed up top');

    expect(document.querySelector('[data-sonner-toaster]')).toHaveAttribute(
      'data-x-position',
      'center',
    );
  });
});
