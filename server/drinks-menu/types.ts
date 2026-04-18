import { z } from 'zod';

export const DRINK_AVAILABILITY_STATUSES = ['available', 'unavailable'] as const;
export type DrinkAvailabilityStatus = (typeof DRINK_AVAILABILITY_STATUSES)[number];

export const DRINK_LIST_STATUS_FILTERS = [
  'all',
  'active',
  'inactive',
  'sold-out',
  'available',
  'unavailable',
] as const;
export type DrinkListStatusFilter = (typeof DRINK_LIST_STATUS_FILTERS)[number];

const requiredText = z.string().trim().min(1);

const optionalNullableText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const stringArray = z.array(z.string().trim().min(1)).default([]);

export const DrinkModifierOptionInputSchema = z.object({
  externalModifierOptionId: requiredText,
  optionName: requiredText,
  priceDelta: z.number().finite(),
  defaultSelected: z.boolean().default(false),
  availabilityStatus: z.enum(DRINK_AVAILABILITY_STATUSES).default('available'),
  displayOrder: z.number().int().default(0),
});

export const DrinkModifierGroupInputSchema = z
  .object({
    externalModifierGroupId: requiredText,
    groupName: requiredText,
    required: z.boolean().default(false),
    minSelect: z.number().int().min(0).default(0),
    maxSelect: z.number().int().min(0).default(1),
    displayOrder: z.number().int().default(0),
    options: z.array(DrinkModifierOptionInputSchema).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.minSelect > value.maxSelect) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minSelect'],
        message: 'minSelect cannot be greater than maxSelect',
      });
    }
    if (value.required && value.minSelect < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minSelect'],
        message: 'Required groups must have minSelect >= 1',
      });
    }
  });

export const DrinkItemUpsertInputSchema = z.object({
  externalDrinkId: requiredText,
  drinkName: requiredText,
  category: requiredText,
  subcategory: optionalNullableText,
  shortDescription: optionalNullableText,
  fullDescription: optionalNullableText,
  basePrice: z.number().finite().nonnegative(),
  currency: z.string().trim().min(1).max(8).transform((value) => value.toUpperCase()).default('GBP'),
  serviceTime: optionalNullableText,
  availabilityStatus: z.enum(DRINK_AVAILABILITY_STATUSES).default('available'),
  drinkType: optionalNullableText,
  alcoholic: z.boolean().default(false),
  abv: z.number().min(0).max(100).nullable().default(null),
  volumeMl: z.number().int().min(0).nullable().default(null),
  servingSize: optionalNullableText,
  servedStyle: optionalNullableText,
  temperature: optionalNullableText,
  baseSpirit: optionalNullableText,
  beerStyle: optionalNullableText,
  wineType: optionalNullableText,
  grapeVarietal: optionalNullableText,
  region: optionalNullableText,
  country: optionalNullableText,
  roastLevel: optionalNullableText,
  caffeineLevel: optionalNullableText,
  sweetnessLevel: optionalNullableText,
  bitternessLevel: optionalNullableText,
  acidityLevel: optionalNullableText,
  bodyLevel: optionalNullableText,
  flavorProfile: optionalNullableText,
  keyIngredients: stringArray,
  garnish: optionalNullableText,
  containsDairy: z.boolean().default(false),
  containsNuts: z.boolean().default(false),
  containsGluten: z.boolean().default(false),
  containsCaffeine: z.boolean().default(false),
  dietaryTags: stringArray,
  allergensContains: stringArray,
  allergensMayContain: stringArray,
  canBeMadeNonAlcoholic: z.boolean().default(false),
  canBeMadeDecaf: z.boolean().default(false),
  customizationRules: optionalNullableText,
  pairings: stringArray,
  signatureScore: z.number().int().min(0).max(100).nullable().default(null),
  popularityScore: z.number().int().min(0).max(100).nullable().default(null),
  recommendationTags: stringArray,
  seasonal: z.boolean().default(false),
  limitedTime: z.boolean().default(false),
  soldOut: z.boolean().default(false),
  active: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
  imageUrl: z.string().trim().url().nullable().optional().transform((value) => value ?? null),
  modifierGroups: z.array(DrinkModifierGroupInputSchema).default([]),
});

export type DrinkModifierOptionInput = z.infer<typeof DrinkModifierOptionInputSchema>;
export type DrinkModifierGroupInput = z.infer<typeof DrinkModifierGroupInputSchema>;
export type DrinkItemUpsertInput = z.infer<typeof DrinkItemUpsertInputSchema>;

export type DrinkModifierOption = DrinkModifierOptionInput & {
  id: string;
  restaurantId: string;
  modifierGroupId: string;
  createdAt: string;
  updatedAt: string;
};

export type DrinkModifierGroup = Omit<DrinkModifierGroupInput, 'options'> & {
  id: string;
  restaurantId: string;
  drinkItemId: string;
  createdAt: string;
  updatedAt: string;
  options: DrinkModifierOption[];
};

export type DrinkItemSummary = {
  id: string;
  restaurantId: string;
  externalDrinkId: string;
  drinkName: string;
  category: string;
  subcategory: string | null;
  basePrice: number;
  currency: string;
  serviceTime: string | null;
  availabilityStatus: DrinkAvailabilityStatus;
  drinkType: string | null;
  alcoholic: boolean;
  active: boolean;
  soldOut: boolean;
  displayOrder: number;
  imageUrl: string | null;
  modifierGroupCount: number;
  updatedAt: string;
};

export type DrinkItemDetail = Omit<DrinkItemUpsertInput, 'modifierGroups'> & {
  id: string;
  restaurantId: string;
  createdAt: string;
  updatedAt: string;
  modifierGroups: DrinkModifierGroup[];
};

export type DrinkFacetSet = {
  categories: string[];
  subcategories: string[];
  serviceTimes: string[];
  drinkTypes: string[];
};

export type DrinkListResponse = {
  items: DrinkItemSummary[];
  facets: DrinkFacetSet;
};

export type DrinkImportError = {
  file: 'items' | 'modifier_groups' | 'modifier_options';
  row: number;
  column: string | null;
  message: string;
};

export type DrinkImportSummary = {
  itemRows: number;
  modifierGroupRows: number;
  modifierOptionRows: number;
  itemsToCreate: number;
  itemsToUpdate: number;
  modifierGroupsToCreate: number;
  modifierGroupsToUpdate: number;
  modifierOptionsToCreate: number;
  modifierOptionsToUpdate: number;
  impactedItemCount: number;
  replaceModifiers: boolean;
};

export type DrinkImportPreview = {
  applied: false;
  canApply: boolean;
  summary: DrinkImportSummary;
  errors: DrinkImportError[];
};

export type DrinkImportApplyResult = {
  applied: true;
  canApply: true;
  summary: DrinkImportSummary;
  errors: DrinkImportError[];
};

export type DrinkImportResult = DrinkImportPreview | DrinkImportApplyResult;

export type DrinkListFilters = {
  search?: string | null;
  category?: string | null;
  subcategory?: string | null;
  status?: DrinkListStatusFilter;
};

export const DrinkListFiltersSchema = z.object({
  search: optionalNullableText.optional(),
  category: optionalNullableText.optional(),
  subcategory: optionalNullableText.optional(),
  status: z.enum(DRINK_LIST_STATUS_FILTERS).default('all'),
});
