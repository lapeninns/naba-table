import { PauseCircle, PlayCircle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface DualSyncReviewPausedAlertProps {
  readonly pauseReason: string;
  readonly onResume?: () => void;
  readonly resumeLabel?: string;
  readonly resumeDisabled?: boolean;
}

export function DualSyncReviewPausedAlert({
  pauseReason,
  onResume,
  resumeLabel = 'Resume sync',
  resumeDisabled = false,
}: DualSyncReviewPausedAlertProps) {
  return (
    <Alert variant="warning">
      <PauseCircle className="size-4" aria-hidden />
      <AlertTitle>Dual-sync is paused.</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>{pauseReason} Choices, refreshes and publishing are off until sync is resumed.</span>
        {onResume ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="self-start"
            onClick={onResume}
            disabled={resumeDisabled}
          >
            <PlayCircle data-icon="inline-start" aria-hidden />
            {resumeLabel}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
