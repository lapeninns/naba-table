import type { GoogleFoodMenuCuisine } from '@/lib/google-food-menu-cuisines';
import type { CanonicalRestaurantMenu } from '@/server/menu-hierarchy/types';

export type { GoogleFoodMenuCuisine } from '@/lib/google-food-menu-cuisines';

export type GoogleFoodMenusResource = {
  name: string;
  menus: GoogleFoodMenu[];
};

export type GoogleFoodMenu = {
  labels: GoogleMenuLabel[];
  sourceUrl?: string;
  sections: GoogleFoodMenuSection[];
  cuisines?: GoogleFoodMenuCuisine[];
};

export type GoogleFoodMenuSection = {
  labels: GoogleMenuLabel[];
  items: GoogleFoodMenuItem[];
};

export type GoogleFoodMenuItem = {
  labels: GoogleMenuLabel[];
  attributes: GoogleFoodMenuItemAttributes;
  options?: GoogleFoodMenuItemOption[];
};

export type GoogleFoodMenuItemOption = {
  labels: GoogleMenuLabel[];
  attributes: GoogleFoodMenuItemAttributes;
};

export type GoogleFoodMenuItemAttributes = {
  price?: GoogleMoney;
  spiciness?: GoogleFoodMenuSpiciness;
  allergen?: GoogleFoodMenuAllergen[];
  dietaryRestriction?: GoogleFoodMenuDietaryRestriction[];
  ingredients?: Array<{ labels: GoogleMenuLabel[] }>;
  preparationMethods?: GoogleFoodMenuPreparationMethod[];
  portionSize?: {
    quantity: number;
    unit: GoogleMenuLabel[];
  };
  mediaKeys?: string[];
  nutritionFacts?: GoogleNutritionFacts;
  servesNumPeople?: number;
  servesNum?: number;
};

export type GoogleNutritionAmount = {
  unit?: string;
  quantity?: number;
  lowerAmount?: number;
  upperAmount?: number;
};

export type GoogleNutritionFacts = Partial<{
  calories: GoogleNutritionAmount;
  totalFat: GoogleNutritionAmount;
  saturatedFat: GoogleNutritionAmount;
  cholesterol: GoogleNutritionAmount;
  sodium: GoogleNutritionAmount;
  totalCarbohydrate: GoogleNutritionAmount;
  sugars: GoogleNutritionAmount;
  dietaryFiber: GoogleNutritionAmount;
  protein: GoogleNutritionAmount;
}>;

export type GoogleMenuLabel = {
  displayName: string;
  description?: string;
  languageCode: string;
};

export type GoogleMoney = {
  currencyCode: string;
  units: string;
  nanos: number;
};

export type GoogleFoodMenuSpiciness = 'MILD' | 'MEDIUM' | 'HOT';

export type GoogleFoodMenuAllergen =
  | 'DAIRY'
  | 'EGG'
  | 'FISH'
  | 'PEANUT'
  | 'SHELLFISH'
  | 'SOY'
  | 'TREE_NUT'
  | 'WHEAT';

export type GoogleFoodMenuDietaryRestriction =
  | 'HALAL'
  | 'KOSHER'
  | 'ORGANIC'
  | 'VEGAN'
  | 'VEGETARIAN';

export type GoogleFoodMenuPreparationMethod =
  | 'BAKED'
  | 'BARBECUED'
  | 'BASTED'
  | 'BLANCHED'
  | 'BOILED'
  | 'BRAISED'
  | 'CODDLED'
  | 'FERMENTED'
  | 'FRIED'
  | 'GRILLED'
  | 'KNEADED'
  | 'MARINATED'
  | 'PAN_FRIED'
  | 'PICKLED'
  | 'PRESSURE_COOKED'
  | 'ROASTED'
  | 'SAUTEED'
  | 'SEARED'
  | 'SIMMERED'
  | 'SMOKED'
  | 'STEAMED'
  | 'STEEPED'
  | 'STIR_FRIED'
  | 'OTHER_METHOD';

export type BuildGoogleFoodMenusProjectionInput = {
  foodMenusName: string;
  items: FoodMenusLocalItem[];
  menuLabel?: string | null;
  sourceUrl?: string | null;
  languageCode?: string | null;
  includeUnavailable?: boolean;
  cuisines?: GoogleFoodMenuCuisine[];
};

export type BuildCanonicalGoogleFoodMenusProjectionInput = {
  foodMenusName: string;
  menus: CanonicalRestaurantMenu[];
  includeUnavailable?: boolean;
};

export type GoogleFoodMenusProjectedIdentity = {
  stableKey: string;
  localItemId: string;
  externalItemId: string;
  itemName: string;
  sectionKey: string;
  sectionLabel: string;
  googlePath: string;
  googleOptionPaths: Array<{
    externalModifierGroupId: string;
    externalModifierOptionId: string;
    googlePath: string;
  }>;
  projectionKind?: 'option_item';
};

export type GoogleFoodMenusProjectionSkippedItem = {
  localItemId: string;
  externalItemId: string;
  reason: 'inactive' | 'sold_out' | 'unavailable';
};

export type GoogleFoodMenusProjection = {
  foodMenus: GoogleFoodMenusResource;
  identities: GoogleFoodMenusProjectedIdentity[];
  skippedItems: GoogleFoodMenusProjectionSkippedItem[];
};

export type GoogleFoodMenusImportMatchConfidence =
  | 'previous_identity'
  | 'section_name_price'
  | 'section_name'
  | 'none';

export type GoogleFoodMenusImportTargetKind = 'food' | 'drink';

export type FoodMenusLocalModifierOption = {
  id?: string;
  restaurantId?: string;
  menuItemId?: string;
  externalModifierOptionId: string;
  optionName: string;
  priceDelta: number;
  defaultSelected: boolean;
  availabilityStatus: 'available' | 'unavailable';
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type FoodMenusLocalModifierGroup = {
  id?: string;
  restaurantId?: string;
  menuItemId?: string;
  externalModifierGroupId: string;
  groupName: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
  options: FoodMenusLocalModifierOption[];
};

export type FoodMenusLocalItem = {
  id: string;
  restaurantId: string;
  externalItemId: string;
  itemName: string;
  category: string;
  subcategory: string | null;
  shortDescription: string | null;
  fullDescription: string | null;
  basePrice: number;
  currency: string;
  serviceTime: string | null;
  availabilityStatus: 'available' | 'unavailable' | 'seasonal';
  keyIngredients: string[];
  mainProteinOrBase: string | null;
  cookingStyle: string | null;
  preparationMethod: string | null;
  flavorProfile: string | null;
  texture: string | null;
  spiceLevel: string | null;
  spiceAdjustable: boolean;
  portionSize: string | null;
  shareable: boolean;
  recommendationTags: string[];
  pairings: string[];
  signatureScore: number | null;
  popularityScore: number | null;
  dietaryTags: string[];
  allergensContains: string[];
  allergensMayContain: string[];
  removableIngredients: string[];
  substitutionsAllowed: boolean;
  canBeMadeVegetarian: boolean;
  canBeMadeVegan: boolean;
  canBeMadeGlutenFree: boolean;
  customizationRules: string | null;
  servingNotes: string | null;
  active: boolean;
  seasonal: boolean;
  limitedTime: boolean;
  soldOut: boolean;
  displayOrder: number;
  imageUrl: string | null;
  caloriesKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  saturatedFatG: number | null;
  carbsG: number | null;
  sugarG: number | null;
  fiberG: number | null;
  sodiumMg: number | null;
  servesNum: number | null;
  createdAt: string;
  updatedAt: string;
  modifierGroups: FoodMenusLocalModifierGroup[];
  targetKind?: GoogleFoodMenusImportTargetKind;
};

export type GoogleFoodMenusImportMenuMetadataPatch = Partial<{
  menuLabel: string | null;
  sourceUrl: string | null;
  cuisines: GoogleFoodMenuCuisine[];
  languageCode: string | null;
}>;

export type GoogleFoodMenusImportItemSuggestedPatch = Partial<
  Pick<
    FoodMenusLocalItem,
    | 'externalItemId'
    | 'itemName'
    | 'category'
    | 'subcategory'
    | 'shortDescription'
    | 'basePrice'
    | 'currency'
    | 'spiceLevel'
    | 'preparationMethod'
    | 'portionSize'
    | 'keyIngredients'
    | 'imageUrl'
    | 'caloriesKcal'
    | 'proteinG'
    | 'fatG'
    | 'saturatedFatG'
    | 'carbsG'
    | 'sugarG'
    | 'fiberG'
    | 'sodiumMg'
    | 'servesNum'
    | 'dietaryTags'
    | 'allergensContains'
  >
> & {
  modifierGroups?: FoodMenusLocalModifierGroup[];
};

export type GoogleFoodMenusImportSuggestedPatch =
  | GoogleFoodMenusImportItemSuggestedPatch
  | GoogleFoodMenusImportMenuMetadataPatch;

export type GoogleFoodMenusImportReviewItem = {
  googlePath: string | null;
  googleSectionLabel: string | null;
  googleItemName: string | null;
  targetKind: GoogleFoodMenusImportTargetKind;
  match:
    | {
        status: 'matched';
        confidence: Exclude<GoogleFoodMenusImportMatchConfidence, 'none'>;
        localItemId: string;
        externalItemId: string;
      }
    | {
        status: 'unmatched';
        confidence: 'none';
      }
    | {
        status: 'missing_from_google';
        confidence: 'none';
        localItemId: string;
        externalItemId: string;
      }
    | {
        status: 'menu_metadata';
        confidence: 'none';
      };
  suggestedPatch: GoogleFoodMenusImportSuggestedPatch | null;
  warnings: string[];
};

export type GoogleFoodMenusImportReview = {
  items: GoogleFoodMenusImportReviewItem[];
  localItemsMissingFromGoogle: Array<{
    localItemId: string;
    externalItemId: string;
    itemName: string;
    targetKind: GoogleFoodMenusImportTargetKind;
    reason: 'not_present_in_google';
  }>;
};

export type BuildGoogleFoodMenusImportReviewInput = {
  googleFoodMenus: GoogleFoodMenusResource;
  localItems: FoodMenusLocalItem[];
  previousIdentities?: ReadonlyArray<GoogleFoodMenusProjectedIdentity>;
  settings?: GoogleFoodMenuSettings | null;
};

export type GoogleFoodMenuSettings = {
  menuLabel: string | null;
  sourceUrl: string | null;
  cuisines: GoogleFoodMenuCuisine[];
  languageCode: string | null;
};

export type CanonicalGoogleFoodMenusResource = {
  name: string;
  menus: Array<{
    labels: GoogleMenuLabel[];
    sourceUrl: string | null;
    cuisines: GoogleFoodMenuCuisine[];
    sections: Array<{
      labels: GoogleMenuLabel[];
      items: Array<{
        labels: GoogleMenuLabel[];
        attributes: {
          price: { currencyCode: string; amount: number | null };
          spiciness: GoogleFoodMenuSpiciness | null;
          allergen: GoogleFoodMenuAllergen[];
          dietaryRestriction: GoogleFoodMenuDietaryRestriction[];
          ingredients: string[];
          preparationMethods: GoogleFoodMenuPreparationMethod[];
          portionSize: string | null;
          mediaKeys: string[];
          nutritionFacts: {
            calories: {
              unit: string | null;
              lowerAmount: number | null;
              upperAmount: number | null;
            };
            totalFat: {
              unit: string | null;
              lowerAmount: number | null;
              upperAmount: number | null;
            };
            saturatedFat: {
              unit: string | null;
              lowerAmount: number | null;
              upperAmount: number | null;
            };
            cholesterol: {
              unit: string | null;
              lowerAmount: number | null;
              upperAmount: number | null;
            };
            sodium: { unit: string | null; lowerAmount: number | null; upperAmount: number | null };
            totalCarbohydrate: {
              unit: string | null;
              lowerAmount: number | null;
              upperAmount: number | null;
            };
            sugars: {
              unit: string | null;
              lowerAmount: number | null;
              upperAmount: number | null;
            };
            dietaryFiber: {
              unit: string | null;
              lowerAmount: number | null;
              upperAmount: number | null;
            };
            protein: {
              unit: string | null;
              lowerAmount: number | null;
              upperAmount: number | null;
            };
          };
          servesNumPeople: number | null;
        };
        options: Array<{
          labels: GoogleMenuLabel[];
          attributes: CanonicalGoogleFoodMenusResource['menus'][number]['sections'][number]['items'][number]['attributes'];
        }>;
      }>;
    }>;
  }>;
};
