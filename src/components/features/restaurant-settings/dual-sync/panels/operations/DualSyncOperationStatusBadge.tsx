import { CheckCircle2, CircleDashed, Clock, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
  const iconClassName = 'h-3.5 w-3.5';
  const Icon =
    iconKey === 'success'
      ? CheckCircle2
      : iconKey === 'failure'
        ? XCircle
        : iconKey === 'skipped'
          ? CircleDashed
          : Clock;
  const toneClassName =
    iconKey === 'failure'
      ? 'text-destructive'
      : iconKey === 'skipped'
        ? 'text-muted-foreground'
        : 'text-primary';

  return (
    <Badge
      variant={DUAL_SYNC_OPERATION_STATUS_VARIANT[status]}
      className="inline-flex items-center gap-1 font-mono text-[10px]"
    >
      <Icon className={cn(iconClassName, toneClassName)} />
      {DUAL_SYNC_OPERATION_STATUS_LABEL[status]}
    </Badge>
  );
}
