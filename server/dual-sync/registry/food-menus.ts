/**
 * FoodMenus registry builder.
 *
 * Each field represents one projected menu item identified by a stable
 * local key. Google FoodMenus is a repeated full-resource payload, so these
 * fields are state/review units only; publishing still needs a full
 * preflight-protected FoodMenus projection.
 */

import { canonicalizeStringArray, canonicalizeText, slugifyDisplay } from './normalizers';

import type { DualSyncFieldConfig } from './types';

interface FoodMenuItemValue {
  readonly stableKey: string;
  readonly itemName: string;
  readonly sectionLabel: string;
  readonly description: string | null;
  readonly basePrice: number | null;
  readonly currency: string | null;
  readonly spiceLevel?: string | null;
  readonly preparationMethod?: string | null;
  readonly portionSize?: string | null;
  readonly keyIngredients?: ReadonlyArray<string>;
  readonly imageUrl?: string | null;
  readonly caloriesKcal?: number | null;
  readonly proteinG?: number | null;
  readonly fatG?: number | null;
  readonly saturatedFatG?: number | null;
  readonly carbsG?: number | null;
  readonly sugarG?: number | null;
  readonly fiberG?: number | null;
  readonly sodiumMg?: number | null;
  readonly servesNum?: number | null;
  readonly dietaryTags: ReadonlyArray<string>;
  readonly allergensContains: ReadonlyArray<string>;
  readonly googlePath: string | null;
}

function readFoodMenuItems(value: unknown): ReadonlyArray<FoodMenuItemValue> {
  if (!value || typeof value !== 'object') return [];
  const items = (value as { items?: unknown }).items;
  return Array.isArray(items) ? (items as ReadonlyArray<FoodMenuItemValue>) : [];
}

function foodMenuItemValue(value: unknown, stableKey: string): FoodMenuItemValue | null {
  return readFoodMenuItems(value).find((entry) => entry?.stableKey === stableKey) ?? null;
}

function canonicalizePrice(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Number(value.toFixed(2));
}

function canonicalizeFoodMenuItem(value: unknown, stableKey: string): unknown {
  const item = foodMenuItemValue(value, stableKey);
  if (!item) return null;
  return {
    stableKey: item.stableKey,
    itemName: canonicalizeText(item.itemName),
    sectionLabel: canonicalizeText(item.sectionLabel),
    description: canonicalizeText(item.description),
    basePrice: canonicalizePrice(item.basePrice),
    currency: item.currency?.trim().toUpperCase() ?? null,
    spiceLevel: canonicalizeText(item.spiceLevel ?? null),
    preparationMethod: canonicalizeText(item.preparationMethod ?? null),
    portionSize: canonicalizeText(item.portionSize ?? null),
    keyIngredients: canonicalizeStringArray(item.keyIngredients ?? []),
    imageUrl: canonicalizeText(item.imageUrl ?? null),
    caloriesKcal: canonicalizePrice(item.caloriesKcal),
    proteinG: canonicalizePrice(item.proteinG),
    fatG: canonicalizePrice(item.fatG),
    saturatedFatG: canonicalizePrice(item.saturatedFatG),
    carbsG: canonicalizePrice(item.carbsG),
    sugarG: canonicalizePrice(item.sugarG),
    fiberG: canonicalizePrice(item.fiberG),
    sodiumMg: canonicalizePrice(item.sodiumMg),
    servesNum: canonicalizePrice(item.servesNum),
    dietaryTags: canonicalizeStringArray(item.dietaryTags),
    allergensContains: canonicalizeStringArray(item.allergensContains),
  };
}

function fieldSafeKey(stableKey: string): string {
  return stableKey.trim().replace(/\.+/g, '_').replace(/\s+/g, '-');
}

export function buildFoodMenuItemFields({
  coreSnapshot,
  gbpSnapshot,
}: {
  readonly coreSnapshot: unknown;
  readonly gbpSnapshot: unknown;
}): ReadonlyArray<DualSyncFieldConfig> {
  const keys = new Set<string>();
  const sampleByKey = new Map<string, FoodMenuItemValue>();
  for (const item of [...readFoodMenuItems(coreSnapshot), ...readFoodMenuItems(gbpSnapshot)]) {
    if (!item || typeof item.stableKey !== 'string' || item.stableKey.trim().length === 0) {
      continue;
    }
    if (!keys.has(item.stableKey)) {
      keys.add(item.stableKey);
      sampleByKey.set(item.stableKey, item);
    }
  }

  return [...keys].sort().map((stableKey, index) => {
    const sample = sampleByKey.get(stableKey)!;
    const safeKey = fieldSafeKey(stableKey);
    const sectionPrefix = slugifyDisplay(sample.sectionLabel || 'menu');
    return {
      fieldKey: `foodMenus.items.${sectionPrefix}.${safeKey}`,
      sectionKey: 'foodMenus',
      kind: 'foodMenu.item',
      label: sample.itemName?.trim() || stableKey,
      helpText:
        'Projected Google FoodMenus item. Import is suggestion-only; export is a full-menu replacement protected by preflight.',
      corePath: `foodMenus.items.${stableKey}`,
      gbpPath: `foodMenus.items.${stableKey}`,
      importable: true,
      exportable: true,
      normalizeCoreValue: (value: unknown) => foodMenuItemValue(value, stableKey),
      normalizeGbpValue: (value: unknown) => foodMenuItemValue(value, stableKey),
      canonicalizeCoreValue: (value: unknown) => canonicalizeFoodMenuItem(value, stableKey),
      canonicalizeGbpValue: (value: unknown) => canonicalizeFoodMenuItem(value, stableKey),
      conflictPolicy: 'manual',
      deletePolicy: 'manual',
      googleUpdateMask: 'menus',
      exportBlockedReason:
        'FoodMenus export publishes the deterministic full menu after Google baseline preflight.',
      sortOrder: index,
    } satisfies DualSyncFieldConfig;
  });
}
