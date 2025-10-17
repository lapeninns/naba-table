import { describe, expect, it } from 'vitest';

import {
  canTransitionTo,
  getAllowedTargets,
  getTransitionMatrix,
  isTerminalStatus,
  validateTransition,
} from '@/src/lib/booking/state-machine';

describe('booking state machine helpers', () => {
  it('returns allowed targets for a status', () => {
    expect(getAllowedTargets('confirmed')).toEqual(['confirmed', 'checked_in', 'cancelled', 'no_show']);
  });

  it('filters self transitions when requested', () => {
    expect(getAllowedTargets('confirmed', { includeSelf: false })).toEqual(['checked_in', 'cancelled', 'no_show']);
  });

  it('detects terminal statuses', () => {
    expect(isTerminalStatus('completed')).toBe(true);
    expect(isTerminalStatus('confirmed')).toBe(false);
  });

  it('validates allowed transitions', () => {
    expect(canTransitionTo('confirmed', 'checked_in')).toBe(true);
    expect(canTransitionTo('confirmed', 'completed')).toBe(false);
  });

  it('provides validation details for invalid transition', () => {
    const result = validateTransition('checked_in', 'confirmed');
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('TRANSITION_NOT_ALLOWED');
    expect(result.allowedTargets).toEqual(['checked_in', 'completed', 'no_show']);
  });

  it('exposes transition matrix as readonly sets', () => {
    const matrix = getTransitionMatrix();
    expect(matrix.confirmed.has('checked_in')).toBe(true);
    expect(matrix.confirmed.has('completed')).toBe(false);
  });
});

