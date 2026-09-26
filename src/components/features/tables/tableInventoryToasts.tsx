import { toast } from 'sonner';

import { getSettingsSaveReasonCode } from '@/components/features/restaurant-settings/shared';
import { toUserMessage } from '@/lib/http/userMessage';

/**
 * Fixed copy for the table and zone API codes. Client-owned so the toast never depends on
 * server text, and a 5xx message is never shown (see `toUserMessage`).
 */
export const TABLE_INVENTORY_ERROR_COPY: Readonly<Record<string, string>> = {
  TABLE_NUMBER_TAKEN: 'Another table already uses that number.',
  TABLE_HAS_BOOKINGS:
    'This table has current or upcoming bookings. Move, complete or cancel them first.',
  TABLE_NOT_FOUND: 'This table no longer exists.',
  ZONE_NAME_TAKEN: 'Another zone already uses that name.',
  ZONE_IN_USE: 'This zone still has tables. Move or delete them first.',
  ZONE_NOT_FOUND: 'This zone no longer exists.',
  MAINTENANCE_CONFLICT: 'That maintenance window overlaps a hold or booking on this table.',
  CAPACITY_NOT_CONFIGURED: 'That table size isn’t set up for this restaurant yet.',
  INSUFFICIENT_ROLE: 'Only owners and managers can change tables and zones.',
  MEMBERSHIP_VALIDATION_UNAVAILABLE: 'We couldn’t check your access just now. Try again.',
  VALIDATION_FAILED: 'Some details need attention. Check them and try again.',
};

/** The user-facing explanation for a failed table or zone write. */
export function describeTableInventoryError(error: unknown): string {
  return toUserMessage(error, { copy: TABLE_INVENTORY_ERROR_COPY });
}

/**
 * Failure toast for a table or zone write: what failed (the title), why, in fixed copy for the
 * API code, and the safe reason code for support. Never the raw error text, which can echo user
 * data back from the server.
 */
export function showTableInventoryErrorToast(message: string, error: unknown) {
  const reasonCode = getSettingsSaveReasonCode(error);
  toast.error(message, {
    description: (
      <span>
        {describeTableInventoryError(error)} Reason code{' '}
        <span className="font-mono">{reasonCode}</span>
      </span>
    ),
  });
}
