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
  /** `import` relabels the confirmation for Google values saved in Nabatable only. */
  readonly purpose?: 'publish' | 'import';
}

export function useDualSyncPublishPreviewDialogState({
  open,
  plan,
  isPublishing,
  purpose = 'publish',
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
  const publishButtonLabel =
    purpose === 'import'
      ? isPublishing
        ? 'Saving…'
        : `Use ${acceptedCount} Google ${acceptedCount === 1 ? 'value' : 'values'}`
      : isPublishing
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
