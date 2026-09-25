import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  routerReplaceMock: vi.fn(),
  searchParams: '',
  gbpFields: [] as unknown[],
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/settings/restaurant/menu',
  useSearchParams: () => new URLSearchParams(navigationMocks.searchParams),
  useRouter: () => ({
    replace: navigationMocks.routerReplaceMock,
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/ops/useOpsDualSync', () => ({
  useOpsDualSync: () => ({
    stateQuery: {
      data: { fields: navigationMocks.gbpFields },
      error: null,
      isError: false,
      isLoading: false,
    },
  }),
}));

import { OpsMenuManagementClient } from '@/components/features/menu';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';

import type { CanonicalRestaurantMenu } from '@/server/menu-hierarchy/types';
import type { OpsMembership, OpsUser } from '@/types/ops';

const user: OpsUser = {
  id: 'user-1',
  email: 'ops@example.com',
};

const memberships: OpsMembership[] = [
  {
    restaurantId: 'rest-1',
    restaurantName: 'Test Restaurant',
    role: 'owner',
    createdAt: null,
  },
];

function label(displayName: string, description: string | null = null) {
  return { displayName, description, languageCode: 'en-GB' };
}

function buildCanonicalMenus(): CanonicalRestaurantMenu[] {
  return [
    {
      id: 'menu-food',
      restaurantId: 'rest-1',
      externalMenuId: 'food-main',
      menuKind: 'food',
      labels: [label('Dinner Menu', 'Seasonal food menu')],
      cuisines: [],
      servicePeriods: [],
      sections: [
        {
          id: 'section-starters',
          restaurantId: 'rest-1',
          menuId: 'menu-food',
          externalSectionId: 'starters',
          labels: [label('Starters')],
          displayOrder: 1,
          active: true,
          legacySource: {},
          items: [
            {
              id: 'item-burrata',
              restaurantId: 'rest-1',
              menuId: 'menu-food',
              sectionId: 'section-starters',
              itemKind: 'food',
              externalItemId: 'starter-burrata',
              labels: [label('Burrata')],
              attributes: {
                price: { currencyCode: 'GBP', amount: 9.5 },
                spiciness: null,
                allergen: ['MILK'],
                dietaryRestriction: [],
                ingredients: [],
                preparationMethods: [],
                mediaKeys: ['google-media-1'],
                nutritionFacts: {},
              },
              media: { googleMediaKeys: [], localMedia: {} },
              extensions: {
                drinkProfile: {},
                recommendationMetadata: {},
                availabilityPolicy: {
                  soldOut: false,
                  servicePeriods: ['dinner'],
                },
                customizationControls: {
                  allowCustomizations: true,
                  requiredOptionGroupIds: ['sides'],
                },
                sourceMetadata: {},
              },
              options: [
                {
                  id: 'option-extra-bread',
                  restaurantId: 'rest-1',
                  menuItemId: 'item-burrata',
                  externalOptionId: 'extra-bread',
                  labels: [label('Extra bread')],
                  attributes: {
                    price: { currencyCode: 'GBP', amount: 2 },
                    spiciness: null,
                    allergen: ['GLUTEN'],
                    dietaryRestriction: [],
                    ingredients: [],
                    preparationMethods: [],
                    mediaKeys: [],
                    nutritionFacts: {},
                  },
                  media: { googleMediaKeys: [], localMedia: {} },
                  displayOrder: 1,
                  active: true,
                  legacySource: {},
                },
              ],
              displayOrder: 1,
              active: true,
              legacySource: {},
            },
          ],
        },
      ],
      displayOrder: 1,
      active: true,
      legacySource: {},
    },
    {
      id: 'menu-drinks',
      restaurantId: 'rest-1',
      externalMenuId: 'drinks-main',
      menuKind: 'drinks',
      labels: [label('Drinks Menu')],
      cuisines: [],
      servicePeriods: [],
      sections: [],
      displayOrder: 2,
      active: true,
      legacySource: {},
    },
  ];
}

function renderClient(options?: {
  memberships?: OpsMembership[];
  listMenus?: ReturnType<typeof vi.fn>;
  updateItem?: ReturnType<typeof vi.fn>;
  searchParams?: string;
}) {
  navigationMocks.searchParams = options?.searchParams ?? '';
  const activeMemberships = options?.memberships ?? memberships;
  const listMenus =
    options?.listMenus ?? vi.fn().mockResolvedValue({ menus: buildCanonicalMenus() });
  const updateItem = options?.updateItem ?? vi.fn().mockResolvedValue({});

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OpsServicesProvider
        factories={{
          menuHierarchyService: () =>
            ({
              listMenus,
              updateItem,
            }) as never,
        }}
      >
        <OpsSessionProvider
          user={activeMemberships.length > 0 ? user : null}
          memberships={activeMemberships}
          initialRestaurantId={activeMemberships[0]?.restaurantId ?? null}
        >
          <OpsMenuManagementClient />
        </OpsSessionProvider>
      </OpsServicesProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  navigationMocks.routerReplaceMock.mockReset();
  navigationMocks.searchParams = '';
  navigationMocks.gbpFields = [];
});

describe('OpsMenuManagementClient', () => {
  it('shows a no-access state when the operator has no restaurant memberships', () => {
    renderClient({ memberships: [] });

    expect(screen.getByText('No restaurant access')).toBeInTheDocument();
    expect(screen.queryByText('Food menu')).not.toBeInTheDocument();
  });

  it('renders the canonical menu hierarchy without legacy v1 panels', async () => {
    const listMenus = vi.fn().mockResolvedValue({ menus: buildCanonicalMenus() });
    renderClient({ listMenus });

    expect(screen.getByRole('navigation', { name: 'Menu catalogues' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Food menus' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Food menus' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/menu?catalog=food',
    );
    expect(screen.getByRole('link', { name: 'Drinks and bar' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/menu?catalog=drinks',
    );
    expect(
      screen.getByText(
        'Food and drinks guests can see. Each change saves when you confirm it. Publishing to Google happens separately.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New menu' })).toBeInTheDocument();
    expect(await screen.findByText('Dinner Menu')).toBeInTheDocument();
    // No Google note while nothing differs from Google.
    expect(screen.queryByTestId('menu-google-note')).not.toBeInTheDocument();
    expect(screen.getAllByText('Starters').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Burrata').length).toBeGreaterThan(0);
    expect(screen.queryByText('Legacy item panels (v1 compatibility)')).not.toBeInTheDocument();
    expect(screen.queryByText(/CSV imports/i)).not.toBeInTheDocument();
    expect(listMenus).toHaveBeenCalledWith('rest-1');
  });

  it('keeps ?catalog=drinks and shows only drinks and mixed menus', async () => {
    renderClient({ searchParams: 'catalog=drinks' });

    expect(screen.getByRole('link', { name: 'Drinks and bar' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(await screen.findByRole('heading', { name: 'Drinks Menu' })).toBeInTheDocument();
    expect(screen.queryByText('Dinner Menu')).not.toBeInTheDocument();
    expect(screen.getByText('No sections yet')).toBeInTheDocument();
  });

  it('shows the canonical empty state when no hierarchy menus exist', async () => {
    renderClient({ listMenus: vi.fn().mockResolvedValue({ menus: [] }) });

    expect(await screen.findByText('No menus yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create menu/i })).toBeInTheDocument();
  });

  it('shows the canonical hierarchy error state', async () => {
    renderClient({
      listMenus: vi.fn().mockRejectedValue(new Error('Menu hierarchy request failed.')),
    });

    expect(await screen.findByText('Menus could not be loaded')).toBeInTheDocument();
    expect(screen.queryByText('Menu hierarchy request failed.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('surfaces complete GBP item and option field groups in the canonical editor', async () => {
    const user = userEvent.setup();
    renderClient({ listMenus: vi.fn().mockResolvedValue({ menus: buildCanonicalMenus() }) });

    await user.click(await screen.findByRole('button', { name: 'Edit Burrata' }));

    const dialog = await screen.findByRole('dialog', { name: 'Edit Burrata' });
    expect(within(dialog).getByText('Item name')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /Google details/ }));
    expect(within(dialog).getByText('Primary label language')).toBeInTheDocument();
    expect(within(dialog).getByText('Additional Google labels')).toBeInTheDocument();
    expect(within(dialog).getByText('Guest menu portion size')).toBeInTheDocument();
    expect(within(dialog).getAllByPlaceholderText('Upper GRAM').length).toBeGreaterThan(0);

    await user.click(within(dialog).getByRole('button', { name: /Options guests can choose/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Edit option Extra bread' }));

    expect(await screen.findByRole('dialog', { name: 'Edit item option' })).toBeInTheDocument();
    expect(screen.getByText('Option Google attributes')).toBeInTheDocument();
    expect(screen.getByText('Option portion and nutrition')).toBeInTheDocument();
    expect(screen.getByText('Option media keys')).toBeInTheDocument();
  });

  it('quick edit updates price without clearing option or Google fields', async () => {
    const user = userEvent.setup();
    const updateItem = vi.fn().mockResolvedValue({});
    renderClient({
      listMenus: vi.fn().mockResolvedValue({ menus: buildCanonicalMenus() }),
      updateItem,
    });

    await screen.findByText('Dinner Menu');
    await user.click(screen.getAllByRole('button', { name: /Open item actions for Burrata/i })[0]!);
    await user.click(await screen.findByRole('menuitem', { name: /Quick edit/i }));

    expect(await screen.findByRole('dialog', { name: 'Quick edit item' })).toBeInTheDocument();
    const priceInput = screen.getByDisplayValue('9.5');
    await user.clear(priceInput);
    await user.type(priceInput, '10.25');
    await user.click(screen.getByRole('button', { name: 'Save quick edit' }));

    await waitFor(() => expect(updateItem).toHaveBeenCalledTimes(1));
    expect(updateItem).toHaveBeenCalledWith(
      'rest-1',
      'menu-food',
      'section-starters',
      'item-burrata',
      expect.objectContaining({
        attributes: expect.objectContaining({
          price: { currencyCode: 'GBP', amount: 10.25 },
          allergen: ['MILK'],
          mediaKeys: ['google-media-1'],
        }),
        extensions: expect.objectContaining({
          availabilityPolicy: expect.objectContaining({
            servicePeriods: ['dinner'],
            soldOut: false,
          }),
          customizationControls: expect.objectContaining({
            requiredOptionGroupIds: ['sides'],
          }),
        }),
      }),
    );
    expect(updateItem.mock.calls[0]?.[4]).not.toHaveProperty('options');
  });

  it('shows FoodMenus drift beside matching menu items', async () => {
    navigationMocks.gbpFields = [
      {
        fieldKey:
          'foodMenus.items.starters.foodMenu_menu_menu-food_section_section-starters_item_starter-burrata',
        sectionKey: 'foodMenus',
        kind: 'foodMenu.item',
        label: 'Burrata',
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
        state: 'drifted',
        lastInSyncAt: null,
        lastInSyncHash: null,
        lastCoreChangeAt: null,
        lastGbpChangeAt: null,
        openCandidate: null,
      },
    ];
    renderClient({ listMenus: vi.fn().mockResolvedValue({ menus: buildCanonicalMenus() }) });

    expect(await screen.findByText('Differs from Google')).toBeInTheDocument();
    const note = screen.getByTestId('menu-google-note');
    expect(note).toHaveTextContent(
      '1 item differs from what Google shows. Publishing a menu to Google replaces Google’s whole menu.',
    );
    expect(within(note).getByRole('link', { name: 'Google Business Profile' })).toHaveAttribute(
      'href',
      expect.stringContaining('/settings/restaurant/google-business-profile'),
    );
  });
});
