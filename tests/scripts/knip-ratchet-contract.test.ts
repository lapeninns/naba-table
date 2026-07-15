import { describe, expect, it } from 'vitest';

import { evaluateKnipRatchet } from '@/scripts/quality/knip-ratchet-contract';

describe('Knip quality ratchet', () => {
  it('accepts findings at or below the explicit legacy baseline', () => {
    expect(
      evaluateKnipRatchet(
        { files: 100, dependencies: 10, devDependencies: 12, unlisted: 2, binaries: 2, cycles: 0 },
        { files: 104, dependencies: 10, devDependencies: 13, unlisted: 2, binaries: 2, cycles: 0 },
      ),
    ).toEqual([]);
  });

  it('reports every category that increases', () => {
    expect(
      evaluateKnipRatchet(
        { files: 105, dependencies: 10, devDependencies: 14, unlisted: 3, binaries: 2, cycles: 1 },
        { files: 104, dependencies: 10, devDependencies: 13, unlisted: 2, binaries: 2, cycles: 0 },
      ),
    ).toEqual([
      'files increased from 104 to 105',
      'devDependencies increased from 13 to 14',
      'unlisted increased from 2 to 3',
      'cycles increased from 0 to 1',
    ]);
  });
});
