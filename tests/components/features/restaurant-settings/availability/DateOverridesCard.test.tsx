import { render, screen, waitFor } from '@testing-library/react';
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

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useRegisterOpsUnsavedChanges: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: toastMock }));

import { DateOverridesCard } from '@/components/features/restaurant-settings/availability/DateOverridesCard';

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
  overrides: [
    {
      id: 'override-1',
      effectiveDate: '2026-12-24',
      opensAt: '12:00',
      closesAt: '20:00',
      isClosed: false,
      notes: 'Christmas Eve',
      reservationIntervalMinutes: 30,
      reservationSlotTimes: null,
    },
  ],
};

describe('DateOverridesCard', () => {
  beforeEach(() => {
    operatingHoursQueryState.data = null;
    operatingHoursQueryState.error = null;
    operatingHoursQueryState.isLoading = false;
    updateOperatingHoursState.isPending = false;
    updateOperatingHoursState.mutateAsync = vi.fn().mockResolvedValue({});
  });

  it('@contract renders nothing without a restaurant', () => {
    const { container } = render(<DateOverridesCard restaurantId={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract stays in the skeleton state until the snapshot arrives', () => {
    operatingHoursQueryState.isLoading = true;
    render(<DateOverridesCard restaurantId="rest-1" />);

    expect(screen.queryByText('Date overrides')).not.toBeInTheDocument();
  });

  it('@contract shows the error state when the snapshot fails', () => {
    operatingHoursQueryState.error = new Error('Hours fetch failed');
    operatingHoursQueryState.data = loadedSnapshot;
    render(<DateOverridesCard restaurantId="rest-1" />);

    expect(screen.getByText('Hours fetch failed')).toBeInTheDocument();
  });

  it('@contract lists loaded overrides and marks the section dirty on edits', async () => {
    const user = userEvent.setup();
    operatingHoursQueryState.data = loadedSnapshot;
    render(<DateOverridesCard restaurantId="rest-1" />);

    expect(await screen.findByText('Date overrides')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toHaveValue('Christmas Eve');
    expect(screen.getByRole('button', { name: /Save overrides/ })).toBeDisabled();

    await user.type(screen.getByLabelText('Notes'), '!');

    expect(screen.getByText('Unsaved changes in this section')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save overrides/ })).toBeEnabled();
  });

  it('@contract saves edited overrides through the mutation and reports success', async () => {
    const user = userEvent.setup();
    operatingHoursQueryState.data = loadedSnapshot;
    render(<DateOverridesCard restaurantId="rest-1" />);

    await user.type(await screen.findByLabelText('Notes'), '!');
    await user.click(screen.getByRole('button', { name: /Save overrides/ }));

    await waitFor(() => {
      expect(updateOperatingHoursState.mutateAsync).toHaveBeenCalledTimes(1);
    });
    const payload = updateOperatingHoursState.mutateAsync.mock.calls[0][0] as {
      overrides: Array<{ notes: string }>;
    };
    expect(payload.overrides[0]).toMatchObject({ notes: 'Christmas Eve!' });
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('@contract blocks saving and explains when an override is invalid', async () => {
    const user = userEvent.setup();
    operatingHoursQueryState.data = loadedSnapshot;
    render(<DateOverridesCard restaurantId="rest-1" />);

    // Clear the opening time while the date stays open -> validation error.
    const opens = await screen.findByLabelText('Opens');
    await user.clear(opens);
    await user.click(screen.getByRole('button', { name: /Save overrides/ }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalled();
    });
    expect(updateOperatingHoursState.mutateAsync).not.toHaveBeenCalled();
  });
});
