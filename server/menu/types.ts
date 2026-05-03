import { z } from 'zod';

export const MENU_AVAILABILITY_STATUSES = ['available', 'unavailable'] as const;
export type MenuAvailabilityStatus = (typeof MENU_AVAILABILITY_STATUSES)[number];

export const MENU_LIST_STATUS_FILTERS = [
  'all',
  'active',
  'inactive',
  'sold-out',
  'available',
  'unavailable',
] as const;
export type MenuListStatusFilter = (typeof MENU_LIST_STATUS_FILTERS)[number];

const requiredText = z.string().trim().min(1);

const optionalNullableText = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
});

const stringArray = z.array(z.string().trim().min(1)).default([]);

const optionalNullableNumber = z
  .union([z.number().finite().min(0), z.null(), z.undefined()])
  .transform((value) => value ?? null);

export const MenuModifierOptionInputSchema = z.object({
  externalModifierOptionId: requiredText,
  optionName: requiredText,
  priceDelta: z.number().finite(),
  defaultSelected: z.boolean().default(false),
  availabilityStatus: z.enum(MENU_AVAILABILITY_STATUSES).default('available'),
  displayOrder: z.number().int().default(0),
});

export const MenuModifierGroupInputSchema = z
  .object({
    externalModifierGroupId: requiredText,
    groupName: requiredText,
    required: z.boolean().default(false),
    minSelect: z.number().int().min(0).default(0),
    maxSelect: z.number().int().min(0).default(1),
    displayOrder: z.number().int().default(0),
    options: z.array(MenuModifierOptionInputSchema).default([]),
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

export const MenuItemUpsertInputSchema = z.object({
  externalItemId: requiredText,
  itemName: requiredText,
  category: requiredText,
  subcategory: optionalNullableText,
  shortDescription: optionalNullableText,
  fullDescription: optionalNullableText,
  basePrice: z.number().finite().nonnegative(),
  currency: z
    .string()
    .trim()
    .min(1)
    .max(8)
    .transform((value) => value.toUpperCase())
    .default('GBP'),
  serviceTime: optionalNullableText,
  availabilityStatus: z.enum(MENU_AVAILABILITY_STATUSES).default('available'),
  keyIngredients: stringArray,
  mainProteinOrBase: optionalNullableText,
  cookingStyle: optionalNullableText,
  preparationMethod: optionalNullableText,
  flavorProfile: optionalNullableText,
  texture: optionalNullableText,
  spiceLevel: optionalNullableText,
  spiceAdjustable: z.boolean().default(false),
  portionSize: optionalNullableText,
  shareable: z.boolean().default(false),
  recommendationTags: stringArray,
  pairings: stringArray,
  signatureScore: z.number().int().min(0).max(100).nullable().default(null),
  popularityScore: z.number().int().min(0).max(100).nullable().default(null),
  dietaryTags: stringArray,
  allergensContains: stringArray,
  allergensMayContain: stringArray,
  removableIngredients: stringArray,
  substitutionsAllowed: z.boolean().default(false),
  canBeMadeVegetarian: z.boolean().default(false),
  canBeMadeVegan: z.boolean().default(false),
  canBeMadeGlutenFree: z.boolean().default(false),
  customizationRules: optionalNullableText,
  servingNotes: optionalNullableText,
  active: z.boolean().default(true),
  seasonal: z.boolean().default(false),
  limitedTime: z.boolean().default(false),
  soldOut: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
  imageUrl: z
    .string()
    .trim()
    .url()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  caloriesKcal: z.number().int().min(0).nullable().default(null),
  proteinG: optionalNullableNumber,
  fatG: optionalNullableNumber,
  saturatedFatG: optionalNullableNumber,
  carbsG: optionalNullableNumber,
  sugarG: optionalNullableNumber,
  fiberG: optionalNullableNumber,
  sodiumMg: optionalNullableNumber,
  servesNum: z.number().int().min(0).nullable().default(null),
  modifierGroups: z.array(MenuModifierGroupInputSchema).default([]),
});

export type MenuModifierOptionInput = z.infer<typeof MenuModifierOptionInputSchema>;
export type MenuModifierGroupInput = z.infer<typeof MenuModifierGroupInputSchema>;
export type MenuItemUpsertInput = z.infer<typeof MenuItemUpsertInputSchema>;

export type MenuModifierOption = MenuModifierOptionInput & {
  id: string;
  restaurantId: string;
  modifierGroupId: string;
  createdAt: string;
  updatedAt: string;
};

export type MenuModifierGroup = Omit<MenuModifierGroupInput, 'options'> & {
  id: string;
  restaurantId: string;
  menuItemId: string;
  createdAt: string;
  updatedAt: string;
  options: MenuModifierOption[];
};

export type MenuItemSummary = {
  id: string;
  restaurantId: string;
  externalItemId: string;
  itemName: string;
  category: string;
  subcategory: string | null;
  basePrice: number;
  currency: string;
  serviceTime: string | null;
  availabilityStatus: MenuAvailabilityStatus;
  active: boolean;
  soldOut: boolean;
  displayOrder: number;
  imageUrl: string | null;
  modifierGroupCount: number;
  updatedAt: string;
};

export type MenuItemDetail = Omit<MenuItemUpsertInput, 'modifierGroups'> & {
  id: string;
  restaurantId: string;
  createdAt: string;
  updatedAt: string;
  modifierGroups: MenuModifierGroup[];
};

export type MenuFacetSet = {
  categories: string[];
  subcategories: string[];
  serviceTimes: string[];
};

export type MenuListResponse = {
  items: MenuItemSummary[];
  facets: MenuFacetSet;
};

export type MenuImportError = {
  file: 'items' | 'modifier_groups' | 'modifier_options';
  row: number;
  column: string | null;
  message: string;
};

export type MenuImportSummary = {
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

export type MenuImportPreview = {
  applied: false;
  canApply: boolean;
  summary: MenuImportSummary;
  errors: MenuImportError[];
};

export type MenuImportApplyResult = {
  applied: true;
  canApply: true;
  summary: MenuImportSummary;
  errors: MenuImportError[];
};

export type MenuImportResult = MenuImportPreview | MenuImportApplyResult;

export type MenuListFilters = {
  search?: string | null;
  category?: string | null;
  subcategory?: string | null;
  status?: MenuListStatusFilter;
};

export const MenuListFiltersSchema = z.object({
  search: optionalNullableText.optional(),
  category: optionalNullableText.optional(),
  subcategory: optionalNullableText.optional(),
  status: z.enum(MENU_LIST_STATUS_FILTERS).default('all'),
});
