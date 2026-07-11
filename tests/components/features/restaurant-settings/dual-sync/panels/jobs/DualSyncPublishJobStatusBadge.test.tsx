import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncPublishJobStatusBadge } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPublishJobStatusBadge';

describe('DualSyncPublishJobStatusBadge', () => {
  it('@contract maps every job status to its badge label', () => {
    render(
      <>
        <DualSyncPublishJobStatusBadge status="success" />
        <DualSyncPublishJobStatusBadge status="partial" />
        <DualSyncPublishJobStatusBadge status="failed" />
        <DualSyncPublishJobStatusBadge status="in-flight" />
      </>,
    );

    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Partial')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('In flight')).toBeInTheDocument();
  });
});
