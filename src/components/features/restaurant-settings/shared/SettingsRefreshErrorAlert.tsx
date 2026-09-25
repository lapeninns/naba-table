import { RefreshCw } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import { getSettingsSaveReasonCode } from './settingsSaveSequence';

type SettingsRefreshErrorAlertProps = {
  error: unknown;
  onRetry: () => void;
};

/**
 * Non-blocking notice for a failed background refetch while loaded settings (and any unsaved
 * edits) stay on screen. Shows only a safe reason code, never the server's message.
 */
export function SettingsRefreshErrorAlert({ error, onRetry }: SettingsRefreshErrorAlertProps) {
  return (
    <Alert variant="warning" role="status">
      <RefreshCw aria-hidden />
      <AlertTitle>Couldn’t refresh saved settings</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing the last loaded version; unsaved changes are kept. Reason code{' '}
          <span className="font-mono">{getSettingsSaveReasonCode(error)}</span>
        </span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
