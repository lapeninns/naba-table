import { describe, expect, it } from 'vitest';

import { classifyPlannerReason, isDeterministicPlannerFailure } from '@/server/capacity/planner-reason';

describe('planner reason classification', () => {
  it('classifies insufficient filtered capacity as deterministic hard failure', () => {
    const classification = classifyPlannerReason('Insufficient filtered capacity');

    expect(classification).toEqual({
      category: 'hard',
      code: 'hard.insufficient_filtered_capacity',
    });
    expect(isDeterministicPlannerFailure('Insufficient filtered capacity')).toBe(true);
  });

  it('keeps generic insufficient capacity classification unchanged', () => {
    expect(classifyPlannerReason('Insufficient capacity')).toEqual({
      category: 'hard',
      code: 'hard.insufficient_capacity',
    });
  });

  it('classifies hold conflicts as transient failures', () => {
    expect(classifyPlannerReason('Hold conflicts prevented all candidates')).toEqual({
      category: 'transient',
      code: 'transient.hold_conflict',
    });
  });
});
