import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import type {
  OpsEmailDeliverySortColumn,
  OpsEmailDeliverySortState,
} from '@/components/features/email-delivery/opsEmailDeliveryTableDomain';

export function OpsEmailDeliveryTableSortIndicator({
  column,
  sortState,
}: {
  column: OpsEmailDeliverySortColumn;
  sortState: OpsEmailDeliverySortState;
}) {
  if (sortState.column !== column) {
    return <ArrowUpDown className="ml-1 inline size-3 text-muted-foreground/50" aria-hidden />;
  }
  return sortState.direction === 'asc' ? (
    <ArrowUp className="ml-1 inline size-3" aria-hidden />
  ) : (
    <ArrowDown className="ml-1 inline size-3" aria-hidden />
  );
}
