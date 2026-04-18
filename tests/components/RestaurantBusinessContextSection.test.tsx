import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useOpsRestaurantBusinessContextMock = vi.hoisted(() => vi.fn());
const mutateAsyncMock = vi.hoisted(() => vi.fn());
const useOpsUpdateRestaurantBusinessContextMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/ops/useOpsRestaurantBusinessContext', () => ({
  useOpsRestaurantBusinessContext: useOpsRestaurantBusinessContextMock,
  useOpsUpdateRestaurantBusinessContext: useOpsUpdateRestaurantBusinessContextMock,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import { RestaurantBusinessContextSection } from '@/components/features/restaurant-settings/RestaurantBusinessContextSection';

describe('RestaurantBusinessContextSection', () => {
  beforeEach(() => {
    useOpsRestaurantBusinessContextMock.mockReset();
    useOpsUpdateRestaurantBusinessContextMock.mockReset();
    mutateAsyncMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    mutateAsyncMock.mockResolvedValue({
      core: {
        categories: [],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      },
      providerSnapshot: {
        categories: [],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      },
    });

    useOpsUpdateRestaurantBusinessContextMock.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    });
  });

  it('seeds empty core categories from the provider snapshot and saves parsed payloads', async () => {
    const user = userEvent.setup();

    useOpsRestaurantBusinessContextMock.mockReturnValue({
      data: {
        core: {
          categories: [],
          serviceAreas: [],
          attributes: [],
          serviceItems: [],
        },
        providerSnapshot: {
          categories: [
            {
              id: 'gbp-category-1',
              displayName: 'Restaurant',
              categoryCode: 'restaurant',
              moreHoursTypes: [
                {
                  hoursTypeId: 'KITCHEN',
                  displayName: 'Kitchen',
                  localizedDisplayName: 'Kitchen',
                },
              ],
              isPrimary: true,
              source: 'gbp',
              managedBy: 'gbp',
              updatedAt: '2026-04-18T12:00:00.000Z',
            },
          ],
          serviceAreas: [],
          attributes: [],
          serviceItems: [],
        },
      },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<RestaurantBusinessContextSection restaurantId="rest-1" />);

    expect(screen.getByDisplayValue('Restaurant')).toBeInTheDocument();
    expect(screen.getByText(/prefilled from the latest gbp snapshot until you save/i)).toBeInTheDocument();
    expect(screen.getByText(/seeded from gbp/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/display name/i));
    await user.type(screen.getByLabelText(/display name/i), 'Neighbourhood Bistro');
    await user.click(screen.getByRole('button', { name: /save categories/i }));

    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        categories: [
          {
            id: 'gbp-category-1',
            displayName: 'Neighbourhood Bistro',
            categoryCode: 'restaurant',
            isPrimary: true,
            moreHoursTypes: [
              {
                hoursTypeId: 'KITCHEN',
                displayName: 'Kitchen',
                localizedDisplayName: 'Kitchen',
              },
            ],
          },
        ],
      }),
    );

    expect(toastSuccessMock).toHaveBeenCalled();
  });
});
