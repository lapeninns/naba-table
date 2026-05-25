import type { OpsEmailDeliveryTableRowViewModel } from './opsEmailDeliveryTypes';

export type OpsEmailDeliverySortColumn = 'sentAt' | 'status';
export type OpsEmailDeliverySortDirection = 'asc' | 'desc';

export type OpsEmailDeliverySortState = {
  column: OpsEmailDeliverySortColumn;
  direction: OpsEmailDeliverySortDirection;
};

export const DEFAULT_OPS_EMAIL_DELIVERY_SORT_STATE: OpsEmailDeliverySortState = {
  column: 'sentAt',
  direction: 'desc',
};

export function getNextOpsEmailDeliverySortState(
  current: OpsEmailDeliverySortState,
  column: OpsEmailDeliverySortColumn,
): OpsEmailDeliverySortState {
  if (current.column === column) {
    return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { column, direction: 'asc' };
}

export function sortOpsEmailDeliveryTableRows({
  rows,
  sortState,
}: {
  rows: OpsEmailDeliveryTableRowViewModel[];
  sortState: OpsEmailDeliverySortState;
}): OpsEmailDeliveryTableRowViewModel[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    const dir = sortState.direction === 'asc' ? 1 : -1;
    if (sortState.column === 'sentAt') {
      if (a.sentAtMs !== b.sentAtMs) return (a.sentAtMs - b.sentAtMs) * dir;
      return a.attempt.messageId.localeCompare(b.attempt.messageId) * dir;
    }

    const statusCompare = a.statusSortValue.localeCompare(b.statusSortValue);
    if (statusCompare !== 0) return statusCompare * dir;
    const sentAtCompare = b.sentAtMs - a.sentAtMs;
    if (sentAtCompare !== 0) return sentAtCompare;
    return a.attempt.messageId.localeCompare(b.attempt.messageId);
  });
  return sorted;
}
