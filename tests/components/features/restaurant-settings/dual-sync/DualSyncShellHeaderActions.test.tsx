import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncShellHeaderActions } from '@/components/features/restaurant-settings/dual-sync/DualSyncShellHeaderActions';
import { TooltipProvider } from '@/components/ui/tooltip';

function renderActions(over: Record<string, unknown> = {}) {
  const handlers = {
    onToggleDriftOnly: vi.fn(),
    onToggleControl: vi.fn(),
    onRefresh: vi.fn(),
    onAutoExport: vi.fn(),
    onPublish: vi.fn(),
  };
  render(
    <TooltipProvider>
      <DualSyncShellHeaderActions
        syncPaused={false}
        pauseReason=""
        showDriftOnly={false}
        controlPending={false}
        refreshPending={false}
        autoExportPending={false}
        publishPending={false}
        previewPublishPending={false}
        canSubmit
        autoExportable={2}
        decisionCount={1}
        {...handlers}
        {...over}
      />
    </TooltipProvider>,
  );
  return handlers;
}

describe('DualSyncShellHeaderActions', () => {
  it('@contract renders the five workspace actions and routes their clicks', async () => {
    const user = userEvent.setup();
    const handlers = renderActions();

    await user.click(screen.getByRole('button', { name: 'All fields' }));
    expect(handlers.onToggleDriftOnly).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Pause sync' }));
    expect(handlers.onToggleControl).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Import latest Google details' }));
    expect(handlers.onRefresh).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Review and publish/ }));
    expect(handlers.onPublish).toHaveBeenCalledTimes(1);
  });

  it('@contract disables publish when nothing can be submitted', () => {
    renderActions({ canSubmit: false, decisionCount: 0 });

    expect(screen.getByRole('button', { name: /Review and publish/ })).toBeDisabled();
  });

  it('@contract flips the control action to resume while paused', () => {
    renderActions({ syncPaused: true, pauseReason: 'Paused by owner.' });

    expect(screen.getByRole('button', { name: 'Resume sync' })).toBeInTheDocument();
  });
});
