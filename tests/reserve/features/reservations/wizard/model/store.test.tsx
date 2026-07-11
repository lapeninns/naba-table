import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useWizardStore } from '@features/reservations/wizard/model/store';

describe('useWizardStore', () => {
  it('exposes initial state seeded from the provided details @contract @smoke', () => {
    const { result } = renderHook(() =>
      useWizardStore({ restaurantSlug: 'the-fox', party: 3, bookingType: 'dinner' }),
    );

    expect(result.current.state.step).toBe(1);
    expect(result.current.state.details.restaurantSlug).toBe('the-fox');
    expect(result.current.state.details.party).toBe(3);
  });

  it('dispatches field updates and step changes through actions @contract', () => {
    const { result } = renderHook(() => useWizardStore());

    act(() => {
      result.current.actions.updateDetails('time', '19:30');
      result.current.actions.goToStep(2);
    });

    expect(result.current.state.details.time).toBe('19:30');
    expect(result.current.state.step).toBe(2);
  });

  it('clearError wipes both the message and the submission error @contract', () => {
    const { result } = renderHook(() => useWizardStore());

    act(() => {
      result.current.actions.setError('boom');
      result.current.actions.setSubmissionError({
        code: 'CAPACITY_EXCEEDED',
        message: 'boom',
        alternatives: [],
        retryable: false,
        retryAfter: null,
      });
    });
    expect(result.current.state.error).toBe('boom');

    act(() => {
      result.current.actions.clearError();
    });
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.submissionError).toBeNull();
  });

  it('resetForm restores the initial snapshot taken on first render @contract', () => {
    const { result } = renderHook(() =>
      useWizardStore({ restaurantSlug: 'the-fox', restaurantName: 'The Fox' }),
    );

    act(() => {
      result.current.actions.updateDetails('party', 6);
      result.current.actions.updateDetails('notes', 'Birthday');
      result.current.actions.goToStep(3);
    });
    expect(result.current.state.details.party).toBe(6);

    act(() => {
      result.current.actions.resetForm();
    });

    expect(result.current.state.step).toBe(1);
    expect(result.current.state.details.party).toBe(1);
    expect(result.current.state.details.notes).toBe('');
    // Identity from the initial snapshot survives the reset.
    expect(result.current.state.details.restaurantSlug).toBe('the-fox');
    expect(result.current.state.details.restaurantName).toBe('The Fox');
  });

  it('keeps the actions object referentially stable across renders @contract', () => {
    const { result, rerender } = renderHook(() => useWizardStore());
    const firstActions = result.current.actions;

    act(() => {
      result.current.actions.updateDetails('party', 2);
    });
    rerender();

    expect(result.current.actions).toBe(firstActions);
  });
});
