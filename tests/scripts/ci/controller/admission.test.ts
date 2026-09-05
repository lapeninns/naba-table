import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ADMISSION_POLICY,
  admissionPolicyFromOperatingConfig,
  collectReadings,
  createAdmissionEvaluator,
  evaluateAdmission,
  isInDedicatedWindow,
  modeFor,
  type AdmissionReadings,
} from '@/scripts/ci/controller/admission/policy';
import {
  ProbeParseError,
  createSystemProbes,
  londonClock,
  parseDf,
  parseMemoryPressure,
  parsePmsetBattery,
  parsePmsetThermal,
  parseVmStat,
  type AdmissionProbes,
} from '@/scripts/ci/controller/admission/probes';

import type { OperatingConfig } from '@/scripts/ci/contracts';

const PMSET_AC = `Now drawing from 'AC Power'\n -InternalBattery-0 (id=1234)\t100%; charged; 0:00 remaining present: true\n`;
const PMSET_BATTERY = `Now drawing from 'Battery Power'\n -InternalBattery-0 (id=1234)\t63%; discharging; 4:10 remaining present: true\n`;
const MEMORY_PRESSURE = `The system has 34359738368 (8388608 pages with a page size of 4096).\n\nStats:\n...\nSystem-wide memory free percentage: 42%\n`;
const VM_STAT = `Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages free:                               100000.\nPages active:                             300000.\nPages inactive:                           200000.\nPages speculative:                         50000.\nPages throttled:                               0.\nPages wired down:                         250000.\nPages purgeable:                           10000.\nPages occupied by compressor:             100000.\n`;
const THERM_OK = `Note: No thermal warning level has been recorded\nNote: No performance warning level has been recorded\nCPU_Scheduler_Limit \t= 100\nCPU_Available_CPUs \t= 12\nCPU_Speed_Limit \t= 100\n`;
const THERM_HOT = `CPU_Scheduler_Limit \t= 60\nCPU_Available_CPUs \t= 8\nCPU_Speed_Limit \t= 55\n`;
const DF = `Filesystem    1024-blocks       Used Available Capacity iused      ifree %iused  Mounted on\n/dev/disk3s5   971350180  610000000 251658240    71% 1200000 2516582400    0%   /System/Volumes/Data\n`;

const okReadings = (): AdmissionReadings => ({
  power: { ok: true, value: { source: 'ac', batteryPercent: 100 } },
  memory: { ok: true, value: { freePercent: 40, origin: 'memory_pressure' } },
  thermal: { ok: true, value: { cpuSpeedLimit: 100, availableCpus: 12, schedulerLimit: 100 } },
  disk: { ok: true, value: { availableGiB: 300, mountPoint: '/' } },
});

const operatingConfig: OperatingConfig = {
  version: 1,
  timezone: 'Europe/London',
  dedicatedWindow: { start: '00:30', end: '06:30' },
  nightlyStart: '00:45',
  disk: { minFreeGiB: 100, ciCapGiB: 120 },
  retention: { logs: { days: 7, maxGiB: 10 }, evidence: { days: 14 } },
  polling: { intervalSeconds: 30, jitterSeconds: 10 },
  heartbeat: { alertAfterMinutes: 15 },
  fallback: { eligibilityAfterMinutes: 60 },
};

describe('admission probes (parsers)', () => {
  it('parses pmset battery output', () => {
    expect(parsePmsetBattery(PMSET_AC)).toEqual({ source: 'ac', batteryPercent: 100 });
    expect(parsePmsetBattery(PMSET_BATTERY)).toEqual({ source: 'battery', batteryPercent: 63 });
    expect(() => parsePmsetBattery('garbage')).toThrow(ProbeParseError);
  });

  it('parses memory_pressure and vm_stat output', () => {
    expect(parseMemoryPressure(MEMORY_PRESSURE)).toEqual({
      freePercent: 42,
      origin: 'memory_pressure',
    });
    const vm = parseVmStat(VM_STAT);
    expect(vm.origin).toBe('vm_stat');
    // (free + inactive + speculative) / total = 350000 / 1000000
    expect(vm.freePercent).toBe(35);
    expect(() => parseVmStat('nothing')).toThrow(ProbeParseError);
  });

  it('parses pmset thermal output', () => {
    expect(parsePmsetThermal(THERM_OK).cpuSpeedLimit).toBe(100);
    expect(parsePmsetThermal(THERM_HOT)).toEqual({
      cpuSpeedLimit: 55,
      availableCpus: 8,
      schedulerLimit: 60,
    });
    expect(
      parsePmsetThermal('Note: No thermal warning level has been recorded').cpuSpeedLimit,
    ).toBe(100);
    expect(() => parsePmsetThermal('')).toThrow(ProbeParseError);
  });

  it('parses df -k output into GiB', () => {
    const disk = parseDf(DF);
    expect(disk.availableGiB).toBeCloseTo(240, 5);
    expect(disk.mountPoint).toBe('/System/Volumes/Data');
    expect(() => parseDf('Filesystem\n')).toThrow(ProbeParseError);
  });

  it('system probes fall back from memory_pressure to vm_stat', async () => {
    const calls: string[] = [];
    const probes = createSystemProbes(async (command, args) => {
      calls.push([command, ...args].join(' '));
      if (command === 'memory_pressure') throw new Error('not available');
      if (command === 'vm_stat') return VM_STAT;
      if (command === 'pmset' && args[1] === 'batt') return PMSET_AC;
      if (command === 'pmset' && args[1] === 'therm') return THERM_OK;
      if (command === 'df') return DF;
      throw new Error(`unexpected ${command}`);
    }, '/Users/nabatable-ci');
    const readings = await collectReadings(probes);
    expect(readings.memory).toEqual({
      ok: true,
      value: { freePercent: 35, origin: 'vm_stat' },
    });
    expect(readings.power.ok && readings.power.value.source).toBe('ac');
    expect(calls).toContain('df -k /Users/nabatable-ci');
  });
});

describe('admission policy', () => {
  const daytime = new Date('2026-09-04T10:00:00.000Z'); // 11:00 BST
  const night = new Date('2026-09-04T01:00:00.000Z'); // 02:00 BST

  it('admits when every probe is healthy', () => {
    const decision = evaluateAdmission(okReadings(), daytime);
    expect(decision.admitted).toBe(true);
    expect(decision.reasons).toEqual([]);
    expect(decision.mode).toBe('normal');
    expect(decision.allocation).toEqual(DEFAULT_ADMISSION_POLICY.allocations.normal);
  });

  it('defers on battery power, low memory, thermal throttling and low disk', () => {
    const readings = okReadings();
    const decision = evaluateAdmission(
      {
        power: { ok: true, value: { source: 'battery', batteryPercent: 80 } },
        memory: { ok: true, value: { freePercent: 5, origin: 'vm_stat' } },
        thermal: { ok: true, value: { cpuSpeedLimit: 50, availableCpus: 4, schedulerLimit: 50 } },
        disk: { ok: true, value: { availableGiB: 3, mountPoint: '/' } },
      },
      daytime,
    );
    expect(decision.admitted).toBe(false);
    expect(decision.reasons).toHaveLength(4);
    expect(decision.reasons.join('\n')).toMatch(/battery/u);
    expect(decision.reasons.join('\n')).toMatch(/free memory/u);
    expect(decision.reasons.join('\n')).toMatch(/thermal/u);
    expect(decision.reasons.join('\n')).toMatch(/free disk/u);
    expect(evaluateAdmission(readings, daytime).admitted).toBe(true);
  });

  it('defers (fails closed) when any probe fails', () => {
    const readings = okReadings();
    const decision = evaluateAdmission(
      { ...readings, disk: { ok: false, error: 'df exited 1' } },
      daytime,
    );
    expect(decision.admitted).toBe(false);
    expect(decision.reasons).toEqual(['disk probe failed: df exited 1']);
  });

  it('computes the dedicated window in Europe/London, wrapping midnight and DST aware', () => {
    expect(modeFor(night, DEFAULT_ADMISSION_POLICY.window).mode).toBe('dedicated');
    expect(modeFor(daytime, DEFAULT_ADMISSION_POLICY.window).mode).toBe('normal');
    expect(isInDedicatedWindow(23 * 60, DEFAULT_ADMISSION_POLICY.window)).toBe(true);
    expect(isInDedicatedWindow(7 * 60, DEFAULT_ADMISSION_POLICY.window)).toBe(false);
    // 00:30Z in July is 01:30 BST; in January it is 00:30 GMT.
    expect(londonClock(new Date('2026-07-01T00:30:00.000Z')).hour).toBe(1);
    expect(londonClock(new Date('2026-01-15T00:30:00.000Z')).hour).toBe(0);
    expect(londonClock(new Date('2026-07-01T00:30:00.000Z')).isoDate).toBe('2026-07-01');
    expect(londonClock(new Date('2026-07-01T23:30:00.000Z')).isoDate).toBe('2026-07-02');
  });

  it('derives window and disk floor from the operating config', () => {
    const policy = admissionPolicyFromOperatingConfig(operatingConfig);
    expect(policy.window).toEqual({ timeZone: 'Europe/London', start: '00:30', end: '06:30' });
    expect(policy.minFreeDiskGiB).toBe(100);
    const decision = evaluateAdmission(okReadings(), night, policy);
    expect(decision.mode).toBe('dedicated');
    expect(decision.allocation).toEqual(policy.allocations.dedicated);
    expect(evaluateAdmission(okReadings(), daytime, policy).admitted).toBe(true);
    const lowDisk = evaluateAdmission(
      { ...okReadings(), disk: { ok: true, value: { availableGiB: 90, mountPoint: '/' } } },
      daytime,
      policy,
    );
    expect(lowDisk.admitted).toBe(false);
  });

  it('evaluator wires probes, policy and clock together', async () => {
    const probes: AdmissionProbes = {
      power: async () => ({ source: 'ac', batteryPercent: null }),
      memory: async () => ({ freePercent: 50, origin: 'memory_pressure' }),
      thermal: async () => ({ cpuSpeedLimit: 100, availableCpus: 8, schedulerLimit: 100 }),
      disk: async () => {
        throw new Error('disk unavailable');
      },
    };
    const evaluate = createAdmissionEvaluator({ probes, now: () => night });
    const decision = await evaluate();
    expect(decision.admitted).toBe(false);
    expect(decision.mode).toBe('dedicated');
    expect(decision.reasons).toEqual(['disk probe failed: disk unavailable']);
    expect(decision.clock.hour).toBe(2);
  });
});
