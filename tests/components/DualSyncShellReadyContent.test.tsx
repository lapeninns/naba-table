import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DualSyncShellReadyContent } from '@/components/features/restaurant-settings/dual-sync/DualSyncShellReadyContent';

import type { DualSyncShellReadyContentProps } from '@/components/features/restaurant-settings/dual-sync/DualSyncShellReadyContent';

const mocks = vi.hoisted(() => ({
  dialogs: vi.fn(),
  reauthAlert: vi.fn(),
  workspaceCard: vi.fn(),
  publishResults: vi.fn(),
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

vi.mock('@/components/features/restaurant-settings/dual-sync/GbpPublishResults', () => ({
  GbpPublishResults: (props: unknown) => {
    mocks.publishResults(props);
    return <div data-testid="publish-results" />;
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
    usesExactPublish: true,
    exactPublishActions: { result: null },
  };
  const workspace = {
    publishMutation: {
      isPending: false,
    },
  };
  const viewState = {
    autoExportable: 0,
    canPublish: false,
    canImport: false,
    decisionSummary: { toSend: 0, toImport: 0, ignored: 0 },
    lastSnapshotAt: null,
    pauseReason: 'Dual-sync is paused for this restaurant.',
    syncPaused: false,
    totalOpen: 0,
    writeBlocked: false,
  };

  return {
    onShowDriftOnlyChange: vi.fn(),
    shellActions,
    showDriftOnly: true,
    viewState,
    workspace,
    ...overrides,
  } as unknown as DualSyncShellReadyContentProps;
}

beforeEach(() => {
  mocks.dialogs.mockClear();
  mocks.reauthAlert.mockClear();
  mocks.workspaceCard.mockClear();
  mocks.publishResults.mockClear();
});

describe('DualSyncShellReadyContent', () => {
  it('forwards ready-state props to dialogs, the review card and the publish results', () => {
    const onShowDriftOnlyChange = vi.fn();
    const props = makeProps({
      onShowDriftOnlyChange,
      showDriftOnly: false,
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
      importPending: true,
    });
    expect(mocks.workspaceCard).toHaveBeenCalledWith({
      workspace: props.workspace,
      shellActions: props.shellActions,
      viewState: props.viewState,
      showDriftOnly: false,
      onShowDriftOnlyChange,
    });
    expect(mocks.publishResults).toHaveBeenCalledWith({ result: null });
    expect(mocks.reauthAlert).not.toHaveBeenCalled();
  });

  it('shows publish results only for the exact publish path', () => {
    const props = makeProps();
    render(
      <DualSyncShellReadyContent
        {...props}
        shellActions={
          {
            ...props.shellActions,
            usesExactPublish: false,
          } as DualSyncShellReadyContentProps['shellActions']
        }
      />,
    );

    expect(screen.queryByTestId('publish-results')).not.toBeInTheDocument();
  });

  it('renders and wires the reauth alert only when the shell needs reconnect', () => {
    const handleReconnect = vi.fn();
    const props = makeProps({
      shellActions: {
        handleReconnect,
        isReconnectPending: true,
        needsReauth: true,
        usesExactPublish: true,
        exactPublishActions: { result: null },
      } as unknown as DualSyncShellReadyContentProps['shellActions'],
    });

    render(<DualSyncShellReadyContent {...props} />);

    expect(screen.getByTestId('reauth-alert')).toBeInTheDocument();
    expect(mocks.reauthAlert).toHaveBeenCalledWith({
      onReconnect: handleReconnect,
      isActionPending: true,
    });
  });
});
