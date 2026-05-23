import { ShieldAlert } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { formatPublishPreviewWarningLabel } from './dualSyncPublishPreviewDomain';

import type { DualSyncPlanWarning } from '@/server/dual-sync/publish/types';

type DualSyncPublishWarningsAlertProps = {
  warnings: ReadonlyArray<DualSyncPlanWarning>;
};

export function DualSyncPublishWarningsAlert({ warnings }: DualSyncPublishWarningsAlertProps) {
  if (warnings.length === 0) return null;

  return (
    <Alert variant="warning">
      <ShieldAlert className="size-4" />
      <AlertTitle>High-risk publish review</AlertTitle>
      <AlertDescription>
        <div className="mt-2 flex flex-col gap-2">
          {warnings.map((warning, index) => (
            <div key={`${warning.code}-${warning.groupId ?? index}`} className="text-sm">
              <span className="font-medium">{formatPublishPreviewWarningLabel(warning.code)}:</span>{' '}
              {warning.message}
            </div>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}
