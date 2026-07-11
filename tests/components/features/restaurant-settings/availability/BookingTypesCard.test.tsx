import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OpsOccasion } from '@/services/ops/occasions';

const cardState = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));

vi.mock('@/components/features/restaurant-settings/availability/useBookingTypesCardState', () => ({
  useBookingTypesCardState: () => cardState.current,
}));

import { BookingTypesCard } from '@/components/features/restaurant-settings/availability/BookingTypesCard';

const lunchOccasion = {
  key: 'lunch',
  label: 'Lunch',
  shortLabel: 'Lunch',
  description: null,
  defaultDurationMinutes: 90,
  displayOrder: 10,
  isActive: true,
  availability: [{ kind: 'anytime' }],
  isBuiltin: true,
} as OpsOccasion;

function makeState(over: Record<string, unknown> = {}) {
  return {
    handleOccasionsChange: vi.fn(),
    handleReset: vi.fn(),
    handleSave: vi.fn(),
    handleTurnBandsChange: vi.fn(),
    hasInitialized: true,
    isDirty: false,
    isLoading: false,
    loadError: null,
    occasionDrafts: [lunchOccasion],
    turnBandDefaults: {},
    turnBandErrors: {},
    turnBandsDraft: {},
    updateTurnBands: { isPending: false },
    ...over,
  };
}

describe('BookingTypesCard', () => {
  beforeEach(() => {
    cardState.current = makeState();
  });

  it('@contract renders nothing without a restaurant', () => {
    const { container } = render(<BookingTypesCard restaurantId={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract shows a loading skeleton before state initializes', () => {
    cardState.current = makeState({ isLoading: true });
    render(<BookingTypesCard restaurantId="rest-1" />);

    expect(screen.queryByText('Booking types and turn times')).not.toBeInTheDocument();
  });

  it('@contract falls back to the schedule error state on load failure', () => {
    cardState.current = makeState({ loadError: new Error('Occasions fetch failed') });
    render(<BookingTypesCard restaurantId="rest-1" />);

    expect(screen.getByText('Availability editor unavailable')).toBeInTheDocument();
    expect(screen.getByText('Occasions fetch failed')).toBeInTheDocument();
  });

  it('@contract disables save until dirty and fires the save handler when enabled', async () => {
    const user = userEvent.setup();
    cardState.current = makeState();
    const { rerender } = render(<BookingTypesCard restaurantId="rest-1" />);

    const saveButton = screen.getByRole('button', { name: /Save booking types/ });
    expect(saveButton).toBeDisabled();
    expect(screen.queryByText('Unsaved changes in this section')).not.toBeInTheDocument();

    cardState.current = makeState({ isDirty: true });
    rerender(<BookingTypesCard restaurantId="rest-1" />);

    expect(screen.getByText('Unsaved changes in this section')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Save booking types/ }));
    expect(cardState.current.handleSave).toHaveBeenCalledTimes(1);
  });

  it('@contract disables actions while the turn bands mutation is pending', () => {
    cardState.current = makeState({ isDirty: true, updateTurnBands: { isPending: true } });
    render(<BookingTypesCard restaurantId="rest-1" />);

    expect(screen.getByRole('button', { name: /Save booking types/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Reset/ })).toBeDisabled();
  });
});
