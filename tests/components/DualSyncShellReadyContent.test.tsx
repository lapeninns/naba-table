import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DualSyncShellReadyContent } from '@/components/features/restaurant-settings/dual-sync/DualSyncShellReadyContent';

import type { DualSyncShellReadyContentProps } from '@/components/features/restaurant-settings/dual-sync/DualSyncShellReadyContent';

const mocks = vi.hoisted(() => ({
  dialogs: vi.fn(),
  reauthAlert: vi.fn(),
  workspaceCard: vi.fn(),
}));

vi.mock('@/components/features/restaurant-settings/dual-sync/DualSyncShellDialogs', () => ({
  DualSyncShellDialogs: (props: unknown) => {
    mocks.dialogs(props);
    return <div data-testid="shell-dialogs" />;
  },
}));

vi.mock('@/components/features/restaurant-settings/dual-sync/DualSyncShellReauthAlert', () => ({
  DualSyncShellReauthAlert: (props: unknown) => {
    mocks.reauthAlert(props);
    return <div data-testid="reauth-alert" />;
  },
}));

vi.mock('@/components/features/restaurant-settings/dual-sync/DualSyncShellWorkspaceCard', () => ({
  DualSyncShellWorkspaceCard: (props: unknown) => {
    mocks.workspaceCard(props);
    return <div data-testid="workspace-card" />;
  },
}));

function makeProps(
  overrides: Partial<DualSyncShellReadyContentProps> = {},
): DualSyncShellReadyContentProps {
  const shellActions = {
    handleReconnect: vi.fn(),
    isReconnectPending: false,
    needsReauth: false,
  };
  const workspace = {
    publishMutation: {
      isPending: false,
    },
  };
  const viewState = {
    autoExportable: 0,
    canSubmit: false,
    lastSnapshotAt: null,
    overallHeatmap: {
      total: 0,
      in_sync: 0,
      drift: 0,
      conflict: 0,
      pending: 0,
      failed: 0,
      inactive: 0,
      hasActionableState: false,
    },
    pauseReason: 'Dual-sync is paused for this restaurant.',
    syncPaused: false,
    totalOpen: 0,
    writeBlocked: false,
  };

  return {
    className: 'custom-shell',
    onToggleDriftOnly: vi.fn(),
    shellActions,
    showDriftOnly: true,
    singleOpenSections: false,
    viewState,
    workspace,
    ...overrides,
  } as unknown as DualSyncShellReadyContentProps;
}

beforeEach(() => {
  mocks.dialogs.mockClear();
  mocks.reauthAlert.mockClear();
  mocks.workspaceCard.mockClear();
});

describe('DualSyncShellReadyContent', () => {
  it('forwards ready-state props to dialogs and the workspace card', () => {
    const onToggleDriftOnly = vi.fn();
    const props = makeProps({
      onToggleDriftOnly,
      showDriftOnly: false,
      singleOpenSections: true,
      workspace: {
        publishMutation: {
          isPending: true,
        },
      } as DualSyncShellReadyContentProps['workspace'],
    });

    render(<DualSyncShellReadyContent {...props} />);

    expect(screen.getByTestId('shell-dialogs')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-card')).toBeInTheDocument();
    expect(mocks.dialogs).toHaveBeenCalledWith({
      shellActions: props.shellActions,
      publishPending: true,
    });
    expect(mocks.workspaceCard).toHaveBeenCalledWith({
      className: 'custom-shell',
      workspace: props.workspace,
      shellActions: props.shellActions,
      viewState: props.viewState,
      showDriftOnly: false,
      onToggleDriftOnly,
      singleOpenSections: true,
    });
    expect(mocks.reauthAlert).not.toHaveBeenCalled();
  });

  it('renders and wires the reauth alert only when the shell needs reconnect', () => {
    const handleReconnect = vi.fn();
    const props = makeProps({
      shellActions: {
        handleReconnect,
        isReconnectPending: true,
        needsReauth: true,
      } as DualSyncShellReadyContentProps['shellActions'],
    });

    render(<DualSyncShellReadyContent {...props} />);

    expect(screen.getByTestId('reauth-alert')).toBeInTheDocument();
    expect(mocks.reauthAlert).toHaveBeenCalledWith({
      onReconnect: handleReconnect,
      isActionPending: true,
    });
  });
});
