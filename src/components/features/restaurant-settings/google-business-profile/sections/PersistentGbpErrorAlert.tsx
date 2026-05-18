import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import type { PersistentGbpError } from '../googleBusinessProfileWorkflow';

type PersistentGbpErrorAlertProps = {
  error: PersistentGbpError;
  actionLabel?: string;
  onAction?: () => void;
  isActionPending?: boolean;
};

export function PersistentGbpErrorAlert({
  error,
  actionLabel,
  onAction,
  isActionPending,
}: PersistentGbpErrorAlertProps) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{error.title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{error.message}</span>
        {actionLabel && onAction ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onAction}
            disabled={isActionPending}
          >
            {isActionPending ? `${actionLabel}...` : actionLabel}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
