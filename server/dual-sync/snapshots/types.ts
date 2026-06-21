/**
 * Phase 1 of the unified dual-sync engine.
 *
 * Canonical section value shapes used by snapshot readers and consumed by
 * registry capability resolution. Mirrors the V2 `SyncV2*SectionValue`
 * shapes today; owned by the dual-sync namespace going forward.
 */

export interface DualSyncProfileSectionValue {
  readonly name: string | null;
  readonly businessDescription: string | null;
  readonly contactPhone: string | null;
  readonly address: string | null;
  readonly storefrontAddress: {
    readonly addressLines: ReadonlyArray<string>;
    readonly locality: string | null;
    readonly administrativeArea: string | null;
    readonly postalCode: string | null;
    readonly regionCode: string | null;
    readonly languageCode: string | null;
    readonly sublocality: string | null;
    readonly organization: string | null;
    readonly recipients: ReadonlyArray<string>;
  } | null;
  readonly googleMapUrl: string | null;
  readonly googleReviewUrl: string | null;
}

export interface DualSyncOperatingHoursDay {
  readonly dayOfWeek: number;
  readonly opensAt: string | null;
  readonly closesAt: string | null;
  readonly isClosed: boolean;
}

export interface DualSyncOperatingHoursSectionValue {
  readonly weekly: ReadonlyArray<DualSyncOperatingHoursDay>;
}

export interface DualSyncServicePeriod {
  readonly stableKey: string;
  readonly name: string;
  readonly dayOfWeek: number | null;
  readonly startTime: string;
  readonly endTime: string;
  readonly bookingOption: string;
}

export interface DualSyncServicePeriodsSectionValue {
  readonly periods: ReadonlyArray<DualSyncServicePeriod>;
}

export interface DualSyncCategoryValue {
  readonly displayName: string;
  readonly categoryCode: string | null;
  readonly moreHoursTypes: ReadonlyArray<{
    readonly hoursTypeId: string | null;
    readonly displayName: string | null;
    readonly localizedDisplayName: string | null;
  }>;
  readonly isPrimary: boolean;
}

export interface DualSyncServiceAreaValue {
  readonly displayName: string;
  readonly areaType: string;
  readonly regionCode: string | null;
  readonly placeData: Record<string, unknown> | null;
}

export interface DualSyncAttributeValue {
  readonly attributeKey: string;
  readonly attributeName: string | null;
  readonly attributeId: string | null;
  readonly valueType: string;
  readonly boolValue: boolean | null;
  readonly textValue: string | null;
  readonly uriValue: string | null;
  readonly uriValues: ReadonlyArray<string>;
  readonly enumValues: ReadonlyArray<string>;
  readonly unsetEnumValues: ReadonlyArray<string>;
}

export interface DualSyncServiceItemValue {
  readonly itemKey: string;
  readonly itemType: string | null;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly payload: Record<string, unknown> | null;
}

export interface DualSyncBusinessContextSectionValues {
  readonly categories: ReadonlyArray<DualSyncCategoryValue>;
  readonly serviceAreas: ReadonlyArray<DualSyncServiceAreaValue>;
  readonly attributes: ReadonlyArray<DualSyncAttributeValue>;
  readonly serviceItems: ReadonlyArray<DualSyncServiceItemValue>;
}

export interface DualSyncFoodMenuItemValue {
  readonly stableKey: string;
  readonly itemName: string;
  readonly sectionLabel: string;
  readonly description: string | null;
  readonly basePrice: number | null;
  readonly currency: string | null;
  readonly dietaryTags: ReadonlyArray<string>;
  readonly allergensContains: ReadonlyArray<string>;
  readonly googlePath: string | null;
}

export interface DualSyncFoodMenusSectionValue {
  readonly items: ReadonlyArray<DualSyncFoodMenuItemValue>;
}

export interface DualSyncCanonicalSnapshot {
  readonly profile: DualSyncProfileSectionValue;
  readonly operatingHours: DualSyncOperatingHoursSectionValue;
  readonly servicePeriods: DualSyncServicePeriodsSectionValue;
  readonly businessContext: DualSyncBusinessContextSectionValues;
  readonly foodMenus?: DualSyncFoodMenusSectionValue;
}
