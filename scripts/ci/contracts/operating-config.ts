import { readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import type { CiLimits } from './profile';
import { PositiveIntSchema } from './primitives';
import { assertWith, validateWith, type ValidationResult } from './validation';

export const OPERATING_CONFIG_PATH = 'config/ci/operating-config.json';

const ClockTimeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u, 'expected a 24h clock time HH:MM');

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function clockMinutes(clock: string): number {
  const [hours, minutes] = clock.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export const OperatingConfigSchema = z
  .strictObject({
    version: z.literal(1),
    timezone: z.string().refine(isValidTimeZone, 'expected an IANA time zone'),
    /** Window in which dedicated (larger) resource limits and nightly work are allowed. */
    dedicatedWindow: z.strictObject({ start: ClockTimeSchema, end: ClockTimeSchema }),
    nightlyStart: ClockTimeSchema,
    disk: z.strictObject({
      /** Below this the controller refuses new leases. */
      minFreeGiB: PositiveIntSchema,
      /** Total disk the CI VMs, caches and evidence may consume together. */
      ciCapGiB: PositiveIntSchema,
    }),
    retention: z.strictObject({
      logs: z.strictObject({ days: PositiveIntSchema, maxGiB: PositiveIntSchema }),
      evidence: z.strictObject({ days: PositiveIntSchema }),
    }),
    polling: z.strictObject({
      intervalSeconds: PositiveIntSchema,
      jitterSeconds: z.number().int().nonnegative(),
    }),
    heartbeat: z.strictObject({ alertAfterMinutes: PositiveIntSchema }),
    fallback: z.strictObject({ eligibilityAfterMinutes: PositiveIntSchema }),
  })
  .superRefine((config, ctx) => {
    const { start, end } = config.dedicatedWindow;
    if (start === end) {
      ctx.addIssue({
        code: 'custom',
        path: ['dedicatedWindow'],
        message: 'dedicated window must not be empty',
      });
    }
    if (!isWithinWindow(clockMinutes(config.nightlyStart), start, end)) {
      ctx.addIssue({
        code: 'custom',
        path: ['nightlyStart'],
        message: 'nightly start must fall inside the dedicated window',
      });
    }
    if (config.polling.jitterSeconds >= config.polling.intervalSeconds) {
      ctx.addIssue({
        code: 'custom',
        path: ['polling', 'jitterSeconds'],
        message: 'jitter must be smaller than the poll interval',
      });
    }
    if (config.heartbeat.alertAfterMinutes * 60 <= config.polling.intervalSeconds * 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['heartbeat', 'alertAfterMinutes'],
        message: 'heartbeat alert must allow at least two missed polls',
      });
    }
    if (config.fallback.eligibilityAfterMinutes < config.heartbeat.alertAfterMinutes) {
      ctx.addIssue({
        code: 'custom',
        path: ['fallback', 'eligibilityAfterMinutes'],
        message: 'fallback eligibility cannot precede the heartbeat alert',
      });
    }
    if (config.retention.evidence.days < config.retention.logs.days) {
      ctx.addIssue({
        code: 'custom',
        path: ['retention', 'evidence', 'days'],
        message: 'evidence must be retained at least as long as logs',
      });
    }
  });
export type OperatingConfig = z.infer<typeof OperatingConfigSchema>;

function isWithinWindow(minuteOfDay: number, start: string, end: string): boolean {
  const startMinutes = clockMinutes(start);
  const endMinutes = clockMinutes(end);
  if (startMinutes < endMinutes) {
    return minuteOfDay >= startMinutes && minuteOfDay < endMinutes;
  }
  // Window crosses midnight (e.g. 22:00 -> 06:00).
  return minuteOfDay >= startMinutes || minuteOfDay < endMinutes;
}

/** Minute of the day for `now` in the configured time zone (DST-aware). */
export function localMinuteOfDay(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

export function isWithinDedicatedWindow(now: Date, config: OperatingConfig): boolean {
  return isWithinWindow(
    localMinuteOfDay(now, config.timezone),
    config.dedicatedWindow.start,
    config.dedicatedWindow.end,
  );
}

export function isFallbackEligible(
  lastHeartbeatAt: Date,
  now: Date,
  config: OperatingConfig,
): boolean {
  const silentMinutes = (now.getTime() - lastHeartbeatAt.getTime()) / 60_000;
  return silentMinutes >= config.fallback.eligibilityAfterMinutes;
}

/** Poll delay with uniform jitter; `random` is injectable for tests. */
export function nextPollDelayMs(
  config: OperatingConfig,
  random: () => number = Math.random,
): number {
  const jitter = Math.floor(random() * (config.polling.jitterSeconds + 1));
  return (config.polling.intervalSeconds + jitter) * 1_000;
}

export function assertLimitsWithinOperatingConfig(limits: CiLimits, config: OperatingConfig): void {
  if (limits.diskGiB > config.disk.ciCapGiB) {
    throw new Error(
      `profile disk allocation ${limits.diskGiB} GiB exceeds the CI disk cap ${config.disk.ciCapGiB} GiB`,
    );
  }
}

export function validateOperatingConfig(input: unknown): ValidationResult<OperatingConfig> {
  return validateWith(OperatingConfigSchema, input);
}

export function loadOperatingConfig(
  repositoryRoot: string = process.cwd(),
  relativePath: string = OPERATING_CONFIG_PATH,
): OperatingConfig {
  const raw = readFileSync(path.resolve(repositoryRoot, relativePath), 'utf8');
  return assertWith(OperatingConfigSchema, JSON.parse(raw), `operating config ${relativePath}`);
}
