'use client';

import {
  ArrowDown,
  ArrowUp,
  Beer,
  Bike,
  Globe2,
  Image as ImageIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  SlidersHorizontal,
  Store,
  ShoppingBasket,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { useOptionalGbpDrift } from '@/components/features/restaurant-settings/gbp-drift/useGbpDrift';
import {
  GbpDriftBadge,
  findFoodMenuItemDriftField,
} from '@/components/features/restaurant-settings/gbpDriftBadges';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FormRoot } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StaleBoundary } from '@/components/ui/stale-boundary';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useOpsCreateRestaurantMenu,
  useOpsCreateRestaurantMenuItem,
  useOpsCreateRestaurantMenuOption,
  useOpsCreateRestaurantMenuSection,
  useOpsDeleteRestaurantMenu,
  useOpsDeleteRestaurantMenuItem,
  useOpsDeleteRestaurantMenuSection,
  useOpsDeleteRestaurantMenuOption,
  useOpsMenuHierarchy,
  useOpsPatchRestaurantMenuItem,
  useOpsPatchRestaurantMenuSection,
  useOpsPatchRestaurantMenuOption,
  useOpsUpdateRestaurantMenu,
  useOpsUpdateRestaurantMenuItem,
  useOpsUpdateRestaurantMenuSection,
} from '@/hooks/ops/useOpsMenuHierarchy';
import {
  GOOGLE_FOOD_MENU_ALLERGENS,
  GOOGLE_FOOD_MENU_CUISINE_OPTIONS,
  GOOGLE_FOOD_MENU_DIETARY_RESTRICTIONS,
  GOOGLE_FOOD_MENU_PREPARATION_METHODS,
  GOOGLE_FOOD_MENU_SPICINESS,
  GOOGLE_NUTRITION_UNITS,
  formatGoogleFoodMenuEnumLabel as formatEnumLabel,
  type GoogleNutritionUnit,
} from '@/lib/google-food-menu-labels';
import { cn } from '@/lib/utils';

import type {
  CanonicalMenuItemAttributes,
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuOption,
  CanonicalRestaurantMenuSection,
  MenuKind,
  NabatableMenuItemExtensions,
  RestaurantMenuInput,
  RestaurantMenuItemInput,
  RestaurantMenuItemPatch,
  RestaurantMenuOptionInput,
  RestaurantMenuOptionPatch,
  RestaurantMenuSectionInput,
} from '@/server/menu-hierarchy/types';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

type MenuHierarchyManagementPanelProps = {
  restaurantId: string | null;
  preferredMenuKind: Extract<MenuKind, 'food' | 'drinks'>;
  gbpDriftFields?: ReadonlyArray<DualSyncFieldSummary>;
};

type MenuFormState = {
  displayName: string;
  description: string;
  additionalLabels: string;
  menuKind: MenuKind;
  defaultLanguageCode: string;
  sourceUrl: string;
  cuisines: string[];
  active: boolean;
};

type SectionFormState = {
  displayName: string;
  description: string;
  languageCode: string;
  additionalLabels: string;
  legacyCategory: string;
  legacySubcategory: string;
  active: boolean;
};

type ItemFormState = {
  displayName: string;
  description: string;
  languageCode: string;
  additionalLabels: string;
  price: string;
  currencyCode: string;
  spiciness: string;
  allergens: string[];
  dietaryRestrictions: string[];
  preparationMethods: string[];
  ingredients: string;
  serves: string;
  calories: string;
  totalFat: string;
  cholesterol: string;
  sodium: string;
  totalCarbohydrate: string;
  protein: string;
  caloriesUpper: string;
  totalFatUpper: string;
  cholesterolUpper: string;
  sodiumUpper: string;
  totalCarbohydrateUpper: string;
  proteinUpper: string;
  portionQuantity: string;
  portionUnitName: string;
  portionUnitDescription: string;
  portionUnitLanguageCode: string;
  portionAdditionalUnits: string;
  googleMediaKeys: string;
  localImageUrl: string;
  active: boolean;
  availabilityStatus: string;
  soldOut: boolean;
  orderable: boolean;
  servicePeriods: string;
  availabilityNote: string;
  allowCustomizations: boolean;
  modifierGroupIds: string;
  maxSelections: string;
  customizationNote: string;
  abvPercent: string;
  volumeMl: string;
  servingSize: string;
  drinkStyle: string;
  drinkRegion: string;
  drinkGrape: string;
  caffeineMg: string;
  containsDairy: boolean;
  containsNuts: boolean;
  containsGluten: boolean;
  containsCaffeine: boolean;
  nonAlcoholic: boolean;
  decafAvailable: boolean;
  drinkProfileNote: string;
  featured: boolean;
  signature: boolean;
  popularityScore: string;
  pairingNotes: string;
  recommendationTags: string;
  sourceSystem: string;
  sourceItemId: string;
  importedAt: string;
  sourceNote: string;
};

type OptionFormState = {
  displayName: string;
  description: string;
  languageCode: string;
  additionalLabels: string;
  price: string;
  currencyCode: string;
  spiciness: string;
  allergens: string[];
  dietaryRestrictions: string[];
  preparationMethods: string[];
  ingredients: string;
  serves: string;
  calories: string;
  totalFat: string;
  cholesterol: string;
  sodium: string;
  totalCarbohydrate: string;
  protein: string;
  caloriesUpper: string;
  totalFatUpper: string;
  cholesterolUpper: string;
  sodiumUpper: string;
  totalCarbohydrateUpper: string;
  proteinUpper: string;
  portionQuantity: string;
  portionUnitName: string;
  portionUnitDescription: string;
  portionUnitLanguageCode: string;
  portionAdditionalUnits: string;
  googleMediaKeys: string;
  localImageUrl: string;
  active: boolean;
};

const LANGUAGE_CODE = 'en-GB';
const NONE_VALUE = '__none__';

const CUISINE_OPTIONS = GOOGLE_FOOD_MENU_CUISINE_OPTIONS;
const ALLERGEN_OPTIONS = GOOGLE_FOOD_MENU_ALLERGENS;
const DIETARY_OPTIONS = GOOGLE_FOOD_MENU_DIETARY_RESTRICTIONS;
const SPICINESS_OPTIONS = GOOGLE_FOOD_MENU_SPICINESS;
const PREPARATION_OPTIONS = GOOGLE_FOOD_MENU_PREPARATION_METHODS;
const NUTRITION_UNITS = {
  calorie: GOOGLE_NUTRITION_UNITS[0],
  gram: GOOGLE_NUTRITION_UNITS[1],
  milligram: GOOGLE_NUTRITION_UNITS[2],
} as const satisfies Record<string, GoogleNutritionUnit>;

function primaryLabel(
  entity:
    | Pick<CanonicalRestaurantMenu, 'labels'>
    | Pick<CanonicalRestaurantMenuSection, 'labels'>
    | Pick<CanonicalRestaurantMenuItem, 'labels'>
    | Pick<CanonicalRestaurantMenuOption, 'labels'>,
  fallback: string,
) {
  return entity.labels[0]?.displayName?.trim() || fallback;
}

function primaryDescription(
  entity:
    | Pick<CanonicalRestaurantMenu, 'labels'>
    | Pick<CanonicalRestaurantMenuSection, 'labels'>
    | Pick<CanonicalRestaurantMenuItem, 'labels'>
    | Pick<CanonicalRestaurantMenuOption, 'labels'>,
) {
  return entity.labels[0]?.description ?? '';
}

function splitTokens(value: string) {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function serializeAdditionalLabels(
  labels: Array<{ displayName: string; description?: string | null; languageCode: string }>,
) {
  return labels
    .slice(1)
    .map((label) =>
      [label.languageCode, label.displayName, label.description ?? '']
        .map((part) => part.trim())
        .join(' | '),
    )
    .join('\n');
}

function parseAdditionalLabels(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [languageCode = LANGUAGE_CODE, displayName = '', description = ''] = line
        .split('|')
        .map((part) => part.trim());
      return displayName
        ? {
            displayName,
            description: description || null,
            languageCode: languageCode || LANGUAGE_CODE,
          }
        : null;
    })
    .filter(
      (label): label is { displayName: string; description: string | null; languageCode: string } =>
        Boolean(label),
    );
}

function buildLabelList({
  displayName,
  description,
  languageCode,
  additionalLabels,
}: {
  displayName: string;
  description: string;
  languageCode: string;
  additionalLabels: string;
}) {
  return [
    {
      displayName: displayName.trim(),
      description: description.trim() || null,
      languageCode: languageCode.trim() || LANGUAGE_CODE,
    },
    ...parseAdditionalLabels(additionalLabels),
  ];
}

function looksLikeLocalMediaUrl(value: string) {
  return /^(https?:|data:|blob:|\/)/i.test(value.trim());
}

function moneyLabel(attributes: CanonicalMenuItemAttributes) {
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

function itemDescription(item: CanonicalRestaurantMenuItem) {
  return primaryDescription(item).trim() || 'No description yet';
}

function normalizedServiceLabel(value: string) {
  const normalized = value.toLowerCase().replace(/[_-]+/g, ' ');
  if (normalized.includes('deliver')) return 'Delivery';
  if (normalized.includes('pickup') || normalized.includes('collection')) return 'Pickup';
  if (normalized.includes('dine') || normalized.includes('restaurant')) return 'Dine-in';
  return formatEnumLabel(value);
}

function availabilityBadges(item: CanonicalRestaurantMenuItem) {
  const policy = item.extensions?.availabilityPolicy as Record<string, unknown> | undefined;
  const servicePeriods = Array.isArray(policy?.servicePeriods)
    ? policy.servicePeriods.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const soldOut = policy?.soldOut === true;
  const orderable = policy?.orderable !== false;

  if (soldOut) {
    return [{ label: 'Sold out', variant: 'status-cancelled' as const, Icon: Store }];
  }
  if (!orderable) {
    return [{ label: 'Unavailable', variant: 'status-pending' as const, Icon: Store }];
  }
  if (servicePeriods.length === 0) {
    return [{ label: 'All services', variant: 'metric' as const, Icon: Store }];
  }
  return servicePeriods.slice(0, 3).map((period) => {
    const label = normalizedServiceLabel(period);
    const Icon = label === 'Delivery' ? Bike : label === 'Pickup' ? ShoppingBasket : Store;
    return { label, variant: 'metric' as const, Icon };
  });
}

type ItemHealth = 'ready' | 'incomplete' | 'inactive';

function deriveItemHealth(item: CanonicalRestaurantMenuItem): {
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

function ItemHealthBadge({ item }: { item: CanonicalRestaurantMenuItem }) {
  const { health, reasons } = deriveItemHealth(item);
  const variant =
    health === 'ready'
      ? 'status-confirmed'
      : health === 'incomplete'
        ? 'status-pending'
        : 'outline';
  const label =
    health === 'ready' ? 'Ready' : health === 'incomplete' ? 'Needs attention' : 'Inactive';
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={variant}
            className="cursor-default"
            aria-label={`Status: ${label}. ${reasons.join('. ')}`}
          >
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-56">
          <ul className="flex list-disc flex-col gap-0.5 pl-4">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ItemThumbnail({ item }: { item: CanonicalRestaurantMenuItem }) {
  return (
    <span
      className={cn(
        'inline-flex size-14 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground shadow-xs',
        item.media.localImageUrl && 'border-primary/20 bg-primary/10 text-primary',
      )}
      aria-hidden
    >
      <ImageIcon />
    </span>
  );
}

function menuInitialState(
  menu?: CanonicalRestaurantMenu | null,
  defaultMenuKind: MenuKind = 'food',
): MenuFormState {
  return {
    displayName: menu ? primaryLabel(menu, 'Menu') : '',
    description: menu ? primaryDescription(menu) : '',
    additionalLabels: menu ? serializeAdditionalLabels(menu.labels) : '',
    menuKind: menu?.menuKind ?? defaultMenuKind,
    defaultLanguageCode: menu?.defaultLanguageCode ?? LANGUAGE_CODE,
    sourceUrl: menu?.sourceUrl ?? '',
    cuisines: menu?.cuisines ?? [],
    active: menu?.active ?? true,
  };
}

function sectionInitialState(section?: CanonicalRestaurantMenuSection | null): SectionFormState {
  return {
    displayName: section ? primaryLabel(section, 'Section') : '',
    description: section ? primaryDescription(section) : '',
    languageCode: section?.labels[0]?.languageCode ?? LANGUAGE_CODE,
    additionalLabels: section ? serializeAdditionalLabels(section.labels) : '',
    legacyCategory: section?.legacyCategory ?? '',
    legacySubcategory: section?.legacySubcategory ?? '',
    active: section?.active ?? true,
  };
}

function recordNote(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return typeof value === 'string' ? value : '';
}

function recordNumber(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function recordBoolean(record: Record<string, unknown> | undefined, key: string, fallback = false) {
  const value = record?.[key];
  return typeof value === 'boolean' ? value : fallback;
}

function recordStringList(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').join(', ')
    : '';
}

function nutritionValue(
  amount: CanonicalMenuItemAttributes['nutritionFacts'][keyof CanonicalMenuItemAttributes['nutritionFacts']],
) {
  const value = amount?.lowerAmount ?? amount?.quantity;
  return typeof value === 'number' ? String(value) : '';
}

function nutritionUpperValue(
  amount: CanonicalMenuItemAttributes['nutritionFacts'][keyof CanonicalMenuItemAttributes['nutritionFacts']],
) {
  const value = amount?.upperAmount;
  return typeof value === 'number' ? String(value) : '';
}

function portionUnitLabel(attributes: CanonicalMenuItemAttributes | undefined) {
  return attributes?.portionSize?.unit[0] ?? null;
}

function serializeAdditionalPortionUnits(attributes: CanonicalMenuItemAttributes | undefined) {
  return serializeAdditionalLabels(attributes?.portionSize?.unit ?? []);
}

function itemInitialState(
  item?: CanonicalRestaurantMenuItem | null,
  menuKind: MenuKind = 'food',
): ItemFormState {
  const attributes = item?.attributes;
  const nutritionFacts = attributes?.nutritionFacts ?? {};
  const portionUnit = portionUnitLabel(attributes);
  const drinkProfile = item?.extensions?.drinkProfile;
  const recommendationMetadata = item?.extensions?.recommendationMetadata;
  const availabilityPolicy = item?.extensions?.availabilityPolicy;
  const customizationControls = item?.extensions?.customizationControls;
  const sourceMetadata = item?.extensions?.sourceMetadata;
  return {
    displayName: item ? primaryLabel(item, 'Menu item') : '',
    description: item ? primaryDescription(item) : '',
    languageCode: item?.labels[0]?.languageCode ?? LANGUAGE_CODE,
    additionalLabels: item ? serializeAdditionalLabels(item.labels) : '',
    price: typeof attributes?.price?.amount === 'number' ? String(attributes.price.amount) : '',
    currencyCode: attributes?.price?.currencyCode ?? 'GBP',
    spiciness: attributes?.spiciness ?? NONE_VALUE,
    allergens: attributes?.allergen ?? [],
    dietaryRestrictions: attributes?.dietaryRestriction ?? [],
    preparationMethods: attributes?.preparationMethods ?? [],
    ingredients:
      attributes?.ingredients
        ?.map((ingredient) => ingredient.labels[0]?.displayName)
        .filter(Boolean)
        .join(', ') ?? '',
    serves:
      typeof attributes?.servesNumPeople === 'number' ? String(attributes.servesNumPeople) : '',
    calories: nutritionValue(nutritionFacts.calories),
    totalFat: nutritionValue(nutritionFacts.totalFat),
    cholesterol: nutritionValue(nutritionFacts.cholesterol),
    sodium: nutritionValue(nutritionFacts.sodium),
    totalCarbohydrate: nutritionValue(nutritionFacts.totalCarbohydrate),
    protein: nutritionValue(nutritionFacts.protein),
    caloriesUpper: nutritionUpperValue(nutritionFacts.calories),
    totalFatUpper: nutritionUpperValue(nutritionFacts.totalFat),
    cholesterolUpper: nutritionUpperValue(nutritionFacts.cholesterol),
    sodiumUpper: nutritionUpperValue(nutritionFacts.sodium),
    totalCarbohydrateUpper: nutritionUpperValue(nutritionFacts.totalCarbohydrate),
    proteinUpper: nutritionUpperValue(nutritionFacts.protein),
    portionQuantity:
      typeof attributes?.portionSize?.quantity === 'number'
        ? String(attributes.portionSize.quantity)
        : '',
    portionUnitName: portionUnit?.displayName ?? '',
    portionUnitDescription: portionUnit?.description ?? '',
    portionUnitLanguageCode: portionUnit?.languageCode ?? LANGUAGE_CODE,
    portionAdditionalUnits: serializeAdditionalPortionUnits(attributes),
    googleMediaKeys: item?.media.googleMediaKeys?.join('\n') ?? '',
    localImageUrl: item?.media.localImageUrl ?? '',
    active: item?.active ?? true,
    availabilityStatus: recordNote(availabilityPolicy, 'availabilityStatus') || NONE_VALUE,
    soldOut: recordBoolean(availabilityPolicy, 'soldOut'),
    orderable: recordBoolean(availabilityPolicy, 'orderable', true),
    servicePeriods: recordStringList(availabilityPolicy, 'servicePeriods'),
    availabilityNote: recordNote(availabilityPolicy, 'opsNote'),
    allowCustomizations: recordBoolean(customizationControls, 'allowCustomizations', true),
    modifierGroupIds: recordStringList(customizationControls, 'operationalModifierGroupIds'),
    maxSelections: recordNumber(customizationControls, 'maxSelections'),
    customizationNote: recordNote(customizationControls, 'opsNote'),
    abvPercent: recordNumber(drinkProfile, 'abvPercent') || recordNumber(drinkProfile, 'abv'),
    volumeMl: recordNumber(drinkProfile, 'volumeMl'),
    servingSize: recordNote(drinkProfile, 'servingSize'),
    drinkStyle: recordNote(drinkProfile, 'style'),
    drinkRegion: recordNote(drinkProfile, 'region'),
    drinkGrape: recordNote(drinkProfile, 'grape'),
    caffeineMg: recordNumber(drinkProfile, 'caffeineMg'),
    containsDairy: recordBoolean(drinkProfile, 'containsDairy'),
    containsNuts: recordBoolean(drinkProfile, 'containsNuts'),
    containsGluten: recordBoolean(drinkProfile, 'containsGluten'),
    containsCaffeine: recordBoolean(drinkProfile, 'containsCaffeine'),
    nonAlcoholic: recordBoolean(drinkProfile, 'nonAlcoholic'),
    decafAvailable: recordBoolean(drinkProfile, 'decafAvailable'),
    drinkProfileNote: menuKind === 'drinks' ? recordNote(drinkProfile, 'opsNote') : '',
    featured: recordBoolean(recommendationMetadata, 'featured'),
    signature: recordBoolean(recommendationMetadata, 'signature'),
    popularityScore: recordNumber(recommendationMetadata, 'popularityScore'),
    pairingNotes: recordNote(recommendationMetadata, 'pairingNotes'),
    recommendationTags: recordStringList(recommendationMetadata, 'recommendationTags'),
    sourceSystem: recordNote(sourceMetadata, 'sourceSystem'),
    sourceItemId: recordNote(sourceMetadata, 'sourceItemId'),
    importedAt: recordNote(sourceMetadata, 'importedAt'),
    sourceNote: recordNote(sourceMetadata, 'opsNote'),
  };
}

function optionInitialState(option?: CanonicalRestaurantMenuOption | null): OptionFormState {
  const attributes = option?.attributes;
  const amount = option?.attributes.price?.amount;
  const nutritionFacts = attributes?.nutritionFacts ?? {};
  const portionUnit = portionUnitLabel(attributes);
  return {
    displayName: option ? primaryLabel(option, 'Option') : '',
    description: option ? primaryDescription(option) : '',
    languageCode: option?.labels[0]?.languageCode ?? LANGUAGE_CODE,
    additionalLabels: option ? serializeAdditionalLabels(option.labels) : '',
    price: typeof amount === 'number' ? String(amount) : '',
    currencyCode: option?.attributes.price?.currencyCode ?? 'GBP',
    spiciness: attributes?.spiciness ?? NONE_VALUE,
    allergens: attributes?.allergen ?? [],
    dietaryRestrictions: attributes?.dietaryRestriction ?? [],
    preparationMethods: attributes?.preparationMethods ?? [],
    ingredients:
      attributes?.ingredients
        ?.map((ingredient) => ingredient.labels[0]?.displayName)
        .filter(Boolean)
        .join(', ') ?? '',
    serves:
      typeof attributes?.servesNumPeople === 'number' ? String(attributes.servesNumPeople) : '',
    calories: nutritionValue(nutritionFacts.calories),
    totalFat: nutritionValue(nutritionFacts.totalFat),
    cholesterol: nutritionValue(nutritionFacts.cholesterol),
    sodium: nutritionValue(nutritionFacts.sodium),
    totalCarbohydrate: nutritionValue(nutritionFacts.totalCarbohydrate),
    protein: nutritionValue(nutritionFacts.protein),
    caloriesUpper: nutritionUpperValue(nutritionFacts.calories),
    totalFatUpper: nutritionUpperValue(nutritionFacts.totalFat),
    cholesterolUpper: nutritionUpperValue(nutritionFacts.cholesterol),
    sodiumUpper: nutritionUpperValue(nutritionFacts.sodium),
    totalCarbohydrateUpper: nutritionUpperValue(nutritionFacts.totalCarbohydrate),
    proteinUpper: nutritionUpperValue(nutritionFacts.protein),
    portionQuantity:
      typeof attributes?.portionSize?.quantity === 'number'
        ? String(attributes.portionSize.quantity)
        : '',
    portionUnitName: portionUnit?.displayName ?? '',
    portionUnitDescription: portionUnit?.description ?? '',
    portionUnitLanguageCode: portionUnit?.languageCode ?? LANGUAGE_CODE,
    portionAdditionalUnits: serializeAdditionalPortionUnits(attributes),
    googleMediaKeys: option?.media.googleMediaKeys?.join('\n') ?? '',
    localImageUrl: option?.media.localImageUrl ?? '',
    active: option?.active ?? true,
  };
}

function toggleValue(values: string[], value: string, checked: boolean) {
  if (checked) return values.includes(value) ? values : [...values, value];
  return values.filter((entry) => entry !== value);
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function nutritionAmount(value: string, upperValue: string, unit: GoogleNutritionUnit) {
  const amount = value.trim() ? Number(value) : null;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return undefined;
  const upperAmount = upperValue.trim() ? Number(upperValue) : null;
  return {
    lowerAmount: amount,
    ...(typeof upperAmount === 'number' && Number.isFinite(upperAmount) && upperAmount >= amount
      ? { upperAmount }
      : {}),
    unit,
  };
}

function buildGoogleNutritionFacts(
  state: Pick<
    ItemFormState,
    | 'calories'
    | 'totalFat'
    | 'cholesterol'
    | 'sodium'
    | 'totalCarbohydrate'
    | 'protein'
    | 'caloriesUpper'
    | 'totalFatUpper'
    | 'cholesterolUpper'
    | 'sodiumUpper'
    | 'totalCarbohydrateUpper'
    | 'proteinUpper'
  >,
): CanonicalMenuItemAttributes['nutritionFacts'] {
  return {
    ...(nutritionAmount(state.calories, state.caloriesUpper, NUTRITION_UNITS.calorie)
      ? { calories: nutritionAmount(state.calories, state.caloriesUpper, NUTRITION_UNITS.calorie) }
      : {}),
    ...(nutritionAmount(state.totalFat, state.totalFatUpper, NUTRITION_UNITS.gram)
      ? { totalFat: nutritionAmount(state.totalFat, state.totalFatUpper, NUTRITION_UNITS.gram) }
      : {}),
    ...(nutritionAmount(state.cholesterol, state.cholesterolUpper, NUTRITION_UNITS.milligram)
      ? {
          cholesterol: nutritionAmount(
            state.cholesterol,
            state.cholesterolUpper,
            NUTRITION_UNITS.milligram,
          ),
        }
      : {}),
    ...(nutritionAmount(state.sodium, state.sodiumUpper, NUTRITION_UNITS.milligram)
      ? { sodium: nutritionAmount(state.sodium, state.sodiumUpper, NUTRITION_UNITS.milligram) }
      : {}),
    ...(nutritionAmount(state.totalCarbohydrate, state.totalCarbohydrateUpper, NUTRITION_UNITS.gram)
      ? {
          totalCarbohydrate: nutritionAmount(
            state.totalCarbohydrate,
            state.totalCarbohydrateUpper,
            NUTRITION_UNITS.gram,
          ),
        }
      : {}),
    ...(nutritionAmount(state.protein, state.proteinUpper, NUTRITION_UNITS.gram)
      ? { protein: nutritionAmount(state.protein, state.proteinUpper, NUTRITION_UNITS.gram) }
      : {}),
  };
}

function buildMenuPayload(state: MenuFormState): RestaurantMenuInput {
  return {
    labels: buildLabelList({
      displayName: state.displayName,
      description: state.description,
      languageCode: state.defaultLanguageCode,
      additionalLabels: state.additionalLabels,
    }),
    sourceUrl: state.sourceUrl.trim() || null,
    cuisines: state.cuisines as RestaurantMenuInput['cuisines'],
    defaultLanguageCode: state.defaultLanguageCode.trim() || LANGUAGE_CODE,
    menuKind: state.menuKind,
    displayOrder: 0,
    active: state.active,
    legacySource: { editedFrom: 'ops-menu-hierarchy-ui' },
  };
}

function buildSectionPayload(
  state: SectionFormState,
  displayOrder: number,
): RestaurantMenuSectionInput {
  return {
    labels: buildLabelList({
      displayName: state.displayName,
      description: state.description,
      languageCode: state.languageCode,
      additionalLabels: state.additionalLabels,
    }),
    displayOrder,
    active: state.active,
    legacyCategory: state.legacyCategory.trim() || state.displayName.trim(),
    legacySubcategory: state.legacySubcategory.trim() || null,
    legacySource: { editedFrom: 'ops-menu-hierarchy-ui' },
  };
}

function buildPortionSize(
  state: Pick<
    ItemFormState,
    | 'portionQuantity'
    | 'portionUnitName'
    | 'portionUnitDescription'
    | 'portionUnitLanguageCode'
    | 'portionAdditionalUnits'
  >,
): CanonicalMenuItemAttributes['portionSize'] {
  const unitName = state.portionUnitName.trim();
  if (!unitName) return undefined;
  const quantity = optionalNumber(state.portionQuantity);
  return {
    quantity: typeof quantity === 'number' && quantity > 0 ? quantity : 1,
    unit: [
      {
        displayName: unitName,
        description: state.portionUnitDescription.trim() || null,
        languageCode: state.portionUnitLanguageCode.trim() || LANGUAGE_CODE,
      },
      ...parseAdditionalLabels(state.portionAdditionalUnits),
    ],
  };
}

function buildGoogleAttributePayload(
  state: Pick<
    ItemFormState,
    | 'price'
    | 'currencyCode'
    | 'spiciness'
    | 'allergens'
    | 'dietaryRestrictions'
    | 'ingredients'
    | 'preparationMethods'
    | 'googleMediaKeys'
    | 'serves'
    | 'calories'
    | 'totalFat'
    | 'cholesterol'
    | 'sodium'
    | 'totalCarbohydrate'
    | 'protein'
    | 'caloriesUpper'
    | 'totalFatUpper'
    | 'cholesterolUpper'
    | 'sodiumUpper'
    | 'totalCarbohydrateUpper'
    | 'proteinUpper'
    | 'portionQuantity'
    | 'portionUnitName'
    | 'portionUnitDescription'
    | 'portionUnitLanguageCode'
    | 'portionAdditionalUnits'
  >,
  existing?: CanonicalRestaurantMenuItem | CanonicalRestaurantMenuOption | null,
): CanonicalMenuItemAttributes {
  const amount = state.price.trim() ? Number(state.price) : null;
  const googleMediaKeys = splitTokens(state.googleMediaKeys);
  return {
    price: {
      currencyCode: state.currencyCode.trim() || 'GBP',
      amount: Number.isFinite(amount) ? amount : null,
    },
    spiciness:
      state.spiciness === NONE_VALUE
        ? null
        : (state.spiciness as CanonicalMenuItemAttributes['spiciness']),
    allergen: state.allergens as CanonicalMenuItemAttributes['allergen'],
    dietaryRestriction:
      state.dietaryRestrictions as CanonicalMenuItemAttributes['dietaryRestriction'],
    ingredients: splitTokens(state.ingredients).map((ingredient) => ({
      labels: [{ displayName: ingredient, description: null, languageCode: LANGUAGE_CODE }],
    })),
    preparationMethods:
      state.preparationMethods as CanonicalMenuItemAttributes['preparationMethods'],
    mediaKeys: googleMediaKeys,
    nutritionFacts: {
      ...(existing?.attributes.nutritionFacts ?? {}),
      ...buildGoogleNutritionFacts(state),
    },
    ...(buildPortionSize(state) ? { portionSize: buildPortionSize(state) } : {}),
    servesNumPeople: state.serves.trim() ? Number(state.serves) : null,
  };
}

function buildItemPayload({
  state,
  menuKind,
  displayOrder,
  existing,
}: {
  state: ItemFormState;
  menuKind: MenuKind;
  displayOrder: number;
  existing?: CanonicalRestaurantMenuItem | null;
}): RestaurantMenuItemInput | RestaurantMenuItemPatch {
  const googleMediaKeys = splitTokens(state.googleMediaKeys);
  const attributes = buildGoogleAttributePayload(state, existing);
  const extensions: NabatableMenuItemExtensions = {
    drinkProfile: {
      ...(existing?.extensions.drinkProfile ?? {}),
      abvPercent: optionalNumber(state.abvPercent),
      volumeMl: optionalNumber(state.volumeMl),
      servingSize: optionalText(state.servingSize),
      style: optionalText(state.drinkStyle),
      region: optionalText(state.drinkRegion),
      grape: optionalText(state.drinkGrape),
      caffeineMg: optionalNumber(state.caffeineMg),
      containsDairy: state.containsDairy,
      containsNuts: state.containsNuts,
      containsGluten: state.containsGluten,
      containsCaffeine: state.containsCaffeine,
      nonAlcoholic: state.nonAlcoholic,
      decafAvailable: state.decafAvailable,
      opsNote: optionalText(state.drinkProfileNote),
    },
    recommendationMetadata: {
      ...(existing?.extensions.recommendationMetadata ?? {}),
      featured: state.featured,
      signature: state.signature,
      popularityScore: optionalNumber(state.popularityScore),
      pairingNotes: optionalText(state.pairingNotes),
      recommendationTags: splitTokens(state.recommendationTags),
    },
    availabilityPolicy: {
      ...(existing?.extensions.availabilityPolicy ?? {}),
      availabilityStatus:
        state.availabilityStatus === NONE_VALUE
          ? null
          : (state.availabilityStatus as 'available' | 'unavailable' | 'seasonal'),
      soldOut: state.soldOut,
      orderable: state.orderable,
      servicePeriods: splitTokens(state.servicePeriods),
      opsNote: optionalText(state.availabilityNote),
    },
    customizationControls: {
      ...(existing?.extensions.customizationControls ?? {}),
      allowCustomizations: state.allowCustomizations,
      operationalModifierGroupIds: splitTokens(state.modifierGroupIds),
      maxSelections: optionalNumber(state.maxSelections),
      opsNote: optionalText(state.customizationNote),
    },
    sourceMetadata: {
      ...(existing?.extensions.sourceMetadata ?? {}),
      sourceSystem: optionalText(state.sourceSystem),
      sourceItemId: optionalText(state.sourceItemId),
      importedAt: optionalText(state.importedAt),
      editedFrom: 'ops-menu-hierarchy-ui',
      opsNote: optionalText(state.sourceNote),
    },
  };

  return {
    itemKind: menuKind === 'drinks' ? 'drink' : 'food',
    externalItemId: existing?.externalItemId ?? `ops:${Date.now()}`,
    labels: buildLabelList({
      displayName: state.displayName,
      description: state.description,
      languageCode: state.languageCode,
      additionalLabels: state.additionalLabels,
    }),
    attributes,
    media: {
      googleMediaKeys,
      localImageUrl: state.localImageUrl.trim() || null,
      localMedia: existing?.media.localMedia ?? {},
    },
    extensions,
    displayOrder,
    active: state.active,
    legacySource: existing?.legacySource ?? { editedFrom: 'ops-menu-hierarchy-ui' },
  };
}

function buildOptionPayload(
  state: OptionFormState,
  displayOrder: number,
  existing?: CanonicalRestaurantMenuOption | null,
): RestaurantMenuOptionInput | RestaurantMenuOptionPatch {
  return {
    externalOptionId: existing?.externalOptionId ?? `ops-option:${Date.now()}`,
    labels: buildLabelList({
      displayName: state.displayName,
      description: state.description,
      languageCode: state.languageCode,
      additionalLabels: state.additionalLabels,
    }),
    attributes: buildGoogleAttributePayload(state, existing),
    media: {
      googleMediaKeys: splitTokens(state.googleMediaKeys),
      localImageUrl: state.localImageUrl.trim() || null,
      localMedia: existing?.media.localMedia ?? {},
    },
    displayOrder,
    active: state.active,
    legacySource: existing?.legacySource ?? { editedFrom: 'ops-menu-hierarchy-ui' },
  };
}

export function MenuHierarchyManagementPanel({
  restaurantId,
  preferredMenuKind,
  gbpDriftFields = [],
}: MenuHierarchyManagementPanelProps) {
  const hierarchyQuery = useOpsMenuHierarchy(restaurantId);
  const menus = useMemo(() => hierarchyQuery.data?.menus ?? [], [hierarchyQuery.data?.menus]);
  const catalogueMenus = useMemo(
    () => menus.filter((menu) => menu.menuKind === preferredMenuKind || menu.menuKind === 'mixed'),
    [menus, preferredMenuKind],
  );
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [menuDialogMode, setMenuDialogMode] = useState<'create' | 'edit' | null>(null);
  const [sectionDialogState, setSectionDialogState] = useState<{
    mode: 'create' | 'edit';
    section: CanonicalRestaurantMenuSection | null;
  } | null>(null);
  const [editingItem, setEditingItem] = useState<CanonicalRestaurantMenuItem | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [optionTarget, setOptionTarget] = useState<{
    item: CanonicalRestaurantMenuItem;
    option: CanonicalRestaurantMenuOption | null;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'menu'; menu: CanonicalRestaurantMenu }
    | { type: 'section'; menu: CanonicalRestaurantMenu; section: CanonicalRestaurantMenuSection }
    | {
        type: 'item';
        menu: CanonicalRestaurantMenu;
        section: CanonicalRestaurantMenuSection;
        item: CanonicalRestaurantMenuItem;
      }
    | {
        type: 'option';
        menu: CanonicalRestaurantMenu;
        section: CanonicalRestaurantMenuSection;
        item: CanonicalRestaurantMenuItem;
        option: CanonicalRestaurantMenuOption;
      }
    | null
  >(null);

  const selectedMenu = useMemo(
    () => catalogueMenus.find((menu) => menu.id === selectedMenuId) ?? null,
    [catalogueMenus, selectedMenuId],
  );
  const selectedSection = useMemo(
    () => selectedMenu?.sections.find((section) => section.id === selectedSectionId) ?? null,
    [selectedMenu, selectedSectionId],
  );

  useEffect(() => {
    if (catalogueMenus.length === 0) {
      setSelectedMenuId(null);
      return;
    }
    const selectedStillExists = catalogueMenus.some((menu) => menu.id === selectedMenuId);
    if (selectedStillExists) return;
    setSelectedMenuId(catalogueMenus[0]?.id ?? null);
  }, [catalogueMenus, selectedMenuId]);

  useEffect(() => {
    if (!selectedMenu) {
      setSelectedSectionId(null);
      return;
    }
    const selectedStillExists = selectedMenu.sections.some(
      (section) => section.id === selectedSectionId,
    );
    if (selectedStillExists) return;
    setSelectedSectionId(selectedMenu.sections[0]?.id ?? null);
  }, [selectedMenu, selectedSectionId]);

  if (!restaurantId) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-6">
          <OpsEmptyState
            title="Select a restaurant"
            description="Choose an active restaurant before editing its menu structure."
          />
        </CardContent>
      </Card>
    );
  }

  if (hierarchyQuery.isError) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-6">
          <OpsEmptyState
            title="Unable to load menus"
            description={hierarchyQuery.error.message}
            action={
              <Button type="button" variant="outline" onClick={() => void hierarchyQuery.refetch()}>
                Retry
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  const selectedMenuItemCount =
    selectedMenu?.sections.reduce((acc, section) => acc + section.items.length, 0) ?? 0;
  const SelectedMenuIcon =
    selectedMenu?.menuKind === 'drinks'
      ? Beer
      : selectedMenu?.menuKind === 'food'
        ? UtensilsCrossed
        : null;

  return (
    <div className="flex flex-col gap-5">
      {hierarchyQuery.isLoading ? (
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-5 text-sm text-muted-foreground">Loading menus...</CardContent>
        </Card>
      ) : null}
      {!hierarchyQuery.isLoading && menus.length === 0 ? (
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-6">
            <OpsEmptyState
              title="No menus yet"
              description="Create the first menu for this restaurant."
              action={
                <Button type="button" onClick={() => setMenuDialogMode('create')}>
                  <Plus data-icon="inline-start" aria-hidden />
                  Create menu
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {!hierarchyQuery.isLoading && menus.length > 0 && catalogueMenus.length === 0 ? (
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-6">
            <OpsEmptyState
              title={`No ${preferredMenuKind === 'drinks' ? 'drinks' : 'food'} menu`}
              description={`Create a ${preferredMenuKind === 'drinks' ? 'drinks' : 'food'} menu before editing sections and items.`}
              action={
                <Button type="button" onClick={() => setMenuDialogMode('create')}>
                  <Plus data-icon="inline-start" aria-hidden />
                  Create {preferredMenuKind === 'drinks' ? 'drinks' : 'food'} menu
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {selectedMenu ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border/70 bg-background p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                {SelectedMenuIcon ? (
                  <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <SelectedMenuIcon aria-hidden />
                  </span>
                ) : null}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-xl font-semibold leading-tight text-foreground text-balance">
                      {primaryLabel(selectedMenu, 'Menu')}
                    </h2>
                    <Badge variant={selectedMenu.active ? 'secondary' : 'outline'}>
                      {selectedMenu.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="tabular-nums">
                      {selectedMenu.sections.length}{' '}
                      {selectedMenu.sections.length === 1 ? 'section' : 'sections'}
                    </span>
                    <span className="tabular-nums">
                      {selectedMenuItemCount} {selectedMenuItemCount === 1 ? 'item' : 'items'}
                    </span>
                    {primaryDescription(selectedMenu) ? (
                      <span className="min-w-0 text-pretty">
                        {primaryDescription(selectedMenu)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {catalogueMenus.length > 1 ? (
                  <Select
                    value={selectedMenu.id ?? ''}
                    onValueChange={(value) => setSelectedMenuId(value || null)}
                  >
                    <SelectTrigger
                      className="h-10 w-full min-w-44 sm:w-auto"
                      aria-label="Select menu"
                    >
                      <SelectValue placeholder="Select menu" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogueMenus.map((menu) =>
                        menu.id ? (
                          <SelectItem key={menu.id} value={menu.id}>
                            {primaryLabel(menu, 'Menu')}
                          </SelectItem>
                        ) : null,
                      )}
                    </SelectContent>
                  </Select>
                ) : null}
                <Button type="button" variant="outline" onClick={() => setMenuDialogMode('create')}>
                  <Plus data-icon="inline-start" aria-hidden />
                  Menu
                </Button>
                <Button type="button" variant="outline" onClick={() => setMenuDialogMode('edit')}>
                  <Pencil data-icon="inline-start" aria-hidden />
                  Edit
                </Button>
                <Button
                  type="button"
                  onClick={() => setSectionDialogState({ mode: 'create', section: null })}
                >
                  <Plus data-icon="inline-start" aria-hidden />
                  Section
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-10"
                      aria-label={`Open menu actions for ${primaryLabel(selectedMenu, 'Menu')}`}
                    >
                      <MoreHorizontal aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleteTarget({ type: 'menu', menu: selectedMenu })}
                      >
                        <Trash2 aria-hidden />
                        Delete menu
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          <StaleBoundary
            isStale={hierarchyQuery.isPlaceholderData && hierarchyQuery.isFetching}
            className="min-w-0"
          >
            <SectionAccordionTable
              menu={selectedMenu}
              gbpDriftFields={gbpDriftFields}
              selectedSectionId={selectedSectionId}
              restaurantId={restaurantId}
              onSelectSection={setSelectedSectionId}
              onCreateItem={(section) => {
                setSelectedSectionId(section.id ?? null);
                setEditingItem(null);
                setItemDialogOpen(true);
              }}
              onEditSection={(section) => {
                setSelectedSectionId(section.id ?? null);
                setSectionDialogState({ mode: 'edit', section });
              }}
              onDeleteSection={(section) => {
                setSelectedSectionId(section.id ?? null);
                setDeleteTarget({ type: 'section', menu: selectedMenu, section });
              }}
              onEditItem={(section, item) => {
                setSelectedSectionId(section.id ?? null);
                setEditingItem(item);
                setItemDialogOpen(true);
              }}
              onDeleteItem={(section, item) => {
                setSelectedSectionId(section.id ?? null);
                setDeleteTarget({ type: 'item', menu: selectedMenu, section, item });
              }}
              onCreateOption={(section, item) => {
                setSelectedSectionId(section.id ?? null);
                setOptionTarget({ item, option: null });
              }}
              onEditOption={(section, item, option) => {
                setSelectedSectionId(section.id ?? null);
                setOptionTarget({ item, option });
              }}
              onDeleteOption={(section, item, option) => {
                setSelectedSectionId(section.id ?? null);
                setDeleteTarget({ type: 'option', menu: selectedMenu, section, item, option });
              }}
            />
          </StaleBoundary>
        </div>
      ) : null}

      <MenuDialog
        restaurantId={restaurantId}
        mode={menuDialogMode}
        menu={menuDialogMode === 'edit' ? selectedMenu : null}
        defaultMenuKind={preferredMenuKind}
        onOpenChange={(open) => {
          if (!open) setMenuDialogMode(null);
        }}
      />
      <SectionDialog
        restaurantId={restaurantId}
        menu={selectedMenu}
        mode={sectionDialogState?.mode ?? null}
        section={sectionDialogState?.section ?? null}
        onOpenChange={(open) => {
          if (!open) setSectionDialogState(null);
        }}
      />
      <ItemDialog
        restaurantId={restaurantId}
        menu={selectedMenu}
        section={selectedSection}
        item={editingItem}
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
      />
      <OptionDialog
        restaurantId={restaurantId}
        menu={selectedMenu}
        section={selectedSection}
        item={optionTarget?.item ?? null}
        option={optionTarget?.option ?? null}
        onOpenChange={(open) => {
          if (!open) setOptionTarget(null);
        }}
      />
      <DeleteHierarchyDialog
        restaurantId={restaurantId}
        target={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function SectionAccordionTable({
  menu,
  gbpDriftFields,
  selectedSectionId,
  restaurantId,
  onSelectSection,
  onCreateItem,
  onEditSection,
  onDeleteSection,
  onEditItem,
  onDeleteItem,
  onCreateOption,
  onEditOption,
  onDeleteOption,
}: {
  menu: CanonicalRestaurantMenu;
  gbpDriftFields: ReadonlyArray<DualSyncFieldSummary>;
  selectedSectionId: string | null;
  restaurantId: string;
  onSelectSection: (sectionId: string | null) => void;
  onCreateItem: (section: CanonicalRestaurantMenuSection) => void;
  onEditSection: (section: CanonicalRestaurantMenuSection) => void;
  onDeleteSection: (section: CanonicalRestaurantMenuSection) => void;
  onEditItem: (section: CanonicalRestaurantMenuSection, item: CanonicalRestaurantMenuItem) => void;
  onDeleteItem: (
    section: CanonicalRestaurantMenuSection,
    item: CanonicalRestaurantMenuItem,
  ) => void;
  onCreateOption: (
    section: CanonicalRestaurantMenuSection,
    item: CanonicalRestaurantMenuItem,
  ) => void;
  onEditOption: (
    section: CanonicalRestaurantMenuSection,
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
  ) => void;
  onDeleteOption: (
    section: CanonicalRestaurantMenuSection,
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
  ) => void;
}) {
  const patchSection = useOpsPatchRestaurantMenuSection(restaurantId);

  const moveSection = async (index: number, direction: -1 | 1) => {
    const current = menu.sections[index];
    const target = menu.sections[index + direction];
    if (!current?.id || !target?.id || !menu.id) return;
    await Promise.all([
      patchSection.mutateAsync({
        menuId: menu.id,
        sectionId: current.id,
        payload: { displayOrder: target.displayOrder },
      }),
      patchSection.mutateAsync({
        menuId: menu.id,
        sectionId: target.id,
        payload: { displayOrder: current.displayOrder },
      }),
    ]);
  };

  const renderItemTable = (section: CanonicalRestaurantMenuSection) => (
    <ItemTable
      restaurantId={restaurantId}
      menu={menu}
      section={section}
      gbpDriftFields={gbpDriftFields}
      onCreateItem={() => onCreateItem(section)}
      onEditItem={(item) => onEditItem(section, item)}
      onDeleteItem={(item) => onDeleteItem(section, item)}
      onCreateOption={(item) => onCreateOption(section, item)}
      onEditOption={(item, option) => onEditOption(section, item, option)}
      onDeleteOption={(item, option) => onDeleteOption(section, item, option)}
    />
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {menu.sections.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="p-6">
            <OpsEmptyState
              title="No sections yet"
              description="Add a section before creating items."
            />
          </CardContent>
        </Card>
      ) : null}
      {menu.sections.length > 0 ? (
        <Accordion
          type="single"
          collapsible
          value={selectedSectionId ?? ''}
          onValueChange={(value) => onSelectSection(value || null)}
          className="flex flex-col gap-4"
        >
          {menu.sections.map((section, index) => {
            if (!section.id) {
              return null;
            }
            const sectionId = section.id;
            const selected = section.id === selectedSectionId;
            return (
              <AccordionItem
                key={sectionId}
                value={sectionId}
                className={cn(
                  'overflow-hidden rounded-lg border border-border/70 bg-background shadow-sm transition-[border-color,box-shadow]',
                  selected && 'border-primary/30 shadow-md shadow-primary/5',
                )}
              >
                <div className="flex items-center gap-2 px-3 py-3">
                  <AccordionTrigger className="min-w-0 flex-1 rounded-md px-2 py-2 hover:bg-muted/60 hover:no-underline">
                    <span className="flex min-w-0 items-center gap-3 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xl font-semibold leading-tight text-foreground">
                          {primaryLabel(section, 'Section')}
                        </span>
                        <span className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="tabular-nums">
                            {section.items.length} {section.items.length === 1 ? 'item' : 'items'}
                          </span>
                          {section.active ? null : (
                            <Badge variant="outline" className="text-[10px]">
                              Inactive
                            </Badge>
                          )}
                        </span>
                      </span>
                    </span>
                  </AccordionTrigger>
                  <div
                    className="flex shrink-0 items-center gap-1"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-10 md:size-9"
                      disabled={index === 0 || patchSection.isPending}
                      aria-label="Move section up"
                      onClick={() => void moveSection(index, -1)}
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-10 md:size-9"
                      disabled={index === menu.sections.length - 1 || patchSection.isPending}
                      aria-label="Move section down"
                      onClick={() => void moveSection(index, 1)}
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-10 md:size-9"
                          aria-label={`Open section actions for ${primaryLabel(section, 'Section')}`}
                        >
                          <MoreHorizontal className="size-4" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onSelect={() => onEditSection(section)}>
                            <Pencil aria-hidden />
                            Edit section
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => onDeleteSection(section)}
                          >
                            <Trash2 aria-hidden />
                            Delete section
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-10 text-primary"
                      onClick={() => onCreateItem(section)}
                    >
                      <Plus data-icon="inline-start" aria-hidden />
                      Add item
                    </Button>
                  </div>
                </div>
                <AccordionContent className="border-t border-border/60 bg-muted/15 px-0 pb-0">
                  {renderItemTable(section)}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      ) : null}
    </div>
  );
}

function ItemTable({
  restaurantId,
  menu,
  section,
  gbpDriftFields,
  onCreateItem,
  onEditItem,
  onDeleteItem,
  onCreateOption,
  onEditOption,
  onDeleteOption,
}: {
  restaurantId: string;
  menu: CanonicalRestaurantMenu;
  section: CanonicalRestaurantMenuSection;
  gbpDriftFields: ReadonlyArray<DualSyncFieldSummary>;
  onCreateItem: () => void;
  onEditItem: (item: CanonicalRestaurantMenuItem) => void;
  onDeleteItem: (item: CanonicalRestaurantMenuItem) => void;
  onCreateOption: (item: CanonicalRestaurantMenuItem) => void;
  onEditOption: (item: CanonicalRestaurantMenuItem, option: CanonicalRestaurantMenuOption) => void;
  onDeleteOption: (
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
  ) => void;
}) {
  const patchItem = useOpsPatchRestaurantMenuItem(restaurantId);
  const patchOption = useOpsPatchRestaurantMenuOption(restaurantId);
  const [quickEditItem, setQuickEditItem] = useState<CanonicalRestaurantMenuItem | null>(null);
  const quickEditDriftField = quickEditItem
    ? findFoodMenuItemDriftField(gbpDriftFields, {
        menuId: menu.id,
        menuLabel: primaryLabel(menu, 'Menu'),
        sectionId: section.id,
        sectionLabel: primaryLabel(section, 'Section'),
        externalItemId: quickEditItem.externalItemId,
        itemId: quickEditItem.id,
      })
    : null;
  const getItemGbpDriftFields = (item: CanonicalRestaurantMenuItem) => {
    const field = findFoodMenuItemDriftField(gbpDriftFields, {
      menuId: menu.id,
      menuLabel: primaryLabel(menu, 'Menu'),
      sectionId: section.id,
      sectionLabel: primaryLabel(section, 'Section'),
      externalItemId: item.externalItemId,
      itemId: item.id,
    });
    return field ? [field] : [];
  };

  const moveItem = async (item: CanonicalRestaurantMenuItem, index: number, direction: -1 | 1) => {
    const target = section.items[index + direction];
    if (!menu.id || !section.id || !item.id || !target?.id) return;
    await Promise.all([
      patchItem.mutateAsync({
        menuId: menu.id,
        sectionId: section.id,
        itemId: item.id,
        payload: { displayOrder: target.displayOrder },
      }),
      patchItem.mutateAsync({
        menuId: menu.id,
        sectionId: section.id,
        itemId: target.id,
        payload: { displayOrder: item.displayOrder },
      }),
    ]);
  };

  const moveOption = async (
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
    index: number,
    direction: -1 | 1,
  ) => {
    const target = item.options[index + direction];
    if (!menu.id || !section.id || !item.id || !option.id || !target?.id) return;
    await Promise.all([
      patchOption.mutateAsync({
        menuId: menu.id,
        sectionId: section.id,
        itemId: item.id,
        optionId: option.id,
        payload: { displayOrder: target.displayOrder },
      }),
      patchOption.mutateAsync({
        menuId: menu.id,
        sectionId: section.id,
        itemId: item.id,
        optionId: target.id,
        payload: { displayOrder: option.displayOrder },
      }),
    ]);
  };

  const removeOption = async (
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
  ) => {
    if (!menu.id || !section.id || !item.id || !option.id) return;
    onDeleteOption(item, option);
  };

  const toggleItemActive = async (item: CanonicalRestaurantMenuItem, active: boolean) => {
    if (!menu.id || !section.id || !item.id) return;
    await patchItem.mutateAsync({
      menuId: menu.id,
      sectionId: section.id,
      itemId: item.id,
      payload: { active },
    });
  };

  const quickPatchItem = async (
    item: CanonicalRestaurantMenuItem,
    payload: RestaurantMenuItemPatch,
  ) => {
    if (!menu.id || !section.id || !item.id) return;
    await patchItem.mutateAsync({
      menuId: menu.id,
      sectionId: section.id,
      itemId: item.id,
      payload,
    });
  };

  const renderOptions = (item: CanonicalRestaurantMenuItem) =>
    item.options.length === 0 ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-9 w-fit text-muted-foreground"
        onClick={() => onCreateOption(item)}
      >
        <Plus data-icon="inline-start" aria-hidden />
        Add option
      </Button>
    ) : (
      <div className="flex flex-wrap items-center gap-1.5">
        {item.options.map((option, optionIndex) => (
          <OptionRow
            key={option.id ?? option.externalOptionId}
            item={item}
            option={option}
            optionIndex={optionIndex}
            optionsCount={item.options.length}
            onEditOption={onEditOption}
            onMoveOption={moveOption}
            onRemoveOption={removeOption}
            patchPending={patchOption.isPending}
          />
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-8 px-2 text-xs text-muted-foreground"
          onClick={() => onCreateOption(item)}
        >
          <Plus data-icon="inline-start" aria-hidden />
          Option
        </Button>
      </div>
    );

  return (
    <div className="min-w-0 bg-background">
      {section.items.length === 0 ? (
        <div className="p-6">
          <OpsEmptyState
            title="No items in this section"
            description="Create the first item for this menu section."
            action={
              <Button type="button" onClick={onCreateItem}>
                <Plus data-icon="inline-start" aria-hidden />
                Create item
              </Button>
            }
          />
        </div>
      ) : null}
      {section.items.length > 0 ? (
        <>
          <ul data-testid="mobile-item-list" className="flex flex-col divide-y md:hidden">
            {section.items.map((item, itemIndex) => (
              <li key={item.id} className="flex flex-col gap-3 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <ItemThumbnail item={item} />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {primaryLabel(item, 'Menu item')}
                      </span>
                      <GbpDriftBadge fields={getItemGbpDriftFields(item)} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground text-pretty">
                      {itemDescription(item)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="tabular-nums">{moneyLabel(item.attributes)}</span>
                      <ItemHealthBadge item={item} />
                    </div>
                  </div>
                  <ItemActions
                    item={item}
                    itemIndex={itemIndex}
                    itemsCount={section.items.length}
                    patchPending={patchItem.isPending}
                    onQuickEditItem={setQuickEditItem}
                    onEditItem={onEditItem}
                    onMoveItem={moveItem}
                    onDeleteItem={onDeleteItem}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availabilityBadges(item).map(({ label, variant, Icon }) => (
                    <Badge key={label} variant={variant} className="gap-1.5">
                      <Icon aria-hidden />
                      {label}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md bg-muted/30 p-3">
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    Status
                  </span>
                  <Switch
                    checked={item.active}
                    disabled={patchItem.isPending}
                    aria-label={`Set ${primaryLabel(item, 'Menu item')} active`}
                    onCheckedChange={(checked) => void toggleItemActive(item, checked)}
                  />
                </div>
                <div className="rounded-md bg-muted/30 p-2">{renderOptions(item)}</div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="min-w-[28rem]">Item details</TableHead>
                  <TableHead className="w-40">Price</TableHead>
                  <TableHead className="min-w-64">Availability</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-16 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.items.map((item, itemIndex) => (
                  <TableRow key={item.id} className="group hover:bg-muted/20">
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-4">
                        <ItemThumbnail item={item} />
                        <div className="min-w-0">
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-auto max-w-full justify-start truncate p-0 text-left text-base font-semibold text-foreground hover:bg-transparent hover:text-primary"
                            onClick={() => onEditItem(item)}
                          >
                            {primaryLabel(item, 'Menu item')}
                          </Button>
                          <GbpDriftBadge fields={getItemGbpDriftFields(item)} />
                          <p className="mt-1 line-clamp-2 max-w-xl text-sm leading-5 text-muted-foreground text-pretty">
                            {itemDescription(item)}
                          </p>
                          <div className="mt-2">{renderOptions(item)}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-base font-semibold tabular-nums">
                        {moneyLabel(item.attributes)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-sm flex-wrap gap-1.5">
                        {availabilityBadges(item).map(({ label, variant, Icon }) => (
                          <Badge key={label} variant={variant} className="gap-1.5">
                            <Icon aria-hidden />
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={item.active}
                          disabled={patchItem.isPending}
                          aria-label={`Set ${primaryLabel(item, 'Menu item')} active`}
                          onCheckedChange={(checked) => void toggleItemActive(item, checked)}
                        />
                        <span className="sr-only">{item.active ? 'Active' : 'Inactive'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <ItemActions
                        item={item}
                        itemIndex={itemIndex}
                        itemsCount={section.items.length}
                        patchPending={patchItem.isPending}
                        onQuickEditItem={setQuickEditItem}
                        onEditItem={onEditItem}
                        onMoveItem={moveItem}
                        onDeleteItem={onDeleteItem}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}
      <QuickEditItemDialog
        gbpDriftField={quickEditDriftField}
        item={quickEditItem}
        open={quickEditItem !== null}
        pending={patchItem.isPending}
        onOpenChange={(open) => {
          if (!open) setQuickEditItem(null);
        }}
        onSubmit={async (item, payload) => {
          await quickPatchItem(item, payload);
          setQuickEditItem(null);
        }}
      />
    </div>
  );
}

function ItemActions({
  item,
  itemIndex,
  itemsCount,
  patchPending,
  onQuickEditItem,
  onEditItem,
  onMoveItem,
  onDeleteItem,
}: {
  item: CanonicalRestaurantMenuItem;
  itemIndex: number;
  itemsCount: number;
  patchPending: boolean;
  onQuickEditItem: (item: CanonicalRestaurantMenuItem) => void;
  onEditItem: (item: CanonicalRestaurantMenuItem) => void;
  onMoveItem: (
    item: CanonicalRestaurantMenuItem,
    index: number,
    direction: -1 | 1,
  ) => Promise<void>;
  onDeleteItem: (item: CanonicalRestaurantMenuItem) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 text-muted-foreground"
          aria-label={`Open item actions for ${primaryLabel(item, 'Menu item')}`}
        >
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => onQuickEditItem(item)}>
            <SlidersHorizontal aria-hidden />
            Quick edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onEditItem(item)}>
            <Pencil aria-hidden />
            Full edit
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={itemIndex === 0 || patchPending}
            onSelect={() => void onMoveItem(item, itemIndex, -1)}
          >
            <ArrowUp aria-hidden />
            Move item up
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={itemIndex === itemsCount - 1 || patchPending}
            onSelect={() => void onMoveItem(item, itemIndex, 1)}
          >
            <ArrowDown aria-hidden />
            Move item down
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => onDeleteItem(item)}>
            <Trash2 aria-hidden />
            Delete item
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function QuickEditItemDialog({
  gbpDriftField,
  item,
  open,
  pending,
  onOpenChange,
  onSubmit,
}: {
  gbpDriftField: DualSyncFieldSummary | null;
  item: CanonicalRestaurantMenuItem | null;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (item: CanonicalRestaurantMenuItem, payload: RestaurantMenuItemPatch) => Promise<void>;
}) {
  const gbpDrift = useOptionalGbpDrift();
  const registerDraftOverride = gbpDrift?.registerDraftOverride;
  const [price, setPrice] = useState('');
  const [currencyCode, setCurrencyCode] = useState('GBP');
  const [active, setActive] = useState(true);
  const [soldOut, setSoldOut] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState(NONE_VALUE);

  useEffect(() => {
    if (!item) return;
    setPrice(
      typeof item.attributes.price?.amount === 'number' ? String(item.attributes.price.amount) : '',
    );
    setCurrencyCode(item.attributes.price?.currencyCode ?? 'GBP');
    setActive(item.active);
    const policy = item.extensions.availabilityPolicy as Record<string, unknown> | undefined;
    setSoldOut(policy?.soldOut === true);
    setAvailabilityStatus(
      typeof policy?.availabilityStatus === 'string' ? policy.availabilityStatus : NONE_VALUE,
    );
  }, [item]);

  useEffect(() => {
    if (!open || !item || !gbpDriftField || !registerDraftOverride) return;
    const amount = price.trim() ? Number(price) : null;
    const baseValue =
      gbpDriftField.coreValue && typeof gbpDriftField.coreValue === 'object'
        ? gbpDriftField.coreValue
        : gbpDriftField.gbpValue && typeof gbpDriftField.gbpValue === 'object'
          ? gbpDriftField.gbpValue
          : {};
    registerDraftOverride(gbpDriftField.fieldKey, {
      ...baseValue,
      basePrice: Number.isFinite(amount) ? amount : null,
      currency: currencyCode.trim() || 'GBP',
    });
    return () => {
      registerDraftOverride(gbpDriftField.fieldKey, null);
    };
  }, [currencyCode, gbpDriftField, item, open, price, registerDraftOverride]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!item) return;
    const amount = price.trim() ? Number(price) : null;
    await onSubmit(item, {
      active,
      attributes: {
        ...item.attributes,
        price: {
          currencyCode: currencyCode.trim() || 'GBP',
          amount: Number.isFinite(amount) ? amount : null,
        },
      },
      extensions: {
        ...item.extensions,
        availabilityPolicy: {
          ...(item.extensions.availabilityPolicy ?? {}),
          availabilityStatus:
            availabilityStatus === NONE_VALUE
              ? null
              : (availabilityStatus as 'available' | 'unavailable' | 'seasonal'),
          soldOut,
        },
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick edit item</DialogTitle>
          <DialogDescription>
            Save price, active state, and guest-visible availability without opening the full item
            sheet.
          </DialogDescription>
        </DialogHeader>
        <FormRoot className="flex flex-col gap-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-[6rem_1fr]">
            <Field label="Currency">
              <Input
                value={currencyCode}
                onChange={(event) => setCurrencyCode(event.target.value)}
              />
            </Field>
            <Field label="Price">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Availability flag">
            <Select value={availabilityStatus} onValueChange={setAvailabilityStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Not set</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="unavailable">Unavailable</SelectItem>
                <SelectItem value="seasonal">Seasonal</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <SwitchField label="Active" checked={active} onCheckedChange={setActive} />
            <SwitchField label="Sold out" checked={soldOut} onCheckedChange={setSoldOut} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !item}>
              {pending ? 'Saving...' : 'Save quick edit'}
            </Button>
          </DialogFooter>
        </FormRoot>
      </DialogContent>
    </Dialog>
  );
}

function OptionRow({
  item,
  option,
  optionIndex,
  optionsCount,
  onEditOption,
  onMoveOption,
  onRemoveOption,
  patchPending,
}: {
  item: CanonicalRestaurantMenuItem;
  option: CanonicalRestaurantMenuOption;
  optionIndex: number;
  optionsCount: number;
  onEditOption: (item: CanonicalRestaurantMenuItem, option: CanonicalRestaurantMenuOption) => void;
  onMoveOption: (
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
    index: number,
    direction: -1 | 1,
  ) => Promise<void>;
  onRemoveOption: (
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
  ) => Promise<void>;
  patchPending: boolean;
}) {
  const price = moneyLabel(option.attributes);
  return (
    <div className="inline-flex max-w-full items-stretch overflow-hidden rounded-md border bg-background shadow-xs">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-8 min-w-0 justify-start gap-2 rounded-none px-2 text-left"
        onClick={() => onEditOption(item, option)}
        aria-label={`Edit option ${primaryLabel(option, 'Option')}`}
      >
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {primaryLabel(option, 'Option')}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{price}</span>
        {!option.active ? (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            Inactive
          </Badge>
        ) : null}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-none border-l"
            aria-label={`Open option actions for ${primaryLabel(option, 'Option')}`}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => onEditOption(item, option)}>
              <Pencil aria-hidden />
              Edit option
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={optionIndex === 0 || patchPending}
              onSelect={() => void onMoveOption(item, option, optionIndex, -1)}
            >
              <ArrowUp aria-hidden />
              Move option up
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={optionIndex === optionsCount - 1 || patchPending}
              onSelect={() => void onMoveOption(item, option, optionIndex, 1)}
            >
              <ArrowDown aria-hidden />
              Move option down
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => void onRemoveOption(item, option)}
            >
              <Trash2 aria-hidden />
              Delete option
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function MenuDialog({
  restaurantId,
  mode,
  menu,
  defaultMenuKind,
  onOpenChange,
}: {
  restaurantId: string;
  mode: 'create' | 'edit' | null;
  menu: CanonicalRestaurantMenu | null;
  defaultMenuKind: MenuKind;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<MenuFormState>(() => menuInitialState(menu, defaultMenuKind));
  const createMenu = useOpsCreateRestaurantMenu(restaurantId);
  const updateMenu = useOpsUpdateRestaurantMenu({ restaurantId, menuId: menu?.id });

  useEffect(() => {
    if (mode) setState(menuInitialState(menu, defaultMenuKind));
  }, [defaultMenuKind, menu, mode]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = buildMenuPayload(state);
    if (mode === 'edit' && menu?.id) {
      await updateMenu.mutateAsync(payload);
    } else {
      await createMenu.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  const pending = createMenu.isPending || updateMenu.isPending;
  const error = createMenu.error ?? updateMenu.error;

  return (
    <Dialog open={Boolean(mode)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit menu' : 'Create menu'}</DialogTitle>
          <DialogDescription>
            Menu details that can be published to Google live here before sections and items.
          </DialogDescription>
        </DialogHeader>
        <FormRoot className="flex flex-col gap-5" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Menu name">
              <Input
                value={state.displayName}
                onChange={(event) =>
                  setState((current) => ({ ...current, displayName: event.target.value }))
                }
                required
              />
            </Field>
            <Field label="Kind">
              <Select
                value={state.menuKind}
                onValueChange={(value) =>
                  setState((current) => ({ ...current, menuKind: value as MenuKind }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="food">Food</SelectItem>
                  <SelectItem value="drinks">Drinks</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Default language">
              <Input
                value={state.defaultLanguageCode}
                onChange={(event) =>
                  setState((current) => ({ ...current, defaultLanguageCode: event.target.value }))
                }
              />
            </Field>
            <Field label="Source URL">
              <Input
                type="url"
                value={state.sourceUrl}
                onChange={(event) =>
                  setState((current) => ({ ...current, sourceUrl: event.target.value }))
                }
              />
            </Field>
          </div>
          <Field label="Description">
            <Textarea
              value={state.description}
              onChange={(event) =>
                setState((current) => ({ ...current, description: event.target.value }))
              }
            />
          </Field>
          <Field label="Additional Google labels">
            <Textarea
              value={state.additionalLabels}
              onChange={(event) =>
                setState((current) => ({ ...current, additionalLabels: event.target.value }))
              }
              placeholder="fr-FR | Nom du menu | Description"
            />
          </Field>
          <MultiCheckboxGroup
            label="Google cuisines"
            options={CUISINE_OPTIONS}
            values={state.cuisines}
            onChange={(value, checked) =>
              setState((current) => ({
                ...current,
                cuisines: toggleValue(current.cuisines, value, checked),
              }))
            }
          />
          <SwitchField
            label="Menu active"
            checked={state.active}
            onCheckedChange={(checked) => setState((current) => ({ ...current, active: checked }))}
          />
          {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : 'Save menu'}
            </Button>
          </DialogFooter>
        </FormRoot>
      </DialogContent>
    </Dialog>
  );
}

function SectionDialog({
  restaurantId,
  menu,
  mode,
  section,
  onOpenChange,
}: {
  restaurantId: string;
  menu: CanonicalRestaurantMenu | null;
  mode: 'create' | 'edit' | null;
  section: CanonicalRestaurantMenuSection | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<SectionFormState>(() => sectionInitialState(section));
  const createSection = useOpsCreateRestaurantMenuSection({ restaurantId, menuId: menu?.id });
  const updateSection = useOpsUpdateRestaurantMenuSection({
    restaurantId,
    menuId: menu?.id,
    sectionId: section?.id,
  });

  useEffect(() => {
    if (mode) setState(sectionInitialState(section));
  }, [mode, section]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!menu) return;
    if (mode === 'edit' && section?.id) {
      await updateSection.mutateAsync(buildSectionPayload(state, section.displayOrder));
    } else {
      await createSection.mutateAsync(buildSectionPayload(state, menu.sections.length));
    }
    onOpenChange(false);
  };

  const pending = createSection.isPending || updateSection.isPending;
  const error = createSection.error ?? updateSection.error;

  return (
    <Dialog open={Boolean(mode)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit section' : 'Create section'}</DialogTitle>
          <DialogDescription>
            Sections replace legacy category/subcategory grouping while preserving compatibility
            labels.
          </DialogDescription>
        </DialogHeader>
        <FormRoot className="flex flex-col gap-4" onSubmit={submit}>
          <Field label="Section name">
            <Input
              value={state.displayName}
              onChange={(event) =>
                setState((current) => ({ ...current, displayName: event.target.value }))
              }
              required
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={state.description}
              onChange={(event) =>
                setState((current) => ({ ...current, description: event.target.value }))
              }
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Primary label language">
              <Input
                value={state.languageCode}
                onChange={(event) =>
                  setState((current) => ({ ...current, languageCode: event.target.value }))
                }
                placeholder="en-GB"
              />
            </Field>
            <Field label="Additional Google labels">
              <Textarea
                value={state.additionalLabels}
                onChange={(event) =>
                  setState((current) => ({ ...current, additionalLabels: event.target.value }))
                }
                placeholder="fr-FR | Nom de section | Description"
              />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Legacy category">
              <Input
                value={state.legacyCategory}
                onChange={(event) =>
                  setState((current) => ({ ...current, legacyCategory: event.target.value }))
                }
              />
            </Field>
            <Field label="Legacy subcategory">
              <Input
                value={state.legacySubcategory}
                onChange={(event) =>
                  setState((current) => ({ ...current, legacySubcategory: event.target.value }))
                }
              />
            </Field>
          </div>
          <SwitchField
            label="Section active"
            checked={state.active}
            onCheckedChange={(checked) => setState((current) => ({ ...current, active: checked }))}
          />
          {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !menu}>
              {pending ? 'Saving...' : mode === 'edit' ? 'Save section' : 'Create section'}
            </Button>
          </DialogFooter>
        </FormRoot>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({
  restaurantId,
  menu,
  section,
  item,
  open,
  onOpenChange,
}: {
  restaurantId: string;
  menu: CanonicalRestaurantMenu | null;
  section: CanonicalRestaurantMenuSection | null;
  item: CanonicalRestaurantMenuItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<ItemFormState>(() => itemInitialState(item, menu?.menuKind));
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaKeyDraft, setMediaKeyDraft] = useState('');
  const createItem = useOpsCreateRestaurantMenuItem({
    restaurantId,
    menuId: menu?.id,
    sectionId: section?.id,
  });
  const updateItem = useOpsUpdateRestaurantMenuItem({
    restaurantId,
    menuId: menu?.id,
    sectionId: section?.id,
    itemId: item?.id,
  });

  useEffect(() => {
    if (open) {
      setState(itemInitialState(item, menu?.menuKind));
      setMediaError(null);
      setMediaKeyDraft('');
    }
  }, [item, menu?.menuKind, open]);

  const mediaKeys = splitTokens(state.googleMediaKeys);

  const addMediaKey = () => {
    const nextKey = mediaKeyDraft.trim();
    if (!nextKey) return;
    if (looksLikeLocalMediaUrl(nextKey)) {
      setMediaError('Google media keys cannot be image URLs.');
      return;
    }
    setMediaError(null);
    setState((current) => ({
      ...current,
      googleMediaKeys: [...new Set([...splitTokens(current.googleMediaKeys), nextKey])].join('\n'),
    }));
    setMediaKeyDraft('');
  };

  const removeMediaKey = (key: string) => {
    setState((current) => ({
      ...current,
      googleMediaKeys: splitTokens(current.googleMediaKeys)
        .filter((entry) => entry !== key)
        .join('\n'),
    }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!menu || !section) return;
    const googleMediaKeys = splitTokens(state.googleMediaKeys);
    if (googleMediaKeys.some(looksLikeLocalMediaUrl)) {
      setMediaError(
        'Google media keys cannot be image URLs. Put local URLs in the local image field.',
      );
      return;
    }
    const payload = buildItemPayload({
      state,
      menuKind: menu.menuKind,
      displayOrder: item?.displayOrder ?? section.items.length,
      existing: item,
    });
    if (item?.id) {
      await updateItem.mutateAsync(payload);
    } else {
      await createItem.mutateAsync(payload as RestaurantMenuItemInput);
    }
    onOpenChange(false);
  };

  const pending = createItem.isPending || updateItem.isPending;
  const error = createItem.error ?? updateItem.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit item' : 'Create item'}</DialogTitle>
          <DialogDescription>
            Details that can be published to Google are grouped above internal operations metadata.
          </DialogDescription>
        </DialogHeader>
        <FormRoot className="flex flex-col gap-5" onSubmit={submit}>
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2">
              <Globe2 className="size-4 text-muted-foreground" aria-hidden />
              <h3 className="text-sm font-semibold">Essentials</h3>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Item name">
                <Input
                  value={state.displayName}
                  onChange={(event) =>
                    setState((current) => ({ ...current, displayName: event.target.value }))
                  }
                  required
                />
              </Field>
              <Field label="Primary label language">
                <Input
                  value={state.languageCode}
                  onChange={(event) =>
                    setState((current) => ({ ...current, languageCode: event.target.value }))
                  }
                  placeholder="en-GB"
                />
              </Field>
              <Field label="Price">
                <div className="grid grid-cols-[6rem_1fr] gap-2">
                  <Input
                    value={state.currencyCode}
                    onChange={(event) =>
                      setState((current) => ({ ...current, currencyCode: event.target.value }))
                    }
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={state.price}
                    onChange={(event) =>
                      setState((current) => ({ ...current, price: event.target.value }))
                    }
                  />
                </div>
              </Field>
            </div>
            <Field label="Description" className="mt-4">
              <Textarea
                value={state.description}
                onChange={(event) =>
                  setState((current) => ({ ...current, description: event.target.value }))
                }
              />
            </Field>
            <Field label="Additional Google labels" className="mt-4">
              <Textarea
                value={state.additionalLabels}
                onChange={(event) =>
                  setState((current) => ({ ...current, additionalLabels: event.target.value }))
                }
                placeholder="fr-FR | Nom affiche | Description"
              />
            </Field>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Spiciness">
                <Select
                  value={state.spiciness}
                  onValueChange={(value) =>
                    setState((current) => ({ ...current, spiciness: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>None</SelectItem>
                    {SPICINESS_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {formatEnumLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Serves">
                <Input
                  type="number"
                  min="0"
                  value={state.serves}
                  onChange={(event) =>
                    setState((current) => ({ ...current, serves: event.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <MultiCheckboxGroup
                label="Allergens"
                options={ALLERGEN_OPTIONS}
                values={state.allergens}
                onChange={(value, checked) =>
                  setState((current) => ({
                    ...current,
                    allergens: toggleValue(current.allergens, value, checked),
                  }))
                }
              />
              <MultiCheckboxGroup
                label="Dietary restrictions"
                options={DIETARY_OPTIONS}
                values={state.dietaryRestrictions}
                onChange={(value, checked) =>
                  setState((current) => ({
                    ...current,
                    dietaryRestrictions: toggleValue(current.dietaryRestrictions, value, checked),
                  }))
                }
              />
            </div>
            <MultiCheckboxGroup
              label="Preparation methods"
              options={PREPARATION_OPTIONS}
              values={state.preparationMethods}
              onChange={(value, checked) =>
                setState((current) => ({
                  ...current,
                  preparationMethods: toggleValue(current.preparationMethods, value, checked),
                }))
              }
              className="mt-4"
            />
            <Field label="Ingredients" className="mt-4">
              <Input
                value={state.ingredients}
                onChange={(event) =>
                  setState((current) => ({ ...current, ingredients: event.target.value }))
                }
                placeholder="Comma-separated ingredient labels"
              />
            </Field>
            <div className="mt-4 rounded-md border bg-muted/20 p-3">
              <h4 className="text-xs font-medium uppercase text-muted-foreground">
                Guest menu portion size
              </h4>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <Field label="Quantity">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={state.portionQuantity}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        portionQuantity: event.target.value,
                      }))
                    }
                    placeholder="1"
                  />
                </Field>
                <Field label="Unit label">
                  <Input
                    value={state.portionUnitName}
                    onChange={(event) =>
                      setState((current) => ({ ...current, portionUnitName: event.target.value }))
                    }
                    placeholder="plate, pieces, skewers"
                  />
                </Field>
                <Field label="Unit description">
                  <Input
                    value={state.portionUnitDescription}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        portionUnitDescription: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Unit language">
                  <Input
                    value={state.portionUnitLanguageCode}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        portionUnitLanguageCode: event.target.value,
                      }))
                    }
                    placeholder="en-GB"
                  />
                </Field>
              </div>
              <Field label="Additional unit labels" className="mt-3">
                <Textarea
                  value={state.portionAdditionalUnits}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      portionAdditionalUnits: event.target.value,
                    }))
                  }
                  placeholder="fr-FR | morceaux | Description"
                />
              </Field>
            </div>
            <div className="mt-4 rounded-md border bg-muted/20 p-3">
              <h4 className="text-xs font-medium uppercase text-muted-foreground">
                Google nutrition facts
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Google menu publishing includes calories, total fat, cholesterol, sodium, total
                carbohydrate, and protein. Sugar, fibre, and saturated fat remain import-tolerated.
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Calories">
                  <NutritionRangeInputs
                    lowerValue={state.calories}
                    upperValue={state.caloriesUpper}
                    unit={NUTRITION_UNITS.calorie}
                    onLowerChange={(value) =>
                      setState((current) => ({ ...current, calories: value }))
                    }
                    onUpperChange={(value) =>
                      setState((current) => ({ ...current, caloriesUpper: value }))
                    }
                  />
                </Field>
                <Field label="Total fat">
                  <NutritionRangeInputs
                    lowerValue={state.totalFat}
                    upperValue={state.totalFatUpper}
                    unit={NUTRITION_UNITS.gram}
                    onLowerChange={(value) =>
                      setState((current) => ({ ...current, totalFat: value }))
                    }
                    onUpperChange={(value) =>
                      setState((current) => ({ ...current, totalFatUpper: value }))
                    }
                  />
                </Field>
                <Field label="Cholesterol">
                  <NutritionRangeInputs
                    lowerValue={state.cholesterol}
                    upperValue={state.cholesterolUpper}
                    unit={NUTRITION_UNITS.milligram}
                    onLowerChange={(value) =>
                      setState((current) => ({ ...current, cholesterol: value }))
                    }
                    onUpperChange={(value) =>
                      setState((current) => ({ ...current, cholesterolUpper: value }))
                    }
                  />
                </Field>
                <Field label="Sodium">
                  <NutritionRangeInputs
                    lowerValue={state.sodium}
                    upperValue={state.sodiumUpper}
                    unit={NUTRITION_UNITS.milligram}
                    onLowerChange={(value) =>
                      setState((current) => ({ ...current, sodium: value }))
                    }
                    onUpperChange={(value) =>
                      setState((current) => ({ ...current, sodiumUpper: value }))
                    }
                  />
                </Field>
                <Field label="Total carbohydrate">
                  <NutritionRangeInputs
                    lowerValue={state.totalCarbohydrate}
                    upperValue={state.totalCarbohydrateUpper}
                    unit={NUTRITION_UNITS.gram}
                    onLowerChange={(value) =>
                      setState((current) => ({ ...current, totalCarbohydrate: value }))
                    }
                    onUpperChange={(value) =>
                      setState((current) => ({ ...current, totalCarbohydrateUpper: value }))
                    }
                  />
                </Field>
                <Field label="Protein">
                  <NutritionRangeInputs
                    lowerValue={state.protein}
                    upperValue={state.proteinUpper}
                    unit={NUTRITION_UNITS.gram}
                    onLowerChange={(value) =>
                      setState((current) => ({ ...current, protein: value }))
                    }
                    onUpperChange={(value) =>
                      setState((current) => ({ ...current, proteinUpper: value }))
                    }
                  />
                </Field>
              </div>
            </div>
          </div>

          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
              <h3 className="text-sm font-semibold">Google publishing</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Select or paste GBP media keys for publishing. Local image URLs stay Nabatable-only.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div className="flex min-w-0 flex-col gap-3 rounded-md border bg-muted/20 p-3">
                <div className="flex gap-2">
                  <Input
                    value={mediaKeyDraft}
                    onChange={(event) => setMediaKeyDraft(event.target.value)}
                    placeholder="locations/{locationId}/media/{mediaKey}"
                  />
                  <Button type="button" variant="outline" onClick={addMediaKey}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {mediaKeys.length > 0 ? (
                    mediaKeys.map((mediaKey) => (
                      <Badge
                        key={mediaKey}
                        variant="secondary"
                        className="max-w-full gap-2 px-2 py-1"
                      >
                        <span className="max-w-64 truncate">{mediaKey}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-5 text-muted-foreground hover:text-foreground"
                          onClick={() => removeMediaKey(mediaKey)}
                          aria-label={`Remove ${mediaKey}`}
                        >
                          ×
                        </Button>
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No GBP media keys selected.
                    </span>
                  )}
                </div>
                <Field label="Manual paste fallback">
                  <Textarea
                    value={state.googleMediaKeys}
                    onChange={(event) =>
                      setState((current) => ({ ...current, googleMediaKeys: event.target.value }))
                    }
                    placeholder="One Google media key per line"
                  />
                </Field>
              </div>
              <Field label="Local image URL">
                <Input
                  value={state.localImageUrl}
                  onChange={(event) =>
                    setState((current) => ({ ...current, localImageUrl: event.target.value }))
                  }
                  placeholder="/uploads/menu/example.jpg"
                />
              </Field>
            </div>
            {mediaError ? <p className="mt-3 text-sm text-destructive">{mediaError}</p> : null}
          </div>

          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
              <h3 className="text-sm font-semibold">Guest menu</h3>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Availability status">
                <Select
                  value={state.availabilityStatus}
                  onValueChange={(value) =>
                    setState((current) => ({ ...current, availabilityStatus: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Not set</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="unavailable">Unavailable</SelectItem>
                    <SelectItem value="seasonal">Seasonal</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Service periods">
                <Input
                  value={state.servicePeriods}
                  onChange={(event) =>
                    setState((current) => ({ ...current, servicePeriods: event.target.value }))
                  }
                  placeholder="lunch, dinner"
                />
              </Field>
              <SwitchField
                label="Item active"
                checked={state.active}
                onCheckedChange={(checked) =>
                  setState((current) => ({ ...current, active: checked }))
                }
              />
              <SwitchField
                label="Sold out"
                checked={state.soldOut}
                onCheckedChange={(checked) =>
                  setState((current) => ({ ...current, soldOut: checked }))
                }
              />
              <SwitchField
                label="Orderable"
                checked={state.orderable}
                onCheckedChange={(checked) =>
                  setState((current) => ({ ...current, orderable: checked }))
                }
              />
            </div>
            <Field label="Availability policy note" className="mt-4">
              <Textarea
                value={state.availabilityNote}
                onChange={(event) =>
                  setState((current) => ({ ...current, availabilityNote: event.target.value }))
                }
              />
            </Field>
          </div>

          {menu?.menuKind === 'drinks' ? (
            <div className="rounded-md border p-4">
              <div className="flex items-center gap-2">
                <Beer className="size-4 text-muted-foreground" aria-hidden />
                <h3 className="text-sm font-semibold">Drink details</h3>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="ABV %">
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={state.abvPercent}
                    onChange={(event) =>
                      setState((current) => ({ ...current, abvPercent: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Volume ml">
                  <Input
                    type="number"
                    min="0"
                    value={state.volumeMl}
                    onChange={(event) =>
                      setState((current) => ({ ...current, volumeMl: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Serving size">
                  <Input
                    value={state.servingSize}
                    onChange={(event) =>
                      setState((current) => ({ ...current, servingSize: event.target.value }))
                    }
                    placeholder="Pint, 175ml, bottle"
                  />
                </Field>
                <Field label="Style">
                  <Input
                    value={state.drinkStyle}
                    onChange={(event) =>
                      setState((current) => ({ ...current, drinkStyle: event.target.value }))
                    }
                    placeholder="Lager, IPA, Merlot"
                  />
                </Field>
                <Field label="Region">
                  <Input
                    value={state.drinkRegion}
                    onChange={(event) =>
                      setState((current) => ({ ...current, drinkRegion: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Grape">
                  <Input
                    value={state.drinkGrape}
                    onChange={(event) =>
                      setState((current) => ({ ...current, drinkGrape: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Caffeine mg">
                  <Input
                    type="number"
                    min="0"
                    value={state.caffeineMg}
                    onChange={(event) =>
                      setState((current) => ({ ...current, caffeineMg: event.target.value }))
                    }
                  />
                </Field>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <SwitchField
                  label="Contains dairy"
                  checked={state.containsDairy}
                  onCheckedChange={(checked) =>
                    setState((current) => ({ ...current, containsDairy: checked }))
                  }
                />
                <SwitchField
                  label="Contains nuts"
                  checked={state.containsNuts}
                  onCheckedChange={(checked) =>
                    setState((current) => ({ ...current, containsNuts: checked }))
                  }
                />
                <SwitchField
                  label="Contains gluten"
                  checked={state.containsGluten}
                  onCheckedChange={(checked) =>
                    setState((current) => ({ ...current, containsGluten: checked }))
                  }
                />
                <SwitchField
                  label="Contains caffeine"
                  checked={state.containsCaffeine}
                  onCheckedChange={(checked) =>
                    setState((current) => ({ ...current, containsCaffeine: checked }))
                  }
                />
                <SwitchField
                  label="Non-alcoholic"
                  checked={state.nonAlcoholic}
                  onCheckedChange={(checked) =>
                    setState((current) => ({ ...current, nonAlcoholic: checked }))
                  }
                />
                <SwitchField
                  label="Decaf available"
                  checked={state.decafAvailable}
                  onCheckedChange={(checked) =>
                    setState((current) => ({ ...current, decafAvailable: checked }))
                  }
                />
              </div>
              <Field label="Drink profile note" className="mt-4">
                <Textarea
                  value={state.drinkProfileNote}
                  onChange={(event) =>
                    setState((current) => ({ ...current, drinkProfileNote: event.target.value }))
                  }
                />
              </Field>
            </div>
          ) : null}

          <div className="rounded-md border p-4">
            <h3 className="text-sm font-semibold">Recommendations</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <SwitchField
                label="Featured"
                checked={state.featured}
                onCheckedChange={(checked) =>
                  setState((current) => ({ ...current, featured: checked }))
                }
              />
              <SwitchField
                label="Signature"
                checked={state.signature}
                onCheckedChange={(checked) =>
                  setState((current) => ({ ...current, signature: checked }))
                }
              />
              <Field label="Popularity score">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={state.popularityScore}
                  onChange={(event) =>
                    setState((current) => ({ ...current, popularityScore: event.target.value }))
                  }
                />
              </Field>
              <Field label="Recommendation tags">
                <Input
                  value={state.recommendationTags}
                  onChange={(event) =>
                    setState((current) => ({ ...current, recommendationTags: event.target.value }))
                  }
                  placeholder="staff pick, pairs with curry"
                />
              </Field>
            </div>
            <Field label="Pairing notes" className="mt-4">
              <Textarea
                value={state.pairingNotes}
                onChange={(event) =>
                  setState((current) => ({ ...current, pairingNotes: event.target.value }))
                }
              />
            </Field>
          </div>

          <div className="rounded-md border p-4">
            <h3 className="text-sm font-semibold">Customization</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <SwitchField
                label="Allow customizations"
                checked={state.allowCustomizations}
                onCheckedChange={(checked) =>
                  setState((current) => ({ ...current, allowCustomizations: checked }))
                }
              />
              <Field label="Max selections">
                <Input
                  type="number"
                  min="0"
                  value={state.maxSelections}
                  onChange={(event) =>
                    setState((current) => ({ ...current, maxSelections: event.target.value }))
                  }
                />
              </Field>
              <Field label="Modifier group IDs">
                <Input
                  value={state.modifierGroupIds}
                  onChange={(event) =>
                    setState((current) => ({ ...current, modifierGroupIds: event.target.value }))
                  }
                />
              </Field>
            </div>
            <Field label="Customization control note" className="mt-4">
              <Textarea
                value={state.customizationNote}
                onChange={(event) =>
                  setState((current) => ({ ...current, customizationNote: event.target.value }))
                }
              />
            </Field>
          </div>

          <div className="rounded-md border p-4">
            <h3 className="text-sm font-semibold">Import metadata</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Source system">
                <Input
                  value={state.sourceSystem}
                  onChange={(event) =>
                    setState((current) => ({ ...current, sourceSystem: event.target.value }))
                  }
                />
              </Field>
              <Field label="Source item ID">
                <Input
                  value={state.sourceItemId}
                  onChange={(event) =>
                    setState((current) => ({ ...current, sourceItemId: event.target.value }))
                  }
                />
              </Field>
              <Field label="Imported at">
                <Input
                  value={state.importedAt}
                  onChange={(event) =>
                    setState((current) => ({ ...current, importedAt: event.target.value }))
                  }
                  placeholder="2026-05-08T12:00:00Z"
                />
              </Field>
            </div>
            <Field label="Source note" className="mt-4">
              <Textarea
                value={state.sourceNote}
                onChange={(event) =>
                  setState((current) => ({ ...current, sourceNote: event.target.value }))
                }
              />
            </Field>
          </div>

          {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !menu || !section}>
              {pending ? 'Saving...' : 'Save item'}
            </Button>
          </DialogFooter>
        </FormRoot>
      </DialogContent>
    </Dialog>
  );
}

function OptionDialog({
  restaurantId,
  menu,
  section,
  item,
  option,
  onOpenChange,
}: {
  restaurantId: string;
  menu: CanonicalRestaurantMenu | null;
  section: CanonicalRestaurantMenuSection | null;
  item: CanonicalRestaurantMenuItem | null;
  option: CanonicalRestaurantMenuOption | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<OptionFormState>(() => optionInitialState(option));
  const createOption = useOpsCreateRestaurantMenuOption({
    restaurantId,
    menuId: menu?.id,
    sectionId: section?.id,
    itemId: item?.id,
  });
  const updateOption = useOpsPatchRestaurantMenuOption(restaurantId);

  useEffect(() => {
    if (item) setState(optionInitialState(option));
  }, [item, option]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!item) return;
    const payload = buildOptionPayload(state, option?.displayOrder ?? item.options.length, option);
    if (option?.id && menu?.id && section?.id && item.id) {
      await updateOption.mutateAsync({
        menuId: menu.id,
        sectionId: section.id,
        itemId: item.id,
        optionId: option.id,
        payload,
      });
    } else {
      await createOption.mutateAsync(payload as RestaurantMenuOptionInput);
    }
    onOpenChange(false);
  };
  const pending = createOption.isPending || updateOption.isPending;
  const error = createOption.error ?? updateOption.error;

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{option ? 'Edit item option' : 'Add item option'}</DialogTitle>
          <DialogDescription>
            Google options are required variant choices and remain separate from internal modifier
            groups.
          </DialogDescription>
        </DialogHeader>
        <FormRoot className="flex flex-col gap-4" onSubmit={submit}>
          {item ? (
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <span className="font-medium">{primaryLabel(item, 'Menu item')}</span>
              <span className="ml-2 text-muted-foreground tabular-nums">
                {item.options.length} existing options
              </span>
            </div>
          ) : null}
          <Field label="Option name">
            <Input
              value={state.displayName}
              onChange={(event) =>
                setState((current) => ({ ...current, displayName: event.target.value }))
              }
              required
            />
          </Field>
          <Field label="Primary label language">
            <Input
              value={state.languageCode}
              onChange={(event) =>
                setState((current) => ({ ...current, languageCode: event.target.value }))
              }
              placeholder="en-GB"
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={state.description}
              onChange={(event) =>
                setState((current) => ({ ...current, description: event.target.value }))
              }
            />
          </Field>
          <Field label="Additional Google labels">
            <Textarea
              value={state.additionalLabels}
              onChange={(event) =>
                setState((current) => ({ ...current, additionalLabels: event.target.value }))
              }
              placeholder="fr-FR | Nom de l'option | Description"
            />
          </Field>
          <Field label="Option price">
            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <Input
                value={state.currencyCode}
                onChange={(event) =>
                  setState((current) => ({ ...current, currencyCode: event.target.value }))
                }
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                value={state.price}
                onChange={(event) =>
                  setState((current) => ({ ...current, price: event.target.value }))
                }
              />
            </div>
          </Field>
          <div className="rounded-md border p-4">
            <h3 className="text-sm font-semibold">Option Google attributes</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Spiciness">
                <Select
                  value={state.spiciness}
                  onValueChange={(value) =>
                    setState((current) => ({ ...current, spiciness: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>None</SelectItem>
                    {SPICINESS_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {formatEnumLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Serves">
                <Input
                  type="number"
                  min="0"
                  value={state.serves}
                  onChange={(event) =>
                    setState((current) => ({ ...current, serves: event.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <MultiCheckboxGroup
                label="Allergens"
                options={ALLERGEN_OPTIONS}
                values={state.allergens}
                onChange={(value, checked) =>
                  setState((current) => ({
                    ...current,
                    allergens: toggleValue(current.allergens, value, checked),
                  }))
                }
              />
              <MultiCheckboxGroup
                label="Dietary restrictions"
                options={DIETARY_OPTIONS}
                values={state.dietaryRestrictions}
                onChange={(value, checked) =>
                  setState((current) => ({
                    ...current,
                    dietaryRestrictions: toggleValue(current.dietaryRestrictions, value, checked),
                  }))
                }
              />
            </div>
            <MultiCheckboxGroup
              label="Preparation methods"
              options={PREPARATION_OPTIONS}
              values={state.preparationMethods}
              onChange={(value, checked) =>
                setState((current) => ({
                  ...current,
                  preparationMethods: toggleValue(current.preparationMethods, value, checked),
                }))
              }
              className="mt-4"
            />
            <Field label="Ingredients" className="mt-4">
              <Input
                value={state.ingredients}
                onChange={(event) =>
                  setState((current) => ({ ...current, ingredients: event.target.value }))
                }
                placeholder="Comma-separated ingredient labels"
              />
            </Field>
          </div>
          <div className="rounded-md border bg-muted/20 p-3">
            <h3 className="text-sm font-semibold">Option portion and nutrition</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Field label="Portion quantity">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={state.portionQuantity}
                  onChange={(event) =>
                    setState((current) => ({ ...current, portionQuantity: event.target.value }))
                  }
                  placeholder="1"
                />
              </Field>
              <Field label="Portion unit">
                <Input
                  value={state.portionUnitName}
                  onChange={(event) =>
                    setState((current) => ({ ...current, portionUnitName: event.target.value }))
                  }
                  placeholder="pieces"
                />
              </Field>
              <Field label="Unit description">
                <Input
                  value={state.portionUnitDescription}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      portionUnitDescription: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Unit language">
                <Input
                  value={state.portionUnitLanguageCode}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      portionUnitLanguageCode: event.target.value,
                    }))
                  }
                  placeholder="en-GB"
                />
              </Field>
            </div>
            <Field label="Additional unit labels" className="mt-3">
              <Textarea
                value={state.portionAdditionalUnits}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    portionAdditionalUnits: event.target.value,
                  }))
                }
                placeholder="fr-FR | morceaux | Description"
              />
            </Field>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Field label="Calories">
                <NutritionRangeInputs
                  lowerValue={state.calories}
                  upperValue={state.caloriesUpper}
                  unit={NUTRITION_UNITS.calorie}
                  onLowerChange={(value) =>
                    setState((current) => ({ ...current, calories: value }))
                  }
                  onUpperChange={(value) =>
                    setState((current) => ({ ...current, caloriesUpper: value }))
                  }
                />
              </Field>
              <Field label="Total fat">
                <NutritionRangeInputs
                  lowerValue={state.totalFat}
                  upperValue={state.totalFatUpper}
                  unit={NUTRITION_UNITS.gram}
                  onLowerChange={(value) =>
                    setState((current) => ({ ...current, totalFat: value }))
                  }
                  onUpperChange={(value) =>
                    setState((current) => ({ ...current, totalFatUpper: value }))
                  }
                />
              </Field>
              <Field label="Cholesterol">
                <NutritionRangeInputs
                  lowerValue={state.cholesterol}
                  upperValue={state.cholesterolUpper}
                  unit={NUTRITION_UNITS.milligram}
                  onLowerChange={(value) =>
                    setState((current) => ({ ...current, cholesterol: value }))
                  }
                  onUpperChange={(value) =>
                    setState((current) => ({ ...current, cholesterolUpper: value }))
                  }
                />
              </Field>
              <Field label="Sodium">
                <NutritionRangeInputs
                  lowerValue={state.sodium}
                  upperValue={state.sodiumUpper}
                  unit={NUTRITION_UNITS.milligram}
                  onLowerChange={(value) => setState((current) => ({ ...current, sodium: value }))}
                  onUpperChange={(value) =>
                    setState((current) => ({ ...current, sodiumUpper: value }))
                  }
                />
              </Field>
              <Field label="Total carbohydrate">
                <NutritionRangeInputs
                  lowerValue={state.totalCarbohydrate}
                  upperValue={state.totalCarbohydrateUpper}
                  unit={NUTRITION_UNITS.gram}
                  onLowerChange={(value) =>
                    setState((current) => ({ ...current, totalCarbohydrate: value }))
                  }
                  onUpperChange={(value) =>
                    setState((current) => ({ ...current, totalCarbohydrateUpper: value }))
                  }
                />
              </Field>
              <Field label="Protein">
                <NutritionRangeInputs
                  lowerValue={state.protein}
                  upperValue={state.proteinUpper}
                  unit={NUTRITION_UNITS.gram}
                  onLowerChange={(value) => setState((current) => ({ ...current, protein: value }))}
                  onUpperChange={(value) =>
                    setState((current) => ({ ...current, proteinUpper: value }))
                  }
                />
              </Field>
            </div>
          </div>
          <div className="rounded-md border p-4">
            <h3 className="text-sm font-semibold">Option media keys</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="GBP media keys">
                <Textarea
                  value={state.googleMediaKeys}
                  onChange={(event) =>
                    setState((current) => ({ ...current, googleMediaKeys: event.target.value }))
                  }
                  placeholder="One Google media key per line"
                />
              </Field>
              <Field label="Local image URL">
                <Input
                  value={state.localImageUrl}
                  onChange={(event) =>
                    setState((current) => ({ ...current, localImageUrl: event.target.value }))
                  }
                />
              </Field>
            </div>
          </div>
          <SwitchField
            label="Option active"
            checked={state.active}
            onCheckedChange={(checked) => setState((current) => ({ ...current, active: checked }))}
          />
          {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !item}>
              {pending ? 'Saving...' : option ? 'Save option' : 'Add option'}
            </Button>
          </DialogFooter>
        </FormRoot>
      </DialogContent>
    </Dialog>
  );
}

function DeleteHierarchyDialog({
  restaurantId,
  target,
  onOpenChange,
}: {
  restaurantId: string;
  target:
    | { type: 'menu'; menu: CanonicalRestaurantMenu }
    | { type: 'section'; menu: CanonicalRestaurantMenu; section: CanonicalRestaurantMenuSection }
    | {
        type: 'item';
        menu: CanonicalRestaurantMenu;
        section: CanonicalRestaurantMenuSection;
        item: CanonicalRestaurantMenuItem;
      }
    | {
        type: 'option';
        menu: CanonicalRestaurantMenu;
        section: CanonicalRestaurantMenuSection;
        item: CanonicalRestaurantMenuItem;
        option: CanonicalRestaurantMenuOption;
      }
    | null;
  onOpenChange: (open: boolean) => void;
}) {
  const deleteMenu = useOpsDeleteRestaurantMenu(restaurantId);
  const deleteSection = useOpsDeleteRestaurantMenuSection(restaurantId);
  const deleteItem = useOpsDeleteRestaurantMenuItem(restaurantId);
  const deleteOption = useOpsDeleteRestaurantMenuOption(restaurantId);

  const pending =
    deleteMenu.isPending ||
    deleteSection.isPending ||
    deleteItem.isPending ||
    deleteOption.isPending;
  const error = deleteMenu.error ?? deleteSection.error ?? deleteItem.error ?? deleteOption.error;

  const targetName = (() => {
    if (!target) return 'item';
    if (target.type === 'menu') return primaryLabel(target.menu, 'Menu');
    if (target.type === 'section') return primaryLabel(target.section, 'Section');
    if (target.type === 'item') return primaryLabel(target.item, 'Menu item');
    return primaryLabel(target.option, 'Option');
  })();

  const targetLabel = target?.type ?? 'item';

  const confirm = async () => {
    if (!target) return;
    if (target.type === 'menu' && target.menu.id) {
      await deleteMenu.mutateAsync({ menuId: target.menu.id });
    }
    if (target.type === 'section' && target.menu.id && target.section.id) {
      await deleteSection.mutateAsync({ menuId: target.menu.id, sectionId: target.section.id });
    }
    if (target.type === 'item' && target.menu.id && target.section.id && target.item.id) {
      await deleteItem.mutateAsync({
        menuId: target.menu.id,
        sectionId: target.section.id,
        itemId: target.item.id,
      });
    }
    if (
      target.type === 'option' &&
      target.menu.id &&
      target.section.id &&
      target.item.id &&
      target.option.id
    ) {
      await deleteOption.mutateAsync({
        menuId: target.menu.id,
        sectionId: target.section.id,
        itemId: target.item.id,
        optionId: target.option.id,
      });
    }
    onOpenChange(false);
  };

  return (
    <AlertDialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {targetLabel}</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {targetName} from the restaurant menu structure. Publishing changes to
            Google is handled separately.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            {pending ? 'Deleting...' : `Delete ${targetLabel}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <Label className="text-xs font-medium uppercase text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SwitchField({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/20 p-3">
      <Label className="text-sm font-medium">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function NutritionRangeInputs({
  lowerValue,
  upperValue,
  unit,
  onLowerChange,
  onUpperChange,
}: {
  lowerValue: string;
  upperValue: string;
  unit: string;
  onLowerChange: (value: string) => void;
  onUpperChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Input
        type="number"
        min="0"
        value={lowerValue}
        onChange={(event) => onLowerChange(event.target.value)}
        placeholder={`Lower ${unit}`}
      />
      <Input
        type="number"
        min="0"
        value={upperValue}
        onChange={(event) => onUpperChange(event.target.value)}
        placeholder={`Upper ${unit}`}
      />
    </div>
  );
}

function MultiCheckboxGroup({
  label,
  options,
  values,
  onChange,
  className,
}: {
  label: string;
  options: readonly string[];
  values: string[];
  onChange: (value: string, checked: boolean) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <Label
            key={option}
            className="flex min-h-10 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
          >
            <Checkbox
              checked={values.includes(option)}
              onCheckedChange={(checked) => onChange(option, checked === true)}
            />
            <span>{formatEnumLabel(option)}</span>
          </Label>
        ))}
      </div>
    </div>
  );
}
