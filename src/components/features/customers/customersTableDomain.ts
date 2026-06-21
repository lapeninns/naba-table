import type { OpsGuestRowViewModel } from './opsCustomersTypes';

export const CUSTOMERS_TABLE_SKELETON_ROW_COUNT = 5;
export const CUSTOMERS_TABLE_VIRTUALIZE_MIN_ITEMS = 24;
export const CUSTOMERS_TABLE_LOAD_MORE_ROW_ESTIMATE = 72;
export const CUSTOMERS_TABLE_ROW_ESTIMATE = 220;
export const CUSTOMERS_TABLE_ROW_HEIGHT_EPSILON = 1;

export type CustomersTableViewState = {
  showEmpty: boolean;
  showSkeleton: boolean;
  shouldVirtualize: boolean;
  totalItems: number;
};

export type CustomersTableFocusTarget = {
  id: string;
  index: number;
} | null;

export function deriveCustomersTableViewState({
  hasNextPage,
  isLoading,
  rowCount,
}: {
  hasNextPage: boolean;
  isLoading: boolean;
  rowCount: number;
}): CustomersTableViewState {
  return {
    showEmpty: !isLoading && rowCount === 0,
    showSkeleton: isLoading && rowCount === 0,
    shouldVirtualize: rowCount >= CUSTOMERS_TABLE_VIRTUALIZE_MIN_ITEMS || hasNextPage,
    totalItems: hasNextPage ? rowCount + 1 : rowCount,
  };
}

export function estimateCustomersTableRowSize({
  cachedHeight,
  index,
  rowCount,
}: {
  cachedHeight?: number;
  index: number;
  rowCount: number;
}): number {
  if (index >= rowCount) return CUSTOMERS_TABLE_LOAD_MORE_ROW_ESTIMATE;
  return cachedHeight ?? CUSTOMERS_TABLE_ROW_ESTIMATE;
}

export function shouldLoadMoreCustomers({
  hasNextPage,
  isFetchingNextPage,
  lastVirtualIndex,
  rowCount,
  shouldVirtualize,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  lastVirtualIndex: number | null | undefined;
  rowCount: number;
  shouldVirtualize: boolean;
}): boolean {
  if (!shouldVirtualize || !hasNextPage || isFetchingNextPage || rowCount === 0) {
    return false;
  }
  return typeof lastVirtualIndex === 'number' && lastVirtualIndex >= rowCount - 1;
}

export function findCustomersTableFocusTarget({
  focusCustomerId,
  rows,
}: {
  focusCustomerId?: string | null;
  rows: OpsGuestRowViewModel[];
}): CustomersTableFocusTarget {
  if (!focusCustomerId || rows.length === 0) return null;

  const focusLower = focusCustomerId.toLowerCase();
  const index = rows.findIndex(
    (row) => row.id === focusCustomerId || row.emailSearchValue === focusLower,
  );
  if (index < 0) return null;

  const id = rows[index]?.id;
  return id ? { id, index } : null;
}

export function shouldUpdateCustomersTableRowHeight({
  cachedHeight,
  measuredHeight,
}: {
  cachedHeight?: number;
  measuredHeight: number;
}): boolean {
  return (
    cachedHeight === undefined ||
    Math.abs(cachedHeight - measuredHeight) > CUSTOMERS_TABLE_ROW_HEIGHT_EPSILON
  );
}
