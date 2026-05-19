import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StatusTransitionAnimator } from '@/components/features/booking-state-machine/StatusTransitionAnimator';

describe('StatusTransitionAnimator', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not restart confetti after the hide timeout fires', () => {
    vi.useFakeTimers();

    const { rerender } = render(
      <StatusTransitionAnimator status="confirmed">
        <div>Booking card</div>
      </StatusTransitionAnimator>,
    );

    rerender(
      <StatusTransitionAnimator status="completed">
        <div>Booking card</div>
      </StatusTransitionAnimator>,
    );

    expect(screen.getByTestId('status-transition-confetti')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(951);
    });

    expect(screen.queryByTestId('status-transition-confetti')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    expect(screen.queryByTestId('status-transition-confetti')).not.toBeInTheDocument();
  });
});
