import { parseCsvFile } from '@/server/menu/csv';

import { getExistingDrinkExternalIds } from './repository';
import {
  DrinkItemUpsertInputSchema,
  type DrinkImportError,
  type DrinkImportPreview,
  type DrinkImportSummary,
  type DrinkItemUpsertInput,
} from './types';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

const ITEM_HEADERS = [
  'drink_id',
  'drink_name',
  'category',
  'subcategory',
  'short_description',
  'full_description',
  'base_price',
  'currency',
  'service_time',
  'availability_status',
  'drink_type',
  'alcoholic',
  'abv',
  'volume_ml',
  'serving_size',
  'served_style',
  'temperature',
  'base_spirit',
  'beer_style',
  'wine_type',
  'grape_varietal',
  'region',
  'country',
  'roast_level',
  'caffeine_level',
  'sweetness_level',
  'bitterness_level',
  'acidity_level',
  'body_level',
  'flavor_profile',
  'key_ingredients',
  'garnish',
  'contains_dairy',
  'contains_nuts',
  'contains_gluten',
  'contains_caffeine',
  'dietary_tags',
  'allergens_contains',
  'allergens_may_contain',
  'can_be_made_non_alcoholic',
  'can_be_made_decaf',
  'customization_rules',
  'pairings',
  'signature_score',
  'popularity_score',
  'recommendation_tags',
  'seasonal',
  'limited_time',
  'sold_out',
  'active',
  'display_order',
  'image_url',
] as const;

const MODIFIER_GROUP_HEADERS = [
  'modifier_group_id',
  'drink_id',
  'group_name',
  'required',
  'min_select',
  'max_select',
] as const;

const MODIFIER_OPTION_HEADERS = [
  'modifier_option_id',
  'modifier_group_id',
  'option_name',
  'price_delta',
  'default_selected',
  'availability_status',
] as const;

type ImportGroupRow = {
  externalModifierGroupId: string;
  externalDrinkId: string;
  groupName: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  displayOrder: number;
};

type ImportOptionRow = {
  externalModifierOptionId: string;
  externalModifierGroupId: string;
  optionName: string;
  priceDelta: number;
  defaultSelected: boolean;
  availabilityStatus: 'available' | 'unavailable';
  displayOrder: number;
};

type PreparedDrinkImport = {
  preview: DrinkImportPreview;
  items: DrinkItemUpsertInput[];
  modifierGroups: ImportGroupRow[];
  modifierOptions: ImportOptionRow[];
  replaceModifiers: boolean;
};

function buildSummary(overrides: Partial<DrinkImportSummary> = {}): DrinkImportSummary {
  return {
    itemRows: 0,
    modifierGroupRows: 0,
    modifierOptionRows: 0,
    itemsToCreate: 0,
    itemsToUpdate: 0,
    modifierGroupsToCreate: 0,
    modifierGroupsToUpdate: 0,
    modifierOptionsToCreate: 0,
    modifierOptionsToUpdate: 0,
    impactedItemCount: 0,
    replaceModifiers: false,
    ...overrides,
  };
}

function addError(
  errors: DrinkImportError[],
  file: DrinkImportError['file'],
  row: number,
  column: string | null,
  message: string,
) {
  errors.push({ file, row, column, message });
}

function ensureHeaders(
  actualHeaders: string[],
  expectedHeaders: readonly string[],
  file: DrinkImportError['file'],
  errors: DrinkImportError[],
) {
  const actualSet = new Set(actualHeaders);
  expectedHeaders.forEach((header) => {
    if (!actualSet.has(header)) {
      addError(errors, file, 1, header, `Missing required header "${header}"`);
    }
  });
}

function parseListCell(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const separator = trimmed.includes('|') ? '|' : ',';
  return trimmed
    .split(separator)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function parseBooleanCell(
  value: string,
  options: {
    defaultValue: boolean;
    file: DrinkImportError['file'];
    row: number;
    column: string;
    errors: DrinkImportError[];
  },
): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return options.defaultValue;
  }
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }
  addError(options.errors, options.file, options.row, options.column, 'Expected a boolean value');
  return options.defaultValue;
}

function parseDecimalCell(
  value: string,
  options: {
    defaultValue?: number | null;
    required?: boolean;
    file: DrinkImportError['file'];
    row: number;
    column: string;
    errors: DrinkImportError[];
  },
): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    if (options.required) {
      addError(options.errors, options.file, options.row, options.column, 'Value is required');
    }
    return options.defaultValue ?? null;
  }
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) {
    addError(options.errors, options.file, options.row, options.column, 'Expected a decimal number');
    return options.defaultValue ?? null;
  }
  return parsed;
}

function parseIntegerCell(
  value: string,
  options: {
    defaultValue?: number | null;
    required?: boolean;
    min?: number;
    max?: number;
    file: DrinkImportError['file'];
    row: number;
    column: string;
    errors: DrinkImportError[];
  },
): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    if (options.required) {
      addError(options.errors, options.file, options.row, options.column, 'Value is required');
    }
    return options.defaultValue ?? null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed)) {
    addError(options.errors, options.file, options.row, options.column, 'Expected an integer');
    return options.defaultValue ?? null;
  }
  if (options.min !== undefined && parsed < options.min) {
    addError(options.errors, options.file, options.row, options.column, `Value must be at least ${options.min}`);
  }
  if (options.max !== undefined && parsed > options.max) {
    addError(options.errors, options.file, options.row, options.column, `Value must be at most ${options.max}`);
  }
  return parsed;
}

function readRequiredText(
  source: Record<string, string>,
  column: string,
  file: DrinkImportError['file'],
  row: number,
  errors: DrinkImportError[],
): string {
  const value = (source[column] ?? '').trim();
  if (!value) {
    addError(errors, file, row, column, 'Value is required');
  }
  return value;
}

function readOptionalText(source: Record<string, string>, column: string): string | null {
  const value = (source[column] ?? '').trim();
  return value.length > 0 ? value : null;
}

export async function prepareDrinkImport(
  restaurantId: string,
  files: {
    itemsText: string;
    modifierGroupsText?: string | null;
    modifierOptionsText?: string | null;
  },
  client: DbClient,
): Promise<PreparedDrinkImport> {
  const errors: DrinkImportError[] = [];
  const parsedItemsFile = parseCsvFile(files.itemsText);
  const parsedGroupsFile = files.modifierGroupsText ? parseCsvFile(files.modifierGroupsText) : null;
  const parsedOptionsFile = files.modifierOptionsText ? parseCsvFile(files.modifierOptionsText) : null;
  const replaceModifiers = Boolean(parsedGroupsFile && parsedOptionsFile);

  ensureHeaders(parsedItemsFile.headers, ITEM_HEADERS, 'items', errors);
  if (parsedGroupsFile) {
    ensureHeaders(parsedGroupsFile.headers, MODIFIER_GROUP_HEADERS, 'modifier_groups', errors);
    if (!parsedOptionsFile) {
      addError(
        errors,
        'modifier_groups',
        1,
        'modifier_group_id',
        'modifier_options CSV is required when modifier_groups CSV is provided',
      );
    }
  }
  if (parsedOptionsFile) {
    ensureHeaders(parsedOptionsFile.headers, MODIFIER_OPTION_HEADERS, 'modifier_options', errors);
    if (!parsedGroupsFile) {
      addError(errors, 'modifier_options', 1, 'modifier_group_id', 'modifier_groups CSV is required when modifier_options CSV is provided');
    }
  }

  const items: DrinkItemUpsertInput[] = [];
  const modifierGroups: ImportGroupRow[] = [];
  const modifierOptions: ImportOptionRow[] = [];

  const seenItemIds = new Set<string>();
  const seenGroupIds = new Set<string>();
  const seenOptionIds = new Set<string>();

  for (const row of parsedItemsFile.rows) {
    const rowErrorsBefore = errors.length;
    const input = {
      externalDrinkId: readRequiredText(row.values, 'drink_id', 'items', row.rowNumber, errors),
      drinkName: readRequiredText(row.values, 'drink_name', 'items', row.rowNumber, errors),
      category: readRequiredText(row.values, 'category', 'items', row.rowNumber, errors),
      subcategory: readOptionalText(row.values, 'subcategory'),
      shortDescription: readOptionalText(row.values, 'short_description'),
      fullDescription: readOptionalText(row.values, 'full_description'),
      basePrice:
        parseDecimalCell(row.values.base_price, {
          required: true,
          defaultValue: 0,
          file: 'items',
          row: row.rowNumber,
          column: 'base_price',
          errors,
        }) ?? 0,
      currency: (readOptionalText(row.values, 'currency') ?? 'GBP').toUpperCase(),
      serviceTime: readOptionalText(row.values, 'service_time'),
      availabilityStatus: ((readOptionalText(row.values, 'availability_status') ?? 'available').toLowerCase() as
        | 'available'
        | 'unavailable'),
      drinkType: readOptionalText(row.values, 'drink_type'),
      alcoholic: parseBooleanCell(row.values.alcoholic ?? '', {
        defaultValue: false,
        file: 'items',
        row: row.rowNumber,
        column: 'alcoholic',
        errors,
      }),
      abv: parseDecimalCell(row.values.abv ?? '', {
        defaultValue: null,
        file: 'items',
        row: row.rowNumber,
        column: 'abv',
        errors,
      }),
      volumeMl: parseIntegerCell(row.values.volume_ml ?? '', {
        defaultValue: null,
        min: 0,
        file: 'items',
        row: row.rowNumber,
        column: 'volume_ml',
        errors,
      }),
      servingSize: readOptionalText(row.values, 'serving_size'),
      servedStyle: readOptionalText(row.values, 'served_style'),
      temperature: readOptionalText(row.values, 'temperature'),
      baseSpirit: readOptionalText(row.values, 'base_spirit'),
      beerStyle: readOptionalText(row.values, 'beer_style'),
      wineType: readOptionalText(row.values, 'wine_type'),
      grapeVarietal: readOptionalText(row.values, 'grape_varietal'),
      region: readOptionalText(row.values, 'region'),
      country: readOptionalText(row.values, 'country'),
      roastLevel: readOptionalText(row.values, 'roast_level'),
      caffeineLevel: readOptionalText(row.values, 'caffeine_level'),
      sweetnessLevel: readOptionalText(row.values, 'sweetness_level'),
      bitternessLevel: readOptionalText(row.values, 'bitterness_level'),
      acidityLevel: readOptionalText(row.values, 'acidity_level'),
      bodyLevel: readOptionalText(row.values, 'body_level'),
      flavorProfile: readOptionalText(row.values, 'flavor_profile'),
      keyIngredients: parseListCell(row.values.key_ingredients ?? ''),
      garnish: readOptionalText(row.values, 'garnish'),
      containsDairy: parseBooleanCell(row.values.contains_dairy ?? '', {
        defaultValue: false,
        file: 'items',
        row: row.rowNumber,
        column: 'contains_dairy',
        errors,
      }),
      containsNuts: parseBooleanCell(row.values.contains_nuts ?? '', {
        defaultValue: false,
        file: 'items',
        row: row.rowNumber,
        column: 'contains_nuts',
        errors,
      }),
      containsGluten: parseBooleanCell(row.values.contains_gluten ?? '', {
        defaultValue: false,
        file: 'items',
        row: row.rowNumber,
        column: 'contains_gluten',
        errors,
      }),
      containsCaffeine: parseBooleanCell(row.values.contains_caffeine ?? '', {
        defaultValue: false,
        file: 'items',
        row: row.rowNumber,
        column: 'contains_caffeine',
        errors,
      }),
      dietaryTags: parseListCell(row.values.dietary_tags ?? ''),
      allergensContains: parseListCell(row.values.allergens_contains ?? ''),
      allergensMayContain: parseListCell(row.values.allergens_may_contain ?? ''),
      canBeMadeNonAlcoholic: parseBooleanCell(row.values.can_be_made_non_alcoholic ?? '', {
        defaultValue: false,
        file: 'items',
        row: row.rowNumber,
        column: 'can_be_made_non_alcoholic',
        errors,
      }),
      canBeMadeDecaf: parseBooleanCell(row.values.can_be_made_decaf ?? '', {
        defaultValue: false,
        file: 'items',
        row: row.rowNumber,
        column: 'can_be_made_decaf',
        errors,
      }),
      customizationRules: readOptionalText(row.values, 'customization_rules'),
      pairings: parseListCell(row.values.pairings ?? ''),
      signatureScore: parseIntegerCell(row.values.signature_score ?? '', {
        defaultValue: null,
        min: 0,
        max: 100,
        file: 'items',
        row: row.rowNumber,
        column: 'signature_score',
        errors,
      }),
      popularityScore: parseIntegerCell(row.values.popularity_score ?? '', {
        defaultValue: null,
        min: 0,
        max: 100,
        file: 'items',
        row: row.rowNumber,
        column: 'popularity_score',
        errors,
      }),
      recommendationTags: parseListCell(row.values.recommendation_tags ?? ''),
      seasonal: parseBooleanCell(row.values.seasonal ?? '', {
        defaultValue: false,
        file: 'items',
        row: row.rowNumber,
        column: 'seasonal',
        errors,
      }),
      limitedTime: parseBooleanCell(row.values.limited_time ?? '', {
        defaultValue: false,
        file: 'items',
        row: row.rowNumber,
        column: 'limited_time',
        errors,
      }),
      soldOut: parseBooleanCell(row.values.sold_out ?? '', {
        defaultValue: false,
        file: 'items',
        row: row.rowNumber,
        column: 'sold_out',
        errors,
      }),
      active: parseBooleanCell(row.values.active ?? '', {
        defaultValue: true,
        file: 'items',
        row: row.rowNumber,
        column: 'active',
        errors,
      }),
      displayOrder:
        parseIntegerCell(row.values.display_order ?? '', {
          defaultValue: 0,
          min: 0,
          file: 'items',
          row: row.rowNumber,
          column: 'display_order',
          errors,
        }) ?? 0,
      imageUrl: readOptionalText(row.values, 'image_url'),
      modifierGroups: [],
    };

    if (seenItemIds.has(input.externalDrinkId)) {
      addError(errors, 'items', row.rowNumber, 'drink_id', `Duplicate drink_id "${input.externalDrinkId}"`);
    } else {
      seenItemIds.add(input.externalDrinkId);
    }

    const parsed = DrinkItemUpsertInputSchema.safeParse(input);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        addError(errors, 'items', row.rowNumber, issue.path[0] ? String(issue.path[0]) : null, issue.message);
      });
    } else if (rowErrorsBefore === errors.length) {
      items.push(parsed.data);
    }
  }

  if (parsedGroupsFile) {
    for (const [index, row] of parsedGroupsFile.rows.entries()) {
      const rowErrorsBefore = errors.length;
      const externalModifierGroupId = readRequiredText(
        row.values,
        'modifier_group_id',
        'modifier_groups',
        row.rowNumber,
        errors,
      );
      const externalDrinkId = readRequiredText(row.values, 'drink_id', 'modifier_groups', row.rowNumber, errors);
      const groupName = readRequiredText(row.values, 'group_name', 'modifier_groups', row.rowNumber, errors);
      const required = parseBooleanCell(row.values.required ?? '', {
        defaultValue: false,
        file: 'modifier_groups',
        row: row.rowNumber,
        column: 'required',
        errors,
      });
      const minSelect =
        parseIntegerCell(row.values.min_select ?? '', {
          defaultValue: 0,
          min: 0,
          file: 'modifier_groups',
          row: row.rowNumber,
          column: 'min_select',
          errors,
        }) ?? 0;
      const maxSelect =
        parseIntegerCell(row.values.max_select ?? '', {
          defaultValue: 1,
          min: 0,
          file: 'modifier_groups',
          row: row.rowNumber,
          column: 'max_select',
          errors,
        }) ?? 1;

      if (seenGroupIds.has(externalModifierGroupId)) {
        addError(errors, 'modifier_groups', row.rowNumber, 'modifier_group_id', `Duplicate modifier_group_id "${externalModifierGroupId}"`);
      } else {
        seenGroupIds.add(externalModifierGroupId);
      }

      if (minSelect > maxSelect) {
        addError(errors, 'modifier_groups', row.rowNumber, 'min_select', 'min_select cannot be greater than max_select');
      }
      if (required && minSelect < 1) {
        addError(errors, 'modifier_groups', row.rowNumber, 'min_select', 'Required groups must have min_select >= 1');
      }

      if (rowErrorsBefore === errors.length) {
        modifierGroups.push({
          externalModifierGroupId,
          externalDrinkId,
          groupName,
          required,
          minSelect,
          maxSelect,
          displayOrder: index,
        });
      }
    }
  }

  if (parsedOptionsFile) {
    for (const [index, row] of parsedOptionsFile.rows.entries()) {
      const rowErrorsBefore = errors.length;
      const externalModifierOptionId = readRequiredText(
        row.values,
        'modifier_option_id',
        'modifier_options',
        row.rowNumber,
        errors,
      );
      const externalModifierGroupId = readRequiredText(
        row.values,
        'modifier_group_id',
        'modifier_options',
        row.rowNumber,
        errors,
      );
      const optionName = readRequiredText(row.values, 'option_name', 'modifier_options', row.rowNumber, errors);
      const priceDelta =
        parseDecimalCell(row.values.price_delta ?? '', {
          defaultValue: 0,
          file: 'modifier_options',
          row: row.rowNumber,
          column: 'price_delta',
          errors,
        }) ?? 0;
      const defaultSelected = parseBooleanCell(row.values.default_selected ?? '', {
        defaultValue: false,
        file: 'modifier_options',
        row: row.rowNumber,
        column: 'default_selected',
        errors,
      });
      const availabilityStatus = ((readOptionalText(row.values, 'availability_status') ?? 'available').toLowerCase() as
        | 'available'
        | 'unavailable');

      if (seenOptionIds.has(externalModifierOptionId)) {
        addError(errors, 'modifier_options', row.rowNumber, 'modifier_option_id', `Duplicate modifier_option_id "${externalModifierOptionId}"`);
      } else {
        seenOptionIds.add(externalModifierOptionId);
      }

      if (!['available', 'unavailable'].includes(availabilityStatus)) {
        addError(errors, 'modifier_options', row.rowNumber, 'availability_status', 'availability_status must be available or unavailable');
      }

      if (rowErrorsBefore === errors.length) {
        modifierOptions.push({
          externalModifierOptionId,
          externalModifierGroupId,
          optionName,
          priceDelta,
          defaultSelected,
          availabilityStatus,
          displayOrder: index,
        });
      }
    }
  }

  const existingIds = await getExistingDrinkExternalIds(
    restaurantId,
    {
      itemExternalIds: items.map((item) => item.externalDrinkId),
      modifierGroupExternalIds: modifierGroups.map((group) => group.externalModifierGroupId),
      modifierOptionExternalIds: modifierOptions.map((option) => option.externalModifierOptionId),
    },
    client,
  );

  const availableItemIds = new Set([
    ...items.map((item) => item.externalDrinkId),
    ...Array.from(existingIds.itemExternalIds),
  ]);
  const providedGroupIds = new Set(modifierGroups.map((group) => group.externalModifierGroupId));

  modifierGroups.forEach((group, index) => {
    if (!availableItemIds.has(group.externalDrinkId)) {
      addError(
        errors,
        'modifier_groups',
        parsedGroupsFile?.rows[index]?.rowNumber ?? index + 2,
        'drink_id',
        `Unknown drink_id "${group.externalDrinkId}"`,
      );
    }
  });

  modifierOptions.forEach((option, index) => {
    if (!providedGroupIds.has(option.externalModifierGroupId)) {
      addError(
        errors,
        'modifier_options',
        parsedOptionsFile?.rows[index]?.rowNumber ?? index + 2,
        'modifier_group_id',
        `Unknown modifier_group_id "${option.externalModifierGroupId}"`,
      );
    }
  });

  const summary = buildSummary({
    itemRows: parsedItemsFile.rows.length,
    modifierGroupRows: parsedGroupsFile?.rows.length ?? 0,
    modifierOptionRows: parsedOptionsFile?.rows.length ?? 0,
    itemsToCreate: items.filter((item) => !existingIds.itemExternalIds.has(item.externalDrinkId)).length,
    itemsToUpdate: items.filter((item) => existingIds.itemExternalIds.has(item.externalDrinkId)).length,
    modifierGroupsToCreate: modifierGroups.filter((group) => !existingIds.modifierGroupExternalIds.has(group.externalModifierGroupId)).length,
    modifierGroupsToUpdate: modifierGroups.filter((group) => existingIds.modifierGroupExternalIds.has(group.externalModifierGroupId)).length,
    modifierOptionsToCreate: modifierOptions.filter((option) => !existingIds.modifierOptionExternalIds.has(option.externalModifierOptionId)).length,
    modifierOptionsToUpdate: modifierOptions.filter((option) => existingIds.modifierOptionExternalIds.has(option.externalModifierOptionId)).length,
    impactedItemCount: replaceModifiers
      ? new Set(
          modifierGroups.length > 0
            ? modifierGroups.map((group) => group.externalDrinkId)
            : items.map((item) => item.externalDrinkId),
        ).size
      : 0,
    replaceModifiers,
  });

  return {
    preview: {
      applied: false,
      canApply: errors.length === 0,
      summary,
      errors,
    },
    items,
    modifierGroups,
    modifierOptions,
    replaceModifiers,
  };
}
