import type { GoogleBusinessProfileAvailableLocation } from './client';
import type { GoogleBusinessProfileConnectionState } from './serviceConnectionStateTypes';

export type GoogleBusinessProfileFieldDiff = {
  field: 'name' | 'contactPhone' | 'address' | 'googleMapUrl' | 'googleReviewUrl';
  label: string;
  localValue: string | null;
  googleValue: string | null;
  status: 'matches' | 'different' | 'missing_google' | 'missing_local' | 'unavailable';
  suggestion: string | null;
};

export type GoogleBusinessProfileBusinessDetailsStatus = {
  connection: {
    isConfigured: boolean;
    provider: 'google_business_profile';
    status: 'not_connected' | 'connected' | 'pending_auth' | 'needs_reauth' | 'sync_failed';
    rawStatus: GoogleBusinessProfileConnectionState['status'];
    connectedGoogleEmail: string | null;
    connectedGoogleName: string | null;
    lastError: string | null;
  };
  selectedLocation: {
    accountId: string | null;
    accountName: string | null;
    locationId: string | null;
    locationName: string | null;
    title: string | null;
    address: string | null;
    phone: string | null;
    websiteUri: string | null;
    primaryCategory: string | null;
    placeId: string | null;
    mapsUri: string | null;
    newReviewUri: string | null;
  } | null;
  lastSync: {
    pulledAt: string | null;
    pushedAt: string | null;
  };
  fieldDiffs: GoogleBusinessProfileFieldDiff[];
  availableLocations: GoogleBusinessProfileAvailableLocation[];
};
