'use client';

import {
  ArrowDown,
  ArrowUp,
  Beer,
  Globe2,
  Image as ImageIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Separator } from '@/components/ui/separator';
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
  useOpsDeleteRestaurantMenuOption,
  useOpsMenuHierarchy,
  useOpsPatchRestaurantMenuSection,
  useOpsPatchRestaurantMenuOption,
  useOpsUpdateRestaurantMenu,
  useOpsUpdateRestaurantMenuItem,
} from '@/hooks/ops/useOpsMenuHierarchy';
import { GOOGLE_FOOD_MENU_CUISINES } from '@/lib/google-food-menu-cuisines';
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

type MenuHierarchyManagementPanelProps = {
  restaurantId: string | null;
  preferredMenuKind: Extract<MenuKind, 'food' | 'drinks'>;
  onPreferredMenuKindChange: (kind: Extract<MenuKind, 'food' | 'drinks'>) => void;
};

type MenuFormState = {
  displayName: string;
  description: string;
  menuKind: MenuKind;
  defaultLanguageCode: string;
  sourceUrl: string;
  cuisines: string[];
  active: boolean;
};

type SectionFormState = {
  displayName: string;
  description: string;
  legacyCategory: string;
  legacySubcategory: string;
  active: boolean;
};

type ItemFormState = {
  displayName: string;
  description: string;
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
  googleMediaKeys: string;
  localImageUrl: string;
  active: boolean;
  availabilityNote: string;
  customizationNote: string;
  drinkProfileNote: string;
};

type OptionFormState = {
  displayName: string;
  description: string;
  price: string;
  currencyCode: string;
  active: boolean;
};

const LANGUAGE_CODE = 'en-GB';
const NONE_VALUE = '__none__';

const CUISINE_OPTIONS = GOOGLE_FOOD_MENU_CUISINES.filter(
  (cuisine) => cuisine !== 'CUISINE_UNSPECIFIED',
);

const ALLERGEN_OPTIONS = [
  'DAIRY',
  'EGG',
  'FISH',
  'PEANUT',
  'SHELLFISH',
  'SOY',
  'TREE_NUT',
  'WHEAT',
];
const DIETARY_OPTIONS = ['HALAL', 'KOSHER', 'ORGANIC', 'VEGAN', 'VEGETARIAN'];
const SPICINESS_OPTIONS = ['MILD', 'MEDIUM', 'HOT'];
const PREPARATION_OPTIONS = [
  'BAKED',
  'FRIED',
  'GRILLED',
  'PAN_FRIED',
  'ROASTED',
  'SAUTEED',
  'STEAMED',
];

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

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function splitTokens(value: string) {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function looksLikeLocalMediaUrl(value: string) {
  return /^(https?:|data:|blob:|\/)/i.test(value.trim());
}

function moneyLabel(attributes: CanonicalMenuItemAttributes) {
  const amount = attributes.price?.amount;
  const currency = attributes.price?.currencyCode ?? 'GBP';
  return typeof amount === 'number' ? `${currency} ${amount.toFixed(2)}` : 'No price';
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

function ItemStatusDot({ item }: { item: CanonicalRestaurantMenuItem }) {
  const { health, reasons } = deriveItemHealth(item);
  const tone =
    health === 'ready'
      ? 'bg-emerald-500'
      : health === 'incomplete'
        ? 'bg-amber-500'
        : 'bg-muted-foreground/40';
  const label =
    health === 'ready' ? 'Ready' : health === 'incomplete' ? 'Needs attention' : 'Inactive';
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            aria-label={`Status: ${label}. ${reasons.join('. ')}`}
          >
            <span className={cn('size-2 rounded-full', tone)} aria-hidden />
            <span>{label}</span>
          </span>
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

function menuInitialState(menu?: CanonicalRestaurantMenu | null): MenuFormState {
  return {
    displayName: menu ? primaryLabel(menu, 'Menu') : '',
    description: menu ? primaryDescription(menu) : '',
    menuKind: menu?.menuKind ?? 'food',
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
    legacyCategory: section?.legacyCategory ?? '',
    legacySubcategory: section?.legacySubcategory ?? '',
    active: section?.active ?? true,
  };
}

function recordNote(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return typeof value === 'string' ? value : '';
}

function nutritionValue(
  amount: CanonicalMenuItemAttributes['nutritionFacts'][keyof CanonicalMenuItemAttributes['nutritionFacts']],
) {
  const value = amount?.lowerAmount ?? amount?.quantity;
  return typeof value === 'number' ? String(value) : '';
}

function itemInitialState(
  item?: CanonicalRestaurantMenuItem | null,
  menuKind: MenuKind = 'food',
): ItemFormState {
  const attributes = item?.attributes;
  const nutritionFacts = attributes?.nutritionFacts ?? {};
  return {
    displayName: item ? primaryLabel(item, 'Menu item') : '',
    description: item ? primaryDescription(item) : '',
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
    googleMediaKeys: item?.media.googleMediaKeys?.join('\n') ?? '',
    localImageUrl: item?.media.localImageUrl ?? '',
    active: item?.active ?? true,
    availabilityNote: recordNote(item?.extensions.availabilityPolicy, 'opsNote'),
    customizationNote: recordNote(item?.extensions.customizationControls, 'opsNote'),
    drinkProfileNote:
      menuKind === 'drinks' ? recordNote(item?.extensions.drinkProfile, 'opsNote') : '',
  };
}

function optionInitialState(option?: CanonicalRestaurantMenuOption | null): OptionFormState {
  const amount = option?.attributes.price?.amount;
  return {
    displayName: option ? primaryLabel(option, 'Option') : '',
    description: option ? primaryDescription(option) : '',
    price: typeof amount === 'number' ? String(amount) : '',
    currencyCode: option?.attributes.price?.currencyCode ?? 'GBP',
    active: option?.active ?? true,
  };
}

function toggleValue(values: string[], value: string, checked: boolean) {
  if (checked) return values.includes(value) ? values : [...values, value];
  return values.filter((entry) => entry !== value);
}

function mergeNote(
  record: Record<string, unknown> | undefined,
  key: string,
  value: string,
): Record<string, unknown> {
  const next = { ...(record ?? {}) };
  const trimmed = value.trim();
  if (trimmed) {
    next[key] = trimmed;
  }
  return next;
}

function nutritionAmount(value: string, unit: 'CALORIE' | 'GRAM' | 'MILLIGRAM') {
  const amount = value.trim() ? Number(value) : null;
  return typeof amount === 'number' && Number.isFinite(amount) && amount >= 0
    ? { lowerAmount: amount, unit }
    : undefined;
}

function buildGoogleNutritionFacts(
  state: ItemFormState,
): CanonicalMenuItemAttributes['nutritionFacts'] {
  return {
    ...(nutritionAmount(state.calories, 'CALORIE')
      ? { calories: nutritionAmount(state.calories, 'CALORIE') }
      : {}),
    ...(nutritionAmount(state.totalFat, 'GRAM')
      ? { totalFat: nutritionAmount(state.totalFat, 'GRAM') }
      : {}),
    ...(nutritionAmount(state.cholesterol, 'MILLIGRAM')
      ? { cholesterol: nutritionAmount(state.cholesterol, 'MILLIGRAM') }
      : {}),
    ...(nutritionAmount(state.sodium, 'MILLIGRAM')
      ? { sodium: nutritionAmount(state.sodium, 'MILLIGRAM') }
      : {}),
    ...(nutritionAmount(state.totalCarbohydrate, 'GRAM')
      ? { totalCarbohydrate: nutritionAmount(state.totalCarbohydrate, 'GRAM') }
      : {}),
    ...(nutritionAmount(state.protein, 'GRAM')
      ? { protein: nutritionAmount(state.protein, 'GRAM') }
      : {}),
  };
}

function buildMenuPayload(state: MenuFormState): RestaurantMenuInput {
  return {
    labels: [
      {
        displayName: state.displayName.trim(),
        description: state.description.trim() || null,
        languageCode: state.defaultLanguageCode.trim() || LANGUAGE_CODE,
      },
    ],
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
    labels: [
      {
        displayName: state.displayName.trim(),
        description: state.description.trim() || null,
        languageCode: LANGUAGE_CODE,
      },
    ],
    displayOrder,
    active: state.active,
    legacyCategory: state.legacyCategory.trim() || state.displayName.trim(),
    legacySubcategory: state.legacySubcategory.trim() || null,
    legacySource: { editedFrom: 'ops-menu-hierarchy-ui' },
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
  const amount = state.price.trim() ? Number(state.price) : null;
  const googleMediaKeys = splitTokens(state.googleMediaKeys);
  const attributes: CanonicalMenuItemAttributes = {
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
    servesNumPeople: state.serves.trim() ? Number(state.serves) : null,
  };
  const extensions: NabatableMenuItemExtensions = {
    drinkProfile: mergeNote(existing?.extensions.drinkProfile, 'opsNote', state.drinkProfileNote),
    recommendationMetadata: existing?.extensions.recommendationMetadata ?? {},
    availabilityPolicy: mergeNote(
      existing?.extensions.availabilityPolicy,
      'opsNote',
      state.availabilityNote,
    ),
    customizationControls: mergeNote(
      existing?.extensions.customizationControls,
      'opsNote',
      state.customizationNote,
    ),
    sourceMetadata: {
      ...(existing?.extensions.sourceMetadata ?? {}),
      editedFrom: 'ops-menu-hierarchy-ui',
    },
  };

  return {
    itemKind: menuKind === 'drinks' ? 'drink' : 'food',
    externalItemId: existing?.externalItemId ?? `ops:${Date.now()}`,
    labels: [
      {
        displayName: state.displayName.trim(),
        description: state.description.trim() || null,
        languageCode: LANGUAGE_CODE,
      },
    ],
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
  const amount = state.price.trim() ? Number(state.price) : null;
  return {
    externalOptionId: existing?.externalOptionId ?? `ops-option:${Date.now()}`,
    labels: [
      {
        displayName: state.displayName.trim(),
        description: state.description.trim() || null,
        languageCode: LANGUAGE_CODE,
      },
    ],
    attributes: {
      price: {
        currencyCode: state.currencyCode.trim() || 'GBP',
        amount: Number.isFinite(amount) ? amount : null,
      },
      spiciness: null,
      allergen: [],
      dietaryRestriction: [],
      ingredients: [],
      preparationMethods: [],
      mediaKeys: [],
      nutritionFacts: {},
    },
    media: {
      googleMediaKeys: existing?.media.googleMediaKeys ?? [],
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
  onPreferredMenuKindChange,
}: MenuHierarchyManagementPanelProps) {
  const hierarchyQuery = useOpsMenuHierarchy(restaurantId);
  const menus = useMemo(() => hierarchyQuery.data?.menus ?? [], [hierarchyQuery.data?.menus]);
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [menuDialogMode, setMenuDialogMode] = useState<'create' | 'edit' | null>(null);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CanonicalRestaurantMenuItem | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [optionTarget, setOptionTarget] = useState<{
    item: CanonicalRestaurantMenuItem;
    option: CanonicalRestaurantMenuOption | null;
  } | null>(null);

  const selectedMenu = useMemo(
    () => menus.find((menu) => menu.id === selectedMenuId) ?? null,
    [menus, selectedMenuId],
  );
  const selectedSection = useMemo(
    () => selectedMenu?.sections.find((section) => section.id === selectedSectionId) ?? null,
    [selectedMenu, selectedSectionId],
  );

  useEffect(() => {
    if (menus.length === 0) {
      setSelectedMenuId(null);
      return;
    }
    const selectedStillExists = menus.some((menu) => menu.id === selectedMenuId);
    if (selectedStillExists) return;
    const preferredMenu =
      menus.find((menu) => menu.menuKind === preferredMenuKind) ??
      menus.find((menu) => menu.menuKind === 'mixed') ??
      menus[0];
    setSelectedMenuId(preferredMenu?.id ?? null);
  }, [menus, preferredMenuKind, selectedMenuId]);

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

  useEffect(() => {
    if (selectedMenu?.menuKind === 'food' || selectedMenu?.menuKind === 'drinks') {
      onPreferredMenuKindChange(selectedMenu.menuKind);
    }
  }, [onPreferredMenuKindChange, selectedMenu?.menuKind]);

  if (!restaurantId) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-6">
          <OpsEmptyState
            title="Select a restaurant"
            description="Choose an active restaurant before editing the canonical menu hierarchy."
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="gap-2 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">Menus</CardTitle>
              </div>
              <Button type="button" size="sm" onClick={() => setMenuDialogMode('create')}>
                <Plus data-icon="inline-start" aria-hidden />
                Menu
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 px-3 pb-4">
            {hierarchyQuery.isLoading ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Loading menus...
              </div>
            ) : null}
            {!hierarchyQuery.isLoading && menus.length === 0 ? (
              <OpsEmptyState
                title="No canonical menus"
                description="Create the first Google-compatible menu for this restaurant."
                action={
                  <Button type="button" onClick={() => setMenuDialogMode('create')}>
                    <Plus data-icon="inline-start" aria-hidden />
                    Create menu
                  </Button>
                }
              />
            ) : null}
            {menus.map((menu) => {
              const active = menu.id === selectedMenuId;
              const itemCount = menu.sections.reduce(
                (acc, section) => acc + section.items.length,
                0,
              );
              const Icon = menu.menuKind === 'drinks' ? Beer : UtensilsCrossed;
              return (
                <Button
                  key={menu.id}
                  type="button"
                  variant="ghost"
                  className={cn(
                    'h-auto min-h-16 justify-start gap-3 rounded-md border border-transparent px-3 py-3 text-left whitespace-normal',
                    active && 'border-primary/30 bg-primary/10 text-foreground',
                  )}
                  onClick={() => setSelectedMenuId(menu.id ?? null)}
                >
                  <Icon data-icon="inline-start" className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {primaryLabel(menu, 'Menu')}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="tabular-nums">{menu.sections.length} sections</span>
                      <span className="tabular-nums">{itemCount} items</span>
                    </span>
                  </span>
                </Button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="gap-4 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl leading-tight">
                    {selectedMenu ? primaryLabel(selectedMenu, 'Menu') : 'Menu hierarchy'}
                  </CardTitle>
                  {selectedMenu ? (
                    <Badge variant={selectedMenu.active ? 'secondary' : 'outline'}>
                      {selectedMenu.active ? 'Active' : 'Inactive'}
                    </Badge>
                  ) : null}
                </div>
              </div>
              {selectedMenu ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setMenuDialogMode('edit')}>
                    <Pencil data-icon="inline-start" aria-hidden />
                    Edit menu
                  </Button>
                  <Button type="button" onClick={() => setSectionDialogOpen(true)}>
                    <Plus data-icon="inline-start" aria-hidden />
                    Section
                  </Button>
                </div>
              ) : null}
            </div>
          </CardHeader>

          {selectedMenu ? (
            <CardContent className="flex flex-col gap-5 px-4 pb-5 sm:px-5">
              <StaleBoundary
                isStale={hierarchyQuery.isPlaceholderData && hierarchyQuery.isFetching}
                className="min-w-0"
              >
                <SectionAccordionTable
                  menu={selectedMenu}
                  selectedSectionId={selectedSectionId}
                  restaurantId={restaurantId}
                  onSelectSection={setSelectedSectionId}
                  onCreateItem={(section) => {
                    setSelectedSectionId(section.id ?? null);
                    setEditingItem(null);
                    setItemDialogOpen(true);
                  }}
                  onEditItem={(section, item) => {
                    setSelectedSectionId(section.id ?? null);
                    setEditingItem(item);
                    setItemDialogOpen(true);
                  }}
                  onCreateOption={(section, item) => {
                    setSelectedSectionId(section.id ?? null);
                    setOptionTarget({ item, option: null });
                  }}
                  onEditOption={(section, item, option) => {
                    setSelectedSectionId(section.id ?? null);
                    setOptionTarget({ item, option });
                  }}
                />
              </StaleBoundary>
            </CardContent>
          ) : null}
        </Card>
      </div>

      <MenuDialog
        restaurantId={restaurantId}
        mode={menuDialogMode}
        menu={menuDialogMode === 'edit' ? selectedMenu : null}
        onOpenChange={(open) => {
          if (!open) setMenuDialogMode(null);
        }}
      />
      <SectionDialog
        restaurantId={restaurantId}
        menu={selectedMenu}
        open={sectionDialogOpen}
        onOpenChange={setSectionDialogOpen}
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
    </div>
  );
}

function SectionAccordionTable({
  menu,
  selectedSectionId,
  restaurantId,
  onSelectSection,
  onCreateItem,
  onEditItem,
  onCreateOption,
  onEditOption,
}: {
  menu: CanonicalRestaurantMenu;
  selectedSectionId: string | null;
  restaurantId: string;
  onSelectSection: (sectionId: string | null) => void;
  onCreateItem: (section: CanonicalRestaurantMenuSection) => void;
  onEditItem: (section: CanonicalRestaurantMenuSection, item: CanonicalRestaurantMenuItem) => void;
  onCreateOption: (
    section: CanonicalRestaurantMenuSection,
    item: CanonicalRestaurantMenuItem,
  ) => void;
  onEditOption: (
    section: CanonicalRestaurantMenuSection,
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
  ) => void;
}) {
  const patchSection = useOpsPatchRestaurantMenuSection(restaurantId);
  const selectedSection =
    menu.sections.find((section) => section.id === selectedSectionId) ?? menu.sections[0] ?? null;

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
      onCreateItem={() => onCreateItem(section)}
      onEditItem={(item) => onEditItem(section, item)}
      onCreateOption={(item) => onCreateOption(section, item)}
      onEditOption={(item, option) => onEditOption(section, item, option)}
    />
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Sections</h3>
        <Badge variant="outline" className="tabular-nums">
          {menu.sections.length}
        </Badge>
      </div>
      {menu.sections.length > 0 ? (
        <div className="md:hidden">
          <Select
            value={selectedSection?.id ?? ''}
            onValueChange={(value) => onSelectSection(value || null)}
          >
            <SelectTrigger aria-label="Select section">
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent>
              {menu.sections.map((section) =>
                section.id ? (
                  <SelectItem key={section.id} value={section.id}>
                    {primaryLabel(section, 'Section')} · {section.items.length} items
                  </SelectItem>
                ) : null,
              )}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {menu.sections.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Add a section before creating items.
        </div>
      ) : null}
      {selectedSection ? <div className="md:hidden">{renderItemTable(selectedSection)}</div> : null}
      {menu.sections.length > 0 ? (
        <Accordion
          type="single"
          collapsible
          value={selectedSectionId ?? ''}
          onValueChange={(value) => onSelectSection(value || null)}
          className="flex flex-col gap-2"
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
                  'rounded-md border bg-background px-2 transition-colors',
                  selected && 'border-primary/40 bg-primary/10',
                )}
              >
                <div className="flex items-center gap-2">
                  <AccordionTrigger className="min-w-0 flex-1 px-1 py-3 hover:no-underline">
                    <span className="min-w-0 text-left">
                      <span className="block truncate text-sm font-medium">
                        {primaryLabel(section, 'Section')}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="tabular-nums">{section.items.length} items</span>
                        {section.active ? null : (
                          <Badge variant="outline" className="text-[10px]">
                            Inactive
                          </Badge>
                        )}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <div
                    className="flex shrink-0 gap-0.5"
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
                  </div>
                </div>
                <AccordionContent className="hidden pb-3 md:block">
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
  onCreateItem,
  onEditItem,
  onCreateOption,
  onEditOption,
}: {
  restaurantId: string;
  menu: CanonicalRestaurantMenu;
  section: CanonicalRestaurantMenuSection;
  onCreateItem: () => void;
  onEditItem: (item: CanonicalRestaurantMenuItem) => void;
  onCreateOption: (item: CanonicalRestaurantMenuItem) => void;
  onEditOption: (item: CanonicalRestaurantMenuItem, option: CanonicalRestaurantMenuOption) => void;
}) {
  const patchOption = useOpsPatchRestaurantMenuOption(restaurantId);
  const deleteOption = useOpsDeleteRestaurantMenuOption(restaurantId);

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
    await deleteOption.mutateAsync({
      menuId: menu.id,
      sectionId: section.id,
      itemId: item.id,
      optionId: option.id,
    });
  };

  const renderOptions = (item: CanonicalRestaurantMenuItem) =>
    item.options.length === 0 ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-10 w-full justify-center md:w-fit"
        onClick={() => onCreateOption(item)}
      >
        <Plus data-icon="inline-start" aria-hidden />
        Add option
      </Button>
    ) : (
      <div className="flex flex-col gap-1.5">
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
            deletePending={deleteOption.isPending}
          />
        ))}
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
      </div>
    );

  return (
    <div className="min-w-0 rounded-md border">
      <div className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-background/95 p-3 backdrop-blur md:flex-row md:items-center md:justify-between md:p-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <h3 className="truncate text-sm font-semibold">{primaryLabel(section, 'Section')}</h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {section.items.length} {section.items.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <Button type="button" className="min-h-10 w-full md:w-auto" onClick={onCreateItem}>
          <Plus data-icon="inline-start" aria-hidden />
          Add item
        </Button>
      </div>
      {section.items.length === 0 ? (
        <div className="p-6">
          <OpsEmptyState
            title="No items in this section"
            description="Create the first canonical item for this menu section."
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
          {/* Mobile-first card list */}
          <ul data-testid="mobile-item-list" className="flex flex-col divide-y md:hidden">
            {section.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-3 p-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {primaryLabel(item, 'Menu item')}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="tabular-nums">{moneyLabel(item.attributes)}</span>
                      <ItemStatusDot item={item} />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-10 shrink-0"
                    onClick={() => onEditItem(item)}
                    aria-label={`Edit item ${primaryLabel(item, 'Menu item')}`}
                  >
                    <Pencil data-icon="inline-start" aria-hidden />
                    Edit item
                  </Button>
                </div>
                {item.attributes.allergen && item.attributes.allergen.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {item.attributes.allergen.slice(0, 3).map((allergen) => (
                      <Badge key={allergen} variant="secondary" className="text-[10px]">
                        {formatEnumLabel(allergen)}
                      </Badge>
                    ))}
                    {item.attributes.allergen.length > 3 ? (
                      <Badge variant="outline" className="text-[10px]">
                        +{item.attributes.allergen.length - 3}
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
                <div className="rounded-md border bg-muted/30 p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Options ({item.options.length})
                    </span>
                  </div>
                  {renderOptions(item)}
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Google fields</TableHead>
                  <TableHead>Options</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="min-w-0">
                        <div className="font-medium">{primaryLabel(item, 'Menu item')}</div>
                        <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                          {moneyLabel(item.attributes)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-sm flex-wrap gap-1">
                        {item.attributes.spiciness ? (
                          <Badge variant="outline">
                            {formatEnumLabel(item.attributes.spiciness)}
                          </Badge>
                        ) : null}
                        {item.attributes.allergen?.slice(0, 2).map((allergen) => (
                          <Badge key={allergen} variant="secondary">
                            {formatEnumLabel(allergen)}
                          </Badge>
                        ))}
                        {item.media.googleMediaKeys.length > 0 ? (
                          <Badge variant="outline">GBP media</Badge>
                        ) : null}
                        {item.media.localImageUrl ? (
                          <Badge variant="outline">Local image</Badge>
                        ) : null}
                        {menu.menuKind === 'drinks' ? (
                          <Badge variant="outline">Drink profile</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-48 max-w-72 flex-col gap-1.5">
                        {renderOptions(item)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ItemStatusDot item={item} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onEditItem(item)}
                      >
                        <Pencil data-icon="inline-start" aria-hidden />
                        Edit item
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}
    </div>
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
  deletePending,
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
  deletePending: boolean;
}) {
  const price = moneyLabel(option.attributes);
  return (
    <div className="flex items-stretch gap-1 rounded-md border bg-background">
      <Button
        type="button"
        variant="ghost"
        className="min-h-10 min-w-0 flex-1 justify-start gap-2 px-2 text-left"
        onClick={() => onEditOption(item, option)}
        aria-label={`Edit option ${primaryLabel(option, 'Option')}`}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {primaryLabel(option, 'Option')}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{price}</span>
        {!option.active ? (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            Inactive
          </Badge>
        ) : null}
      </Button>
      <div className="flex shrink-0 items-center border-l">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-none"
          aria-label="Move option up"
          disabled={optionIndex === 0 || patchPending}
          onClick={() => void onMoveOption(item, option, optionIndex, -1)}
        >
          <ArrowUp className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-none"
          aria-label="Move option down"
          disabled={optionIndex === optionsCount - 1 || patchPending}
          onClick={() => void onMoveOption(item, option, optionIndex, 1)}
        >
          <ArrowDown className="size-4" aria-hidden />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 rounded-none"
              aria-label={`Open option actions for ${primaryLabel(option, 'Option')}`}
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                disabled={deletePending}
                onSelect={() => void onRemoveOption(item, option)}
              >
                <Trash2 aria-hidden />
                Delete option
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function MenuDialog({
  restaurantId,
  mode,
  menu,
  onOpenChange,
}: {
  restaurantId: string;
  mode: 'create' | 'edit' | null;
  menu: CanonicalRestaurantMenu | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<MenuFormState>(() => menuInitialState(menu));
  const createMenu = useOpsCreateRestaurantMenu(restaurantId);
  const updateMenu = useOpsUpdateRestaurantMenu({ restaurantId, menuId: menu?.id });

  useEffect(() => {
    if (mode) setState(menuInitialState(menu));
  }, [menu, mode]);

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
            Menu-level Google FoodMenus fields live here before sections and items.
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
  open,
  onOpenChange,
}: {
  restaurantId: string;
  menu: CanonicalRestaurantMenu | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<SectionFormState>(() => sectionInitialState());
  const createSection = useOpsCreateRestaurantMenuSection({ restaurantId, menuId: menu?.id });

  useEffect(() => {
    if (open) setState(sectionInitialState());
  }, [open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!menu) return;
    await createSection.mutateAsync(buildSectionPayload(state, menu.sections.length));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create section</DialogTitle>
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
          {createSection.error ? (
            <p className="text-sm text-destructive">{createSection.error.message}</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createSection.isPending || !menu}>
              {createSection.isPending ? 'Saving...' : 'Create section'}
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
            Google FoodMenus fields are grouped above Nabatable-only operations metadata.
          </DialogDescription>
        </DialogHeader>
        <FormRoot className="flex flex-col gap-5" onSubmit={submit}>
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2">
              <Globe2 className="size-4 text-muted-foreground" aria-hidden />
              <h3 className="text-sm font-semibold">Google core</h3>
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
                Google nutrition facts
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Google FoodMenus publishes calories, total fat, cholesterol, sodium, total
                carbohydrate, and protein. Sugar, fibre, and saturated fat remain import-tolerated.
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Calories">
                  <Input
                    type="number"
                    min="0"
                    value={state.calories}
                    onChange={(event) =>
                      setState((current) => ({ ...current, calories: event.target.value }))
                    }
                    placeholder="CALORIE"
                  />
                </Field>
                <Field label="Total fat">
                  <Input
                    type="number"
                    min="0"
                    value={state.totalFat}
                    onChange={(event) =>
                      setState((current) => ({ ...current, totalFat: event.target.value }))
                    }
                    placeholder="GRAM"
                  />
                </Field>
                <Field label="Cholesterol">
                  <Input
                    type="number"
                    min="0"
                    value={state.cholesterol}
                    onChange={(event) =>
                      setState((current) => ({ ...current, cholesterol: event.target.value }))
                    }
                    placeholder="MILLIGRAM"
                  />
                </Field>
                <Field label="Sodium">
                  <Input
                    type="number"
                    min="0"
                    value={state.sodium}
                    onChange={(event) =>
                      setState((current) => ({ ...current, sodium: event.target.value }))
                    }
                    placeholder="MILLIGRAM"
                  />
                </Field>
                <Field label="Total carbohydrate">
                  <Input
                    type="number"
                    min="0"
                    value={state.totalCarbohydrate}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        totalCarbohydrate: event.target.value,
                      }))
                    }
                    placeholder="GRAM"
                  />
                </Field>
                <Field label="Protein">
                  <Input
                    type="number"
                    min="0"
                    value={state.protein}
                    onChange={(event) =>
                      setState((current) => ({ ...current, protein: event.target.value }))
                    }
                    placeholder="GRAM"
                  />
                </Field>
              </div>
            </div>
          </div>

          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
              <h3 className="text-sm font-semibold">GBP media-key manager</h3>
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
              <h3 className="text-sm font-semibold">Nabatable operations</h3>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Availability policy note">
                <Textarea
                  value={state.availabilityNote}
                  onChange={(event) =>
                    setState((current) => ({ ...current, availabilityNote: event.target.value }))
                  }
                />
              </Field>
              <Field label="Customization control note">
                <Textarea
                  value={state.customizationNote}
                  onChange={(event) =>
                    setState((current) => ({ ...current, customizationNote: event.target.value }))
                  }
                />
              </Field>
              {menu?.menuKind === 'drinks' ? (
                <Field label="Drink profile note">
                  <Textarea
                    value={state.drinkProfileNote}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        drinkProfileNote: event.target.value,
                      }))
                    }
                  />
                </Field>
              ) : null}
            </div>
            <Separator className="my-4" />
            <SwitchField
              label="Item active"
              checked={state.active}
              onCheckedChange={(checked) =>
                setState((current) => ({ ...current, active: checked }))
              }
            />
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
            Google options are required variant choices for FoodMenus and remain separate from
            Nabatable modifier groups.
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
          <Field label="Description">
            <Textarea
              value={state.description}
              onChange={(event) =>
                setState((current) => ({ ...current, description: event.target.value }))
              }
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

function MultiCheckboxGroup({
  label,
  options,
  values,
  onChange,
  className,
}: {
  label: string;
  options: string[];
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
