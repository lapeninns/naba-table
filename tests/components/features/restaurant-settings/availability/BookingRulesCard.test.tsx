import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const detailsQueryState = vi.hoisted(() => ({
  data: null as unknown,
  error: null as Error | null,
  isLoading: false,
  refetch: vi.fn(),
}));
const registerUnsavedMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/ops/useOpsRestaurantDetails', () => ({
  useOpsRestaurantDetails: () => detailsQueryState,
}));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useRegisterOpsUnsavedChanges: registerUnsavedMock,
}));

// The booking-rules subform is its own tested component (RestaurantDetailsForm
// suite); stub it to keep this card test focused on the card states.
vi.mock('@/components/ops/restaurants/RestaurantDetailsForm', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    BookingRulesSubform: (props: { restaurantId: string; onDirtyChange: (dirty: boolean) => void }) => (
      <div data-testid="booking-rules-subform" data-restaurant-id={props.restaurantId}>
        <button type="button" onClick={() => props.onDirtyChange(true)}>
          make dirty
        </button>
      </div>
    ),
  };
});

import { BookingRulesCard } from '@/components/features/restaurant-settings/availability/BookingRulesCard';

describe('BookingRulesCard', () => {
  beforeEach(() => {
    detailsQueryState.data = null;
    detailsQueryState.error = null;
    detailsQueryState.isLoading = false;
    detailsQueryState.refetch = vi.fn();
  });

  it('@contract prompts for a restaurant when none is selected', () => {
    render(<BookingRulesCard restaurantId={null} />);

    expect(
      screen.getByText('Choose a restaurant using the sidebar switcher to update booking rules.'),
    ).toBeInTheDocument();
  });

  it('@contract shows the loading skeleton while details load', () => {
    detailsQueryState.isLoading = true;
    render(<BookingRulesCard restaurantId="rest-1" />);

    expect(screen.getByText('Loading restaurant-level reservation timing rules.')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-rules-subform')).not.toBeInTheDocument();
  });

  it('@contract surfaces the load error with a retry action', async () => {
    const user = userEvent.setup();
    detailsQueryState.error = new Error('Details fetch failed');
    render(<BookingRulesCard restaurantId="rest-1" />);

    expect(screen.getByText('Unable to load booking rules')).toBeInTheDocument();
    expect(screen.getByText('Details fetch failed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(detailsQueryState.refetch).toHaveBeenCalledTimes(1);
  });

  it('@contract renders the subform and registers unsaved changes when it goes dirty', async () => {
    const user = userEvent.setup();
    detailsQueryState.data = { id: 'rest-1', name: 'Old Crown Girton' };
    render(<BookingRulesCard restaurantId="rest-1" />);

    expect(screen.getByTestId('booking-rules-subform')).toHaveAttribute(
      'data-restaurant-id',
      'rest-1',
    );
    expect(registerUnsavedMock).toHaveBeenLastCalledWith(
      'restaurant-booking-rules',
      false,
      expect.any(String),
    );

    await user.click(screen.getByRole('button', { name: 'make dirty' }));
    expect(registerUnsavedMock).toHaveBeenLastCalledWith(
      'restaurant-booking-rules',
      true,
      expect.any(String),
    );
  });
});
