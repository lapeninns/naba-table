import { render } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';


import type { WizardActions } from '@features/reservations/wizard/model/store';
import type { CalendarMask } from '@features/reservations/wizard/services/schedule';
import type { ReservationSchedule } from '@features/reservations/wizard/services/timeSlots';

expect.extend({ toHaveNoViolations });

vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));

vi.mock('@reserve/features/reservations/wizard/services/schedule', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@reserve/features/reservations/wizard/services/schedule')
  >();
  return {
    ...actual,
    fetchReservationSchedule: vi.fn(),
    fetchCalendarMask: vi.fn(),
  };
});

describe('PlanStepForm accessibility', () => {
  it('has no axe violations for the default plan step', async () => {
    const queryClient = createTestQueryClient();
    const QueryWrapper = createQueryWrapper(queryClient);

    const { WizardProvider } = await import(
      '@features/reservations/wizard/context/WizardContext'
    );
    const { getInitialState } = await import('@features/reservations/wizard/model/reducer');
    const { PlanStepForm } = await import(
      '@features/reservations/wizard/ui/steps/plan-step/PlanStepForm'
    );

    const state = getInitialState({
      restaurantId: 'rest-1',
      restaurantSlug: 'the-fox',
      restaurantName: 'The Fox',
      restaurantTimezone: 'Europe/London',
      date: '2026-02-10',
      party: 2,
      bookingType: 'dinner',
    });

    const schedule: ReservationSchedule = {
      restaurantId: 'rest-1',
      date: '2026-02-10',
      timezone: 'Europe/London',
      intervalMinutes: 15,
      defaultDurationMinutes: 90,
      lastSeatingBufferMinutes: 0,
      window: { opensAt: '12:00', closesAt: '22:00' },
      isClosed: false,
      availableBookingOptions: ['dinner'],
      slots: [
        {
          value: '19:00',
          display: '7:00 PM',
          periodId: null,
          periodName: 'Dinner',
          bookingOption: 'dinner',
          defaultBookingOption: 'dinner',
          availability: {
            services: {},
            labels: { kitchenClosed: false, lunchWindow: false, dinnerWindow: true },
          },
          disabled: false,
        },
      ],
      occasionCatalog: [],
    };

    const mask: CalendarMask = {
      timezone: 'Europe/London',
      from: '2026-02-01',
      to: '2026-02-28',
      closedDaysOfWeek: [],
      closedDates: [],
    };

    const { fetchReservationSchedule, fetchCalendarMask } = await import(
      '@reserve/features/reservations/wizard/services/schedule'
    );

    vi.mocked(fetchReservationSchedule).mockResolvedValue(schedule);
    vi.mocked(fetchCalendarMask).mockResolvedValue(mask);

    const actions: WizardActions = {
      goToStep: vi.fn(),
      updateDetails: vi.fn(),
      setSubmitting: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      setSubmissionError: vi.fn(),
      clearError: vi.fn(),
      setBookings: vi.fn(),
      applyConfirmation: vi.fn(),
      startEdit: vi.fn(),
      resetForm: vi.fn(),
      hydrateContacts: vi.fn(),
      hydrateDetails: vi.fn(),
    };

    const { container } = render(
      <QueryWrapper>
        <WizardProvider state={state} actions={actions}>
          <PlanStepForm
            minDate={new Date('2026-02-01T00:00:00Z')}
            onActionsChange={vi.fn()}
          />
        </WizardProvider>
      </QueryWrapper>,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
