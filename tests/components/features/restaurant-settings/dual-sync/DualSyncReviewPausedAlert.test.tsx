import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncReviewPausedAlert } from '@/components/features/restaurant-settings/dual-sync/DualSyncReviewPausedAlert';

describe('DualSyncReviewPausedAlert', () => {
  it('@smoke explains the pause reason and the disabled writes', () => {
    render(<DualSyncReviewPausedAlert pauseReason="Paused by the owner." />);

    expect(screen.getByText('Dual-sync is paused.')).toBeInTheDocument();
    expect(
      screen.getByText(/Paused by the owner\. Choices, refreshes and publishing are off/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resume sync/i })).not.toBeInTheDocument();
  });

  it('@contract offers Resume sync when a handler is provided', () => {
    const onResume = vi.fn();
    render(<DualSyncReviewPausedAlert pauseReason="Paused by the owner." onResume={onResume} />);

    screen.getByRole('button', { name: 'Resume sync' }).click();
    expect(onResume).toHaveBeenCalledTimes(1);
  });
});
