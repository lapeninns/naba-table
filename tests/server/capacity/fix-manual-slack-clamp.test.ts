import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getManualAssignmentMaxSlack: vi.fn(),
  getSelectorScoringConfig: vi.fn(),
}));

vi.mock('@/server/runtime-policy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/runtime-policy')>()),
  getManualAssignmentMaxSlack: mocks.getManualAssignmentMaxSlack,
}));

vi.mock('@/server/capacity/policy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/capacity/policy')>()),
  getSelectorScoringConfig: mocks.getSelectorScoringConfig,
}));

import { resolveManualSlackBudget } from '@/server/capacity/table-assignment/manual-checks';

/**
 * Regression for #12: resolveManualSlackBudget returned the runtime override
 * (getManualAssignmentMaxSlack) UNCLAMPED — a misconfigured huge value silently
 * disabled the slack check (any oversized selection passes) and a negative value
 * rejected every selection. The override (and the fallback) must be clamped to a
 * sane [0, MAX] range.
 */
describe('#12 manual slack budget clamping', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('clamps an unbounded override down to the ceiling (24)', () => {
    mocks.getManualAssignmentMaxSlack.mockReturnValue(999999);
    expect(resolveManualSlackBudget()).toBe(24);
  });

  it('clamps a negative override up to 0', () => {
    mocks.getManualAssignmentMaxSlack.mockReturnValue(-5);
    expect(resolveManualSlackBudget()).toBe(0);
  });

  it('passes an in-range override through unchanged', () => {
    mocks.getManualAssignmentMaxSlack.mockReturnValue(10);
    expect(resolveManualSlackBudget()).toBe(10);
  });

  it('returns the default for a non-finite override', () => {
    mocks.getManualAssignmentMaxSlack.mockReturnValue(Number.NaN);
    expect(resolveManualSlackBudget()).toBe(4);
  });

  it('uses and clamps the policy maxOverage when there is no override', () => {
    mocks.getManualAssignmentMaxSlack.mockReturnValue(undefined);
    mocks.getSelectorScoringConfig.mockReturnValue({ maxOverage: 4 });
    expect(resolveManualSlackBudget()).toBe(4);

    mocks.getSelectorScoringConfig.mockReturnValue({ maxOverage: 500 });
    expect(resolveManualSlackBudget()).toBe(24);
  });
});
