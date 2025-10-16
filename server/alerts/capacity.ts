import { env } from '@/lib/env';
import { recordObservabilityEvent } from '@/server/observability';
import { getServiceSupabaseClient } from '@/server/supabase';

export type CapacityAlert = {
  restaurantId: string;
  windowStart: string;
  successCount: number;
  conflictCount: number;
  capacityExceededCount: number;
  conflictRate: number;
  kind: 'conflict_rate' | 'capacity_exceeded';
};

export type CapacityAlertOptions = {
  windowMinutes?: number;
  conflictRateThreshold?: number;
  capacityExceededThreshold?: number;
};

async function sendWebhookNotification(alerts: CapacityAlert[]): Promise<void> {
  const { webhookUrl } = env.alerts;
  if (!webhookUrl || alerts.length === 0) {
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alerts }),
    });
  } catch (error) {
    console.error('[capacity-alerts] webhook notification failed', error);
  }
}

export async function checkCapacityAlerts(options: CapacityAlertOptions = {}): Promise<{ alerts: CapacityAlert[] }> {
  const {
    windowMinutes = 60,
    conflictRateThreshold = 0.05,
    capacityExceededThreshold = 1,
  } = options;

  const supabase = getServiceSupabaseClient();
  const sinceIso = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('capacity_metrics_hourly')
    .select('restaurant_id, window_start, success_count, conflict_count, capacity_exceeded_count')
    .gte('window_start', sinceIso);

  if (error) {
    console.error('[capacity-alerts] failed to query metrics', error);
    return { alerts: [] };
  }

  const alerts: CapacityAlert[] = [];

  for (const row of data ?? []) {
    const totalAttempts = row.success_count + row.conflict_count + row.capacity_exceeded_count;
    const conflictRate = totalAttempts > 0 ? row.conflict_count / totalAttempts : 0;

    if (row.capacity_exceeded_count >= capacityExceededThreshold) {
      alerts.push({
        restaurantId: row.restaurant_id,
        windowStart: row.window_start,
        successCount: row.success_count,
        conflictCount: row.conflict_count,
        capacityExceededCount: row.capacity_exceeded_count,
        conflictRate,
        kind: 'capacity_exceeded',
      });
    }

    if (conflictRateThreshold > 0 && conflictRate >= conflictRateThreshold) {
      alerts.push({
        restaurantId: row.restaurant_id,
        windowStart: row.window_start,
        successCount: row.success_count,
        conflictCount: row.conflict_count,
        capacityExceededCount: row.capacity_exceeded_count,
        conflictRate,
        kind: 'conflict_rate',
      });
    }
  }

  if (alerts.length > 0) {
    alerts.forEach((alert) =>
      recordObservabilityEvent({
        source: 'capacity.alerts',
        eventType: `capacity.alert.${alert.kind}`,
        severity: 'warning',
        context: alert,
      })
    );
    await sendWebhookNotification(alerts);
  }

  return { alerts };
}
