import { z } from 'zod';

import { GOOGLE_FOOD_MENU_CUISINES } from '@/lib/google-food-menu-cuisines';

import type { GoogleFoodMenuCuisine } from '@/lib/google-food-menu-cuisines';

export const DEFAULT_MENU_LANGUAGE_CODE = 'en-GB';

export const MENU_KINDS = ['food', 'drinks', 'mixed'] as const;
export const MENU_ITEM_KINDS = ['food', 'drink'] as const;
export const GOOGLE_FOOD_MENU_SPICINESS = ['MILD', 'MEDIUM', 'HOT'] as const;
export const GOOGLE_FOOD_MENU_ALLERGENS = [
  'DAIRY',
  'EGG',
  'FISH',
  'PEANUT',
  'SHELLFISH',
  'SOY',
  'TREE_NUT',
  'WHEAT',
] as const;
export const GOOGLE_FOOD_MENU_DIETARY_RESTRICTIONS = [
  'HALAL',
  'KOSHER',
  'ORGANIC',
  'VEGAN',
  'VEGETARIAN',
] as const;
export const GOOGLE_FOOD_MENU_PREPARATION_METHODS = [
  'BAKED',
  'BARBECUED',
  'BASTED',
  'BLANCHED',
  'BOILED',
  'BRAISED',
  'CODDLED',
  'FERMENTED',
  'FRIED',
  'GRILLED',
  'KNEADED',
  'MARINATED',
  'PAN_FRIED',
  'PICKLED',
  'PRESSURE_COOKED',
  'ROASTED',
  'SAUTEED',
  'SEARED',
  'SIMMERED',
  'SMOKED',
  'STEAMED',
  'STEEPED',
  'STIR_FRIED',
  'OTHER_METHOD',
] as const;
const requiredText = z.string().trim().min(1);
const optionalNullableText = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
});

const jsonObject = z.record(z.string(), z.unknown());

const DEFAULT_MENU_ITEM_ATTRIBUTES = {
  allergen: [],
  dietaryRestriction: [],
  ingredients: [],
  preparationMethods: [],
  mediaKeys: [],
  nutritionFacts: {},
};

const DEFAULT_MENU_MEDIA = {
  googleMediaKeys: [],
  localMedia: {},
};

const DEFAULT_MENU_ITEM_EXTENSIONS = {
  drinkProfile: {},
  recommendationMetadata: {},
  availabilityPolicy: {},
  customizationControls: {},
  sourceMetadata: {},
};

function looksLikeLocalMediaUrl(value: string): boolean {
  return /^(https?:|data:|blob:|\/)/i.test(value.trim());
}

export const CanonicalMenuLabelSchema = z.object({
  displayName: requiredText,
  description: optionalNullableText.optional(),
  languageCode: requiredText.default(DEFAULT_MENU_LANGUAGE_CODE),
});

export const GoogleMediaKeySchema = requiredText.refine(
  (value) => !looksLikeLocalMediaUrl(value),
  'Google media keys must not be local image URLs',
);

export const CanonicalMenuMediaSchema = z.object({
  googleMediaKeys: z.array(GoogleMediaKeySchema).default([]),
  localImageUrl: optionalNullableText.optional(),
  localMedia: jsonObject.default({}),
});

export const GoogleMoneyAmountSchema = z.object({
  currencyCode: requiredText.transform((value) => value.toUpperCase()),
  amount: z.number().finite().nonnegative().nullable().default(null),
});

export const GoogleNutritionAmountSchema = z.object({
  unit: optionalNullableText.optional(),
  quantity: z.number().finite().nonnegative().nullable().optional(),
  lowerAmount: z.number().finite().nonnegative().nullable().optional(),
  upperAmount: z.number().finite().nonnegative().nullable().optional(),
});

export const GoogleNutritionFactsSchema = z
  .object({
    calories: GoogleNutritionAmountSchema.optional(),
    totalFat: GoogleNutritionAmountSchema.optional(),
    saturatedFat: GoogleNutritionAmountSchema.optional(),
    cholesterol: GoogleNutritionAmountSchema.optional(),
    sodium: GoogleNutritionAmountSchema.optional(),
    totalCarbohydrate: GoogleNutritionAmountSchema.optional(),
    sugars: GoogleNutritionAmountSchema.optional(),
    dietaryFiber: GoogleNutritionAmountSchema.optional(),
    protein: GoogleNutritionAmountSchema.optional(),
  })
  .default({});

export const CanonicalMenuItemAttributesSchema = z.object({
  price: GoogleMoneyAmountSchema.optional(),
  spiciness: z.enum(GOOGLE_FOOD_MENU_SPICINESS).nullable().optional(),
  allergen: z.array(z.enum(GOOGLE_FOOD_MENU_ALLERGENS)).default([]),
  dietaryRestriction: z.array(z.enum(GOOGLE_FOOD_MENU_DIETARY_RESTRICTIONS)).default([]),
  ingredients: z.array(z.object({ labels: z.array(CanonicalMenuLabelSchema) })).default([]),
  preparationMethods: z.array(z.enum(GOOGLE_FOOD_MENU_PREPARATION_METHODS)).default([]),
  portionSize: z
    .object({
      quantity: z.number().finite().positive().default(1),
      unit: z.array(CanonicalMenuLabelSchema).default([]),
    })
    .optional(),
  mediaKeys: z.array(GoogleMediaKeySchema).default([]),
  nutritionFacts: GoogleNutritionFactsSchema,
  servesNumPeople: z.number().int().nonnegative().nullable().optional(),
  servesNum: z.number().int().nonnegative().nullable().optional(),
});

export const NabatableMenuItemExtensionsSchema = z.object({
  drinkProfile: jsonObject.default({}),
  recommendationMetadata: jsonObject.default({}),
  availabilityPolicy: jsonObject.default({}),
  customizationControls: jsonObject.default({}),
  sourceMetadata: jsonObject.default({}),
});

export const CanonicalRestaurantMenuOptionSchema = z.object({
  id: requiredText.optional(),
  restaurantId: requiredText,
  menuItemId: requiredText.optional(),
  externalOptionId: optionalNullableText.optional(),
  labels: z.array(CanonicalMenuLabelSchema).default([]),
  attributes: CanonicalMenuItemAttributesSchema.default(DEFAULT_MENU_ITEM_ATTRIBUTES),
  media: CanonicalMenuMediaSchema.default(DEFAULT_MENU_MEDIA),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
  legacySource: jsonObject.default({}),
});

export const CanonicalRestaurantMenuItemSchema = z.object({
  id: requiredText.optional(),
  restaurantId: requiredText,
  menuId: requiredText.nullable().optional(),
  sectionId: requiredText.nullable().optional(),
  itemKind: z.enum(MENU_ITEM_KINDS),
  externalItemId: requiredText,
  legacySource: jsonObject.default({}),
  labels: z.array(CanonicalMenuLabelSchema).default([]),
  attributes: CanonicalMenuItemAttributesSchema.default(DEFAULT_MENU_ITEM_ATTRIBUTES),
  media: CanonicalMenuMediaSchema.default(DEFAULT_MENU_MEDIA),
  extensions: NabatableMenuItemExtensionsSchema.default(DEFAULT_MENU_ITEM_EXTENSIONS),
  options: z.array(CanonicalRestaurantMenuOptionSchema).default([]),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const CanonicalRestaurantMenuSectionSchema = z.object({
  id: requiredText.optional(),
  restaurantId: requiredText,
  menuId: requiredText.optional(),
  labels: z.array(CanonicalMenuLabelSchema).default([]),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
  legacyCategory: optionalNullableText.optional(),
  legacySubcategory: optionalNullableText.optional(),
  legacySource: jsonObject.default({}),
  items: z.array(CanonicalRestaurantMenuItemSchema).default([]),
});

export const CanonicalRestaurantMenuSchema = z.object({
  id: requiredText.optional(),
  restaurantId: requiredText,
  labels: z.array(CanonicalMenuLabelSchema).default([]),
  sourceUrl: optionalNullableText.optional(),
  cuisines: z.array(z.enum(GOOGLE_FOOD_MENU_CUISINES)).default([]),
  defaultLanguageCode: requiredText.default(DEFAULT_MENU_LANGUAGE_CODE),
  menuKind: z.enum(MENU_KINDS),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
  legacySource: jsonObject.default({}),
  sections: z.array(CanonicalRestaurantMenuSectionSchema).default([]),
});

export const RestaurantMenuInputSchema = z.object({
  labels: z.array(CanonicalMenuLabelSchema).default([]),
  sourceUrl: optionalNullableText.optional(),
  cuisines: z.array(z.enum(GOOGLE_FOOD_MENU_CUISINES)).default([]),
  defaultLanguageCode: requiredText.default(DEFAULT_MENU_LANGUAGE_CODE),
  menuKind: z.enum(MENU_KINDS).default('food'),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
  legacySource: jsonObject.default({}),
});

export const RestaurantMenuPatchSchema = RestaurantMenuInputSchema.partial();

export const RestaurantMenuSectionInputSchema = z.object({
  labels: z.array(CanonicalMenuLabelSchema).default([]),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
  legacyCategory: optionalNullableText.optional(),
  legacySubcategory: optionalNullableText.optional(),
  legacySource: jsonObject.default({}),
});

export const RestaurantMenuSectionPatchSchema = RestaurantMenuSectionInputSchema.partial();

export const RestaurantMenuItemInputSchema = z.object({
  itemKind: z.enum(MENU_ITEM_KINDS),
  externalItemId: requiredText,
  labels: z.array(CanonicalMenuLabelSchema).default([]),
  attributes: CanonicalMenuItemAttributesSchema.default(DEFAULT_MENU_ITEM_ATTRIBUTES),
  media: CanonicalMenuMediaSchema.default(DEFAULT_MENU_MEDIA),
  extensions: NabatableMenuItemExtensionsSchema.default(DEFAULT_MENU_ITEM_EXTENSIONS),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
  legacySource: jsonObject.default({}),
});

export const RestaurantMenuItemPatchSchema = RestaurantMenuItemInputSchema.partial();

export const RestaurantMenuOptionInputSchema = z.object({
  externalOptionId: optionalNullableText.optional(),
  labels: z.array(CanonicalMenuLabelSchema).default([]),
  attributes: CanonicalMenuItemAttributesSchema.default(DEFAULT_MENU_ITEM_ATTRIBUTES),
  media: CanonicalMenuMediaSchema.default(DEFAULT_MENU_MEDIA),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
  legacySource: jsonObject.default({}),
});

export const RestaurantMenuOptionPatchSchema = RestaurantMenuOptionInputSchema.partial();

export function buildCanonicalMenuLabel(input: {
  readonly displayName: string;
  readonly description?: string | null;
  readonly languageCode?: string | null;
}) {
  return CanonicalMenuLabelSchema.parse({
    displayName: input.displayName,
    description: input.description,
    languageCode: input.languageCode ?? DEFAULT_MENU_LANGUAGE_CODE,
  });
}

export function parseCanonicalMenuMedia(input: unknown) {
  return CanonicalMenuMediaSchema.parse(input);
}

export type MenuKind = (typeof MENU_KINDS)[number];
export type MenuItemKind = (typeof MENU_ITEM_KINDS)[number];
export { GOOGLE_FOOD_MENU_CUISINES };
export type { GoogleFoodMenuCuisine };
export type CanonicalMenuLabel = z.infer<typeof CanonicalMenuLabelSchema>;
export type CanonicalMenuMedia = z.infer<typeof CanonicalMenuMediaSchema>;
export type CanonicalMenuItemAttributes = z.infer<typeof CanonicalMenuItemAttributesSchema>;
export type NabatableMenuItemExtensions = z.infer<typeof NabatableMenuItemExtensionsSchema>;
export type CanonicalRestaurantMenuOption = z.infer<typeof CanonicalRestaurantMenuOptionSchema>;
export type CanonicalRestaurantMenuItem = z.infer<typeof CanonicalRestaurantMenuItemSchema>;
export type CanonicalRestaurantMenuSection = z.infer<typeof CanonicalRestaurantMenuSectionSchema>;
export type CanonicalRestaurantMenu = z.infer<typeof CanonicalRestaurantMenuSchema>;
export type RestaurantMenuInput = z.infer<typeof RestaurantMenuInputSchema>;
export type RestaurantMenuPatch = z.infer<typeof RestaurantMenuPatchSchema>;
export type RestaurantMenuSectionInput = z.infer<typeof RestaurantMenuSectionInputSchema>;
export type RestaurantMenuSectionPatch = z.infer<typeof RestaurantMenuSectionPatchSchema>;
export type RestaurantMenuItemInput = z.infer<typeof RestaurantMenuItemInputSchema>;
export type RestaurantMenuItemPatch = z.infer<typeof RestaurantMenuItemPatchSchema>;
export type RestaurantMenuOptionInput = z.infer<typeof RestaurantMenuOptionInputSchema>;
export type RestaurantMenuOptionPatch = z.infer<typeof RestaurantMenuOptionPatchSchema>;
