import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { usePlanStepForm } from '@features/reservations/wizard/hooks/usePlanStepForm';
import { getInitialState } from '@features/reservations/wizard/model/reducer';

const createPlanState = () =>
  getInitialState({
    date: '2025-05-10',
    time: '12:00',
  });

describe('usePlanStepForm analytics', () => {
  it('tracks select_date when choosing a date', async () => {
    const onTrack = vi.fn();
    const state = createPlanState();
    const updateDetails = vi.fn();
    const goToStep = vi.fn();

    const { result } = renderHook(() =>
      usePlanStepForm({
        state,
        actions: { updateDetails, goToStep },
        onActionsChange: vi.fn(),
        onTrack,
        minDate: new Date('2025-05-01T00:00:00Z'),
      }),
    );

    await act(async () => {
      result.current.handlers.selectDate(new Date('2025-05-20T12:00:00Z'));
    });

    expect(onTrack).toHaveBeenCalledWith(
      'select_date',
      expect.objectContaining({ date: expect.any(String) }),
    );
  });

  it('tracks select_party when changing party size', async () => {
    const onTrack = vi.fn();
    const state = createPlanState();
    const updateDetails = vi.fn();
    const goToStep = vi.fn();

    const { result } = renderHook(() =>
      usePlanStepForm({
        state,
        actions: { updateDetails, goToStep },
        onActionsChange: vi.fn(),
        onTrack,
        minDate: new Date('2025-05-01T00:00:00Z'),
      }),
    );

    await act(async () => {
      result.current.handlers.changeParty('increment');
    });

    expect(onTrack).toHaveBeenCalledWith('select_party', expect.objectContaining({ party: 2 }));
  });
});
