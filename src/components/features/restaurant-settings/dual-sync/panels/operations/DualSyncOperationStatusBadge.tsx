import { CheckCircle2, CircleDashed, Clock, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import {
  DUAL_SYNC_OPERATION_STATUS_LABEL,
  DUAL_SYNC_OPERATION_STATUS_VARIANT,
  getOperationStatusIconKey,
} from './dualSyncOperationsDomain';

import type { DualSyncPublishOperationStatus } from '@/server/dual-sync';

type DualSyncOperationStatusBadgeProps = {
  status: DualSyncPublishOperationStatus;
};

export function DualSyncOperationStatusBadge({ status }: DualSyncOperationStatusBadgeProps) {
  const iconKey = getOperationStatusIconKey(status);
  const Icon =
    iconKey === 'success'
      ? CheckCircle2
      : iconKey === 'failure'
        ? XCircle
        : iconKey === 'skipped'
          ? CircleDashed
          : Clock;

  // The icon inherits the Badge variant's semantic text color (green/amber/
  // red/gray) rather than overriding success + pending to cobalt — matching the
  // sibling queue-job/publish-job badges and the full 2.0 semantic palette.
  return (
    <Badge
      variant={DUAL_SYNC_OPERATION_STATUS_VARIANT[status]}
      className="inline-flex items-center gap-1 font-mono text-[10px]"
    >
      <Icon className="h-3.5 w-3.5" />
      {DUAL_SYNC_OPERATION_STATUS_LABEL[status]}
    </Badge>
  );
}
