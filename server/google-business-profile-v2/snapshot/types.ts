/**
 * Phase 2 of the GBP Dual-Sync V2 architecture.
 *
 * Canonical V2 section values used by both Nabatable and Google snapshot
 * readers, and consumed by per-section diff adapters. Keeping a shared shape
 * for each section means each adapter only has to compare like-with-like and
 * the diff engine is dumb.
 *
 * These shapes are deliberately a small superset of the fields the V2 engine
 * cares about today. Adding a field here without teaching the section
 * adapters is a no-op for diff output.
 */

export interface SyncV2ProfileSectionValue {
  readonly name: string | null;
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

export interface SyncV2OperatingHoursDay {
  readonly dayOfWeek: number;
  readonly opensAt: string | null;
  readonly closesAt: string | null;
  readonly isClosed: boolean;
}

export interface SyncV2OperatingHoursSectionValue {
  readonly weekly: ReadonlyArray<SyncV2OperatingHoursDay>;
}

export interface SyncV2ServicePeriod {
  readonly stableKey: string;
  readonly name: string;
  readonly dayOfWeek: number | null;
  readonly startTime: string;
  readonly endTime: string;
  readonly bookingOption: string;
}

export interface SyncV2ServicePeriodsSectionValue {
  readonly periods: ReadonlyArray<SyncV2ServicePeriod>;
}

export interface SyncV2CategoryValue {
  readonly displayName: string;
  readonly categoryCode: string | null;
  readonly moreHoursTypes: ReadonlyArray<{
    readonly hoursTypeId: string | null;
    readonly displayName: string | null;
    readonly localizedDisplayName: string | null;
  }>;
  readonly isPrimary: boolean;
}

export interface SyncV2ServiceAreaValue {
  readonly displayName: string;
  readonly areaType: string;
  readonly regionCode: string | null;
  readonly placeData: Record<string, unknown> | null;
}

export interface SyncV2AttributeValue {
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

export interface SyncV2ServiceItemValue {
  readonly itemKey: string;
  readonly itemType: string | null;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly payload: Record<string, unknown> | null;
}

export interface SyncV2BusinessContextSectionValues {
  readonly categories: ReadonlyArray<SyncV2CategoryValue>;
  readonly serviceAreas: ReadonlyArray<SyncV2ServiceAreaValue>;
  readonly attributes: ReadonlyArray<SyncV2AttributeValue>;
  readonly serviceItems: ReadonlyArray<SyncV2ServiceItemValue>;
}

/**
 * Aggregated canonical-section values for one side. The diff engine consumes
 * one of these from each side and produces `SyncV2DiffItem[]`.
 */
export interface SyncV2CanonicalSnapshot {
  readonly profile: SyncV2ProfileSectionValue;
  readonly operatingHours: SyncV2OperatingHoursSectionValue;
  readonly servicePeriods: SyncV2ServicePeriodsSectionValue;
  readonly businessContext: SyncV2BusinessContextSectionValues;
}
