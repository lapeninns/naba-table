import { isConfiguredValue, resolveControlPlaneConfig } from './config';
import {
  ACTIVE_RUNTIME,
  CANDIDATE_RUNTIME,
  MAX_PROBE_TARGETS,
  PLACEHOLDER_PATTERN,
  PROBE_TIMEOUT_MS,
  SERVICE_NAME,
  UPTIME_PING_TIMEOUT_MS,
} from './contracts';
import { checkEvidenceFreshness, writeEvidence } from './evidence';
import { isRecord } from './http';
import { writeStructuredLog } from '../../shared/observability';

import type {
  HealthObservation,
  HeartbeatState,
  OperationalControlEnv,
  ProbeEnvironment,
  ProbeTarget,
} from './contracts';
import type { CoordinatorClient, TickReport } from './coordinator-client';
import type { EvidenceFreshness } from './evidence';
import type { LogSink } from '../../shared/observability';

const TARGET_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/u;
const PROBE_ENVIRONMENTS: readonly ProbeEnvironment[] = ['staging', 'production'];

export type ProbeTargetsResult =
  | { readonly ok: true; readonly targets: readonly ProbeTarget[] }
  | { readonly ok: false; readonly reason: string };

export type ProbeFailureClass = 'unhealthy_status' | 'timeout' | 'network';

export type ProbeResult = {
  readonly name: string;
  readonly environment: ProbeEnvironment;
  readonly healthy: boolean;
  readonly status: number | null;
  readonly durationMs: number;
  readonly failureClass: ProbeFailureClass | null;
};

export type ScheduledCycleReport = {
  readonly startedAt: string;
  readonly completedAt: string;
  readonly valid: boolean;
  readonly invalidReasons: readonly string[];
  readonly probes: readonly ProbeResult[];
  readonly heartbeat: { readonly state: HeartbeatState; readonly ageMs: number | null };
  readonly fallbackEligible: boolean;
  readonly evidence: EvidenceFreshness;
  readonly activeIncidents: number;
  readonly tick: TickReport | null;
  readonly uptimePinged: boolean;
  readonly activeRuntime: typeof ACTIVE_RUNTIME;
  readonly candidateRuntime: typeof CANDIDATE_RUNTIME;
};

export function parseProbeTargets(raw: string | undefined): ProbeTargetsResult {
  if (raw === undefined || raw.trim() === '') return { ok: false, reason: 'targets_unconfigured' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'targets_invalid_json' };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return { ok: false, reason: 'targets_empty' };
  if (parsed.length > MAX_PROBE_TARGETS) return { ok: false, reason: 'targets_too_many' };
  const targets: ProbeTarget[] = [];
  const seen = new Set<string>();
  for (const entry of parsed) {
    if (!isRecord(entry) || typeof entry.name !== 'string' || typeof entry.url !== 'string') {
      return { ok: false, reason: 'target_shape_invalid' };
    }
    if (!TARGET_NAME_PATTERN.test(entry.name)) return { ok: false, reason: 'target_name_invalid' };
    if (!PROBE_ENVIRONMENTS.includes(entry.environment as ProbeEnvironment)) {
      return { ok: false, reason: 'target_environment_invalid' };
    }
    if (PLACEHOLDER_PATTERN.test(entry.url)) return { ok: false, reason: 'target_url_placeholder' };
    let url: URL;
    try {
      url = new URL(entry.url);
    } catch {
      return { ok: false, reason: 'target_url_invalid' };
    }
    if (
      url.protocol !== 'https:' ||
      url.search !== '' ||
      url.hash !== '' ||
      url.username ||
      url.password
    ) {
      return { ok: false, reason: 'target_url_invalid' };
    }
    const key = `${entry.name}|${entry.environment}`;
    if (seen.has(key)) return { ok: false, reason: 'target_duplicate' };
    seen.add(key);
    targets.push({
      name: entry.name,
      environment: entry.environment as ProbeEnvironment,
      url: url.toString(),
    });
  }
  return { ok: true, targets };
}

/** GET-only readiness probe: bounded timeout, no redirects followed, response body discarded. */
export async function probeTarget(input: {
  readonly target: ProbeTarget;
  readonly monitoringToken: string;
  readonly fetcher: typeof fetch;
  readonly now: () => number;
  readonly timeoutMs?: number;
}): Promise<ProbeResult> {
  const startedAt = input.now();
  const base = { name: input.target.name, environment: input.target.environment };
  try {
    const response = await input.fetcher(input.target.url, {
      method: 'GET',
      headers: { authorization: `Bearer ${input.monitoringToken}`, accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(input.timeoutMs ?? PROBE_TIMEOUT_MS),
    });
    const durationMs = Math.max(0, input.now() - startedAt);
    const healthy = response.status === 200;
    return {
      ...base,
      healthy,
      status: response.status,
      durationMs,
      failureClass: healthy ? null : 'unhealthy_status',
    };
  } catch (error) {
    const durationMs = Math.max(0, input.now() - startedAt);
    const timedOut =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return {
      ...base,
      healthy: false,
      status: null,
      durationMs,
      failureClass: timedOut ? 'timeout' : 'network',
    };
  }
}

async function pingUptime(url: string, fetcher: typeof fetch): Promise<boolean> {
  try {
    const response = await fetcher(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(UPTIME_PING_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function isHttpsUrl(value: string | undefined): value is string {
  if (!isConfiguredValue(value)) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * One five-minute control cycle. Every check is read-only; the uptime heartbeat is only
 * emitted after a fully valid cycle so a silent worker reads as an outage upstream.
 */
export async function runScheduledCycle(input: {
  readonly env: OperationalControlEnv;
  readonly coordinator: CoordinatorClient | null;
  readonly fetcher: typeof fetch;
  readonly now: () => number;
  readonly sink?: LogSink;
}): Promise<ScheduledCycleReport> {
  const startedAtMs = input.now();
  const invalidReasons: string[] = [];
  const log = (
    level: 'info' | 'warn' | 'error',
    event: string,
    fields: Record<string, unknown>,
  ): void => writeStructuredLog({ level, event, service: SERVICE_NAME, fields, sink: input.sink });

  const config = resolveControlPlaneConfig(input.env);
  if (!config.ok) invalidReasons.push(`unconfigured:${config.missing.join(',')}`);

  const targets = parseProbeTargets(input.env.TARGETS_JSON);
  if (!targets.ok) invalidReasons.push(targets.reason);
  const monitoringToken = input.env.MONITORING_TOKEN;
  const tokenConfigured = isConfiguredValue(monitoringToken) && monitoringToken.length >= 16;
  if (!tokenConfigured) invalidReasons.push('monitoring_token_unconfigured');

  const probes: ProbeResult[] =
    targets.ok && tokenConfigured
      ? await Promise.all(
          targets.targets.map((target) =>
            probeTarget({ target, monitoringToken, fetcher: input.fetcher, now: input.now }),
          ),
        )
      : [];
  for (const probe of probes) {
    if (!probe.healthy) invalidReasons.push(`probe_unhealthy:${probe.environment}/${probe.name}`);
  }

  let heartbeat: ScheduledCycleReport['heartbeat'] = { state: 'unknown', ageMs: null };
  let activeIncidents = 0;
  let tick: TickReport | null = null;
  if (!input.coordinator) {
    invalidReasons.push('coordinator_unconfigured');
  } else {
    try {
      const status = await input.coordinator.status();
      heartbeat = { state: status.heartbeat.state, ageMs: status.heartbeat.ageMs };
      const observations: HealthObservation[] = [
        ...probes.map((probe) => ({
          service: probe.name,
          environment: probe.environment,
          failureClass: 'readiness',
          healthy: probe.healthy,
        })),
        {
          service: 'local-ci-controller',
          environment: 'control-plane',
          failureClass: 'heartbeat_stale',
          healthy: heartbeat.state === 'fresh',
        },
      ];
      await input.coordinator.recordObservations({
        observations,
        now: new Date(input.now()).toISOString(),
      });
      tick = await input.coordinator.tick(new Date(input.now()).toISOString());
      activeIncidents = (await input.coordinator.status()).incidents.active.length;
    } catch (error) {
      invalidReasons.push('coordinator_unavailable');
      log('error', 'scheduled.coordinator_unavailable', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (heartbeat.state !== 'fresh') invalidReasons.push(`controller_heartbeat_${heartbeat.state}`);
  if (activeIncidents > 0) invalidReasons.push('active_incidents');

  const evidence = await checkEvidenceFreshness({
    bucket: input.env.EVIDENCE_BUCKET,
    nowMs: input.now(),
  });
  if (!evidence.ok) invalidReasons.push(`evidence_${evidence.reason}`);

  const valid = invalidReasons.length === 0;
  const completedAtMs = input.now();
  const partial: Omit<ScheduledCycleReport, 'uptimePinged'> = {
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: new Date(completedAtMs).toISOString(),
    valid,
    invalidReasons,
    probes,
    heartbeat,
    fallbackEligible: heartbeat.state === 'fallback_eligible',
    evidence,
    activeIncidents,
    tick,
    activeRuntime: ACTIVE_RUNTIME,
    candidateRuntime: CANDIDATE_RUNTIME,
  };

  const written = await writeEvidence({
    bucket: input.env.EVIDENCE_BUCKET,
    kind: 'cycle',
    id: `cycle-${completedAtMs}`,
    payload: partial,
    now: new Date(completedAtMs),
  });
  if (!written.ok) log('warn', 'scheduled.evidence_write_skipped', { reason: written.reason });

  let uptimePinged = false;
  if (valid && written.ok) {
    if (isHttpsUrl(input.env.UPTIME_HEARTBEAT_URL)) {
      uptimePinged = await pingUptime(input.env.UPTIME_HEARTBEAT_URL, input.fetcher);
      if (!uptimePinged) log('warn', 'scheduled.uptime_ping_failed', {});
    } else {
      log('warn', 'scheduled.uptime_unconfigured', {});
    }
  }

  log(valid ? 'info' : 'warn', 'scheduled.cycle_completed', {
    valid,
    invalidReasons,
    probes: probes.length,
    heartbeatState: heartbeat.state,
    fallbackEligible: partial.fallbackEligible,
    activeIncidents,
    uptimePinged,
  });
  return { ...partial, uptimePinged };
}
