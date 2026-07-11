import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncShellHeader } from '@/components/features/restaurant-settings/dual-sync/DualSyncShellHeader';
import { TooltipProvider } from '@/components/ui/tooltip';

describe('DualSyncShellHeader', () => {
  it('@contract composes status, actions, and review progress', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    render(
      <TooltipProvider>
        <DualSyncShellHeader
          totalOpen={3}
          autoExportable={1}
          lastSnapshotAt={null}
          overallHeatmap={{
            total: 3,
            in_sync: 2,
            drift: 1,
            conflict: 0,
            pending: 0,
            failed: 0,
            inactive: 0,
            hasActionableState: true,
          }}
          syncPaused={false}
          pauseReason=""
          showDriftOnly={false}
          controlPending={false}
          refreshPending={false}
          autoExportPending={false}
          publishPending={false}
          previewPublishPending={false}
          canSubmit
          decisionCount={1}
          workspaceProgress={{
            totalFields: 3,
            inSyncCount: 2,
            needsReviewCount: 1,
            draftedForReviewCount: 1,
            syncHealthPercent: 67,
            draftCoveragePercent: 100,
          }}
          onToggleDriftOnly={vi.fn()}
          onToggleControl={vi.fn()}
          onRefresh={onRefresh}
          onAutoExport={vi.fn()}
          onPublish={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText('Google Business Profile sync')).toBeInTheDocument();
    expect(screen.getByText('3 pending')).toBeInTheDocument();
    expect(screen.getByText('Match 67%')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Import latest Google details' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
