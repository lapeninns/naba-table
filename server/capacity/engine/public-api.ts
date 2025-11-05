import {
  quoteTablesForBooking as _quoteTablesForBooking,
  confirmHoldAssignment as _confirmHoldAssignment,
  getManualAssignmentContext as _getManualAssignmentContext,
  evaluateManualSelection as _evaluateManualSelection,
  createManualHold as _createManualHold,
  ManualSelectionInputError,
} from '@/server/capacity/tables';

import type {
  QuoteTablesOptions,
  QuoteTablesResult,
  ManualHoldOptions,
  ManualHoldResult,
  ManualValidationResult,
  ManualAssignmentContext,
  TableAssignmentMember,
  ManualSelectionOptions,
} from '@/server/capacity/tables';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';


type DbClient = SupabaseClient<Database, 'public'>;

export { ManualSelectionInputError };

// Public Engine API: keep names concise and cohesive

export async function quoteTables(options: QuoteTablesOptions): Promise<QuoteTablesResult> {
  return _quoteTablesForBooking(options);
}

export async function confirmHold(params: {
  holdId: string;
  bookingId: string;
  idempotencyKey: string;
  requireAdjacency?: boolean;
  assignedBy?: string | null;
  client?: DbClient;
}): Promise<TableAssignmentMember[]> {
  return _confirmHoldAssignment(params);
}

export async function getManualContext(params: {
  bookingId: string;
  client?: DbClient;
}): Promise<ManualAssignmentContext> {
  return _getManualAssignmentContext(params);
}

export async function validateManualSelection(options: ManualSelectionOptions): Promise<ManualValidationResult> {
  return _evaluateManualSelection(options);
}

export async function holdManualSelection(options: ManualHoldOptions): Promise<ManualHoldResult> {
  return _createManualHold(options);
}

// Types re-export for convenience when consuming the engine
export type { QuoteTablesOptions, QuoteTablesResult, ManualHoldOptions, ManualHoldResult, ManualValidationResult, ManualAssignmentContext };
