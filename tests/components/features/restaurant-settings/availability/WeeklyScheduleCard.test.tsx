import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const operatingHoursQueryState = vi.hoisted(() => ({
  data: null as unknown,
  error: null as Error | null,
  isLoading: false,
}));
const updateOperatingHoursState = vi.hoisted(() => ({
  isPending: false,
  mutateAsync: vi.fn(),
}));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('@/hooks/ops/useOpsOperatingHours', () => ({
  useOpsOperatingHours: () => operatingHoursQueryState,
  useOpsUpdateOperatingHours: () => updateOperatingHoursState,
}));

vi.mock('@/hooks/ops/useOpsDualSync', () => ({
  useOpsDualSync: () => ({
    stateQuery: { data: null, isLoading: false, isError: false, error: null },
  }),
}));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useRegisterOpsUnsavedChanges: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: toastMock }));

import { WeeklyScheduleCard } from '@/components/features/restaurant-settings/availability/WeeklyScheduleCard';

const loadedSnapshot = {
  weekly: [
    {
      dayOfWeek: 1,
      opensAt: '11:00',
      closesAt: '22:00',
      isClosed: false,
      notes: null,
      reservationIntervalMinutes: 30,
      reservationSlotTimes: null,
    },
  ],
  overrides: [],
};

describe('WeeklyScheduleCard', () => {
  beforeEach(() => {
    operatingHoursQueryState.data = null;
    operatingHoursQueryState.error = null;
    operatingHoursQueryState.isLoading = false;
    updateOperatingHoursState.isPending = false;
    updateOperatingHoursState.mutateAsync = vi.fn().mockResolvedValue({});
  });

  it('@contract renders nothing without a restaurant', () => {
    const { container } = render(<WeeklyScheduleCard restaurantId={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract shows the error state when the snapshot fails', () => {
    operatingHoursQueryState.error = new Error('Hours fetch failed');
    operatingHoursQueryState.data = loadedSnapshot;
    render(<WeeklyScheduleCard restaurantId="rest-1" />);

    expect(screen.getByText('Hours fetch failed')).toBeInTheDocument();
  });

  it('@contract renders a card per weekday with the loaded hours', async () => {
    operatingHoursQueryState.data = loadedSnapshot;
    render(<WeeklyScheduleCard restaurantId="rest-1" />);

    expect(await screen.findByText('Weekly operating hours')).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Sunday')).toBeInTheDocument();
    expect(screen.getByLabelText('Opens')).toHaveValue('11:00');
  });

  it('@contract saves edited weekly hours and reports success', async () => {
    const user = userEvent.setup();
    operatingHoursQueryState.data = loadedSnapshot;
    render(<WeeklyScheduleCard restaurantId="rest-1" />);

    fireEvent.change(await screen.findByLabelText('Opens'), { target: { value: '10:00' } });
    expect(screen.getByText('Unsaved changes in this section')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Save/ }));

    await waitFor(() => {
      expect(updateOperatingHoursState.mutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('@contract blocks saving invalid weekly hours with an error toast', async () => {
    const user = userEvent.setup();
    operatingHoursQueryState.data = loadedSnapshot;
    render(<WeeklyScheduleCard restaurantId="rest-1" />);

    const opens = await screen.findByLabelText('Opens');
    await user.clear(opens);
    await user.click(screen.getByRole('button', { name: /Save/ }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalled();
    });
    expect(updateOperatingHoursState.mutateAsync).not.toHaveBeenCalled();
  });
});
