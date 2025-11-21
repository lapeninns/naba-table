import {
  computeBookingWindow as computeBookingWindowInternal,
  filterAvailableTables as filterAvailableTablesInternal,
  filterTimeAvailableTables as filterTimeAvailableTablesInternal,
  extractConflictsForTables as extractConflictsForTablesInternal,
} from "./table-assignment";
import { windowsOverlap } from "./time-windows";

export type {
  Table,
  TableMatchParams,
  TableAssignmentMember,
  TableAssignmentGroup,
  ManualSelectionCheck,
  ManualSelectionSummary,
  ManualValidationResult,
  ManualSelectionOptions,
  ManualHoldOptions,
  ManualHoldResult,
  ManualAssignmentConflict,
  ManualAssignmentContextHold,
  ManualAssignmentContext,
  BookingWindow,
  QuoteTablesOptions,
  QuoteTablesResult,
} from "./table-assignment";

export { ManualSelectionInputError } from "./table-assignment";

export {
  computeBookingWindow,
  filterAvailableTables,
  evaluateLookahead,
  evaluateManualSelection,
  createManualHold,
  getManualAssignmentContext,
  confirmHoldAssignment,
  atomicConfirmAndTransition,
  assignTableToBooking,
  unassignTableFromBooking,
  getBookingTableAssignments,
  quoteTablesForBooking,
  findSuitableTables,
  isTableAvailableV2,
  isTableAvailable,
} from "./table-assignment";
export { windowsOverlap } from "./time-windows";

export type { IntervalLike } from "./time-windows";

export const __internal = {
  computeBookingWindow: computeBookingWindowInternal,
  windowsOverlap,
  filterAvailableTables: filterAvailableTablesInternal,
  filterTimeAvailableTables: filterTimeAvailableTablesInternal,
  extractConflictsForTables: extractConflictsForTablesInternal,
};
