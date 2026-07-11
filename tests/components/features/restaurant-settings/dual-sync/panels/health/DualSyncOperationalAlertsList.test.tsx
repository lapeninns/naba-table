import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncOperationalAlertsList } from '@/components/features/restaurant-settings/dual-sync/panels/health/DualSyncOperationalAlertsList';

import type { DualSyncOperationalAlert } from '@/server/dual-sync/observability';

describe('DualSyncOperationalAlertsList', () => {
  it('@contract reports a clear signal state without alerts', () => {
    render(<DualSyncOperationalAlertsList alerts={[]} />);

    expect(screen.getByText('No operational alerts')).toBeInTheDocument();
  });

  it('@contract renders each alert with its label, message, and count', () => {
    const alerts: DualSyncOperationalAlert[] = [
      {
        code: 'QUEUE_BACKLOG',
        severity: 'warning',
        message: '12 jobs are waiting to run.',
        count: 12,
      },
      {
        code: 'REAUTH_REQUIRED',
        severity: 'critical',
        message: 'Google needs to be reconnected.',
        count: 1,
      },
    ];
    render(<DualSyncOperationalAlertsList alerts={alerts} />);

    expect(screen.getByText('Queue backlog')).toBeInTheDocument();
    expect(screen.getByText('12 jobs are waiting to run.')).toBeInTheDocument();
    expect(screen.getByText('Count: 12')).toBeInTheDocument();
    expect(screen.getByText('Google reauth')).toBeInTheDocument();
  });
});
