import { formatGoogleFoodMenuEnumLabel as formatEnumLabel } from '@/lib/google-food-menu-labels';

import type {
  CanonicalMenuItemAttributes,
  CanonicalRestaurantMenuItem,
} from '@/server/menu-hierarchy/types';

export { itemInitialState, optionInitialState } from './menuHierarchyItemInitialState';
export { buildItemPayload, buildOptionPayload } from './menuHierarchyItemPayload';
export type { ItemFormState, OptionFormState } from './menuHierarchyItemFormState';

export function moneyLabel(attributes: CanonicalMenuItemAttributes) {
  const amount = attributes.price?.amount;
  const currency = attributes.price?.currencyCode ?? 'GBP';
  return typeof amount === 'number'
    ? new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
      }).format(amount)
    : 'No price';
}

export function normalizedServiceLabel(value: string) {
  const normalized = value.toLowerCase().replace(/[_-]+/g, ' ');
  if (normalized.includes('deliver')) return 'Delivery';
  if (normalized.includes('pickup') || normalized.includes('collection')) return 'Pickup';
  if (normalized.includes('dine') || normalized.includes('restaurant')) return 'Dine-in';
  return formatEnumLabel(value);
}

export type ItemHealth = 'ready' | 'incomplete' | 'inactive';

export function deriveItemHealth(item: CanonicalRestaurantMenuItem): {
  health: ItemHealth;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!item.active) {
    return { health: 'inactive', reasons: ['Inactive'] };
  }
  if (typeof item.attributes.price?.amount !== 'number') {
    reasons.push('Missing price');
  }
  if (
    (item.media.googleMediaKeys?.length ?? 0) === 0 &&
    !item.media.localImageUrl &&
    Object.keys(item.media.localMedia ?? {}).length === 0
  ) {
    reasons.push('Missing media');
  }
  return reasons.length === 0
    ? { health: 'ready', reasons: ['Ready to publish'] }
    : { health: 'incomplete', reasons };
}

export type ItemReadiness =
  | { status: 'ready'; label: string; missing: [] }
  | { status: 'needs-attention'; label: string; missing: Array<'price' | 'photo'> }
  | { status: 'hidden'; label: string; missing: [] };

/**
 * Google readiness line for an item row. Built on `deriveItemHealth`, and names exactly what
 * is missing ("Needs price and photo for Google").
 */
export function deriveItemReadiness(item: CanonicalRestaurantMenuItem): ItemReadiness {
  const { health, reasons } = deriveItemHealth(item);
  if (health === 'inactive') {
    return { status: 'hidden', label: 'Hidden from menu', missing: [] };
  }
  if (health === 'ready') {
    return { status: 'ready', label: 'Ready for Google', missing: [] };
  }
  const missing: Array<'price' | 'photo'> = [];
  if (reasons.includes('Missing price')) missing.push('price');
  if (reasons.includes('Missing media')) missing.push('photo');
  return {
    status: 'needs-attention',
    label: `Needs ${missing.join(' and ')} for Google`,
    missing,
  };
}

export function itemNeedsAttention(item: CanonicalRestaurantMenuItem) {
  return deriveItemHealth(item).health === 'incomplete';
}

export type ItemAvailabilityPolicy = {
  soldOut: boolean;
  orderable: boolean;
  servicePeriods: string[];
};

export function itemAvailabilityPolicy(item: CanonicalRestaurantMenuItem): ItemAvailabilityPolicy {
  const policy = item.extensions?.availabilityPolicy as Record<string, unknown> | undefined;
  return {
    soldOut: policy?.soldOut === true,
    orderable: policy?.orderable !== false,
    servicePeriods: Array.isArray(policy?.servicePeriods)
      ? policy.servicePeriods.filter(
          (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
        )
      : [],
  };
}

/** "All services" when no service period is set, otherwise the named periods. */
export function itemServicesLabel(item: CanonicalRestaurantMenuItem) {
  const { servicePeriods } = itemAvailabilityPolicy(item);
  if (servicePeriods.length === 0) return 'All services';
  return [...new Set(servicePeriods.map(normalizedServiceLabel))].join(', ');
}

export type MenuItemStatusFilter = 'all' | 'attention' | 'sold-out';

export type MenuItemFilter = {
  query: string;
  status: MenuItemStatusFilter;
};

export const DEFAULT_MENU_ITEM_FILTER: MenuItemFilter = { query: '', status: 'all' };

export function isMenuItemFilterActive(filter: MenuItemFilter) {
  return filter.query.trim().length > 0 || filter.status !== 'all';
}

export function menuItemMatchesFilter(item: CanonicalRestaurantMenuItem, filter: MenuItemFilter) {
  const query = filter.query.trim().toLowerCase();
  if (query) {
    const haystack = item.labels
      .flatMap((entry) => [entry.displayName, entry.description ?? ''])
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  if (filter.status === 'attention') return itemNeedsAttention(item);
  if (filter.status === 'sold-out') return itemAvailabilityPolicy(item).soldOut;
  return true;
}
