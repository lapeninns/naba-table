import type { FamilyKey } from '../businessContextModel';

/** Sections the Google comparison covers. Business status and links are not compared. */
export const GOOGLE_COMPARED_FAMILIES: ReadonlySet<FamilyKey> = new Set<FamilyKey>([
  'categories',
  'attributes',
  'serviceItems',
  'serviceAreas',
]);

const DIFFERENCE_UNITS: Record<FamilyKey, { singular: string; plural: string }> = {
  businessDetails: { singular: 'detail', plural: 'details' },
  links: { singular: 'link', plural: 'links' },
  categories: { singular: 'category', plural: 'categories' },
  attributes: { singular: 'amenity', plural: 'amenities' },
  serviceItems: { singular: 'service', plural: 'services' },
  serviceAreas: { singular: 'area', plural: 'areas' },
};

/** How many differing items are named in the status line before "and N more". */
const NAMED_DIFFERENCES = 3;

export type DiscoveryGoogleStatus =
  | { kind: 'prefilled'; text: string; detail: string }
  | { kind: 'differs'; text: string; count: number }
  | { kind: 'matches'; text: string }
  | { kind: 'checking'; text: string }
  | { kind: 'not-compared'; text: string; canLink: boolean };

export type DiscoveryGoogleStatusInput = {
  family: FamilyKey;
  /** The section was filled from Google's snapshot because nothing is saved yet. */
  prefilled: boolean;
  googleLinked: boolean;
  driftLoading: boolean;
  /** Labels of the fields where Google differs from the saved values. */
  differingLabels: readonly string[];
};

function formatDifferences(family: FamilyKey, labels: readonly string[]): string {
  const unit = DIFFERENCE_UNITS[family];
  const count = labels.length;
  const noun = count === 1 ? unit.singular : unit.plural;
  const named = labels.slice(0, NAMED_DIFFERENCES).join(', ');
  const more = count > NAMED_DIFFERENCES ? ` and ${count - NAMED_DIFFERENCES} more` : '';
  return `Google differs on ${count} ${noun} (${named}${more}).`;
}

/** The Google line at the top of each Discovery section. */
export function formatDiscoveryGoogleStatus({
  family,
  prefilled,
  googleLinked,
  driftLoading,
  differingLabels,
}: DiscoveryGoogleStatusInput): DiscoveryGoogleStatus {
  if (prefilled) {
    return {
      kind: 'prefilled',
      text: 'Pre-filled from Google. Not saved yet.',
      detail: 'Save to keep these values, or edit them first.',
    };
  }
  if (!GOOGLE_COMPARED_FAMILIES.has(family)) {
    return { kind: 'not-compared', text: 'Not compared with Google.', canLink: false };
  }
  if (!googleLinked) {
    return {
      kind: 'not-compared',
      text: 'Not compared with Google. Google Business Profile isn’t linked.',
      canLink: true,
    };
  }
  if (driftLoading) {
    return { kind: 'checking', text: 'Comparing with Google…' };
  }
  if (differingLabels.length > 0) {
    return {
      kind: 'differs',
      text: formatDifferences(family, differingLabels),
      count: differingLabels.length,
    };
  }
  return { kind: 'matches', text: 'Matches Google' };
}
