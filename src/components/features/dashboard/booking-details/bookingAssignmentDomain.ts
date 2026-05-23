import { HttpError } from '@/lib/http/errors';

import type {
  ManualAssignmentTable,
  ManualSelectionCheck,
  ManualValidationResult,
} from '@/services/ops/bookings';

type AssignmentErrorCheck = {
  id: string;
  passed: boolean;
  message: string;
};

type AssignmentErrorDetails = {
  checks?: AssignmentErrorCheck[];
  missingTableIds?: string[];
};

export type BookingAssignmentPreflightDecision =
  | { kind: 'already-assigned'; message: string }
  | { kind: 'empty-selection'; message: string }
  | {
      kind: 'stale-selection';
      staleTableIds: string[];
      validTableIds: string[];
      message: string | null;
    }
  | { kind: 'ready'; tableIds: string[] };

export type BookingAssignmentErrorResolution =
  | { kind: 'missing-tables'; message: string; missingTableIds: string[] }
  | { kind: 'validation'; message: string; validationResult: ManualValidationResult | null }
  | { kind: 'message'; message: string };

export function buildAssignmentTableMap(
  tables: ManualAssignmentTable[] | null | undefined,
): Map<string, ManualAssignmentTable> {
  return new Map((tables ?? []).map((table) => [table.id, table]));
}

export function resolveEffectiveSelectedIds({
  assignedTableIds,
  selectedTableIds,
}: {
  assignedTableIds: string[];
  selectedTableIds: string[];
}): string[] {
  return selectedTableIds.length > 0 ? selectedTableIds : assignedTableIds;
}

export function calculateAssignmentSelectedCapacity({
  selectedTableIds,
  tableMap,
}: {
  selectedTableIds: string[];
  tableMap: Map<string, ManualAssignmentTable>;
}): number {
  return selectedTableIds.reduce((sum, tableId) => sum + (tableMap.get(tableId)?.capacity ?? 0), 0);
}

export function resolveAssignedTables({
  assignedTableIds,
  tableMap,
}: {
  assignedTableIds: string[];
  tableMap: Map<string, ManualAssignmentTable>;
}): ManualAssignmentTable[] {
  return assignedTableIds.flatMap((tableId) => {
    const table = tableMap.get(tableId);
    return table ? [table] : [];
  });
}

export function resolveBookingAssignmentPreflight({
  assignedTableCount,
  selectedTableIds,
  tableMap,
}: {
  assignedTableCount: number;
  selectedTableIds: string[];
  tableMap: Map<string, ManualAssignmentTable>;
}): BookingAssignmentPreflightDecision {
  if (assignedTableCount > 0) {
    return {
      kind: 'already-assigned',
      message: 'Tables are already assigned. Remove existing tables before assigning new ones.',
    };
  }

  if (selectedTableIds.length === 0) {
    return { kind: 'empty-selection', message: 'Please select tables to assign.' };
  }

  const validTableIds = selectedTableIds.filter((id) => tableMap.has(id));
  const staleTableIds = selectedTableIds.filter((id) => !tableMap.has(id));

  if (staleTableIds.length > 0) {
    return {
      kind: 'stale-selection',
      staleTableIds,
      validTableIds,
      message:
        validTableIds.length === 0
          ? 'Selected tables are no longer available. Please select again.'
          : null,
    };
  }

  return { kind: 'ready', tableIds: selectedTableIds };
}

export function resolveBookingAssignmentError(
  error: unknown,
  {
    partySize,
    selectedCapacity,
    selectedTableIds,
  }: {
    partySize: number;
    selectedCapacity: number;
    selectedTableIds: string[];
  },
): BookingAssignmentErrorResolution {
  if (!(error instanceof HttpError)) {
    return {
      kind: 'message',
      message: error instanceof Error ? error.message : 'Assignment failed',
    };
  }

  const details = error.details as AssignmentErrorDetails | undefined;

  if (error.code === 'TABLES_NOT_FOUND') {
    const missingTableIds = details?.missingTableIds ?? [];
    return {
      kind: 'missing-tables',
      missingTableIds,
      message:
        missingTableIds.length > 0
          ? `Selected tables were removed: ${missingTableIds.join(', ')}`
          : 'Selected tables were removed. Please reselect.',
    };
  }

  if (error.status !== 422) {
    return { kind: 'message', message: error.message };
  }

  const failedChecks = details?.checks?.filter((check) => !check.passed) ?? [];
  if (failedChecks.length === 0) {
    return { kind: 'validation', message: error.message, validationResult: null };
  }

  const checkMessages = failedChecks.map((check) => `• ${check.message}`).join('\n');
  return {
    kind: 'validation',
    message: `${error.message}\n\n${checkMessages}`,
    validationResult: {
      ok: false,
      checks: failedChecks.map((check) => ({
        id: check.id as ManualSelectionCheck['id'],
        status: 'error',
        message: check.message,
      })),
      summary: {
        tableCount: selectedTableIds.length,
        totalCapacity: selectedCapacity,
        partySize,
        slack: selectedCapacity - partySize,
        zoneId: null,
        tableNumbers: selectedTableIds,
      },
    },
  };
}
