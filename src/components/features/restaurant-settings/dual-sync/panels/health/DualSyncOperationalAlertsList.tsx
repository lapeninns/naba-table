import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

import {
  DUAL_SYNC_OPERATIONAL_ALERT_LABEL,
  getOperationalAlertBadgeVariant,
} from './dualSyncOperationalHealthDomain';

import type { DualSyncOperationalAlert } from '@/server/dual-sync/observability';

type DualSyncOperationalAlertsListProps = {
  alerts: ReadonlyArray<DualSyncOperationalAlert>;
};

export function DualSyncOperationalAlertsList({ alerts }: DualSyncOperationalAlertsListProps) {
  if (alerts.length === 0) {
    return (
      <Alert variant="success">
        <CheckCircle2 className="size-4" />
        <AlertTitle>No operational alerts</AlertTitle>
        <AlertDescription>
          Queue, quota, reauth, and publish-failure signals are clear.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert) => (
        <Alert key={alert.code} variant={alert.severity === 'critical' ? 'destructive' : 'warning'}>
          <AlertTriangle className="size-4" />
          <AlertTitle>{DUAL_SYNC_OPERATIONAL_ALERT_LABEL[alert.code]}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>{alert.message}</span>
            <Badge
              variant={getOperationalAlertBadgeVariant(alert)}
              className="w-fit font-mono text-[10px]"
            >
              Count: {alert.count}
            </Badge>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
