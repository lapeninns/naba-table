import { CircleAlert } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import { getSettingsSaveReasonCode } from './settingsSaveSequence';

import type { ReactNode } from 'react';

export const SETTINGS_LOAD_ERROR_UNCHANGED_COPY = 'Your saved settings are unchanged.';

export type SettingsLoadErrorAlertProps = {
  /** e.g. "Couldn’t load the restaurant profile". */
  title: ReactNode;
  error: unknown;
  onRetry: () => void;
  /** A retry is in flight; the button is disabled and marked busy. */
  retrying?: boolean;
  /** Replaces the "Your saved settings are unchanged." sentence. Never server text. */
  message?: ReactNode;
  className?: string;
};

/**
 * Blocking load failure for a settings page (shown only when there is no data yet). Shows a safe
 * reason code, never the server's message, and an outline "Try again".
 */
export function SettingsLoadErrorAlert({
  title,
  error,
  onRetry,
  retrying = false,
  message = SETTINGS_LOAD_ERROR_UNCHANGED_COPY,
  className,
}: SettingsLoadErrorAlertProps) {
  return (
    <Alert variant="destructive" className={className}>
      <CircleAlert className="size-4" aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <span>
          {message} Reason code{' '}
          <span className="font-mono">{getSettingsSaveReasonCode(error)}</span>
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          // The destructive Alert tints its text; the retry stays a neutral outline button.
          className="text-foreground"
          onClick={onRetry}
          disabled={retrying}
          aria-busy={retrying || undefined}
        >
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
