import { formatGoogleFoodMenuEnumLabel as formatEnumLabel } from '@/lib/google-food-menu-labels';

import { primaryDescription } from './menuHierarchySharedDomain';

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

export function itemDescription(item: CanonicalRestaurantMenuItem) {
  return primaryDescription(item).trim() || 'No description yet';
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
