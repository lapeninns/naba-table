import { useEffect, useMemo, useState } from 'react';

import {
  formatPublishPreviewFieldLabel,
  isPublishPreviewConfirmDisabled,
  requiresPublishPreviewAcknowledgement,
} from '../dualSyncPublishPreviewDomain';

import type { DualSyncPublishPlan } from '@/server/dual-sync/publish/types';

interface UseDualSyncPublishPreviewDialogStateArgs {
  readonly open: boolean;
  readonly plan: DualSyncPublishPlan | null;
  readonly isPublishing: boolean;
}

export function useDualSyncPublishPreviewDialogState({
  open,
  plan,
  isPublishing,
}: UseDualSyncPublishPreviewDialogStateArgs) {
  const [acknowledged, setAcknowledged] = useState(false);
  const needsAcknowledgement = useMemo(() => requiresPublishPreviewAcknowledgement(plan), [plan]);
  const acceptedCount = plan?.acceptedCount ?? 0;
  const confirmDisabled = isPublishPreviewConfirmDisabled({
    isPublishing,
    acceptedCount,
    needsAcknowledgement,
    acknowledged,
  });
  const publishButtonLabel = isPublishing
    ? 'Publishing'
    : `Publish ${acceptedCount} ${formatPublishPreviewFieldLabel(acceptedCount)}`;

  useEffect(() => {
    if (open) {
      setAcknowledged(false);
    }
  }, [open, plan]);

  return {
    acknowledged,
    acceptedCount,
    confirmDisabled,
    needsAcknowledgement,
    publishButtonLabel,
    setAcknowledged,
  };
}
