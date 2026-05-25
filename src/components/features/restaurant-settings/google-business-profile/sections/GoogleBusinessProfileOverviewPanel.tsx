'use client';

import { PersistentGbpErrorAlert } from './PersistentGbpErrorAlert';
import { GbpOverviewCard } from '../components/GbpOverviewCard';

import type { PersistentGbpError } from '../googleBusinessProfileWorkflow';
import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

export type GoogleBusinessProfileOverviewAction = {
  label: string;
  onAction: () => void;
  isPending: boolean;
} | null;

export type GoogleBusinessProfileOverviewPanelProps = {
  accountLabel: string;
  canDisconnect: boolean;
  canRefresh: boolean;
  error: PersistentGbpError | null;
  errorAction: GoogleBusinessProfileOverviewAction;
  hasLinkedLocation: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  isRefreshing: boolean;
  lastPullAt: string | null;
  locationTitle: string;
  manageOnGoogleHref: string | null;
  onChooseLocation: () => void;
  onConnect: (() => void) | null;
  onRefresh: (() => void) | null;
  onRequestDisconnect: (() => void) | null;
  showConnect: boolean;
  showPicker: boolean;
  stageLabel: string;
  status: GoogleBusinessProfileConnection['status'];
};

export function GoogleBusinessProfileOverviewPanel({
  accountLabel,
  canDisconnect,
  canRefresh,
  error,
  errorAction,
  hasLinkedLocation,
  isConnecting,
  isDisconnecting,
  isRefreshing,
  lastPullAt,
  locationTitle,
  manageOnGoogleHref,
  onChooseLocation,
  onConnect,
  onRefresh,
  onRequestDisconnect,
  showConnect,
  showPicker,
  stageLabel,
  status,
}: GoogleBusinessProfileOverviewPanelProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {error ? (
        <PersistentGbpErrorAlert
          error={error}
          actionLabel={errorAction?.label}
          onAction={errorAction?.onAction}
          isActionPending={errorAction?.isPending}
        />
      ) : null}
      <GbpOverviewCard
        status={status}
        stageLabel={stageLabel}
        locationTitle={locationTitle}
        accountLabel={accountLabel}
        lastPullAt={lastPullAt}
        hasLinkedLocation={hasLinkedLocation}
        showConnect={showConnect}
        onConnect={onConnect}
        isConnecting={isConnecting}
        showPicker={showPicker}
        onChooseLocation={onChooseLocation}
        canRefresh={canRefresh}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        manageOnGoogleHref={manageOnGoogleHref}
        canDisconnect={canDisconnect}
        onRequestDisconnect={onRequestDisconnect}
        isDisconnecting={isDisconnecting}
      />
    </div>
  );
}

export default GoogleBusinessProfileOverviewPanel;
