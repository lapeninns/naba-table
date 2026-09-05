import {
  londonClock,
  type AdmissionProbes,
  type DiskReading,
  type LondonClock,
  type MemoryReading,
  type PowerReading,
  type ThermalReading,
} from './probes';
import { clockMinutes, localMinuteOfDay, type OperatingConfig } from '../../contracts';
import type { AdmissionMode, Allocation } from '../types';

export interface DedicatedWindow {
  readonly timeZone: string;
  /** Inclusive start, HH:MM, in `timeZone`. */
  readonly start: string;
  /** Exclusive end, HH:MM; the window may wrap midnight. */
  readonly end: string;
}

export interface AdmissionPolicy {
  readonly requireAcPower: boolean;
  readonly minFreeMemoryPercent: number;
  readonly minCpuSpeedLimit: number;
  readonly minFreeDiskGiB: number;
  readonly window: DedicatedWindow;
  readonly allocations: Readonly<Record<AdmissionMode, Allocation>>;
}

export const DEFAULT_ALLOCATIONS: Readonly<Record<AdmissionMode, Allocation>> = {
  normal: { cpus: 4, memoryGiB: 8 },
  dedicated: { cpus: 8, memoryGiB: 16 },
};

export const DEFAULT_ADMISSION_POLICY: AdmissionPolicy = {
  requireAcPower: true,
  minFreeMemoryPercent: 15,
  minCpuSpeedLimit: 80,
  minFreeDiskGiB: 20,
  window: { timeZone: 'Europe/London', start: '22:00', end: '07:00' },
  allocations: DEFAULT_ALLOCATIONS,
};

/** Derives the window and disk floor from `config/ci/operating-config.json`. */
export function admissionPolicyFromOperatingConfig(
  config: OperatingConfig,
  overrides: Partial<Omit<AdmissionPolicy, 'window' | 'minFreeDiskGiB'>> = {},
): AdmissionPolicy {
  return {
    ...DEFAULT_ADMISSION_POLICY,
    ...overrides,
    minFreeDiskGiB: config.disk.minFreeGiB,
    window: {
      timeZone: config.timezone,
      start: config.dedicatedWindow.start,
      end: config.dedicatedWindow.end,
    },
  };
}

export type ProbeOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export interface AdmissionReadings {
  readonly power: ProbeOutcome<PowerReading>;
  readonly memory: ProbeOutcome<MemoryReading>;
  readonly thermal: ProbeOutcome<ThermalReading>;
  readonly disk: ProbeOutcome<DiskReading>;
}

export interface AdmissionDecision {
  readonly admitted: boolean;
  readonly mode: AdmissionMode;
  readonly allocation: Allocation;
  readonly reasons: readonly string[];
  readonly clock: LondonClock;
}

export function isInDedicatedWindow(minuteOfDay: number, window: DedicatedWindow): boolean {
  const start = clockMinutes(window.start);
  const end = clockMinutes(window.end);
  if (start === end) return false;
  if (start < end) return minuteOfDay >= start && minuteOfDay < end;
  return minuteOfDay >= start || minuteOfDay < end;
}

export function modeFor(
  now: Date,
  window: DedicatedWindow,
): { readonly mode: AdmissionMode; readonly clock: LondonClock } {
  const clock = londonClock(now, window.timeZone);
  const minuteOfDay = localMinuteOfDay(now, window.timeZone);
  return { mode: isInDedicatedWindow(minuteOfDay, window) ? 'dedicated' : 'normal', clock };
}

function probeReason<T>(name: string, outcome: ProbeOutcome<T>): string | null {
  return outcome.ok ? null : `${name} probe failed: ${outcome.error}`;
}

/**
 * Fails closed: any probe failure defers admission. Mode/allocation are still
 * computed so the controller can report them, but the caller must only apply
 * an allocation change to the next dispatched job.
 */
export function evaluateAdmission(
  readings: AdmissionReadings,
  now: Date,
  policy: AdmissionPolicy = DEFAULT_ADMISSION_POLICY,
): AdmissionDecision {
  const { mode, clock } = modeFor(now, policy.window);
  const reasons: string[] = [];
  for (const [name, outcome] of Object.entries(readings) as [string, ProbeOutcome<unknown>][]) {
    const reason = probeReason(name, outcome);
    if (reason) reasons.push(reason);
  }
  if (readings.power.ok && policy.requireAcPower && readings.power.value.source !== 'ac') {
    reasons.push(`host is on ${readings.power.value.source} power; AC power required`);
  }
  if (readings.memory.ok && readings.memory.value.freePercent < policy.minFreeMemoryPercent) {
    reasons.push(
      `free memory ${readings.memory.value.freePercent}% below ${policy.minFreeMemoryPercent}%`,
    );
  }
  if (readings.thermal.ok && readings.thermal.value.cpuSpeedLimit < policy.minCpuSpeedLimit) {
    reasons.push(
      `thermal CPU speed limit ${readings.thermal.value.cpuSpeedLimit} below ${policy.minCpuSpeedLimit}`,
    );
  }
  if (readings.disk.ok && readings.disk.value.availableGiB < policy.minFreeDiskGiB) {
    reasons.push(
      `free disk ${readings.disk.value.availableGiB.toFixed(1)} GiB below ${policy.minFreeDiskGiB} GiB`,
    );
  }
  return {
    admitted: reasons.length === 0,
    mode,
    allocation: policy.allocations[mode],
    reasons,
    clock,
  };
}

async function capture<T>(probe: () => Promise<T>): Promise<ProbeOutcome<T>> {
  try {
    return { ok: true, value: await probe() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function collectReadings(probes: AdmissionProbes): Promise<AdmissionReadings> {
  const [power, memory, thermal, disk] = await Promise.all([
    capture(() => probes.power()),
    capture(() => probes.memory()),
    capture(() => probes.thermal()),
    capture(() => probes.disk()),
  ]);
  return { power, memory, thermal, disk };
}

export type AdmissionEvaluator = () => Promise<AdmissionDecision>;

export function createAdmissionEvaluator(input: {
  readonly probes: AdmissionProbes;
  readonly policy?: AdmissionPolicy;
  readonly now?: () => Date;
}): AdmissionEvaluator {
  const now = input.now ?? (() => new Date());
  return async () => evaluateAdmission(await collectReadings(input.probes), now(), input.policy);
}
