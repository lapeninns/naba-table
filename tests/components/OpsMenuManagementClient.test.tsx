import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  routerReplaceMock: vi.fn(),
  searchParams: '',
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

import { OpsMenuManagementClient } from '@/components/features/menu';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';

import type { DrinkMenuService } from '@/services/ops/drinks-menu';
import type { MenuService } from '@/services/ops/menu';
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

function buildMenuListResponse() {
  return {
    items: [
      {
        id: 'item-1',
        restaurantId: 'rest-1',
        externalItemId: 'starter-burrata',
        itemName: 'Burrata',
        category: 'Starters',
        subcategory: 'Cold',
        basePrice: 9.5,
        currency: 'GBP',
        serviceTime: 'Lunch',
        availabilityStatus: 'available' as const,
        active: true,
        soldOut: false,
        displayOrder: 10,
        imageUrl: null,
        modifierGroupCount: 1,
        updatedAt: new Date().toISOString(),
      },
    ],
    facets: {
      categories: ['Starters'],
      subcategories: ['Cold'],
      serviceTimes: ['Lunch'],
    },
  };
}

function buildMenuDetail() {
  return {
    id: 'item-1',
    restaurantId: 'rest-1',
    externalItemId: 'starter-burrata',
    itemName: 'Burrata',
    category: 'Starters',
    subcategory: 'Cold',
    shortDescription: 'Short',
    fullDescription: 'Full',
    basePrice: 9.5,
    currency: 'GBP',
    serviceTime: 'Lunch',
    availabilityStatus: 'available' as const,
    keyIngredients: [],
    mainProteinOrBase: null,
    cookingStyle: null,
    preparationMethod: null,
    flavorProfile: null,
    texture: null,
    spiceLevel: null,
    spiceAdjustable: false,
    portionSize: null,
    shareable: false,
    recommendationTags: [],
    pairings: [],
    signatureScore: null,
    popularityScore: null,
    dietaryTags: [],
    allergensContains: [],
    allergensMayContain: [],
    removableIngredients: [],
    substitutionsAllowed: false,
    canBeMadeVegetarian: false,
    canBeMadeVegan: false,
    canBeMadeGlutenFree: false,
    customizationRules: null,
    servingNotes: null,
    active: true,
    seasonal: false,
    limitedTime: false,
    soldOut: false,
    displayOrder: 10,
    imageUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    modifierGroups: [],
  };
}

function buildDrinkListResponse() {
  return {
    items: [
      {
        id: 'drink-1',
        restaurantId: 'rest-1',
        externalDrinkId: 'house-negroni',
        drinkName: 'House Negroni',
        category: 'Cocktails',
        subcategory: 'Classics',
        basePrice: 11.5,
        currency: 'GBP',
        serviceTime: 'Evening',
        availabilityStatus: 'available' as const,
        drinkType: 'Cocktail',
        alcoholic: true,
        active: true,
        soldOut: false,
        displayOrder: 20,
        imageUrl: null,
        modifierGroupCount: 0,
        updatedAt: new Date().toISOString(),
      },
    ],
    facets: {
      categories: ['Cocktails'],
      subcategories: ['Classics'],
      serviceTimes: ['Evening'],
      drinkTypes: ['Cocktail'],
    },
  };
}

function buildDrinkDetail() {
  return {
    id: 'drink-1',
    restaurantId: 'rest-1',
    externalDrinkId: 'house-negroni',
    drinkName: 'House Negroni',
    category: 'Cocktails',
    subcategory: 'Classics',
    shortDescription: 'Short',
    fullDescription: 'Full',
    basePrice: 11.5,
    currency: 'GBP',
    serviceTime: 'Evening',
    availabilityStatus: 'available' as const,
    drinkType: 'Cocktail',
    alcoholic: true,
    abv: 24,
    volumeMl: 120,
    servingSize: 'Short serve',
    servedStyle: 'On the rocks',
    temperature: 'Cold',
    baseSpirit: 'Gin',
    beerStyle: null,
    wineType: null,
    grapeVarietal: null,
    region: null,
    country: 'United Kingdom',
    roastLevel: null,
    caffeineLevel: null,
    sweetnessLevel: 'Low',
    bitternessLevel: 'High',
    acidityLevel: 'Low',
    bodyLevel: 'Medium',
    flavorProfile: 'Bitter, herbal, citrus',
    keyIngredients: [],
    garnish: 'Orange peel',
    containsDairy: false,
    containsNuts: false,
    containsGluten: false,
    containsCaffeine: false,
    dietaryTags: [],
    allergensContains: [],
    allergensMayContain: [],
    canBeMadeNonAlcoholic: true,
    canBeMadeDecaf: false,
    customizationRules: null,
    pairings: [],
    signatureScore: 92,
    popularityScore: 88,
    recommendationTags: [],
    seasonal: false,
    limitedTime: false,
    soldOut: false,
    active: true,
    displayOrder: 20,
    imageUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    modifierGroups: [],
  };
}

function createMenuService(overrides: Partial<MenuService> = {}): MenuService {
  return {
    listItems: vi.fn().mockResolvedValue(buildMenuListResponse()),
    getItem: vi.fn().mockResolvedValue(buildMenuDetail()),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    previewImport: vi.fn(),
    applyImport: vi.fn(),
    ...overrides,
  };
}

function createDrinkMenuService(overrides: Partial<DrinkMenuService> = {}): DrinkMenuService {
  return {
    listItems: vi.fn().mockResolvedValue(buildDrinkListResponse()),
    getItem: vi.fn().mockResolvedValue(buildDrinkDetail()),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    previewImport: vi.fn(),
    applyImport: vi.fn(),
    ...overrides,
  };
}

function renderClient(options?: {
  memberships?: OpsMembership[];
  menuService?: MenuService;
  drinkMenuService?: DrinkMenuService;
  searchParams?: string;
}) {
  navigationMocks.searchParams = options?.searchParams ?? '';
  const activeMemberships = options?.memberships ?? memberships;

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OpsServicesProvider
        factories={{
          menuService: () => options?.menuService ?? createMenuService(),
          drinkMenuService: () => options?.drinkMenuService ?? createDrinkMenuService(),
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
});

describe('OpsMenuManagementClient', () => {
  it('shows a no-access state when the operator has no restaurant memberships', () => {
    renderClient({ memberships: [] });

    expect(screen.getByText('No restaurant access')).toBeInTheDocument();
    expect(screen.queryByText('Food menu')).not.toBeInTheDocument();
  });

  it('switches catalog mode through the route query string', async () => {
    const user = userEvent.setup();
    renderClient();

    await user.click(screen.getByRole('tab', { name: 'Drinks menu' }));

    expect(navigationMocks.routerReplaceMock).toHaveBeenCalledWith(
      '/app/settings/restaurant/menu?catalog=drinks',
      { scroll: false },
    );
  });

  it('renders menu rows and opens the edit sheet', async () => {
    const user = userEvent.setup();
    renderClient();

    expect(await screen.findByText('Burrata')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(await screen.findByText('Edit menu item')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Burrata')).toBeInTheDocument();
  });

  it('captures search input changes', async () => {
    const user = userEvent.setup();
    const menuService = createMenuService();
    renderClient({ menuService });

    expect(await screen.findByText('Burrata')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search name, category, subcategory'), 'Burr');

    expect(screen.getByDisplayValue('Burr')).toBeInTheDocument();
    await waitFor(() =>
      expect(menuService.listItems).toHaveBeenLastCalledWith(
        'rest-1',
        expect.objectContaining({
          search: 'Burr',
          status: 'all',
        }),
      ),
    );
  });

  it('marks stale food rows inert while filter changes refetch', async () => {
    const user = userEvent.setup();
    const menuService = createMenuService({
      listItems: vi
        .fn()
        .mockResolvedValueOnce(buildMenuListResponse())
        .mockImplementationOnce(() => new Promise(() => {})),
    });
    renderClient({ menuService });

    expect(await screen.findByText('Burrata')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search name, category, subcategory'), 'pizza');

    await waitFor(() =>
      expect(menuService.listItems).toHaveBeenLastCalledWith(
        'rest-1',
        expect.objectContaining({
          search: 'pizza',
        }),
      ),
    );

    const staleBoundary = screen.getByText('Burrata').closest('[data-slot="stale-boundary"]');
    expect(staleBoundary).toHaveAttribute('aria-busy', 'true');
    expect(staleBoundary).toHaveAttribute('inert');
    expect(staleBoundary).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows a food list error state', async () => {
    renderClient({
      menuService: createMenuService({
        listItems: vi.fn().mockRejectedValue(new Error('Food list request failed.')),
      }),
    });

    expect(await screen.findByText('Unable to load food items.')).toBeInTheDocument();
  });

  it('shows an empty food list state', async () => {
    renderClient({
      menuService: createMenuService({
        listItems: vi.fn().mockResolvedValue({
          items: [],
          facets: { categories: [], serviceTimes: [], subcategories: [] },
        }),
      }),
    });

    expect(await screen.findByText('No food items match the current filters.')).toBeInTheDocument();
  });

  it('shows an error state instead of a blank create form when food item loading fails', async () => {
    const user = userEvent.setup();
    renderClient({
      menuService: createMenuService({
        getItem: vi.fn().mockRejectedValue(new Error('Food detail request failed.')),
      }),
    });

    expect(await screen.findByText('Burrata')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(await screen.findByText('Unable to load menu item')).toBeInTheDocument();
    expect(screen.getByText('Food detail request failed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save item' })).toBeDisabled();
  });

  it('shows an error state instead of a blank create form when drink item loading fails', async () => {
    const user = userEvent.setup();
    renderClient({
      searchParams: 'catalog=drinks',
      drinkMenuService: createDrinkMenuService({
        getItem: vi.fn().mockRejectedValue(new Error('Drink detail request failed.')),
      }),
    });

    expect(await screen.findByText('House Negroni')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(await screen.findByText('Unable to load drink item')).toBeInTheDocument();
    expect(screen.getByText('Drink detail request failed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save drink' })).toBeDisabled();
  });
});
