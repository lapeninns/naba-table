import { mediaKeysToImageUrl } from './food-menus-import-mapping';
import {
  buildCreateSuggestedPatch,
  buildMenuMetadataSuggestedPatch,
  buildSuggestedPatch,
} from './food-menus-import-review-patches';
import { getSectionLabel } from './food-menus-local-projection';
import {
  cleanText,
  foodMenusArray,
  getPrimaryLabel,
  googleMoneyToNumber,
  menuSectionsArray,
  normalizeComparableText,
  sectionItemsArray,
} from './food-menus-serialization';

import type {
  BuildGoogleFoodMenusImportReviewInput,
  FoodMenusLocalItem,
  GoogleFoodMenu,
  GoogleFoodMenusImportMatchConfidence,
  GoogleFoodMenusImportReview,
  GoogleFoodMenusImportReviewItem,
  GoogleFoodMenusImportTargetKind,
  GoogleFoodMenusProjectedIdentity,
} from './food-menus';

export {
  buildCreateSuggestedPatch,
  buildMenuMetadataSuggestedPatch,
  buildSuggestedPatch,
  splitSectionLabelForCreate,
} from './food-menus-import-review-patches';

type ImportLocalItem = FoodMenusLocalItem & {
  targetKind: GoogleFoodMenusImportTargetKind;
};

export function classifyMenuTarget(menu: GoogleFoodMenu): GoogleFoodMenusImportTargetKind {
  const label = normalizeComparableText(getPrimaryLabel(menu.labels)?.displayName);
  if (!label) {
    return 'food';
  }
  if (/\bfood\b/.test(label) && /\b(drinks?|beverages?)\b/.test(label)) {
    return 'food';
  }
  return /\b(drinks?|beverages?|bar|cocktails?|wine|beer|cellar)\b/.test(label) ? 'drink' : 'food';
}

function toImportLocalItem(item: FoodMenusLocalItem): ImportLocalItem {
  return { ...item, targetKind: item.targetKind ?? 'food' };
}

export function isOptionItemIdentity(identity: GoogleFoodMenusProjectedIdentity): boolean {
  return identity.projectionKind === 'option_item' || identity.stableKey.includes('.optionItem.');
}

type PreviousIdentityLookup = {
  readonly match: { item: ImportLocalItem; isProjectedOptionItem: boolean } | null;
  readonly warning: string | null;
};

export function previousIdentityMatchesGoogleRow(input: {
  readonly identity: GoogleFoodMenusProjectedIdentity;
  readonly googleSectionLabel: string | null;
  readonly googleItemName: string | null;
}): boolean {
  const identitySection = normalizeComparableText(input.identity.sectionLabel);
  const googleSection = normalizeComparableText(input.googleSectionLabel);
  const identityName = normalizeComparableText(input.identity.itemName);
  const googleName = normalizeComparableText(input.googleItemName);
  if (!identitySection || !googleSection || identitySection !== googleSection) {
    return false;
  }
  if (!identityName || !googleName || identityName !== googleName) {
    return false;
  }
  if (isOptionItemIdentity(input.identity)) {
    return true;
  }
  return true;
}

export function findLocalItemByPreviousIdentity(
  googlePath: string,
  localItemsById: Map<string, ImportLocalItem>,
  previousIdentities: ReadonlyArray<GoogleFoodMenusProjectedIdentity>,
  googleSectionLabel: string | null,
  googleItemName: string | null,
): PreviousIdentityLookup {
  const identity = previousIdentities.find((entry) => entry.googlePath === googlePath);
  if (!identity) {
    return { match: null, warning: null };
  }
  const item = localItemsById.get(identity.localItemId);
  if (!item) {
    return {
      match: null,
      warning: 'Previous FoodMenus identity points to a local item that no longer exists.',
    };
  }
  if (
    !previousIdentityMatchesGoogleRow({
      identity,
      googleSectionLabel,
      googleItemName,
    })
  ) {
    return {
      match: null,
      warning:
        'Previous FoodMenus identity no longer matches this Google row; match by section, name, and price before applying changes.',
    };
  }
  return {
    match: { item, isProjectedOptionItem: isOptionItemIdentity(identity) },
    warning: null,
  };
}

export function findLocalItemByDisplayMatch(
  googleSectionLabel: string | null,
  googleItemName: string | null,
  googlePrice: number | null,
  localItems: ImportLocalItem[],
): { item: ImportLocalItem; confidence: 'section_name_price' | 'section_name' } | null {
  const sectionKey = normalizeComparableText(googleSectionLabel);
  const nameKey = normalizeComparableText(googleItemName);
  if (!sectionKey || !nameKey) {
    return null;
  }

  const sectionNameMatches = localItems.filter(
    (item) =>
      normalizeComparableText(getSectionLabel(item)) === sectionKey &&
      normalizeComparableText(item.itemName) === nameKey,
  );
  if (sectionNameMatches.length === 0) {
    return null;
  }

  if (googlePrice !== null) {
    const priceMatches = sectionNameMatches.filter(
      (item) => Math.abs(item.basePrice - googlePrice) < 0.01,
    );
    if (priceMatches.length === 1) {
      return { item: priceMatches[0]!, confidence: 'section_name_price' };
    }
  }

  if (sectionNameMatches.length === 1) {
    return { item: sectionNameMatches[0]!, confidence: 'section_name' };
  }

  return null;
}

export function buildGoogleFoodMenusImportReview(
  input: BuildGoogleFoodMenusImportReviewInput,
): GoogleFoodMenusImportReview {
  const localItemsForImport = input.localItems.map(toImportLocalItem);
  const localItemsByTarget = {
    food: localItemsForImport.filter((item) => item.targetKind === 'food'),
    drink: localItemsForImport.filter((item) => item.targetKind === 'drink'),
  } satisfies Record<GoogleFoodMenusImportTargetKind, ImportLocalItem[]>;
  const matchedLocalItemIds = new Set<string>();
  const items: GoogleFoodMenusImportReviewItem[] = [];
  const googleMenus = foodMenusArray(input.googleFoodMenus);

  for (const [menuIndex, menu] of googleMenus.entries()) {
    const targetKind = classifyMenuTarget(menu);
    const metadataPatch = buildMenuMetadataSuggestedPatch(menu, input.settings ?? null);
    if (metadataPatch) {
      items.push({
        googlePath: `menus[${menuIndex}].metadata`,
        googleSectionLabel: null,
        googleItemName:
          cleanText(getPrimaryLabel(menu.labels)?.displayName) ?? `Menu ${menuIndex + 1} settings`,
        targetKind,
        match: { status: 'menu_metadata', confidence: 'none' },
        suggestedPatch: metadataPatch,
        warnings: [],
      });
    }
    const localItems = localItemsByTarget[targetKind];
    const localItemsById = new Map(localItems.map((item) => [item.id, item]));
    for (const [sectionIndex, section] of menuSectionsArray(menu).entries()) {
      const googleSectionLabel = cleanText(getPrimaryLabel(section.labels)?.displayName);
      for (const [itemIndex, googleItem] of sectionItemsArray(section).entries()) {
        const googlePath = `menus[${menuIndex}].sections[${sectionIndex}].items[${itemIndex}]`;
        const googleItemName = cleanText(getPrimaryLabel(googleItem.labels)?.displayName);
        const googlePrice = googleMoneyToNumber(googleItem.attributes.price);
        const warnings: string[] = [];
        const previousIdentityLookup = findLocalItemByPreviousIdentity(
          googlePath,
          localItemsById,
          input.previousIdentities ?? [],
          googleSectionLabel,
          googleItemName,
        );
        let localItem = previousIdentityLookup.match?.item ?? null;
        const isProjectedOptionItem = previousIdentityLookup.match?.isProjectedOptionItem ?? false;
        let confidence: GoogleFoodMenusImportMatchConfidence = localItem
          ? 'previous_identity'
          : 'none';

        if (!localItem) {
          const displayMatch = findLocalItemByDisplayMatch(
            googleSectionLabel,
            googleItemName,
            googlePrice,
            localItems,
          );
          localItem = displayMatch?.item ?? null;
          confidence = displayMatch?.confidence ?? 'none';
        }

        if (!googleItemName) {
          warnings.push('Google item has no display name.');
        }
        if (googlePrice === null) {
          warnings.push('Google item has no parseable price.');
        }
        if (
          (googleItem.attributes.mediaKeys ?? []).length > 0 &&
          !mediaKeysToImageUrl(googleItem.attributes.mediaKeys)
        ) {
          warnings.push('Google item media keys need a public URL before image import.');
        }

        if (!localItem || confidence === 'none') {
          if (previousIdentityLookup.warning) {
            warnings.push(previousIdentityLookup.warning);
          }
          const suggestedPatch = buildCreateSuggestedPatch(
            googleSectionLabel,
            googleItem,
            googlePath,
          );
          if (!suggestedPatch) {
            warnings.push(
              'Google item needs a display name and parseable price before it can be created.',
            );
          }
          items.push({
            googlePath,
            googleSectionLabel,
            googleItemName,
            targetKind,
            match: { status: 'unmatched', confidence: 'none' },
            suggestedPatch,
            warnings,
          });
          continue;
        }

        matchedLocalItemIds.add(`${targetKind}:${localItem.id}`);
        items.push({
          googlePath,
          googleSectionLabel,
          googleItemName,
          targetKind,
          match: {
            status: 'matched',
            confidence,
            localItemId: localItem.id,
            externalItemId: localItem.externalItemId,
          },
          suggestedPatch: isProjectedOptionItem
            ? null
            : buildSuggestedPatch(localItem, googleItem, googlePath),
          warnings,
        });
      }
    }
  }

  const localItemsMissingFromGoogle = localItemsForImport
    .filter((item) => !matchedLocalItemIds.has(`${item.targetKind}:${item.id}`))
    .map((item) => ({
      localItemId: item.id,
      externalItemId: item.externalItemId,
      itemName: item.itemName,
      targetKind: item.targetKind,
      reason: 'not_present_in_google' as const,
    }));

  for (const item of localItemsMissingFromGoogle) {
    items.push({
      googlePath: null,
      googleSectionLabel: null,
      googleItemName: item.itemName,
      targetKind: item.targetKind,
      match: {
        status: 'missing_from_google',
        confidence: 'none',
        localItemId: item.localItemId,
        externalItemId: item.externalItemId,
      },
      suggestedPatch: null,
      warnings: ['This local item was not present in the latest Google FoodMenus pull.'],
    });
  }

  return {
    items,
    localItemsMissingFromGoogle,
  };
}
