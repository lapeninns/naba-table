import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsEmailQueueMetricsGrid } from '@/components/features/email-delivery/components/OpsEmailQueueMetricsGrid';
import { buildOpsEmailQueueMetrics } from '@/components/features/email-delivery/opsEmailQueuePanelDomain';

describe('OpsEmailQueueMetricsGrid', () => {
  it('@smoke renders the five queue metrics with their values', () => {
    render(
      <OpsEmailQueueMetricsGrid
        metrics={buildOpsEmailQueueMetrics({ total: 12, waiting: 4, active: 2, delayed: 5, dlq: 1 })}
      />,
    );

    expect(screen.getByText('Total in queue')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Scheduled for later')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Ready to send')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Sending now')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Needs attention')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('@smoke falls back to zeros when the summary is missing', () => {
    render(<OpsEmailQueueMetricsGrid metrics={buildOpsEmailQueueMetrics(null)} />);

    expect(screen.getAllByText('0')).toHaveLength(5);
  });
});
