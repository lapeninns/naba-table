import { RefreshCw } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import { getSettingsSaveReasonCode } from './settingsSaveSequence';

export const SETTINGS_REFRESH_ERROR_DRAFT_COPY =
  'Showing the last loaded version; unsaved changes are kept.';
export const SETTINGS_REFRESH_ERROR_READ_ONLY_COPY = 'Showing the last loaded version.';

type SettingsRefreshErrorAlertProps = {
  error: unknown;
  onRetry: () => void;
  /** Pages without a draft pass SETTINGS_REFRESH_ERROR_READ_ONLY_COPY. Never server text. */
  message?: string;
};

/**
 * Non-blocking notice for a failed background refetch while loaded settings (and any unsaved
 * edits) stay on screen. Shows only a safe reason code, never the server's message.
 */
export function SettingsRefreshErrorAlert({
  error,
  onRetry,
  message = SETTINGS_REFRESH_ERROR_DRAFT_COPY,
}: SettingsRefreshErrorAlertProps) {
  return (
    <Alert variant="warning" role="status">
      <RefreshCw className="size-4" aria-hidden />
      <AlertTitle>Couldn’t refresh saved settings</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {message} Reason code{' '}
          <span className="font-mono">{getSettingsSaveReasonCode(error)}</span>
        </span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
