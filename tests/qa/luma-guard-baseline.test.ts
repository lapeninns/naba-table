import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

type LumaBaseline = {
  counts?: {
    byFileKind?: Record<string, number>;
    bySeverity?: Record<string, number>;
  };
  version?: number;
};

describe('Luma guard baseline ratchet', () => {
  it('pins the current semantic-token migration inventory by file and finding kind', () => {
    const baseline = JSON.parse(
      readFileSync('config/qa/luma-baseline.json', 'utf8'),
    ) as LumaBaseline;

    expect(baseline.version).toBe(1);
    expect(baseline.counts?.bySeverity?.exception).toBeGreaterThan(0);
    expect(baseline.counts?.byFileKind).toMatchObject({
      'exception::hardcoded-palette-utility::components/TimeSlider.tsx': expect.any(Number),
    });
  });

  it('passes strict mode when findings do not exceed the pinned baseline', () => {
    const result = spawnSync(
      'node',
      [
        'scripts/check-luma-compliance.mjs',
        '--fail-on=exception',
        '--baseline=config/qa/luma-baseline.json',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('Passed Luma baseline ratchet for --fail-on=exception');
  });
});
