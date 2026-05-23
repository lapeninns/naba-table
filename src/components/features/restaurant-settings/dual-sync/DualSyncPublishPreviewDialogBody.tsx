import { AlertTriangle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { DualSyncPublishAcknowledgement } from './DualSyncPublishAcknowledgement';
import { DualSyncPublishGroupsTable } from './DualSyncPublishGroupsTable';
import { DualSyncPublishPreviewSummaryBadges } from './DualSyncPublishPreviewSummaryBadges';
import { DualSyncPublishWarningsAlert } from './DualSyncPublishWarningsAlert';
import { DualSyncRejectedDecisionsPanel } from './DualSyncRejectedDecisionsPanel';

import type { DualSyncPublishPlan } from '@/server/dual-sync/publish/types';

interface DualSyncPublishPreviewDialogBodyProps {
  readonly acknowledged: boolean;
  readonly needsAcknowledgement: boolean;
  readonly onAcknowledgedChange: (checked: boolean) => void;
  readonly plan: DualSyncPublishPlan | null;
}

export function DualSyncPublishPreviewDialogBody({
  acknowledged,
  needsAcknowledgement,
  onAcknowledgedChange,
  plan,
}: DualSyncPublishPreviewDialogBodyProps) {
  if (!plan) {
    return (
      <Alert>
        <AlertTriangle className="size-4" />
        <AlertTitle>No publish plan loaded.</AlertTitle>
        <AlertDescription>Close this dialog and generate a new preview.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DualSyncPublishPreviewSummaryBadges plan={plan} />
      <DualSyncPublishWarningsAlert warnings={plan.warnings} />
      <DualSyncPublishGroupsTable groups={plan.groups} />
      <DualSyncRejectedDecisionsPanel rejected={plan.rejected} />

      {needsAcknowledgement ? (
        <DualSyncPublishAcknowledgement
          acknowledged={acknowledged}
          onAcknowledgedChange={onAcknowledgedChange}
        />
      ) : null}
    </div>
  );
}
