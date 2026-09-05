import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  findMissingAlertRefs,
  listAlertKeys,
  loadMonitoringConfig,
  parseIntervalMs,
  parseMonitoringConfig,
} from '@/scripts/monitoring/config';
import { YamlSubsetError, parseYamlSubset } from '@/scripts/monitoring/yaml-subset';

const monitoringSource = readFileSync('config/observability/monitoring.yaml', 'utf8');
const alertsSource = readFileSync('config/observability/alerts.yaml', 'utf8');

describe('yaml subset parser', () => {
  it('parses nested maps, sequences, inline arrays, quotes, comments, and scalars', () => {
    expect(
      parseYamlSubset(`
# leading comment
version: 1
name: 'single # not a comment'
title: "double \\"quoted\\""
flag: true
nothing: null
ratio: 0.5
negative: -3
plain: hello world   # trailing comment
list: [a, "b", 3, true]
empty: []
nested:
  child:
    deep: value
  seq:
    - one
    - 2
  maps:
    - key: a
      other: 1
    - key: b
`),
    ).toEqual({
      version: 1,
      name: 'single # not a comment',
      title: 'double "quoted"',
      flag: true,
      nothing: null,
      ratio: 0.5,
      negative: -3,
      plain: 'hello world',
      list: ['a', 'b', 3, true],
      empty: [],
      nested: {
        child: { deep: 'value' },
        seq: ['one', 2],
        maps: [{ key: 'a', other: 1 }, { key: 'b' }],
      },
    });
  });

  it('rejects tabs, duplicate keys, flow maps, and bad indentation with line numbers', () => {
    expect(() => parseYamlSubset('a:\n\tb: 1')).toThrow(YamlSubsetError);
    expect(() => parseYamlSubset('a: 1\na: 2')).toThrow(/duplicate key "a" \(line 2\)/u);
    expect(() => parseYamlSubset('a: {b: 1}')).toThrow(/flow maps/u);
    expect(() => parseYamlSubset('a: [1, [2]]')).toThrow(/nested flow/u);
    expect(() => parseYamlSubset('a: 1\n  b: 2')).toThrow(/unexpected indentation/u);
    expect(() => parseYamlSubset('  a: 1')).toThrow(/column 0/u);
    expect(() => parseYamlSubset('a: "unterminated')).toThrow(/unterminated/u);
    expect(parseYamlSubset('')).toBeNull();
  });
});

describe('monitoring.yaml contract', () => {
  const config = loadMonitoringConfig();

  it('records the reviewed plan values', () => {
    expect(config.version).toBe(1);
    expect(config.repository).toBe('lapeninns/nabatable');
    expect(config.runtime).toMatchObject({ activeRuntime: 'node22', candidateRuntime: 'node24' });
    expect(config.runtime.qualificationNote.length).toBeGreaterThan(20);
    expect(config.auth).toEqual({
      tokenEnv: 'MONITORING_TOKEN',
      githubTokenEnv: 'MONITORING_GITHUB_TOKEN',
    });
    expect(config.intervals).toEqual({ external: '5m', worker: '5m', github: '1h' });
    expect(config.heartbeat).toEqual({ urlEnv: 'MONITORING_HEARTBEAT_URL', graceMinutes: 75 });
    expect(config.evidence).toMatchObject({
      coverageMinimumPercent: 99,
      warmUpDays: 14,
      windowDays: 30,
      backup: { workflowFile: 'backup.yml', warningHours: 18, maxHours: 24 },
      drill: { workflowFile: 'recovery-drill.yml', warningDays: 21, blockDays: 30 },
    });
    expect(config.evidence.requiredWorkflowFiles).toEqual(
      expect.arrayContaining([
        'backup.yml',
        'recovery-drill.yml',
        'operational-verification.yml',
        'release-gate.yml',
      ]),
    );
    expect(config.requiredChecks).toEqual({
      branch: 'main',
      enforce: true,
      contexts: ['Release gate', 'Local CI / pr'],
    });
  });

  it('keeps monitoring independent of execution workflows retired in Phase 4', () => {
    for (const legacy of [
      'test-suite.yml',
      'e2e-smoke.yml',
      'test-stability.yml',
      'shadcn-primitives.yml',
    ]) {
      expect(config.evidence.requiredWorkflowFiles).not.toContain(legacy);
    }
    expect(config.evidence.requiredWorkflowFiles).toContain('release-gate.yml');
  });

  it('declares the web target, all four Workers, and the operational control plane audit', () => {
    expect(config.targets.map((target) => [target.name, target.service, target.kind])).toEqual([
      ['web', 'nabatable-web', 'web'],
      ['booking-short-links', 'booking-short-links', 'worker'],
      ['email-queue-gateway', 'email-queue-gateway', 'worker'],
      ['sms-summary-gateway', 'sms-summary-gateway', 'worker'],
      ['operational-control-worker', 'operational-control', 'worker'],
      ['operational-control', 'operational-control', 'github'],
    ]);
    const web = config.targets.find((target) => target.name === 'web');
    expect(web).toMatchObject({ readyPath: '/api/ready', interval: 'external' });
    for (const worker of config.targets.filter((target) => target.kind === 'worker')) {
      expect(worker.readyPath).toBe('/ready');
      expect(worker.interval).toBe('worker');
      expect(worker.baseUrlEnv).toMatch(/^MONITORING_[A-Z_]+_BASE_URL$/u);
    }
    const emailGateway = config.targets.find((target) => target.name === 'email-queue-gateway');
    expect(emailGateway?.baseUrl).toBeNull();
    // The control-plane Worker has no committed hostname either: env-only, fails closed until set.
    const controlPlane = config.targets.find(
      (target) => target.name === 'operational-control-worker',
    );
    expect(controlPlane).toMatchObject({
      baseUrl: null,
      baseUrlEnv: 'MONITORING_OPERATIONAL_CONTROL_BASE_URL',
      readyPath: '/ready',
    });
  });

  it('references alerts.yaml keys by alertRef instead of duplicating thresholds', () => {
    const alertKeys = listAlertKeys(alertsSource);
    expect(config.thresholds.map((threshold) => threshold.name)).toEqual([
      'queueAge',
      'deadLetterQueue',
      'latency',
      'failureRate',
      'workerAvailability',
    ]);
    expect(findMissingAlertRefs(config, alertKeys)).toEqual([]);
    expect(findMissingAlertRefs(config, new Set(['nabatable-web.latency']))).toContain(
      'queueAge -> email-queue-gateway.queueHealth',
    );
    expect(monitoringSource).not.toMatch(/dlq_depth|oldest_job_age|http_p95_ms|failure_rate >/u);
  });

  it('parses intervals into milliseconds', () => {
    expect(parseIntervalMs('5m')).toBe(300_000);
    expect(parseIntervalMs('1h')).toBe(3_600_000);
    expect(parseIntervalMs('30s')).toBe(30_000);
    expect(parseIntervalMs('2d')).toBe(172_800_000);
    expect(() => parseIntervalMs('5 minutes')).toThrow(/invalid interval/u);
  });

  it('fails loudly on malformed documents', () => {
    const mutate = (from: string, to: string): string => {
      if (!monitoringSource.includes(from)) throw new Error(`fixture missing ${from}`);
      return monitoringSource.replace(from, to);
    };
    expect(() => parseMonitoringConfig(mutate('warningHours: 18', 'warningHours: 30'))).toThrow(
      /warningHours must not exceed maxHours/u,
    );
    expect(() => parseMonitoringConfig(mutate('warningDays: 21', 'warningDays: 45'))).toThrow(
      /warningDays must not exceed blockDays/u,
    );
    expect(() =>
      parseMonitoringConfig(
        mutate('baseUrl: https://go.nabatable.com', 'baseUrl: http://go.nabatable.com'),
      ),
    ).toThrow(/must use https/u);
    expect(() => parseMonitoringConfig(mutate('interval: external', 'interval: daily'))).toThrow(
      /unknown interval daily/u,
    );
    expect(() =>
      parseMonitoringConfig(mutate('alertRef: nabatable-web.latency', 'alertRef: latency')),
    ).toThrow(/must be <service>.<alert>/u);
    expect(() => parseMonitoringConfig(mutate('enforce: true', 'enforce: yes'))).toThrow(
      /enforce must be a boolean/u,
    );
    expect(() =>
      parseMonitoringConfig(mutate('repository: lapeninns/nabatable', 'repository: nope')),
    ).toThrow(/repository must be <owner>\/<name>/u);
    expect(() => parseMonitoringConfig('version: 1')).toThrow(/runtime must be a map/u);
  });
});
