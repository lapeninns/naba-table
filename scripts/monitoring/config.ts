import { readFileSync } from 'node:fs';
import path from 'node:path';

import { isYamlMap, parseYamlSubset } from './yaml-subset';

import type { YamlMap, YamlValue } from './yaml-subset';

/**
 * Typed, validated view of `config/observability/monitoring.yaml`. Every
 * accessor fails loudly on a malformed document so `pnpm ops:verify` never
 * runs against a partially understood contract.
 */

export type MonitoringTargetKind = 'web' | 'worker' | 'github';

export type MonitoringTarget = {
  readonly name: string;
  readonly service: string;
  readonly kind: MonitoringTargetKind;
  readonly interval: string;
  readonly readyPath: string | null;
  readonly baseUrl: string | null;
  readonly baseUrlEnv: string | null;
};

export type MonitoringThreshold = {
  readonly name: string;
  readonly alertRef: string;
};

export type MonitoringConfig = {
  readonly version: number;
  readonly owner: string;
  readonly repository: string;
  readonly runtime: {
    readonly activeRuntime: string;
    readonly candidateRuntime: string;
    readonly qualificationNote: string;
  };
  readonly auth: { readonly tokenEnv: string; readonly githubTokenEnv: string };
  readonly intervals: Readonly<Record<string, string>>;
  readonly timeouts: {
    readonly readyRequestMs: number;
    readonly githubRequestMs: number;
    readonly heartbeatRequestMs: number;
  };
  readonly heartbeat: { readonly urlEnv: string; readonly graceMinutes: number };
  readonly targets: ReadonlyArray<MonitoringTarget>;
  readonly thresholds: ReadonlyArray<MonitoringThreshold>;
  readonly evidence: {
    readonly coverageMinimumPercent: number;
    readonly warmUpDays: number;
    readonly windowDays: number;
    readonly backup: {
      readonly workflowFile: string;
      readonly warningHours: number;
      readonly maxHours: number;
    };
    readonly drill: {
      readonly workflowFile: string;
      readonly warningDays: number;
      readonly blockDays: number;
    };
    readonly requiredWorkflowFiles: ReadonlyArray<string>;
  };
  readonly requiredChecks: {
    readonly branch: string;
    readonly enforce: boolean;
    readonly contexts: ReadonlyArray<string>;
  };
};

export class MonitoringConfigError extends Error {
  constructor(message: string) {
    super(`monitoring.yaml: ${message}`);
    this.name = 'MonitoringConfigError';
  }
}

function requireMap(value: YamlValue | undefined, label: string): YamlMap {
  if (!isYamlMap(value)) throw new MonitoringConfigError(`${label} must be a map`);
  return value;
}

function requireString(value: YamlValue | undefined, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MonitoringConfigError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value: YamlValue | undefined, label: string): string | null {
  if (value === undefined || value === null) return null;
  return requireString(value, label);
}

function requireNumber(value: YamlValue | undefined, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new MonitoringConfigError(`${label} must be a non-negative number`);
  }
  return value;
}

function requireBoolean(value: YamlValue | undefined, label: string): boolean {
  if (typeof value !== 'boolean') throw new MonitoringConfigError(`${label} must be a boolean`);
  return value;
}

function requireStringArray(value: YamlValue | undefined, label: string): string[] {
  if (!Array.isArray(value)) throw new MonitoringConfigError(`${label} must be an array`);
  return value.map((item, index) => requireString(item, `${label}[${index}]`));
}

const INTERVAL_PATTERN = /^\d+(?:s|m|h|d)$/u;
const SAFE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/u;
const ALERT_REF_PATTERN = /^[a-z0-9-]+\.[A-Za-z0-9]+$/u;

export function parseIntervalMs(value: string): number {
  if (!INTERVAL_PATTERN.test(value)) throw new MonitoringConfigError(`invalid interval ${value}`);
  const amount = Number.parseInt(value.slice(0, -1), 10);
  const unit = value.at(-1);
  const multiplier =
    unit === 's' ? 1_000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return amount * multiplier;
}

function parseTarget(name: string, raw: YamlValue | undefined): MonitoringTarget {
  if (!SAFE_NAME_PATTERN.test(name)) throw new MonitoringConfigError(`invalid target name ${name}`);
  const map = requireMap(raw, `targets.${name}`);
  const kind = requireString(map.kind, `targets.${name}.kind`);
  if (kind !== 'web' && kind !== 'worker' && kind !== 'github') {
    throw new MonitoringConfigError(`targets.${name}.kind must be web|worker|github`);
  }
  const target: MonitoringTarget = {
    name,
    service: requireString(map.service, `targets.${name}.service`),
    kind,
    interval: requireString(map.interval, `targets.${name}.interval`),
    readyPath: optionalString(map.readyPath, `targets.${name}.readyPath`),
    baseUrl: optionalString(map.baseUrl, `targets.${name}.baseUrl`),
    baseUrlEnv: optionalString(map.baseUrlEnv, `targets.${name}.baseUrlEnv`),
  };
  if (kind !== 'github') {
    if (!target.readyPath?.startsWith('/')) {
      throw new MonitoringConfigError(`targets.${name}.readyPath must start with /`);
    }
    if (!target.baseUrl && !target.baseUrlEnv) {
      throw new MonitoringConfigError(`targets.${name} needs baseUrl or baseUrlEnv`);
    }
    if (target.baseUrl && !/^https:\/\//u.test(target.baseUrl)) {
      throw new MonitoringConfigError(`targets.${name}.baseUrl must use https`);
    }
  }
  return target;
}

export function parseMonitoringConfig(source: string): MonitoringConfig {
  const root = requireMap(parseYamlSubset(source), 'document');
  const runtime = requireMap(root.runtime, 'runtime');
  const auth = requireMap(root.auth, 'auth');
  const intervalsMap = requireMap(root.intervals, 'intervals');
  const timeouts = requireMap(root.timeouts, 'timeouts');
  const heartbeat = requireMap(root.heartbeat, 'heartbeat');
  const targetsMap = requireMap(root.targets, 'targets');
  const thresholdsMap = requireMap(root.thresholds, 'thresholds');
  const evidence = requireMap(root.evidence, 'evidence');
  const backup = requireMap(evidence.backup, 'evidence.backup');
  const drill = requireMap(evidence.drill, 'evidence.drill');
  const requiredChecks = requireMap(root.requiredChecks, 'requiredChecks');

  const intervals: Record<string, string> = {};
  for (const [key, value] of Object.entries(intervalsMap)) {
    const interval = requireString(value, `intervals.${key}`);
    parseIntervalMs(interval);
    intervals[key] = interval;
  }

  const targets = Object.entries(targetsMap).map(([name, raw]) => parseTarget(name, raw));
  if (targets.length === 0) throw new MonitoringConfigError('targets must not be empty');
  for (const target of targets) {
    if (!(target.interval in intervals)) {
      throw new MonitoringConfigError(
        `targets.${target.name}.interval references unknown interval ${target.interval}`,
      );
    }
  }

  const thresholds = Object.entries(thresholdsMap).map(([name, raw]) => {
    const alertRef = requireString(
      requireMap(raw, `thresholds.${name}`).alertRef,
      `thresholds.${name}.alertRef`,
    );
    if (!ALERT_REF_PATTERN.test(alertRef)) {
      throw new MonitoringConfigError(`thresholds.${name}.alertRef must be <service>.<alert>`);
    }
    return { name, alertRef };
  });

  const config: MonitoringConfig = {
    version: requireNumber(root.version, 'version'),
    owner: requireString(root.owner, 'owner'),
    repository: requireString(root.repository, 'repository'),
    runtime: {
      activeRuntime: requireString(runtime.activeRuntime, 'runtime.activeRuntime'),
      candidateRuntime: requireString(runtime.candidateRuntime, 'runtime.candidateRuntime'),
      qualificationNote: requireString(runtime.qualificationNote, 'runtime.qualificationNote'),
    },
    auth: {
      tokenEnv: requireString(auth.tokenEnv, 'auth.tokenEnv'),
      githubTokenEnv: requireString(auth.githubTokenEnv, 'auth.githubTokenEnv'),
    },
    intervals,
    timeouts: {
      readyRequestMs: requireNumber(timeouts.readyRequestMs, 'timeouts.readyRequestMs'),
      githubRequestMs: requireNumber(timeouts.githubRequestMs, 'timeouts.githubRequestMs'),
      heartbeatRequestMs: requireNumber(timeouts.heartbeatRequestMs, 'timeouts.heartbeatRequestMs'),
    },
    heartbeat: {
      urlEnv: requireString(heartbeat.urlEnv, 'heartbeat.urlEnv'),
      graceMinutes: requireNumber(heartbeat.graceMinutes, 'heartbeat.graceMinutes'),
    },
    targets,
    thresholds,
    evidence: {
      coverageMinimumPercent: requireNumber(
        evidence.coverageMinimumPercent,
        'evidence.coverageMinimumPercent',
      ),
      warmUpDays: requireNumber(evidence.warmUpDays, 'evidence.warmUpDays'),
      windowDays: requireNumber(evidence.windowDays, 'evidence.windowDays'),
      backup: {
        workflowFile: requireString(backup.workflowFile, 'evidence.backup.workflowFile'),
        warningHours: requireNumber(backup.warningHours, 'evidence.backup.warningHours'),
        maxHours: requireNumber(backup.maxHours, 'evidence.backup.maxHours'),
      },
      drill: {
        workflowFile: requireString(drill.workflowFile, 'evidence.drill.workflowFile'),
        warningDays: requireNumber(drill.warningDays, 'evidence.drill.warningDays'),
        blockDays: requireNumber(drill.blockDays, 'evidence.drill.blockDays'),
      },
      requiredWorkflowFiles: requireStringArray(
        evidence.requiredWorkflowFiles,
        'evidence.requiredWorkflowFiles',
      ),
    },
    requiredChecks: {
      branch: requireString(requiredChecks.branch, 'requiredChecks.branch'),
      enforce: requireBoolean(requiredChecks.enforce, 'requiredChecks.enforce'),
      contexts: requireStringArray(requiredChecks.contexts, 'requiredChecks.contexts'),
    },
  };

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(config.repository)) {
    throw new MonitoringConfigError('repository must be <owner>/<name>');
  }
  if (config.evidence.backup.warningHours > config.evidence.backup.maxHours) {
    throw new MonitoringConfigError('evidence.backup.warningHours must not exceed maxHours');
  }
  if (config.evidence.drill.warningDays > config.evidence.drill.blockDays) {
    throw new MonitoringConfigError('evidence.drill.warningDays must not exceed blockDays');
  }
  for (const file of config.evidence.requiredWorkflowFiles) {
    if (!/^[A-Za-z0-9_.-]+\.ya?ml$/u.test(file)) {
      throw new MonitoringConfigError(`invalid workflow file name ${file}`);
    }
  }
  return config;
}

export const DEFAULT_MONITORING_CONFIG_PATH = path.join(
  'config',
  'observability',
  'monitoring.yaml',
);

export function loadMonitoringConfig(filePath = DEFAULT_MONITORING_CONFIG_PATH): MonitoringConfig {
  return parseMonitoringConfig(readFileSync(filePath, 'utf8'));
}

/** Extracts `<service>.<alert>` keys from alerts.yaml for threshold reference validation. */
export function listAlertKeys(alertsSource: string): Set<string> {
  const root = requireMap(parseYamlSubset(alertsSource), 'alerts document');
  const services = requireMap(root.services, 'alerts.services');
  const keys = new Set<string>();
  for (const [service, alerts] of Object.entries(services)) {
    for (const alertName of Object.keys(requireMap(alerts, `alerts.services.${service}`))) {
      keys.add(`${service}.${alertName}`);
    }
  }
  return keys;
}

export function findMissingAlertRefs(
  config: MonitoringConfig,
  alertKeys: ReadonlySet<string>,
): string[] {
  return config.thresholds
    .filter((threshold) => !alertKeys.has(threshold.alertRef))
    .map((threshold) => `${threshold.name} -> ${threshold.alertRef}`);
}
