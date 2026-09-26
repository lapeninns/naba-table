import type { BusinessContextFamilyPayloadState, DirtyState } from '../businessContextModel';

/**
 * "We serve customers at their location" is stored and saved with Business status (the business
 * details request writes status, opening date and this flag together), but staff edit it in
 * Where you serve, beside the list of areas it relates to. These helpers keep the page's
 * "Edited" markers, review groups and save step names on the section staff actually used.
 */

type Drafts = Pick<BusinessContextFamilyPayloadState, 'businessDetails'>;

export function isServiceLocationChanged(saved: Drafts, draft: Drafts): boolean {
  return (
    saved.businessDetails.isServiceAreaBusiness !== draft.businessDetails.isServiceAreaBusiness
  );
}

/** Business status or opening date changed (the parts still shown under Business status). */
export function isBusinessStatusChanged(saved: Drafts, draft: Drafts): boolean {
  return (
    saved.businessDetails.businessStatus !== draft.businessDetails.businessStatus ||
    saved.businessDetails.openingDate !== draft.businessDetails.openingDate
  );
}

/** Which sections show "Edited": the switch marks Where you serve, not Business status. */
export function getDiscoveryDisplayDirtyState(
  dirty: DirtyState,
  saved: Drafts,
  draft: Drafts,
): DirtyState {
  if (!isServiceLocationChanged(saved, draft)) {
    return dirty;
  }
  return {
    ...dirty,
    businessDetails: dirty.businessDetails && isBusinessStatusChanged(saved, draft),
    serviceAreas: true,
  };
}

/**
 * Only the service-location switch changed in business details. Save then writes business
 * details inside the Where you serve step, so staff see one step for the one section they edited.
 */
export function isOnlyServiceLocationChanged(saved: Drafts, draft: Drafts): boolean {
  return isServiceLocationChanged(saved, draft) && !isBusinessStatusChanged(saved, draft);
}
