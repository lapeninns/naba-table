import { CheckCircle2, Clock, RotateCcw, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import {
  DUAL_SYNC_QUEUE_JOB_STATUS_LABEL,
  DUAL_SYNC_QUEUE_JOB_STATUS_VARIANT,
  getQueueJobStatusIconKey,
} from './dualSyncQueueJobsDomain';

import type { DualSyncJobStatus } from '@/server/dual-sync';

type DualSyncQueueJobStatusBadgeProps = {
  status: DualSyncJobStatus;
};

export function DualSyncQueueJobStatusBadge({ status }: DualSyncQueueJobStatusBadgeProps) {
  const iconKey = getQueueJobStatusIconKey(status);
  const Icon =
    iconKey === 'success'
      ? CheckCircle2
      : iconKey === 'failure'
        ? XCircle
        : iconKey === 'retrying'
          ? RotateCcw
          : Clock;

  return (
    <Badge
      variant={DUAL_SYNC_QUEUE_JOB_STATUS_VARIANT[status]}
      className="inline-flex items-center gap-1 font-mono text-[10px]"
    >
      <Icon className="size-3" />
      {DUAL_SYNC_QUEUE_JOB_STATUS_LABEL[status]}
    </Badge>
  );
}
