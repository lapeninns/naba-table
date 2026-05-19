export type RestaurantSetupProfileDetails = {
  name?: string | null;
  slug?: string | null;
  timezone?: string | null;
  contactPhone?: string | null;
};

export type ProfileSetupFieldKey = keyof RestaurantSetupProfileDetails;

export const PROFILE_SETUP_REQUIRED_FIELDS = [
  { key: 'name', label: 'restaurant name' },
  { key: 'slug', label: 'booking URL' },
  { key: 'timezone', label: 'timezone' },
  { key: 'contactPhone', label: 'public phone' },
] as const satisfies ReadonlyArray<{ key: ProfileSetupFieldKey; label: string }>;

function hasSetupValue(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function formatFieldList(values: readonly string[]): string {
  if (values.length <= 1) return values[0] ?? '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

export function getMissingProfileSetupFields(
  details: RestaurantSetupProfileDetails | null | undefined,
) {
  return PROFILE_SETUP_REQUIRED_FIELDS.filter((field) => !hasSetupValue(details?.[field.key]));
}

export function isProfileSetupComplete(
  details: RestaurantSetupProfileDetails | null | undefined,
): boolean {
  return getMissingProfileSetupFields(details).length === 0;
}

export function formatMissingProfileSetupFields(
  details: RestaurantSetupProfileDetails | null | undefined,
): string {
  const missing = getMissingProfileSetupFields(details).map((field) => field.label);
  if (missing.length === 0) {
    return 'Core public details are present.';
  }
  return `Add ${formatFieldList(missing)} before go-live.`;
}
