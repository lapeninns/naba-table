import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeDayConfig, makeWeeklyRow } from '../testUtils';

const cardState = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));

vi.mock('@/components/features/restaurant-settings/availability/useServiceWindowsCardState', () => ({
  useServiceWindowsCardState: () => cardState.current,
}));

import { ServiceWindowsCard } from '@/components/features/restaurant-settings/availability/ServiceWindowsCard';

function makeState(over: Record<string, unknown> = {}) {
  return {
    createRequiredOccasions: vi.fn(),
    dayRows: [
      {
        day: makeDayConfig(),
        row: makeWeeklyRow(),
        serviceDriftFields: [],
      },
    ],
    handleMealTimeChange: vi.fn(),
    handleMealToggle: vi.fn(),
    handleReset: vi.fn(),
    handleSave: vi.fn(),
    hasInitialized: true,
    hasRequiredOccasions: true,
    isCreatingOccasions: false,
    isDirty: false,
    isLoading: false,
    loadError: null,
    serviceErrors: {},
    updateServicePeriods: { isPending: false },
    ...over,
  };
}

describe('ServiceWindowsCard', () => {
  beforeEach(() => {
    cardState.current = makeState();
  });

  it('@contract renders nothing without a restaurant', () => {
    const { container } = render(<ServiceWindowsCard restaurantId={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract renders day cards with meal editors when loaded', () => {
    render(<ServiceWindowsCard restaurantId="rest-1" />);

    expect(screen.getByText('Meal windows (Lunch / Dinner)')).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText('Dinner')).toBeInTheDocument();
  });

  it('@contract shows the error state when loading fails', () => {
    cardState.current = makeState({ loadError: new Error('Service periods unavailable') });
    render(<ServiceWindowsCard restaurantId="rest-1" />);

    expect(screen.getByText('Service periods unavailable')).toBeInTheDocument();
  });

  it('@contract offers to create missing lunch and dinner booking types', async () => {
    const user = userEvent.setup();
    cardState.current = makeState({ hasRequiredOccasions: false });
    render(<ServiceWindowsCard restaurantId="rest-1" />);

    expect(screen.getByText('Lunch and dinner booking types are required')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Create missing lunch and dinner booking types' }),
    );
    expect(cardState.current.createRequiredOccasions).toHaveBeenCalledTimes(1);
  });

  it('@contract enables save only when dirty and not already saving', async () => {
    const user = userEvent.setup();
    cardState.current = makeState({ isDirty: true });
    render(<ServiceWindowsCard restaurantId="rest-1" />);

    expect(screen.getByText('Unsaved changes in this section')).toBeInTheDocument();
    const save = screen.getByRole('button', { name: /Save windows/ });
    expect(save).toBeEnabled();

    await user.click(save);
    expect(cardState.current.handleSave).toHaveBeenCalledTimes(1);
  });
});
