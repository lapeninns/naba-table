/**
 * Operational health alert delivery for dual-sync.
 *
 * Loads restaurant-scoped health metrics, maps warning/critical alerts
 * into the shared notification port, and records alert emission in the
 * existing observability stream. The sweep is intentionally bounded and
 * read-first so it can run from cron without blocking other tenants.
 */

import { recordObservabilityEvent } from '@/server/observability';

import { loadDualSyncOperationalMetrics } from './metrics';
import { buildDefaultNotificationPort, type DualSyncNotificationPort } from '../notifications';
import { listRestaurantsWithLinkedGoogleBusinessProfile } from '../scheduling/refresh';

import type {
  DualSyncOperationalAlert,
  DualSyncOperationalMetricThresholds,
  DualSyncOperationalMetrics,
} from './metrics';
import type { ObservabilitySeverity } from '@/server/observability';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface RunDualSyncOperationalHealthAlertSweepInput {
  readonly client: DbClient;
  readonly maxRestaurants?: number;
  readonly dryRun?: boolean;
  readonly onError?: 'continue' | 'throw';
  readonly windowMs?: number;
  readonly limit?: number;
  readonly now?: Date;
  readonly thresholds?: Partial<DualSyncOperationalMetricThresholds>;
  readonly onlyCritical?: boolean;
  readonly notifications?: DualSyncNotificationPort;
}

export interface DualSyncOperationalHealthAlertTenantSummary {
  readonly restaurantId: string;
  readonly alertCount: number;
  readonly criticalCount: number;
  readonly warningCount: number;
  readonly alerts: ReadonlyArray<Pick<DualSyncOperationalAlert, 'code' | 'severity' | 'count'>>;
}

export interface RunDualSyncOperationalHealthAlertSweepSummary {
  readonly restaurantsConsidered: number;
  readonly restaurantsProcessed: number;
  readonly restaurantIds: ReadonlyArray<string>;
  readonly summaries: ReadonlyArray<DualSyncOperationalHealthAlertTenantSummary>;
  readonly alertsEmitted: number;
  readonly errors: ReadonlyArray<{
    readonly restaurantId: string;
    readonly message: string;
  }>;
  readonly dryRun: boolean;
}

function filterAlerts(
  alerts: ReadonlyArray<DualSyncOperationalAlert>,
  onlyCritical: boolean,
): ReadonlyArray<DualSyncOperationalAlert> {
  return onlyCritical ? alerts.filter((alert) => alert.severity === 'critical') : alerts;
}

function countAlerts(alerts: ReadonlyArray<DualSyncOperationalAlert>) {
  let criticalCount = 0;
  let warningCount = 0;
  for (const alert of alerts) {
    if (alert.severity === 'critical') {
      criticalCount += 1;
    } else {
      warningCount += 1;
    }
  }
  return { criticalCount, warningCount };
}

function notificationSeverity(
  alerts: ReadonlyArray<DualSyncOperationalAlert>,
): 'warning' | 'error' {
  return alerts.some((alert) => alert.severity === 'critical') ? 'error' : 'warning';
}

function observabilitySeverity(
  alerts: ReadonlyArray<DualSyncOperationalAlert>,
): ObservabilitySeverity {
  return alerts.some((alert) => alert.severity === 'critical') ? 'critical' : 'warning';
}

function tenantSummary(
  restaurantId: string,
  alerts: ReadonlyArray<DualSyncOperationalAlert>,
): DualSyncOperationalHealthAlertTenantSummary {
  const { criticalCount, warningCount } = countAlerts(alerts);
  return {
    restaurantId,
    alertCount: alerts.length,
    criticalCount,
    warningCount,
    alerts: alerts.map((alert) => ({
      code: alert.code,
      severity: alert.severity,
      count: alert.count,
    })),
  };
}

async function emitTenantHealthAlert(input: {
  readonly notifications: DualSyncNotificationPort;
  readonly restaurantId: string;
  readonly metrics: DualSyncOperationalMetrics;
  readonly alerts: ReadonlyArray<DualSyncOperationalAlert>;
}): Promise<void> {
  const { criticalCount, warningCount } = countAlerts(input.alerts);
  const firstAlert = input.alerts[0] ?? null;
  const severity = notificationSeverity(input.alerts);
  await input.notifications.emit({
    kind: 'operational_health_alert',
    severity,
    summary: `Dual-sync health for ${input.restaurantId} has ${input.alerts.length} alert(s).`,
    restaurantId: input.restaurantId,
    errorCode: firstAlert?.code ?? null,
    counts: {
      failed: criticalCount,
      other: warningCount,
    },
    metadata: {
      windowStart: input.metrics.windowStart,
      windowEnd: input.metrics.windowEnd,
      queueBacklog: input.metrics.queueBacklog,
      deadLetterJobs: input.metrics.deadLetterJobs,
      partialPublishFailures: input.metrics.partialPublishFailures,
      failureCounts: input.metrics.failureCounts,
      alerts: input.alerts.map((alert) => ({
        code: alert.code,
        severity: alert.severity,
        count: alert.count,
        message: alert.message,
      })),
    },
  });

  await recordObservabilityEvent({
    source: 'dual-sync.operational-health',
    eventType: 'alert.emitted',
    severity: observabilitySeverity(input.alerts),
    restaurantId: input.restaurantId,
    context: {
      alertCount: input.alerts.length,
      criticalCount,
      warningCount,
      alertCodes: input.alerts.map((alert) => alert.code),
      windowStart: input.metrics.windowStart,
      windowEnd: input.metrics.windowEnd,
    },
  });
}

export async function runDualSyncOperationalHealthAlertSweep(
  input: RunDualSyncOperationalHealthAlertSweepInput,
): Promise<RunDualSyncOperationalHealthAlertSweepSummary> {
  const {
    client,
    maxRestaurants,
    dryRun = false,
    onError = 'continue',
    windowMs,
    limit,
    now,
    thresholds,
    onlyCritical = false,
  } = input;
  const notifications = input.notifications ?? buildDefaultNotificationPort();

  const restaurantIds = await listRestaurantsWithLinkedGoogleBusinessProfile({
    client,
    limit: maxRestaurants,
  });
  const summaries: DualSyncOperationalHealthAlertTenantSummary[] = [];
  const errors: Array<{ readonly restaurantId: string; readonly message: string }> = [];
  let alertsEmitted = 0;

  for (const restaurantId of restaurantIds) {
    try {
      const metrics = await loadDualSyncOperationalMetrics({
        client,
        restaurantId,
        now,
        windowMs,
        limit,
        thresholds,
      });
      const alerts = filterAlerts(metrics.alerts, onlyCritical);
      summaries.push(tenantSummary(restaurantId, alerts));
      if (alerts.length > 0 && !dryRun) {
        await emitTenantHealthAlert({
          notifications,
          restaurantId,
          metrics,
          alerts,
        });
        alertsEmitted += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ restaurantId, message });
      if (!dryRun) {
        await notifications.emit({
          kind: 'tenant_run_failed',
          severity: 'error',
          summary: `Dual-sync operational health sweep for ${restaurantId} threw: ${message}`,
          restaurantId,
          errorMessage: message,
          metadata: {
            sweep: 'operational_health_alerts',
          },
        });
      }
      if (onError === 'throw') {
        throw error;
      }
    }
  }

  return {
    restaurantsConsidered: restaurantIds.length,
    restaurantsProcessed: summaries.length,
    restaurantIds,
    summaries,
    alertsEmitted,
    errors,
    dryRun,
  };
}
