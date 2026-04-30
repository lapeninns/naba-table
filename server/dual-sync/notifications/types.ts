/**
 * Phase 3p of the unified dual-sync engine.
 *
 * Failure / partial-failure notifications. The cross-tenant auto-export
 * cron from Phase 3h fans out across every restaurant with open
 * outbound candidates. Without observability, a quietly broken tenant
 * (e.g. revoked Google credentials) would never surface to operators.
 *
 * The notification surface is intentionally a port so deployments can
 * route events to whichever channel they prefer (PagerDuty, Slack,
 * Sentry breadcrumbs, custom Lambda, etc.) without coupling the
 * dual-sync core to any specific provider.
 */

export type DualSyncNotificationKind =
  | 'tenant_run_failed'
  | 'tenant_run_partial'
  | 'cron_run_failed';

export type DualSyncNotificationSeverity = 'info' | 'warning' | 'error';

export interface DualSyncNotificationEvent {
  readonly kind: DualSyncNotificationKind;
  readonly severity: DualSyncNotificationSeverity;
  readonly summary: string;
  readonly restaurantId?: string | null;
  readonly publishJobId?: string | null;
  readonly errorCode?: string | null;
  readonly errorMessage?: string | null;
  readonly counts?: {
    readonly succeeded?: number;
    readonly failed?: number;
    readonly skipped?: number;
    readonly other?: number;
  };
  readonly metadata?: Readonly<Record<string, unknown>>;
  /** ISO-8601 timestamp; the port is responsible for stamping if absent. */
  readonly occurredAt?: string;
}

export interface DualSyncNotificationPort {
  /**
   * Send a notification. The port should swallow its own errors and
   * never throw — the cron caller relies on this contract to keep the
   * fan-out loop running across remaining tenants.
   */
  emit(event: DualSyncNotificationEvent): Promise<void>;
}
