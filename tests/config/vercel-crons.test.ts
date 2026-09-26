import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type VercelCronConfig = {
  readonly path: string;
  readonly schedule: string;
};

type VercelConfig = {
  readonly crons?: readonly VercelCronConfig[];
};

const ACTIVE_DUAL_SYNC_CRONS = [
  {
    path: '/api/cron/dual-sync/auto-export',
    schedule: '*/30 * * * *',
  },
  {
    path: '/api/cron/dual-sync/queue',
    schedule: '*/5 * * * *',
  },
  {
    path: '/api/cron/dual-sync/core-outbox',
    schedule: '*/5 * * * *',
  },
  {
    path: '/api/cron/dual-sync/health',
    schedule: '0 * * * *',
  },
  {
    path: '/api/cron/dual-sync/refresh',
    schedule: '*/15 * * * *',
  },
  {
    path: '/api/cron/dual-sync/notifications',
    schedule: '*/15 * * * *',
  },
  {
    path: '/api/cron/dual-sync/request-log-retention',
    schedule: '30 2 * * *',
  },
] as const satisfies readonly VercelCronConfig[];

const DUAL_SYNC_CRON_PREFIX = '/api/cron/dual-sync/';

function normalizeCrons(crons: readonly VercelCronConfig[]): VercelCronConfig[] {
  return [...crons].sort(
    (left, right) =>
      left.path.localeCompare(right.path) || left.schedule.localeCompare(right.schedule),
  );
}

function readVercelConfig(): VercelConfig {
  const configPath = path.resolve(process.cwd(), 'vercel.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as VercelConfig;
}

describe('vercel cron configuration', () => {
  it('keeps the email queue drain route scheduled', () => {
    const config = readVercelConfig();

    expect(config.crons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/api/cron/process-emails',
          schedule: '*/5 * * * *',
        }),
      ]),
    );
  });

  it('keeps the booking auto-complete route scheduled', () => {
    const config = readVercelConfig();

    expect(config.crons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/api/cron/auto-complete-bookings',
          schedule: '*/15 * * * *',
        }),
      ]),
    );
  });

  it('schedules the capacity outbox drain exactly once', () => {
    const config = readVercelConfig();
    const matchingCrons =
      config.crons?.filter((cron) => cron.path === '/api/cron/capacity-outbox') ?? [];

    expect(matchingCrons).toEqual([{ path: '/api/cron/capacity-outbox', schedule: '*/5 * * * *' }]);
  });

  it.each(ACTIVE_DUAL_SYNC_CRONS)('schedules $path exactly once at $schedule', (expected) => {
    const config = readVercelConfig();
    const matchingCrons = config.crons?.filter((cron) => cron.path === expected.path) ?? [];

    expect(matchingCrons).toEqual([expected]);
  });

  it('contains exactly the active dual-sync cron set without duplicates or omissions', () => {
    const config = readVercelConfig();
    const configuredDualSyncCrons =
      config.crons?.filter((cron) => cron.path.startsWith(DUAL_SYNC_CRON_PREFIX)) ?? [];

    expect(normalizeCrons(configuredDualSyncCrons)).toEqual(normalizeCrons(ACTIVE_DUAL_SYNC_CRONS));
  });
});
