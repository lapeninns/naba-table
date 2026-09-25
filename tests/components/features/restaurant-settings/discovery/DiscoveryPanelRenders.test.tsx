import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RestaurantBusinessContextSection } from '@/components/features/restaurant-settings/RestaurantBusinessContextSection';

import type {
  RestaurantBusinessContextAttribute,
  RestaurantBusinessContextCategory,
  RestaurantBusinessContextFamily,
  RestaurantBusinessContextLink,
  RestaurantBusinessContextServiceArea,
  RestaurantBusinessContextServiceItem,
} from '@/services/ops/restaurants';

/**
 * Counts how often each Discovery panel's own render function runs. The counter sits inside
 * any `React.memo` wrapper the panel ships with, so a memo bail-out is not counted.
 */
const panelRenders = vi.hoisted(() => {
  type RenderFn = (props: object) => unknown;
  const counts = new Map<string, number>();

  function isRenderFn(value: unknown): value is RenderFn {
    return typeof value === 'function';
  }
  function isMemoComponent(value: unknown): value is { type: RenderFn } {
    return typeof value === 'object' && value !== null && 'type' in value && isRenderFn(value.type);
  }
  function counted(name: string, renderPanel: RenderFn): RenderFn {
    return (props) => {
      counts.set(name, (counts.get(name) ?? 0) + 1);
      return renderPanel(props);
    };
  }
  function instrument(name: string, component: unknown): unknown {
    if (isMemoComponent(component)) {
      component.type = counted(name, component.type);
      return component;
    }
    if (isRenderFn(component)) {
      return counted(name, component);
    }
    throw new Error(`Cannot count renders of ${name}`);
  }
  function snapshot() {
    return Object.fromEntries(
      ['businessDetails', 'categories', 'links', 'attributes', 'serviceItems', 'serviceAreas'].map(
        (name) => [name, counts.get(name) ?? 0],
      ),
    );
  }

  return { counts, instrument, snapshot };
});

vi.mock(
  '@/components/features/restaurant-settings/discovery/panels/BusinessDetailsPanel',
  async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
      ...actual,
      BusinessDetailsPanel: panelRenders.instrument('businessDetails', actual.BusinessDetailsPanel),
    };
  },
);
vi.mock(
  '@/components/features/restaurant-settings/discovery/panels/CategoriesPanel',
  async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
      ...actual,
      CategoriesPanel: panelRenders.instrument('categories', actual.CategoriesPanel),
    };
  },
);
vi.mock(
  '@/components/features/restaurant-settings/discovery/panels/LinksPanel',
  async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual, LinksPanel: panelRenders.instrument('links', actual.LinksPanel) };
  },
);
vi.mock(
  '@/components/features/restaurant-settings/discovery/panels/AttributesPanel',
  async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
      ...actual,
      AttributesPanel: panelRenders.instrument('attributes', actual.AttributesPanel),
    };
  },
);
vi.mock(
  '@/components/features/restaurant-settings/discovery/panels/ServiceItemsPanel',
  async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
      ...actual,
      ServiceItemsPanel: panelRenders.instrument('serviceItems', actual.ServiceItemsPanel),
    };
  },
);
vi.mock(
  '@/components/features/restaurant-settings/discovery/panels/ServiceAreasPanel',
  async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
      ...actual,
      ServiceAreasPanel: panelRenders.instrument('serviceAreas', actual.ServiceAreasPanel),
    };
  },
);

const useOpsRestaurantBusinessContextMock = vi.hoisted(() => vi.fn());
const useOpsUpdateRestaurantBusinessContextMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/ops/useOpsRestaurantBusinessContext', () => ({
  useOpsRestaurantBusinessContext: useOpsRestaurantBusinessContextMock,
  useOpsUpdateRestaurantBusinessContext: useOpsUpdateRestaurantBusinessContextMock,
}));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useRegisterOpsUnsavedChanges: vi.fn(),
  useRegisterOptionalOpsUnsavedChanges: vi.fn(),
}));

vi.mock('@/hooks/ops/useOpsDualSync', () => ({
  useOpsDualSync: () => ({
    stateQuery: { data: { fields: [] }, error: null, isError: false, isLoading: false },
  }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const SAVED = { source: 'manual', managedBy: 'ops', updatedAt: '2026-09-01T09:00:00.000Z' };

function range<T>(count: number, make: (index: number) => T): T[] {
  return Array.from({ length: count }, (_, index) => make(index));
}

/** A large restaurant: 40 categories, 60 amenities, 20 areas, plus links and services. */
function largeCore(): RestaurantBusinessContextFamily {
  return {
    businessDetails: {
      id: 'bd-1',
      openingDate: '2019-05-01',
      businessStatus: 'OPEN',
      isServiceAreaBusiness: true,
      ...SAVED,
    },
    links: range<RestaurantBusinessContextLink>(4, (index) => ({
      id: `link-${index}`,
      linkType: 'website',
      linkStatus: 'active',
      label: `Link ${index}`,
      url: `https://example.com/${index}`,
      isPrimary: index === 0,
      ...SAVED,
    })),
    categories: range<RestaurantBusinessContextCategory>(40, (index) => ({
      id: `category-${index}`,
      displayName: `Category ${index}`,
      categoryCode: `gcid:category_${index}`,
      moreHoursTypes: [],
      isPrimary: index === 0,
      ...SAVED,
    })),
    serviceAreas: range<RestaurantBusinessContextServiceArea>(20, (index) => ({
      id: `area-${index}`,
      displayName: `Town ${index}, UK`,
      areaType: 'locality',
      regionCode: 'GB',
      googlePlaceId: null,
      googlePlaceResourceName: null,
      placeData: null,
      ...SAVED,
    })),
    attributes: range<RestaurantBusinessContextAttribute>(60, (index) => ({
      id: `attribute-${index}`,
      attributeGroup: 'Amenities & crowd',
      attributeKey: `amenity_${index}`,
      attributeName: null,
      attributeId: null,
      displayName: `Amenity ${index}`,
      displayText: null,
      displayTextStandalone: null,
      displayTextNegative: null,
      valueType: 'boolean',
      boolValue: index % 2 === 0,
      textValue: null,
      uriValue: null,
      uriValues: [],
      enumValues: [],
      unsetEnumValues: [],
      rawValue: null,
      rawEnumValues: null,
      displayValue: null,
      valueMetadata: [],
      ...SAVED,
    })),
    serviceItems: range<RestaurantBusinessContextServiceItem>(4, (index) => ({
      id: `service-${index}`,
      itemKey: `service_${index}`,
      itemType: 'structured',
      displayName: `Service ${index}`,
      description: null,
      payload: null,
      ...SAVED,
    })),
  };
}

const EMPTY_FAMILY: RestaurantBusinessContextFamily = {
  businessDetails: null,
  links: [],
  categories: [],
  serviceAreas: [],
  attributes: [],
  serviceItems: [],
};

function section(name: string) {
  return screen.getByRole('region', { name });
}

function renderLargeDiscovery() {
  useOpsRestaurantBusinessContextMock.mockReturnValue({
    data: { core: largeCore(), providerSnapshot: EMPTY_FAMILY },
    error: null,
    isLoading: false,
    refetch: vi.fn(),
  });
  render(<RestaurantBusinessContextSection restaurantId="rest-1" />);
  panelRenders.counts.clear();
}

const NO_RENDERS = {
  businessDetails: 0,
  categories: 0,
  links: 0,
  attributes: 0,
  serviceItems: 0,
  serviceAreas: 0,
};

// The large fixture renders a full page, which is slow when the suite runs in parallel.
describe('Discovery panel re-renders', { timeout: 30_000 }, () => {
  beforeEach(() => {
    useOpsUpdateRestaurantBusinessContextMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it('typing in a link re-renders only the Links panel', async () => {
    const user = userEvent.setup({ delay: null });
    renderLargeDiscovery();

    const address = within(section('Links')).getAllByLabelText('Web address')[1];
    await user.type(address, '/menu');

    const renders = panelRenders.snapshot();
    expect(renders.links).toBeGreaterThan(0);
    expect({ ...renders, links: 0 }).toEqual(NO_RENDERS);
  });

  it('typing in a service re-renders only the Services panel', async () => {
    const user = userEvent.setup({ delay: null });
    renderLargeDiscovery();

    const service = within(section('Services')).getAllByLabelText('Service')[2];
    await user.type(service, ' extra');

    const renders = panelRenders.snapshot();
    expect(renders.serviceItems).toBeGreaterThan(0);
    expect({ ...renders, serviceItems: 0 }).toEqual(NO_RENDERS);
  });

  it('adding an area re-renders only Where you serve', async () => {
    const user = userEvent.setup({ delay: null });
    renderLargeDiscovery();

    await user.type(within(section('Where you serve')).getByLabelText('New area'), 'Ely{Enter}');

    expect(within(section('Where you serve')).getByText('Ely')).toBeInTheDocument();
    const renders = panelRenders.snapshot();
    expect(renders.serviceAreas).toBeGreaterThan(0);
    expect({ ...renders, serviceAreas: 0 }).toEqual(NO_RENDERS);
  });

  it('keeps a field issue on its own panel without re-rendering the others', async () => {
    const user = userEvent.setup({ delay: null });
    renderLargeDiscovery();

    const address = within(section('Links')).getAllByLabelText('Web address')[0];
    await user.clear(address);
    await user.type(address, 'example.com');
    await user.tab();

    expect(address).toHaveAccessibleDescription('Enter a full web address, starting with https://');
    const renders = panelRenders.snapshot();
    expect({ ...renders, links: 0 }).toEqual(NO_RENDERS);
  });
});
