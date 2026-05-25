export type GoogleBusinessProfileGoogleUpdateMask =
  | 'title'
  | 'phoneNumbers'
  | 'regularHours'
  | 'specialHours'
  | 'moreHours';

const GOOGLE_UPDATE_MASKS: readonly GoogleBusinessProfileGoogleUpdateMask[] = [
  'title',
  'phoneNumbers',
  'regularHours',
  'specialHours',
  'moreHours',
];

type GoogleUpdateMaskSelectionInput = {
  profileFields?: readonly string[];
  weeklyDays?: readonly number[];
  overrideDates?: readonly string[];
  includesServicePeriods?: boolean;
};

export function normalizeGoogleMasks(
  value: string[] | null | undefined,
): GoogleBusinessProfileGoogleUpdateMask[] {
  const allowed = new Set<GoogleBusinessProfileGoogleUpdateMask>(GOOGLE_UPDATE_MASKS);

  return [...new Set(value ?? [])].filter((mask): mask is GoogleBusinessProfileGoogleUpdateMask =>
    allowed.has(mask as GoogleBusinessProfileGoogleUpdateMask),
  );
}

export function buildGoogleUpdateMasksForSelections(
  input: GoogleUpdateMaskSelectionInput,
): GoogleBusinessProfileGoogleUpdateMask[] {
  const masks = new Set<GoogleBusinessProfileGoogleUpdateMask>();
  const profileFields = input.profileFields ?? [];

  if (profileFields.includes('name')) {
    masks.add('title');
  }
  if (profileFields.includes('contactPhone')) {
    masks.add('phoneNumbers');
  }
  if (input.weeklyDays && input.weeklyDays.length > 0) {
    masks.add('regularHours');
  }
  if (input.overrideDates && input.overrideDates.length > 0) {
    masks.add('specialHours');
  }
  if (input.includesServicePeriods) {
    masks.add('moreHours');
  }

  return [...masks];
}
