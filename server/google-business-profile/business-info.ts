import { buildCanonicalRows } from './businessInfoCanonicalRows';
import { buildFieldSyncStatuses } from './businessInfoFieldSyncStatus';
import { humanizeIdentifier } from './businessInfoLabelNormalization';
import { pickGooglePlaceId } from './businessInfoPlaceNormalization';
import { combineFieldVerifications } from './businessInfoReadModel';
import { normalizeGoogleDate, normalizeGoogleTime } from './businessInfoScheduleNormalization';
import {
  insertProfileChangeLogRows,
  linkAttributeDefinitions,
  replaceProviderFieldSyncStatuses,
  upsertBusinessDetails,
} from './businessInfoSyncPersistence';

export type {
  GoogleBusinessProfileBusinessInfo,
  GoogleBusinessProfileFieldVerification,
} from './businessInfoReadModel';
export { readGoogleBusinessProfileBusinessInfo } from './businessInfoReadPersistence';
export { syncGoogleBusinessProfileCanonicalBusinessInfo } from './businessInfoSyncOrchestration';

export const businessInfoTestUtils = {
  buildCanonicalRows,
  buildFieldSyncStatuses,
  combineFieldVerifications,
  humanizeIdentifier,
  linkAttributeDefinitions,
  normalizeGoogleDate,
  normalizeGoogleTime,
  pickGooglePlaceId,
  replaceProviderFieldSyncStatuses,
  insertProfileChangeLogRows,
  upsertBusinessDetails,
};
