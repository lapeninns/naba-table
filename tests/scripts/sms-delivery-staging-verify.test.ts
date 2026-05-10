import { describe, expect, it } from 'vitest';

import {
  buildStagingVerifyReport,
  stagingVerifyStepsNoPersistEnv,
  stagingVerifyStepsWithPulledEnv,
} from '@/scripts/sms-delivery-staging-verify';

describe('staging SMS delivery verifier', () => {
  it('runs safe gates in the expected order', () => {
    expect(stagingVerifyStepsWithPulledEnv.map((step) => step.name)).toEqual([
      'pull branch-effective Vercel Preview env',
      'strict branch staging readiness',
      'Preview deployment freshness',
      'protected Preview webhook route/config',
    ]);
  });

  it('reports the first required failing gate as a blocker', () => {
    const report = buildStagingVerifyReport([
      {
        name: 'pull branch-effective Vercel Preview env',
        exitCode: 0,
        ok: true,
        optional: false,
      },
      {
        name: 'strict branch staging readiness',
        exitCode: 1,
        ok: false,
        optional: false,
      },
    ]);

    expect(report.ok).toBe(false);
    expect(report.mode).toBe('pulled-env');
    expect(report.blockers).toEqual(['strict branch staging readiness failed with exit code 1.']);
  });

  it('supports a no-persist env mode', () => {
    expect(stagingVerifyStepsNoPersistEnv.map((step) => step.name)).toEqual([
      'Vercel Preview SMS env metadata',
      'Preview deployment freshness',
      'protected Preview webhook route/config',
    ]);
    expect(stagingVerifyStepsNoPersistEnv[0]?.args).toEqual([
      'run',
      'sms:delivery:env:preview:metadata',
    ]);

    const report = buildStagingVerifyReport(
      [
        {
          name: 'Vercel Preview SMS env metadata',
          exitCode: 1,
          ok: false,
          optional: false,
        },
      ],
      'no-persist-env',
    );

    expect(report.mode).toBe('no-persist-env');
    expect(report.blockers).toEqual(['Vercel Preview SMS env metadata failed with exit code 1.']);
  });
});
