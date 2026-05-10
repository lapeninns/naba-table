import { z } from 'zod';

import { GOOGLE_FOOD_MENU_CUISINES } from '@/lib/google-food-menu-cuisines';

import type {
  GoogleFoodMenuCuisine,
  GoogleFoodMenusResource,
} from '@/server/google-business-profile/food-menus';

export const GoogleFoodMenuCuisineSchema = z.enum([...GOOGLE_FOOD_MENU_CUISINES] satisfies [
  GoogleFoodMenuCuisine,
  ...GoogleFoodMenuCuisine[],
]);

export const FoodMenusProjectionRequestSchema = z.object({
  foodMenusName: z.string().trim().min(1),
  menuLabel: z.string().trim().min(1).nullable().optional(),
  sourceUrl: z.string().trim().url().nullable().optional(),
  languageCode: z.string().trim().min(2).nullable().optional(),
  includeUnavailable: z.boolean().optional(),
  cuisines: z.array(GoogleFoodMenuCuisineSchema).optional(),
  persist: z.boolean().optional(),
});

const GoogleMenuLabelSchema = z
  .object({
    displayName: z.string().trim().min(1),
    description: z.string().trim().nullable().optional(),
    languageCode: z.string().trim().min(2),
  })
  .passthrough();

const GoogleMoneySchema = z
  .object({
    currencyCode: z.string().trim().min(1),
    units: z.string().optional(),
    nanos: z.number().optional(),
  })
  .passthrough();

const GoogleNutritionAmountSchema = z
  .object({
    unit: z.string().trim().optional(),
    quantity: z.number().optional(),
    lowerAmount: z.number().optional(),
    upperAmount: z.number().optional(),
  })
  .passthrough();

const GoogleNutritionFactsSchema = z
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
  .passthrough();

const GoogleFoodMenuItemAttributesSchema = z
  .object({
    price: GoogleMoneySchema,
    spiciness: z.string().optional(),
    allergen: z.array(z.string()).optional(),
    dietaryRestriction: z.array(z.string()).optional(),
    ingredients: z
      .array(z.object({ labels: z.array(GoogleMenuLabelSchema) }).passthrough())
      .optional(),
    preparationMethods: z.array(z.string()).optional(),
    portionSize: z
      .object({
        quantity: z.number().optional(),
        unit: z.array(GoogleMenuLabelSchema).optional(),
      })
      .passthrough()
      .optional(),
    mediaKeys: z.array(z.string()).optional(),
    nutritionFacts: GoogleNutritionFactsSchema.optional(),
    servesNumPeople: z.number().optional(),
    servesNum: z.number().optional(),
  })
  .passthrough();

const GoogleFoodMenuItemSchema = z
  .object({
    labels: z.array(GoogleMenuLabelSchema),
    attributes: GoogleFoodMenuItemAttributesSchema,
    options: z
      .array(
        z
          .object({
            labels: z.array(GoogleMenuLabelSchema),
            attributes: GoogleFoodMenuItemAttributesSchema,
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

const GoogleFoodMenuSectionSchema = z
  .object({
    labels: z.array(GoogleMenuLabelSchema),
    items: z.array(GoogleFoodMenuItemSchema),
  })
  .passthrough();

const GoogleFoodMenuSchema = z
  .object({
    labels: z.array(GoogleMenuLabelSchema),
    sourceUrl: z.string().trim().url().optional(),
    sections: z.array(GoogleFoodMenuSectionSchema),
    cuisines: z.array(GoogleFoodMenuCuisineSchema).optional(),
  })
  .passthrough();

export const GoogleFoodMenusResourceSchema = z
  .object({
    name: z.string().trim().min(1),
    menus: z.array(GoogleFoodMenuSchema),
  })
  .passthrough()
  .transform((value) => value as GoogleFoodMenusResource);

export const FoodMenusImportReviewRequestSchema = z.object({
  googleFoodMenus: GoogleFoodMenusResourceSchema,
  googleSnapshotId: z.string().uuid().nullable().optional(),
  projectionSnapshotId: z.string().uuid().nullable().optional(),
  persist: z.boolean().optional(),
});

export const FoodMenusImportReviewRefreshRequestSchema = z.object({
  projectionSnapshotId: z.string().uuid().nullable().optional(),
  persist: z.boolean().optional(),
});

export const FoodMenusImportReviewDecisionRequestSchema = z.object({
  action: z.enum([
    'apply_to_nabatable',
    'create_new_item',
    'ignore_google_change',
    'apply_menu_metadata',
    'mark_inactive',
    'mark_sold_out',
    'delete_local',
  ]),
});

export const FoodMenusPublishRequestSchema = z.object({
  menuLabel: z.string().trim().min(1).nullable().optional(),
  sourceUrl: z.string().trim().url().nullable().optional(),
  languageCode: z.string().trim().min(2).nullable().optional(),
  includeUnavailable: z.boolean().optional(),
  cuisines: z.array(GoogleFoodMenuCuisineSchema).optional(),
  expectedGoogleHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .nullable()
    .optional(),
  expectedProjectionHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .nullable()
    .optional(),
});

export function invalidPayloadResponse(error: z.ZodError) {
  return {
    error: 'Invalid payload',
    details: error.flatten(),
  };
}
