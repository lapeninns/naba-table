import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const controllerState = vi.hoisted(() => ({
  activatePanel: vi.fn(),
  panels: [
    {
      id: 'metrics',
      value: 'metrics',
      title: 'Operational health',
      isActive: false,
      inactiveDescription: 'Metrics load when opened.',
      loadButtonLabel: 'Load metrics',
    },
    {
      id: 'operations',
      value: 'operations',
      title: 'Recent operations',
      isActive: true,
      inactiveDescription: 'Operations load when opened.',
      loadButtonLabel: 'Load operations',
    },
  ],
}));

vi.mock(
  '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncLazyPanelsController',
  () => ({
    useDualSyncLazyPanelsController: () => controllerState,
  }),
);

// Panel bodies have their own suites; stub them to keep this test on the lazy shell.
vi.mock(
  '@/components/features/restaurant-settings/dual-sync/panels/health/DualSyncOperationalHealthPanel',
  () => ({ DualSyncOperationalHealthPanel: () => <div data-testid="metrics-panel" /> }),
);
vi.mock(
  '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPendingCandidatesPanel',
  () => ({ DualSyncPendingCandidatesPanel: () => <div data-testid="candidates-panel" /> }),
);
vi.mock(
  '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPublishJobsPanel',
  () => ({ DualSyncPublishJobsPanel: () => <div data-testid="publish-jobs-panel" /> }),
);
vi.mock(
  '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncQueueJobsPanel',
  () => ({ DualSyncQueueJobsPanel: () => <div data-testid="queue-jobs-panel" /> }),
);
vi.mock(
  '@/components/features/restaurant-settings/dual-sync/panels/operations/DualSyncOperationsPanel',
  () => ({ DualSyncOperationsPanel: () => <div data-testid="operations-panel" /> }),
);

import { Accordion } from '@/components/ui/accordion';
import { DualSyncLazyPanels } from '@/components/features/restaurant-settings/dual-sync/DualSyncLazyPanels';

import type { DualSyncWorkspace } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncWorkspace';

const workspace = {} as unknown as DualSyncWorkspace;

describe('DualSyncLazyPanels', () => {
  it('@contract renders inactive panels as load placeholders and active panels with content', () => {
    render(
      <Accordion type="multiple" defaultValue={['metrics', 'operations']}>
        <DualSyncLazyPanels workspace={workspace} />
      </Accordion>,
    );

    expect(screen.getByText('Operational health')).toBeInTheDocument();
    expect(screen.getByText('Metrics load when opened.')).toBeInTheDocument();
    expect(screen.queryByTestId('metrics-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('operations-panel')).toBeInTheDocument();
  });

  it('@contract activates a lazy panel through its load action', async () => {
    const user = userEvent.setup();
    render(
      <Accordion type="multiple" defaultValue={['metrics', 'operations']}>
        <DualSyncLazyPanels workspace={workspace} />
      </Accordion>,
    );

    await user.click(screen.getByRole('button', { name: /Load metrics/ }));

    expect(controllerState.activatePanel).toHaveBeenCalledWith('metrics');
  });
});
