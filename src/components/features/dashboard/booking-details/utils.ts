/**
 * Booking details utilities (pure functions).
 */

import { DateTime } from 'luxon';

import { getOpsBookingStatusUi } from '@/lib/ops/booking-status';

import type { AssignmentValidation } from './types';
import type { ManualAssignmentTable } from '@/services/ops/bookings';
import type { OpsBookingStatus, OpsTodayBooking } from '@/types/ops';

// =============================================================================
// TIME/DATE FORMATTING
// =============================================================================

const ISO_DATE_TIME_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/;

export function parseBookingDateTime(params: {
  time: string | null;
  date: string | null;
  timezone: string;
}): DateTime | null {
  const { time, date, timezone } = params;
  if (!time) return null;

  const isoCandidate = ISO_DATE_TIME_REGEX.test(time) ? time : date ? `${date}T${time}` : null;
  if (!isoCandidate) return null;

  const dt = DateTime.fromISO(isoCandidate, { zone: timezone });
  return dt.isValid ? dt : null;
}

export function formatBookingTime(time: string | null, date: string | null, timezone: string): string {
  if (!time) return '--:--';
  if (/^\d{2}:\d{2}$/.test(time)) return time;

  const dt = parseBookingDateTime({ time, date, timezone });
  if (!dt) return time;
  return dt.toFormat('HH:mm');
}

export function formatBookingDate(date: string | null, timezone: string): string {
  if (!date) return 'Date TBC';
  const dt = DateTime.fromISO(date, { zone: timezone });
  if (!dt.isValid) return date;
  return dt.toFormat('ccc dd LLL');
}

export function getMinutesUntilTime(
  time: string | null,
  date: string | null,
  timezone: string,
  now?: DateTime,
): number | null {
  const target = parseBookingDateTime({ time, date, timezone });
  if (!target) return null;
  const reference = now ?? DateTime.now().setZone(timezone);
  return Math.round(target.diff(reference, 'minutes').minutes ?? 0);
}

export function formatCountdown(minutes: number): string {
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

// =============================================================================
// STATUS UTILITIES
// =============================================================================

export function getStatusLabel(status: OpsBookingStatus | string): string {
  if (!status) return 'Unknown';
  if (typeof status !== 'string') return getOpsBookingStatusUi(status).label;
  // booking details sometimes receive string statuses; keep a safe fallback.
  return status.replaceAll('_', ' ');
}

export function canCheckIn(status: OpsBookingStatus): boolean {
  return status === 'confirmed' || status === 'pending' || status === 'pending_allocation' || status === 'PRIORITY_WAITLIST';
}

export function canMarkNoShow(status: OpsBookingStatus): boolean {
  return status === 'confirmed' || status === 'pending' || status === 'pending_allocation' || status === 'PRIORITY_WAITLIST';
}

export function shouldShowCountdown(status: OpsBookingStatus, minutesRemaining: number | null): boolean {
  if (minutesRemaining === null) return false;
  const excluded: OpsBookingStatus[] = ['completed', 'cancelled', 'no_show', 'checked_in'];
  if (excluded.includes(status)) return false;
  return minutesRemaining <= 60 && minutesRemaining >= -60;
}

// =============================================================================
// GUEST UTILITIES
// =============================================================================

export function getGuestInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function formatPhoneForTel(phone: string): string {
  return phone.replace(/[^+\d]/g, '');
}

// =============================================================================
// TABLE UTILITIES
// =============================================================================

export type CapacityFit = 'exact' | 'within' | 'oversized' | 'too_small';

export function getCapacityFit(partySize: number, table: ManualAssignmentTable): CapacityFit {
  const min = table.minPartySize ?? 1;
  const max = table.maxPartySize ?? table.capacity;

  if (partySize < min || partySize > max) return 'too_small';
  if (table.capacity === partySize) return 'exact';
  if (table.capacity <= partySize + 2) return 'within';
  return 'oversized';
}

export function getCapacityFitLabel(fit: CapacityFit): string {
  switch (fit) {
    case 'exact':
      return 'Exact fit';
    case 'within':
      return 'Comfort fit';
    case 'oversized':
      return 'Large table';
    case 'too_small':
      return 'Too small';
    default:
      return 'Fit';
  }
}

export type FlattenedTable = {
  id: string;
  tableNumber: string;
  capacity: number;
  section: string | null;
};

export function flattenTableAssignments(
  tableAssignments: OpsTodayBooking['tableAssignments'],
): FlattenedTable[] {
  return (tableAssignments || []).flatMap((group) =>
    group.members.map((member) => ({
      id: member.tableId,
      tableNumber: member.tableNumber,
      capacity: member.capacity ?? 0,
      section: member.section ?? null,
    })),
  );
}

export function calculateTotalCapacity(tables: FlattenedTable[]): number {
  return tables.reduce((sum, table) => sum + table.capacity, 0);
}

export function calculateCapacityPercent(currentCapacity: number, requiredCapacity: number): number {
  if (requiredCapacity <= 0) return 0;
  return Math.min(100, (currentCapacity / requiredCapacity) * 100);
}

export function groupTablesBySection(tables: ManualAssignmentTable[]): Map<string, ManualAssignmentTable[]> {
  const map = new Map<string, ManualAssignmentTable[]>();
  for (const table of tables) {
    const section = table.section || 'Main';
    if (!map.has(section)) map.set(section, []);
    map.get(section)!.push(table);
  }
  return map;
}

export function validateTableSelection(params: {
  partySize: number;
  selectedTables: ManualAssignmentTable[];
  conflictedTableIds: Set<string>;
  hasExistingAssignments: boolean;
}): AssignmentValidation {
  const { partySize, selectedTables, conflictedTableIds, hasExistingAssignments } = params;
  const selectedCapacity = selectedTables.reduce((sum, table) => sum + table.capacity, 0);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (hasExistingAssignments && selectedTables.length > 0) {
    errors.push('Remove current table assignment before selecting new tables.');
  }

  if (selectedTables.some((table) => conflictedTableIds.has(table.id))) {
    errors.push('One or more selected tables are currently reserved.');
  }

  if (selectedTables.length > 0 && selectedCapacity < partySize) {
    errors.push(`Selected capacity is ${partySize - selectedCapacity} seats short.`);
  }

  if (selectedTables.length > 1) {
    warnings.push('Multiple tables selected. Confirm split seating with the guest.');
  }

  if (selectedTables.length > 0 && selectedCapacity >= partySize + 4) {
    warnings.push('Selected tables provide much more capacity than required.');
  }

  const status: AssignmentValidation['status'] =
    errors.length > 0 ? 'error' : warnings.length > 0 ? 'warn' : selectedTables.length > 0 ? 'ok' : 'idle';

  return {
    status,
    warnings,
    errors,
    needsConfirmation: warnings.length > 0,
    summary: {
      selectedCount: selectedTables.length,
      selectedCapacity,
      requiredCapacity: partySize,
    },
  };
}

// =============================================================================
// CLIPBOARD
// =============================================================================

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch {
      return false;
    }
  }
}
