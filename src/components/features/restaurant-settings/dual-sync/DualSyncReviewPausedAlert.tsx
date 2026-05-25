import { PauseCircle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface DualSyncReviewPausedAlertProps {
  readonly pauseReason: string;
}

export function DualSyncReviewPausedAlert({ pauseReason }: DualSyncReviewPausedAlertProps) {
  return (
    <Alert>
      <PauseCircle className="size-4" />
      <AlertTitle>Dual-sync is paused.</AlertTitle>
      <AlertDescription>
        {pauseReason} Write-affecting actions are disabled until sync is resumed.
      </AlertDescription>
    </Alert>
  );
}
