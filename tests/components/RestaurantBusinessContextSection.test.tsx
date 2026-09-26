import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RestaurantBusinessContextSection } from '@/components/features/restaurant-settings/RestaurantBusinessContextSection';
import { HttpError } from '@/lib/http/errors';

import type {
  RestaurantBusinessContextFamily,
  RestaurantBusinessContextSnapshot,
  UpdateRestaurantBusinessContextInput,
} from '@/services/ops/restaurants';

const useOpsRestaurantBusinessContextMock = vi.hoisted(() => vi.fn());
const mutateAsyncMock = vi.hoisted(() => vi.fn());
const useOpsUpdateRestaurantBusinessContextMock = vi.hoisted(() => vi.fn());
const registerUnsavedMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
const gbpFieldsMock = vi.hoisted(() => ({ fields: [] as unknown[] }));

vi.mock('@/hooks/ops/useOpsRestaurantBusinessContext', () => ({
  useOpsRestaurantBusinessContext: useOpsRestaurantBusinessContextMock,
  useOpsUpdateRestaurantBusinessContext: useOpsUpdateRestaurantBusinessContextMock,
}));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useRegisterOpsUnsavedChanges: registerUnsavedMock,
  useRegisterOptionalOpsUnsavedChanges: vi.fn(),
}));

vi.mock('@/hooks/ops/useOpsDualSync', () => ({
  useOpsDualSync: () => ({
    stateQuery: {
      data: { fields: gbpFieldsMock.fields },
      error: null,
      isError: false,
      isLoading: false,
    },
  }),
}));

vi.mock('sonner', () => ({ toast: toastMock }));

const EMPTY_FAMILY: RestaurantBusinessContextFamily = {
  businessDetails: null,
  links: [],
  categories: [],
  serviceAreas: [],
  attributes: [],
  serviceItems: [],
};

const GOOGLE_CATEGORY = {
  id: 'gbp-category-1',
  displayName: 'Restaurant',
  categoryCode: 'gcid:restaurant',
  moreHoursTypes: [],
  isPrimary: true,
  source: 'gbp',
  managedBy: 'gbp',
  updatedAt: '2026-04-18T12:00:00.000Z',
};

let serverSnapshot: RestaurantBusinessContextSnapshot;

function setSnapshot(
  core: Partial<RestaurantBusinessContextFamily> = {},
  provider: Partial<RestaurantBusinessContextFamily> = {},
) {
  serverSnapshot = {
    core: { ...EMPTY_FAMILY, ...core },
    providerSnapshot: { ...EMPTY_FAMILY, ...provider },
  };
  useOpsRestaurantBusinessContextMock.mockReturnValue({
    data: serverSnapshot,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
  });
}

/** Stands in for the API: applies the family that was sent and returns the full snapshot. */
function applyToServer(payload: UpdateRestaurantBusinessContextInput) {
  const core = { ...serverSnapshot.core };
  if (payload.businessDetails) {
    core.businessDetails = {
      id: 'bd-1',
      openingDate: payload.businessDetails.openingDate ?? null,
      businessStatus: payload.businessDetails.businessStatus ?? null,
      isServiceAreaBusiness: payload.businessDetails.isServiceAreaBusiness ?? false,
      source: 'manual',
      managedBy: 'ops',
      updatedAt: '2026-09-25T09:00:00.000Z',
    };
  }
  if (payload.categories) {
    core.categories = payload.categories.map((row, index) => ({
      id: `saved-category-${index}`,
      displayName: row.displayName,
      categoryCode: row.categoryCode ?? null,
      moreHoursTypes: row.moreHoursTypes ?? [],
      isPrimary: row.isPrimary ?? false,
      source: 'manual',
      managedBy: 'ops',
      updatedAt: '2026-09-25T09:00:00.000Z',
    }));
  }
  if (payload.serviceAreas) {
    core.serviceAreas = payload.serviceAreas.map((row, index) => ({
      id: `saved-area-${index}`,
      displayName: row.displayName,
      areaType: row.areaType ?? 'region',
      regionCode: row.regionCode ?? null,
      googlePlaceId: row.googlePlaceId ?? null,
      googlePlaceResourceName: row.googlePlaceResourceName ?? null,
      placeData: row.placeData ?? null,
      source: 'manual',
      managedBy: 'ops',
      updatedAt: '2026-09-25T09:00:00.000Z',
    })) as RestaurantBusinessContextFamily['serviceAreas'];
  }
  serverSnapshot = { ...serverSnapshot, core };
  return serverSnapshot;
}

function saveBar() {
  return screen.getByRole('region', { name: 'Unsaved changes' });
}

function section(name: string) {
  return screen.getByRole('region', { name });
}

/** Turns on the service-location switch and adds an area, both in Where you serve. */
async function serveCambridge(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('switch', { name: 'We serve customers at their location' }));
  await user.type(screen.getByLabelText('New area'), 'Cambridge, UK{Enter}');
}

describe('RestaurantBusinessContextSection', () => {
  beforeEach(() => {
    gbpFieldsMock.fields = [];
    mutateAsyncMock.mockImplementation(async (payload: UpdateRestaurantBusinessContextInput) =>
      applyToServer(payload),
    );
    useOpsUpdateRestaurantBusinessContextMock.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    });
  });

  it('shows all six sections in order on one page, with a jump bar and nothing unsaved', () => {
    setSnapshot();
    render(<RestaurantBusinessContextSection restaurantId="rest-1" />);

    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Business status',
      'Categories',
      'Links',
      'Amenities',
      'Services',
      'Where you serve',
    ]);
    const jumpBar = screen.getByRole('navigation', { name: /Sections on this page/i });
    expect(within(jumpBar).getByRole('link', { name: /Amenities/ })).toHaveAttribute(
      'href',
      '#profile-discovery-attributes',
    );
    expect(screen.queryByRole('button', { name: /^Save/ })).not.toBeInTheDocument();
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
    expect(
      within(section('Links')).getByRole('link', { name: 'Restaurant profile' }),
    ).toHaveAttribute('href', '/app/settings/restaurant/profile#profile-contact');
    expect(within(section('Links')).getByText('Not compared with Google.')).toBeInTheDocument();
    expect(registerUnsavedMock).toHaveBeenLastCalledWith(
      'restaurant-discovery',
      false,
      expect.any(String),
    );
  });

  it('counts a section pre-filled from Google as unsaved', () => {
    setSnapshot({}, { categories: [GOOGLE_CATEGORY] });
    render(<RestaurantBusinessContextSection restaurantId="rest-1" />);

    expect(
      within(section('Categories')).getByText('Pre-filled from Google. Not saved yet.'),
    ).toBeInTheDocument();
    expect(within(section('Categories')).getByText('Restaurant')).toBeInTheDocument();
    expect(within(saveBar()).getByText('1 section with changes')).toBeInTheDocument();
    expect(within(saveBar()).getByText(/Categories/)).toBeInTheDocument();
    expect(registerUnsavedMock).toHaveBeenLastCalledWith(
      'restaurant-discovery',
      true,
      expect.any(String),
    );
  });

  it('saves every section with changes in one request', async () => {
    const user = userEvent.setup();
    setSnapshot({}, { categories: [GOOGLE_CATEGORY] });
    render(<RestaurantBusinessContextSection restaurantId="rest-1" />);

    await serveCambridge(user);
    // The switch is edited in Where you serve, so Business status is not marked.
    expect(within(saveBar()).getByText('2 sections with changes')).toBeInTheDocument();
    expect(within(section('Where you serve')).getByText('Edited')).toBeInTheDocument();
    expect(within(section('Business status')).queryByText('Edited')).not.toBeInTheDocument();

    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(1));
    // One transactional request with every changed section, each a full-list replacement. The
    // switch is saved through business details. No revision is sent when the server has none.
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      categories: [
        {
          id: 'gbp-category-1',
          displayName: 'Restaurant',
          categoryCode: 'gcid:restaurant',
          isPrimary: true,
          moreHoursTypes: [],
        },
      ],
      businessDetails: { openingDate: null, businessStatus: null, isServiceAreaBusiness: true },
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
    });

    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith(
        'Saved Categories and Where you serve. Each section replaces its full list.',
      ),
    );
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument();
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
    expect(
      within(section('Categories')).queryByText('Pre-filled from Google. Not saved yet.'),
    ).not.toBeInTheDocument();
  });

  it('sends the loaded revision so a stale save is refused, and explains the conflict', async () => {
    const user = userEvent.setup();
    setSnapshot({}, { categories: [GOOGLE_CATEGORY] });
    serverSnapshot = { ...serverSnapshot, revision: 7 } as RestaurantBusinessContextSnapshot;
    useOpsRestaurantBusinessContextMock.mockReturnValue({
      data: serverSnapshot,
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });
    mutateAsyncMock.mockRejectedValueOnce(
      new HttpError({ message: 'Changed', status: 409, code: 'STALE_WRITE' }),
    );
    render(<RestaurantBusinessContextSection restaurantId="rest-1" />);

    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(1));
    expect(mutateAsyncMock).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 7 }));
    expect(await within(saveBar()).findByText(/Categories not saved\./)).toBeInTheDocument();
    expect(saveBar()).toHaveTextContent('Someone else changed these settings.');
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('keeps every edit and names the unsaved sections when the request fails', async () => {
    const user = userEvent.setup();
    setSnapshot({}, { categories: [GOOGLE_CATEGORY] });
    mutateAsyncMock.mockRejectedValueOnce(
      new HttpError({ message: 'Too Many Requests', status: 429, code: 'RATE_LIMITED' }),
    );
    render(<RestaurantBusinessContextSection restaurantId="rest-1" />);

    await serveCambridge(user);
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }));

    expect(
      await within(saveBar()).findByText(
        'Categories and Where you serve not saved. Your edits are still here.',
      ),
    ).toBeInTheDocument();
    // Nothing is half-saved: the one request either applied every section or none.
    expect(saveBar()).not.toHaveTextContent('Saved:');
    expect(within(saveBar()).getByText('RATE_LIMITED')).toHaveClass('font-mono');
    expect(screen.getByText('Not all changes saved')).toBeInTheDocument();
    expect(within(section('Where you serve')).getByText('Cambridge, UK')).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'We serve customers at their location' }),
    ).toBeChecked();
    expect(toastMock.success).not.toHaveBeenCalled();

    await user.click(within(saveBar()).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(2));
    expect(Object.keys(mutateAsyncMock.mock.calls[1]?.[0] ?? {}).sort()).toEqual([
      'businessDetails',
      'categories',
      'serviceAreas',
    ]);
    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith(
        'Saved Categories and Where you serve. Each section replaces its full list.',
      ),
    );
  });

  it('blocks saving with issues and shows the first one, opening its Advanced area', async () => {
    const user = userEvent.setup();
    setSnapshot();
    render(<RestaurantBusinessContextSection restaurantId="rest-1" />);

    await user.click(screen.getByRole('button', { name: 'Add service' }));
    await user.type(screen.getByLabelText('Service'), 'Private dining');
    expect(screen.queryByLabelText('Service code')).not.toBeInTheDocument();

    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }));

    expect(mutateAsyncMock).not.toHaveBeenCalled();
    expect(within(saveBar()).getByText('1 issue to fix before saving')).toBeInTheDocument();
    const code = await screen.findByLabelText('Service code');
    await waitFor(() => expect(code).toHaveFocus());
    expect(code).toHaveAttribute('aria-invalid', 'true');
    expect(code).toHaveAccessibleDescription('Enter a service code. Each service needs one.');
    const jumpBar = screen.getByRole('navigation', { name: /Sections on this page/i });
    expect(within(jumpBar).getByRole('link', { name: /Services/ })).toHaveTextContent('1 issue');

    const saveButton = within(saveBar()).getByRole('button', { name: 'Save changes' });
    expect(saveButton).toHaveAttribute('aria-disabled', 'true');

    await user.type(code, 'private_dining');
    await user.click(saveButton);
    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        serviceItems: [
          {
            id: undefined,
            itemKey: 'private_dining',
            itemType: null,
            displayName: 'Private dining',
            description: null,
            payload: null,
          },
        ],
      }),
    );
  });

  it('flags an invalid web address and focuses it', async () => {
    const user = userEvent.setup();
    setSnapshot();
    render(<RestaurantBusinessContextSection restaurantId="rest-1" />);

    await user.click(screen.getByRole('button', { name: 'Add link' }));
    await user.type(screen.getByLabelText('Web address'), 'example.com');
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }));

    const address = screen.getByLabelText('Web address');
    await waitFor(() => expect(address).toHaveFocus());
    expect(address).toHaveAccessibleDescription('Enter a full web address, starting with https://');
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('saves amenities as Yes, No or Not set', async () => {
    const user = userEvent.setup();
    setSnapshot();
    render(<RestaurantBusinessContextSection restaurantId="rest-1" />);

    await user.click(screen.getByRole('button', { name: /Amenities & crowd/ }));
    const wifi = screen.getByRole('radiogroup', { name: 'Free Wi-Fi' });
    await user.click(within(wifi).getByRole('radio', { name: 'No' }));
    expect(
      screen.getByRole('button', { name: /Amenities & crowd.*1 of 4 set/ }),
    ).toBeInTheDocument();

    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        attributes: [
          expect.objectContaining({
            id: undefined,
            attributeGroup: 'Amenities & crowd',
            attributeKey: 'has_wifi',
            valueType: 'boolean',
            boolValue: false,
          }),
        ],
      }),
    );
  });

  it('discards every section after confirmation', async () => {
    const user = userEvent.setup();
    setSnapshot({}, { categories: [GOOGLE_CATEGORY] });
    render(<RestaurantBusinessContextSection restaurantId="rest-1" />);

    await serveCambridge(user);
    await user.click(within(saveBar()).getByRole('button', { name: 'Discard' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Discard changes' }),
    );

    expect(screen.queryByText('Cambridge, UK')).not.toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'We serve customers at their location' }),
    ).not.toBeChecked();
    // Discarding a Google pre-fill returns the section to what is saved: nothing.
    expect(within(section('Categories')).getByText('No categories yet.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument();
    expect(toastMock.info).toHaveBeenCalledWith('Changes discarded.');
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('reviews changes per section and can undo one section', async () => {
    const user = userEvent.setup();
    setSnapshot();
    render(<RestaurantBusinessContextSection restaurantId="rest-1" />);

    await serveCambridge(user);
    await user.click(screen.getByRole('combobox', { name: 'Business status' }));
    await user.click(await screen.findByRole('option', { name: 'Closed temporarily' }));
    await user.click(within(saveBar()).getByRole('button', { name: 'Review changes' }));

    const dialog = await screen.findByRole('dialog', { name: 'Review changes' });
    // The switch change is listed under Where you serve, where it is edited.
    const businessStatus = within(dialog).getByRole('heading', { name: 'Business status' });
    const whereYouServe = within(dialog).getByRole('heading', { name: 'Where you serve' });
    const switchChange = within(dialog).getByText('We serve customers at their location');
    expect(businessStatus.compareDocumentPosition(whereYouServe)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(whereYouServe.compareDocumentPosition(switchChange)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    await user.click(
      within(dialog).getByRole('button', { name: /Undo section\s*Where you serve/ }),
    );

    // Undo puts back the areas and the switch, and keeps the Business status edit.
    expect(
      within(dialog).queryByRole('heading', { name: 'Where you serve' }),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Business status' })).toBeInTheDocument();
    // The page sits behind the modal dialog, so query it including hidden elements.
    expect(
      screen.getByRole('switch', { name: 'We serve customers at their location', hidden: true }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('combobox', { name: 'Business status', hidden: true }),
    ).toHaveTextContent('Closed temporarily');
    expect(within(saveBar()).getByText('1 section with changes')).toBeInTheDocument();
  });

  it('names where Google differs and links to the Google page', () => {
    gbpFieldsMock.fields = [
      {
        fieldKey: 'businessContext.attributes.has_wifi',
        sectionKey: 'businessContext.attributes',
        kind: 'businessContext.attribute',
        label: 'Free Wi-Fi',
        helpText: null,
        conflictPolicy: 'manual',
        deletePolicy: 'manual',
        policy: {},
        importable: true,
        exportable: true,
        sortOrder: 1,
        coreValue: {},
        gbpValue: {},
        coreCanonicalHash: 'core',
        gbpCanonicalHash: 'gbp',
        capability: { canImport: true, canExport: true, canIgnore: true, blockedReasons: [] },
        state: 'conflict',
        lastInSyncAt: null,
        lastInSyncHash: null,
        lastCoreChangeAt: null,
        lastGbpChangeAt: null,
        openCandidate: null,
      },
    ];
    // Google has suggestions, so it counts as linked without the drift provider.
    setSnapshot(
      { categories: [{ ...GOOGLE_CATEGORY, id: 'core-category-1', source: 'manual' }] },
      { categories: [GOOGLE_CATEGORY] },
    );
    render(<RestaurantBusinessContextSection restaurantId="rest-1" />);

    const amenities = section('Amenities');
    expect(
      within(amenities).getByText(/Google differs on 1 amenity \(Free Wi-Fi\)\./),
    ).toBeInTheDocument();
    expect(within(amenities).getByRole('link', { name: 'Review on Google page' })).toHaveAttribute(
      'href',
      expect.stringContaining('/settings/restaurant/google-business-profile'),
    );
    expect(within(section('Categories')).getByText('Matches Google')).toBeInTheDocument();
  });

  it('shows a retryable load error with its reason code and no raw message', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    useOpsRestaurantBusinessContextMock.mockReturnValue({
      data: undefined,
      error: new HttpError({ message: 'secret detail', status: 500, code: 'HTTP_500' }),
      isLoading: false,
      refetch,
    });
    render(<RestaurantBusinessContextSection restaurantId="rest-1" />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Discovery details didn’t load');
    expect(alert).toHaveTextContent('Saved settings are unchanged. Reason code HTTP_500');
    expect(alert).not.toHaveTextContent('secret detail');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
