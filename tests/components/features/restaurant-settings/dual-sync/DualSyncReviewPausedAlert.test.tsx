import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncReviewPausedAlert } from '@/components/features/restaurant-settings/dual-sync/DualSyncReviewPausedAlert';

describe('DualSyncReviewPausedAlert', () => {
  it('@smoke explains the pause reason and the disabled writes', () => {
    render(<DualSyncReviewPausedAlert pauseReason="Paused by the owner." />);

    expect(screen.getByText('Dual-sync is paused.')).toBeInTheDocument();
    expect(
      screen.getByText(/Paused by the owner\. Write-affecting actions are disabled/),
    ).toBeInTheDocument();
  });
});
