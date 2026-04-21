import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const { routerReplaceMock } = vi.hoisted(() => ({
  routerReplaceMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/settings/restaurant/menu',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    replace: routerReplaceMock,
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import { OpsMenuManagementClient } from '@/components/features/menu';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';

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

function createMenuService(): MenuService {
  return {
    listItems: vi.fn().mockResolvedValue({
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
          availabilityStatus: 'available',
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
    }),
    getItem: vi.fn().mockResolvedValue({
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
      availabilityStatus: 'available',
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
    }),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    previewImport: vi.fn(),
    applyImport: vi.fn(),
  };
}

function renderClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OpsServicesProvider
        factories={{
          menuService: () => createMenuService(),
        }}
      >
        <OpsSessionProvider user={user} memberships={memberships} initialRestaurantId="rest-1">
          <OpsMenuManagementClient />
        </OpsSessionProvider>
      </OpsServicesProvider>
    </QueryClientProvider>,
  );
}

describe('OpsMenuManagementClient', () => {
  it('renders menu rows and opens the edit sheet', async () => {
    const user = userEvent.setup();
    renderClient();

    expect(await screen.findByText('Burrata')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(await screen.findByText('Edit menu item')).toBeInTheDocument();
    // External ID lives under collapsed "Advanced metadata"; item name is always visible.
    expect(screen.getByDisplayValue('Burrata')).toBeInTheDocument();
  });

  it('captures search input changes', async () => {
    const user = userEvent.setup();
    renderClient();

    expect(await screen.findByText('Burrata')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search name, category, subcategory'), 'Burr');

    expect(screen.getByDisplayValue('Burr')).toBeInTheDocument();
  });
});
