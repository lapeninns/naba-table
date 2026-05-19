import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { openSettingsCompare } from '../../gbp/openSettingsCompare';

import type { GbpDriftContextValue } from '../../gbp-drift/types';

type GbpSyncSummarySectionProps = {
  status: 'linked' | 'sync_error';
  lastError: string | null;
  hasSyncWorkspace: boolean;
  gbpDrift: GbpDriftContextValue | null;
};

export function GbpSyncSummarySection({
  status,
  lastError,
  hasSyncWorkspace,
  gbpDrift,
}: GbpSyncSummarySectionProps) {
  return (
    <Card variant="compact" className="border-border/70 shadow-none">
      <CardContent className="px-4 py-4 sm:px-5">
        {status === 'sync_error' && lastError ? (
          <Alert variant="destructive">
            <AlertTitle>Last sync failed</AlertTitle>
            <AlertDescription>{lastError}</AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTitle>
              {hasSyncWorkspace ? 'Review changes below' : 'Google Business Profile linked'}
            </AlertTitle>
            <AlertDescription>
              <span className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {hasSyncWorkspace
                    ? 'Use the sync workspace below before changing Nabatable or Google.'
                    : 'Google is linked. Comparison tools are currently unavailable, so review changes directly in Nabatable and Google for now.'}
                </span>
                {gbpDrift?.isLinked ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      openSettingsCompare(gbpDrift.openCompare, {
                        preset: 'globalDrifted',
                      })
                    }
                  >
                    Quick compare
                  </Button>
                ) : null}
              </span>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
