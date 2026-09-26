import { screen, within } from '@testing-library/react';
import { vi } from 'vitest';

import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuOption,
  CanonicalRestaurantMenuSection,
} from '@/server/menu-hierarchy/types';

export function label(displayName: string, description: string | null = null) {
  return { displayName, description, languageCode: 'en-GB' };
}

export function makeOption(
  overrides: Partial<CanonicalRestaurantMenuOption> = {},
): CanonicalRestaurantMenuOption {
  return {
    id: 'option-1',
    restaurantId: 'rest-1',
    menuItemId: 'item-1',
    externalOptionId: 'ext-option-1',
    labels: [label('Extra bread')],
    attributes: {
      price: { currencyCode: 'GBP', amount: 2 },
      spiciness: null,
      allergen: [],
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
    ...overrides,
  } as CanonicalRestaurantMenuOption;
}

export function makeItem(
  overrides: Partial<CanonicalRestaurantMenuItem> = {},
): CanonicalRestaurantMenuItem {
  return {
    id: 'item-1',
    restaurantId: 'rest-1',
    menuId: 'menu-1',
    sectionId: 'section-1',
    itemKind: 'food',
    externalItemId: 'ext-item-1',
    labels: [label('Burrata', 'Creamy starter')],
    attributes: {
      price: { currencyCode: 'GBP', amount: 9.5 },
      spiciness: null,
      allergen: ['DAIRY'],
      dietaryRestriction: [],
      ingredients: [],
      preparationMethods: [],
      mediaKeys: [],
      nutritionFacts: {},
    },
    media: { googleMediaKeys: ['media-key-1'], localMedia: {} },
    extensions: {
      drinkProfile: {},
      recommendationMetadata: {},
      availabilityPolicy: {},
      customizationControls: {},
      sourceMetadata: {},
    },
    options: [],
    displayOrder: 1,
    active: true,
    legacySource: {},
    ...overrides,
  } as CanonicalRestaurantMenuItem;
}

export function makeSection(
  overrides: Partial<CanonicalRestaurantMenuSection> = {},
): CanonicalRestaurantMenuSection {
  return {
    id: 'section-1',
    restaurantId: 'rest-1',
    menuId: 'menu-1',
    externalSectionId: 'ext-section-1',
    labels: [label('Starters')],
    displayOrder: 1,
    active: true,
    legacySource: {},
    items: [makeItem()],
    ...overrides,
  } as CanonicalRestaurantMenuSection;
}

export function makeMenu(
  overrides: Partial<CanonicalRestaurantMenu> = {},
): CanonicalRestaurantMenu {
  return {
    id: 'menu-1',
    restaurantId: 'rest-1',
    externalMenuId: 'ext-menu-1',
    menuKind: 'food',
    labels: [label('Dinner Menu', 'Seasonal food menu')],
    cuisines: [],
    servicePeriods: [],
    sections: [makeSection()],
    displayOrder: 1,
    active: true,
    legacySource: {},
    ...overrides,
  } as CanonicalRestaurantMenu;
}

export type MutationStub = {
  mutateAsync: ReturnType<typeof vi.fn>;
  mutate: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  isPending: boolean;
  error: Error | null;
  variables?: unknown;
};

/** Fresh react-query mutation stub. Create inside each test (config resets mocks). */
export function mutationStub(overrides: Partial<MutationStub> = {}): MutationStub {
  return {
    mutateAsync: vi.fn().mockResolvedValue({}),
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    error: null,
    variables: undefined,
    ...overrides,
  };
}

/**
 * Locates the switch rendered next to a SwitchField label. KNOWN-ISSUE:
 * SwitchField renders its Label as a sibling without htmlFor/id, so the
 * switch has no accessible name and cannot be queried by role+name; tests
 * scope through the shared row instead (defect documented in
 * menuHierarchyFormControls.test.tsx).
 */
export function switchByLabel(labelText: string) {
  const label = screen.getByText(labelText);
  return within(label.parentElement as HTMLElement).getByRole('switch');
}

/**
 * Applies a captured `setState((current) => next)` updater from a mocked
 * state setter to a base state, returning the patched state. Lets field
 * suites assert patch semantics without a stateful harness.
 */
export function applySetterCalls<T>(setter: ReturnType<typeof vi.fn>, base: T): T {
  return setter.mock.calls.reduce<T>((state, call) => {
    const update = call[0];
    return typeof update === 'function' ? update(state) : { ...state, ...update };
  }, base);
}
