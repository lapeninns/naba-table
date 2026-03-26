import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type VercelCronConfig = {
  path: string;
  schedule: string;
};

type VercelConfig = {
  crons?: VercelCronConfig[];
};

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
});
