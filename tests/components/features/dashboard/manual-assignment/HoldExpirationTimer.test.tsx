import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HoldExpirationTimer } from '@/components/features/dashboard/manual-assignment/HoldExpirationTimer';

import { PINNED_NOW_ISO } from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

describe('HoldExpirationTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(PINNED_NOW_ISO));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract renders the remaining time as m:ss with a timer role', () => {
    const expiresAt = new Date(Date.now() + 90_000).toISOString();

    render(<HoldExpirationTimer expiresAt={expiresAt} />);

    expect(screen.getByRole('timer')).toHaveAccessibleName(
      'Hold expires in 1 minutes and 30 seconds',
    );
    expect(screen.getByText('1:30')).toBeInTheDocument();
    expect(screen.getByText('Hold Expires')).toBeInTheDocument();
  });

  it('@contract counts down each second', async () => {
    const expiresAt = new Date(Date.now() + 90_000).toISOString();

    render(<HoldExpirationTimer expiresAt={expiresAt} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });

    expect(screen.getByText('0:59')).toBeInTheDocument();
  });

  it('@contract shows Expired and fires onExpired when the hold lapses', async () => {
    const onExpired = vi.fn();
    const expiresAt = new Date(Date.now() + 2_000).toISOString();

    render(<HoldExpirationTimer expiresAt={expiresAt} onExpired={onExpired} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(onExpired).toHaveBeenCalled();
  });

  it('@contract accepts an already-expired Date input', () => {
    const onExpired = vi.fn();

    render(
      <HoldExpirationTimer expiresAt={new Date(Date.now() - 1_000)} onExpired={onExpired} />,
    );

    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(onExpired).toHaveBeenCalled();
  });
});
