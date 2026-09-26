import { toast } from 'sonner';

import { getSettingsSaveReasonCode } from '@/components/features/restaurant-settings/shared';

/**
 * Failure toast for a table or zone write. Shows the safe reason code, never the raw error text,
 * which can echo user data back from the server.
 */
export function showTableInventoryErrorToast(message: string, error: unknown) {
  const reasonCode = getSettingsSaveReasonCode(error);
  toast.error(message, {
    description: (
      <span>
        Reason code <span className="font-mono">{reasonCode}</span>
      </span>
    ),
  });
}
