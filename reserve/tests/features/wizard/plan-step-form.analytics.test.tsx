import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { wizardStateFixture } from '@/tests/fixtures/wizard';
import { usePlanStepForm } from '@features/reservations/wizard/hooks/usePlanStepForm';

const createPlanState = () =>
  wizardStateFixture({
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

  it('exposes time slot suggestions for a selected date', async () => {
    const state = wizardStateFixture({
      date: '2025-05-12',
      time: '18:00',
    });
    const updateDetails = vi.fn();
    const goToStep = vi.fn();

    const { result } = renderHook(() =>
      usePlanStepForm({
        state,
        actions: { updateDetails, goToStep },
        onActionsChange: vi.fn(),
        minDate: new Date('2025-05-01T00:00:00Z'),
      }),
    );

    await act(async () => {});

    expect(result.current.slots.length).toBeGreaterThan(0);
    expect(result.current.slots[0]).toMatchObject({ value: expect.stringMatching(/\d{2}:\d{2}/) });
  });
  it('tracks changeOccasion when occasion picker toggled', async () => {
    const onTrack = vi.fn();
    const state = wizardStateFixture({
      date: '2025-05-12',
      time: '18:00',
    });

    const { result } = renderHook(() =>
      usePlanStepForm({
        state,
        actions: { updateDetails: vi.fn(), goToStep: vi.fn() },
        onActionsChange: vi.fn(),
        onTrack,
        minDate: new Date('2025-05-01T00:00:00Z'),
      }),
    );

    await act(async () => {
      result.current.handlers.changeOccasion('drinks');
    });

    await act(async () => {});

    expect(onTrack).toHaveBeenCalledWith(
      'select_time',
      expect.objectContaining({ booking_type: 'drinks' }),
    );
  });
});
