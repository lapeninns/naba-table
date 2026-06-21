import type { GoogleBusinessProfileBusinessInfo } from './business-info';
import type { GoogleBusinessProfileAvailableLocation } from './client';

export type GoogleBusinessProfileConnectionState = {
  isConfigured: boolean;
  provider: 'google_business_profile';
  status: 'pending_auth' | 'authorized' | 'linked' | 'unlinked' | 'reauth_required' | 'sync_error';
  pushEnabled: boolean;
  connectedGoogleEmail: string | null;
  connectedGoogleName: string | null;
  externalAccountId: string | null;
  externalAccountName: string | null;
  externalLocationId: string | null;
  externalLocationName: string | null;
  externalLocationTitle: string | null;
  externalPlaceId: string | null;
  providerTimezone: string | null;
  lastPullAt: string | null;
  lastPushAt: string | null;
  lastError: string | null;
  availableLocations: GoogleBusinessProfileAvailableLocation[];
  businessInfo: GoogleBusinessProfileBusinessInfo;
};

export type LinkGoogleBusinessProfileLocationInput = {
  accountName: string;
  accountId: string;
  locationName: string;
  locationId: string;
};
