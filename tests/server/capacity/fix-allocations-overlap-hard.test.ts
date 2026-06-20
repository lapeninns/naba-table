import { describe, expect, it } from 'vitest';

import {
  classifyPlannerReason,
  isDeterministicPlannerFailure,
} from '@/server/capacity/planner-reason';

// Regression for bug #8: the job classifies a hard concurrency conflict using
// the thrown error's name (AssignTablesRpcError) and/or the underlying
// allocations_no_overlap constraint message. Both must classify as HARD so the
// job stops retrying and backs off the same way the inline path does, instead
// of retrying a genuinely-taken slot up to 4x.
describe('planner reason classification: allocations_no_overlap / AssignTablesRpcError (#8)', () => {
  it('classifies the raw allocations_no_overlap constraint name as a hard failure', () => {
    const classification = classifyPlannerReason('allocations_no_overlap');

    expect(classification.category).toBe('hard');
    expect(classification.code).toBe('hard.allocations_overlap');
    expect(isDeterministicPlannerFailure('allocations_no_overlap')).toBe(true);
  });

  it('classifies an allocations_no_overlap exclusion message as hard', () => {
    const classification = classifyPlannerReason(
      'conflicting key value violates exclusion constraint "allocations_no_overlap"',
    );

    expect(classification.category).toBe('hard');
    expect(classification.code).toBe('hard.allocations_overlap');
  });

  it('classifies the bare AssignTablesRpcError name as hard so the job backs off like inline', () => {
    const classification = classifyPlannerReason('AssignTablesRpcError');

    expect(classification.category).toBe('hard');
    expect(classification.code).toBe('hard.assign_tables_rpc');
    expect(isDeterministicPlannerFailure('AssignTablesRpcError')).toBe(true);
  });

  it('classifies a combined "AssignTablesRpcError: ...allocations_no_overlap..." reason as hard', () => {
    // The job composes `${error.name}: ${error.message}`; the overlap pattern
    // must win over the generic /rpc/i transient pattern.
    const classification = classifyPlannerReason(
      'AssignTablesRpcError: conflicting key value violates exclusion constraint "allocations_no_overlap"',
    );

    expect(classification.category).toBe('hard');
    expect(classification.code).toBe('hard.allocations_overlap');
  });

  it('still treats a genuinely transient DB message (lock wait) as transient even via the RPC error', () => {
    // Defense for the message-propagation fix: transient DB hints in the message
    // must remain retryable rather than being swallowed by the hard RPC name.
    const classification = classifyPlannerReason(
      'AssignTablesRpcError: lock wait timeout exceeded; try restarting transaction',
    );

    expect(classification.category).toBe('transient');
    expect(classification.code).toBe('transient.lock_wait');
  });

  it('keeps existing hard capacity classifications unchanged', () => {
    expect(classifyPlannerReason('Insufficient filtered capacity')).toEqual({
      category: 'hard',
      code: 'hard.insufficient_filtered_capacity',
    });
  });

  it('keeps existing transient hold-conflict classification unchanged', () => {
    expect(classifyPlannerReason('Hold conflicts prevented all candidates')).toEqual({
      category: 'transient',
      code: 'transient.hold_conflict',
    });
  });
});
