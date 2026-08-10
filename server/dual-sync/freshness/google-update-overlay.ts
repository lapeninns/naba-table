const KNOWN_LOCATION_ROOTS = new Set([
  'attributes',
  'categories',
  'moreHours',
  'phoneNumbers',
  'profile',
  'regularHours',
  'serviceArea',
  'serviceItems',
  'specialHours',
  'storefrontAddress',
  'title',
]);

type GoogleUpdateMaskSet = {
  readonly diffMasks: readonly string[];
  readonly pendingMasks: readonly string[];
  readonly unknownPaths?: readonly string[];
};

export type GoogleUpdateOverlayInput = {
  readonly location: GoogleUpdateMaskSet;
  readonly attributes: GoogleUpdateMaskSet;
};

export type GoogleUpdateOverlay =
  | {
      readonly state: 'actionable';
      readonly updateMasks: readonly string[];
      readonly displayOnlyPaths: readonly [];
    }
  | {
      readonly state: 'display_only';
      readonly updateMasks: readonly [];
      readonly displayOnlyPaths: readonly string[];
    };

function overlaps(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}.`) || right.startsWith(`${left}.`);
}

export function buildGoogleUpdateOverlay(input: GoogleUpdateOverlayInput): GoogleUpdateOverlay {
  const paths = [
    ...new Set([
      ...input.location.diffMasks,
      ...input.location.pendingMasks,
      ...(input.location.unknownPaths ?? []),
      ...input.attributes.diffMasks,
      ...input.attributes.pendingMasks,
      ...(input.attributes.unknownPaths ?? []),
    ]),
  ].sort();
  const containsUnknown = paths.some((path) => !KNOWN_LOCATION_ROOTS.has(path.split('.')[0] ?? ''));
  const containsPrefixConflict = paths.some((path, index) =>
    paths.slice(index + 1).some((other) => overlaps(path, other)),
  );
  if (containsUnknown || containsPrefixConflict) {
    return { state: 'display_only', updateMasks: [], displayOnlyPaths: paths };
  }
  return { state: 'actionable', updateMasks: paths, displayOnlyPaths: [] };
}
