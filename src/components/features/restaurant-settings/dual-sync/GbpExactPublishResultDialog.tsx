import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { GbpPublishResponseV1 } from '@/services/ops/dual-sync';

export function GbpExactPublishResultDialog({
  open,
  result,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly result: GbpPublishResponseV1 | null;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const hasUnknown =
    result?.mode === 'immediate' &&
    result.outcomes.some((outcome) => outcome.status === 'outcome_unknown');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pr-12 sm:pr-0">
          <DialogTitle>
            {result?.mode === 'queued' ? 'Google publish queued' : 'Google publish outcome'}
          </DialogTitle>
          <DialogDescription>
            Queued is not complete, and an unknown provider outcome is never treated as success.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant={result.mode === 'queued' ? 'status-pending' : 'secondary'}>
                {result.mode}
              </Badge>
              <Badge variant="outline" className="font-mono">
                bundle {result.bundleId}
              </Badge>
              {result.mode === 'queued' ? (
                <Badge variant="outline" className="font-mono">
                  job {result.jobId}
                </Badge>
              ) : null}
            </div>
            {hasUnknown ? (
              <Alert variant="warning">
                <AlertTitle>Provider outcome unknown</AlertTitle>
                <AlertDescription>
                  Refresh Google state, verify the listing, and create a new preview before any
                  retry. The in-app outcome remains available; verify the operational notification
                  channel.
                </AlertDescription>
              </Alert>
            ) : null}
            {result.mode === 'immediate' ? (
              <ul className="flex flex-col gap-2">
                {result.outcomes.map((outcome) => (
                  <li key={outcome.groupId} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono">{outcome.groupId}</span>
                    <Badge
                      variant={
                        outcome.status === 'consumed'
                          ? 'status-confirmed'
                          : outcome.status === 'outcome_unknown'
                            ? 'status-pending'
                            : 'status-cancelled'
                      }
                    >
                      {outcome.status}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {outcome.reasonCode}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                The publish is queued. Follow job {result.jobId} for a terminal outcome.
              </p>
            )}
          </div>
        ) : null}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
