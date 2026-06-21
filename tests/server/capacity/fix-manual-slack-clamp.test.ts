import { afterEach, describe, expect, it, vi } from 'vitest';

// The runtime override for manual slack is otherwise unbounded. Drive it through a
// mutable holder so each case can configure getManualAssignmentMaxSlack() and assert
// the clamp applied at the resolveManualSlackBudget call site (#12).
let manualSlackOverride: number | null = null;

vi.mock('@/server/runtime-policy', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getManualAssignmentMaxSlack: () => manualSlackOverride,
  };
});

import { resolveManualSlackBudget } from '@/server/capacity/table-assignment/manual-checks';

// DEFAULT_MANUAL_SLACK_BUDGET = 4; MAX_MANUAL_SLACK_BUDGET = 4 * 6 = 24 (kept in sync
// with manual-checks.ts). The fallback (maxOverage) default is 4.
const MAX_MANUAL_SLACK_BUDGET = 24;

describe('resolveManualSlackBudget clamping (regression #12)', () => {
  afterEach(() => {
    manualSlackOverride = null;
  });

  it('passes through an in-range override unchanged', () => {
    manualSlackOverride = 6;
    expect(resolveManualSlackBudget()).toBe(6);
  });

  it('clamps a negative override to 0 instead of rejecting every selection', () => {
    manualSlackOverride = -5;
    expect(resolveManualSlackBudget()).toBe(0);
  });

  it('clamps a huge override to the upper bound instead of disabling the slack check', () => {
    manualSlackOverride = 999_999;
    expect(resolveManualSlackBudget()).toBe(MAX_MANUAL_SLACK_BUDGET);
  });

  it('falls back to the default budget when the override is not finite (NaN/Infinity)', () => {
    manualSlackOverride = Number.NaN;
    expect(resolveManualSlackBudget()).toBe(4);

    manualSlackOverride = Number.POSITIVE_INFINITY;
    expect(resolveManualSlackBudget()).toBe(4);
  });

  it('uses the clamped fallback (maxOverage) when no override is configured', () => {
    manualSlackOverride = null;
    // Default selector maxOverage is 4, which is within [0, 24] -> unchanged default.
    expect(resolveManualSlackBudget()).toBe(4);
  });

  it('clamps the override at zero (boundary) without flipping to the fallback', () => {
    manualSlackOverride = 0;
    expect(resolveManualSlackBudget()).toBe(0);
  });
});
