import {
  getOperationDirectionIconKey,
  getOperationDirectionLabel,
} from './dualSyncOperationsDomain';
import { DualSyncDirectionIcon } from '../../DualSyncDirectionIcon';

import type { DualSyncPublishOperation } from '@/server/dual-sync';

type DualSyncOperationDirectionCellProps = {
  direction: DualSyncPublishOperation['direction'];
};

export function DualSyncOperationDirectionCell({ direction }: DualSyncOperationDirectionCellProps) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px]">
      <DualSyncDirectionIcon iconKey={getOperationDirectionIconKey(direction)} className="size-3" />
      {getOperationDirectionLabel(direction)}
    </span>
  );
}
