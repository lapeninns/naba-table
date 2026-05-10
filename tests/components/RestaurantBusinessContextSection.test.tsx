import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

import {
  cloneFamily,
  csvToArray,
  formatCategoryTitle,
  formatSeedSource,
  parseJsonArray,
  parseJsonRecord,
  serializeMoreHoursTypes,
} from '@/components/features/restaurant-settings/businessContextModel';
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

    await user.click(screen.getByRole('button', { name: /dining categories/i }));
    expect(screen.getByDisplayValue('Restaurant')).toBeInTheDocument();
    expect(screen.getByText(/pre-filled from google until you save/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/category name/i));
    await user.type(screen.getByLabelText(/category name/i), 'Neighbourhood Bistro');
    await user.type(screen.getByLabelText(/more-hours types/i), 'HAPPY_HOUR{Enter}');
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
              {
                hoursTypeId: 'HAPPY_HOUR',
                displayName: null,
                localizedDisplayName: null,
              },
            ],
          },
        ],
      }),
    );

    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it('adds and removes category rows without changing the save API shape', async () => {
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
          categories: [],
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

    await user.click(screen.getByRole('button', { name: /dining categories/i }));
    await user.click(screen.getByRole('button', { name: /add category/i }));
    await user.type(screen.getByLabelText(/category name/i), 'Wine Bar');
    await user.type(screen.getByLabelText(/category code/i), 'wine_bar');
    await user.type(screen.getByLabelText(/more-hours types/i), 'BAR_HOURS{Enter}');
    await user.type(screen.getByLabelText(/more-hours types/i), 'LATE_NIGHT{Enter}');
    await user.click(screen.getByRole('button', { name: /remove late_night/i }));
    await user.click(screen.getByRole('button', { name: /save categories/i }));

    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        categories: [
          {
            id: undefined,
            displayName: 'Wine Bar',
            categoryCode: 'wine_bar',
            isPrimary: false,
            moreHoursTypes: [
              {
                hoursTypeId: 'BAR_HOURS',
                displayName: null,
                localizedDisplayName: null,
              },
            ],
          },
        ],
      }),
    );
  });

  it('renders embedded discovery settings as ordered subsections instead of tabs', () => {
    useOpsRestaurantBusinessContextMock.mockReturnValue({
      data: {
        core: {
          businessDetails: {
            openingDate: null,
            businessStatus: null,
            isServiceAreaBusiness: false,
          },
          links: [],
          categories: [],
          serviceAreas: [],
          attributes: [],
          serviceItems: [],
        },
        providerSnapshot: {
          businessDetails: null,
          links: [],
          categories: [],
          serviceAreas: [],
          attributes: [],
          serviceItems: [],
        },
      },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<RestaurantBusinessContextSection restaurantId="rest-1" embedded />);

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    const headings = screen
      .getAllByRole('heading', { level: 3 })
      .map(
        (heading) =>
          heading.textContent?.match(
            /^(Profile basics|Dining categories|Online links|Amenities|Services|Where you serve)/,
          )?.[0],
      );

    expect(headings).toEqual([
      'Profile basics',
      'Dining categories',
      'Online links',
      'Amenities',
      'Services',
      'Where you serve',
    ]);
    expect(screen.getByRole('button', { name: /^profile basics$/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: /save profile basics/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^dining categories$/i }));
    expect(screen.getByRole('button', { name: /^profile basics$/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: /^dining categories$/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: /^dining categories$/i }));
    expect(screen.getByRole('button', { name: /^dining categories$/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('button', { name: /add category/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^dining categories$/i }));
    expect(screen.getByRole('button', { name: /add category/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^amenities$/i }));
    expect(screen.getByRole('button', { name: /save attributes/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^online links$/i }));
    expect(screen.getByRole('button', { name: /add link/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^services$/i }));
    expect(screen.getByRole('button', { name: /save service items/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^where you serve$/i }));
    expect(screen.getByRole('button', { name: /save service areas/i })).toBeInTheDocument();
    expect(screen.getByText(/import details/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /gbp workspace/i })).toBeInTheDocument();
  });

  it('saves provider-safe service-area and attribute fields from the CRUD editor', async () => {
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
          categories: [],
          serviceAreas: [
            {
              id: 'gbp-service-area-1',
              displayName: 'Cambridge',
              areaType: 'region',
              regionCode: 'GB',
              googlePlaceId: 'ChIJ-old',
              googlePlaceResourceName: 'places/ChIJ-old',
              placeData: { placeId: 'ChIJ-old' },
              source: 'gbp',
              managedBy: 'gbp',
              updatedAt: '2026-04-18T12:00:00.000Z',
            },
          ],
          attributes: [
            {
              id: 'gbp-attribute-1',
              attributeGroup: 'Planning',
              attributeKey: 'planning_reservation_recommended',
              attributeName: 'locations/123/attributes/planning_reservation_recommended',
              attributeId: 'planning_reservation_recommended',
              displayName: 'Reservations',
              displayText: 'Reservations recommended',
              displayTextStandalone: null,
              displayTextNegative: null,
              valueType: 'REPEATED_ENUM',
              boolValue: null,
              textValue: null,
              uriValue: null,
              uriValues: [],
              enumValues: ['RESERVATION_RECOMMENDED'],
              unsetEnumValues: [],
              rawValue: { repeatedEnumValue: { setValues: ['RESERVATION_RECOMMENDED'] } },
              rawEnumValues: { setValues: ['RESERVATION_RECOMMENDED'] },
              displayValue: { setLabels: ['Reservations recommended'] },
              valueMetadata: [],
              source: 'gbp',
              managedBy: 'gbp',
              updatedAt: '2026-04-18T12:00:00.000Z',
            },
          ],
          serviceItems: [],
        },
      },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<RestaurantBusinessContextSection restaurantId="rest-1" />);

    await user.click(screen.getByRole('button', { name: /where you serve/i }));
    await user.click(screen.getByRole('button', { name: /advanced service-area details/i }));
    await user.clear(screen.getByLabelText(/google place id/i));
    await user.type(screen.getByLabelText(/google place id/i), 'ChIJ-new');
    await user.click(screen.getByRole('button', { name: /show provider payload fields/i }));
    await user.clear(screen.getByLabelText(/place resource/i));
    await user.type(screen.getByLabelText(/place resource/i), 'places/ChIJ-new');
    await user.click(screen.getByRole('button', { name: /save service areas/i }));

    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        serviceAreas: [
          {
            id: 'gbp-service-area-1',
            displayName: 'Cambridge',
            areaType: 'region',
            regionCode: 'GB',
            googlePlaceId: 'ChIJ-new',
            googlePlaceResourceName: 'places/ChIJ-new',
            placeData: { placeId: 'ChIJ-old' },
          },
        ],
      }),
    );

    await user.click(screen.getByRole('button', { name: /amenities/i }));
    await user.click(screen.getByRole('button', { name: /advanced attribute rows/i }));
    await user.clear(screen.getByLabelText(/^Selected values/i));
    await user.type(screen.getByLabelText(/^Selected values/i), 'RESERVATION_REQUIRED');
    await user.click(screen.getByRole('button', { name: /show provider payload fields/i }));
    fireEvent.change(screen.getByLabelText(/raw selected values/i), {
      target: { value: '{"setValues":["RESERVATION_REQUIRED"]}' },
    });
    fireEvent.change(screen.getByLabelText(/^Display value$/i), {
      target: { value: '{"setLabels":["Reservations required"]}' },
    });
    await user.click(screen.getByRole('button', { name: /save attributes/i }));

    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenLastCalledWith({
        attributes: [
          expect.objectContaining({
            id: 'gbp-attribute-1',
            attributeKey: 'planning_reservation_recommended',
            valueType: 'REPEATED_ENUM',
            enumValues: ['RESERVATION_REQUIRED'],
            rawEnumValues: { setValues: ['RESERVATION_REQUIRED'] },
            displayValue: { setLabels: ['Reservations required'] },
          }),
        ],
      }),
    );
  });

  it('adds service-area chips and grouped amenity attributes from the embedded editor', async () => {
    const user = userEvent.setup();

    useOpsRestaurantBusinessContextMock.mockReturnValue({
      data: {
        core: {
          businessDetails: null,
          links: [],
          categories: [],
          serviceAreas: [],
          attributes: [],
          serviceItems: [],
        },
        providerSnapshot: {
          businessDetails: null,
          links: [],
          categories: [],
          serviceAreas: [],
          attributes: [],
          serviceItems: [],
        },
      },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<RestaurantBusinessContextSection restaurantId="rest-1" embedded />);

    await user.click(screen.getByRole('button', { name: /where you serve/i }));
    await user.type(screen.getByLabelText(/new service area/i), 'Cambridge, UK');
    await user.click(screen.getByRole('button', { name: /add area/i }));
    expect(screen.getByText('Cambridge, UK')).toBeInTheDocument();
    expect(screen.getByText('This saves service areas only.')).toBeInTheDocument();
    expect(screen.getByText('Dirty')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save service areas/i }));
    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        serviceAreas: [
          {
            id: undefined,
            displayName: 'Cambridge, UK',
            areaType: 'region',
            regionCode: null,
            googlePlaceId: null,
            googlePlaceResourceName: null,
            placeData: null,
          },
        ],
      }),
    );

    await user.click(screen.getByRole('button', { name: /amenities/i }));
    await user.click(screen.getByLabelText(/free wi-fi/i));
    await user.click(screen.getByRole('button', { name: /save attributes/i }));

    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenLastCalledWith({
        attributes: [
          expect.objectContaining({
            id: undefined,
            attributeGroup: 'Amenities & crowd',
            attributeKey: 'has_wifi',
            attributeId: 'has_wifi',
            displayName: 'Free Wi-Fi',
            valueType: 'boolean',
            boolValue: true,
          }),
        ],
      }),
    );
  });
});

describe('business context model', () => {
  it('formats seed state and clones provider rows only when local rows are empty', () => {
    expect(formatSeedSource('core', 2)).toBe('Showing saved values');
    expect(formatSeedSource('provider', 1)).toBe('Pre-filled from Google until you save');
    expect(formatSeedSource('provider', 0)).toBe('No values yet');

    expect(cloneFamily(['local'], ['provider'])).toEqual({ rows: ['local'], source: 'core' });
    expect(cloneFamily([], ['provider'])).toEqual({ rows: ['provider'], source: 'provider' });
    expect(cloneFamily([], [])).toEqual({ rows: [], source: 'empty' });
  });

  it('serializes discovery editor values without changing API shapes', () => {
    expect(csvToArray(' alpha, , beta ')).toEqual(['alpha', 'beta']);
    expect(parseJsonRecord('{"placeId":"abc"}', 'Place data')).toEqual({ placeId: 'abc' });
    expect(parseJsonArray<string>('["one","two"]', 'Value metadata')).toEqual(['one', 'two']);
    expect(
      serializeMoreHoursTypes([
        { hoursTypeId: ' KITCHEN ', displayName: '', localizedDisplayName: null },
        { hoursTypeId: null, displayName: null, localizedDisplayName: null },
      ]),
    ).toEqual([{ hoursTypeId: 'KITCHEN', displayName: null, localizedDisplayName: null }]);
  });

  it('formats editor row titles from labels or safe fallbacks', () => {
    expect(
      formatCategoryTitle({
        id: 'category-1',
        displayName: '  Bistro  ',
        categoryCode: '',
        isPrimary: false,
        moreHoursTypes: [],
        moreHoursTypeDraft: '',
      }),
    ).toBe('Bistro');
    expect(
      formatCategoryTitle({
        id: 'category-2',
        displayName: '',
        categoryCode: '',
        isPrimary: true,
        moreHoursTypes: [],
        moreHoursTypeDraft: '',
      }),
    ).toBe('Primary category');
  });
});
