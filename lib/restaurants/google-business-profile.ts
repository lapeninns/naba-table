export type RestaurantGoogleBusinessProfileLocationOption = {
  accountId: string;
  accountName: string;
  locationId: string;
  locationName: string;
  title: string;
  addressText: string | null;
  primaryPhone: string | null;
  websiteUri: string | null;
  mapsUri: string | null;
  reviewUri: string | null;
  matchScore: number;
};

export type RestaurantGoogleBusinessProfileReviewSnippet = {
  reviewId: string;
  starRating: string | null;
  comment: string | null;
  reviewerDisplayName: string | null;
  createTime: string | null;
  updateTime: string | null;
};

export type RestaurantGoogleBusinessProfileMediaItem = {
  name: string;
  category: string | null;
  format: string | null;
  sourceUrl: string | null;
  googleUrl: string | null;
  thumbnailUrl: string | null;
  description: string | null;
};

export type RestaurantGoogleBusinessProfileMetricSummary = {
  metric: string;
  total: number;
  startDate: string;
  endDate: string;
};

export type RestaurantGoogleBusinessProfileNormalized = {
  title: string;
  description: string | null;
  primaryCategory: string | null;
  additionalCategories: string[];
  addressText: string | null;
  locality: string | null;
  regionCode: string | null;
  postalCode: string | null;
  primaryPhone: string | null;
  additionalPhones: string[];
  websiteUri: string | null;
  mapsUri: string | null;
  reviewUri: string | null;
  regularHoursSummary: string[];
  specialHoursSummary: string[];
  attributeLabels: string[];
  rating: number | null;
  reviewCount: number | null;
  reviewSnippets: RestaurantGoogleBusinessProfileReviewSnippet[];
  media: RestaurantGoogleBusinessProfileMediaItem[];
  metrics30d: RestaurantGoogleBusinessProfileMetricSummary[];
};

export type RestaurantGoogleBusinessProfileSyncStatus = 'idle' | 'success' | 'failed';

export type RestaurantGoogleBusinessProfileConnectionStatus =
  | 'disconnected'
  | 'connected'
  | 'needs_location'
  | 'synced'
  | 'error';

export type RestaurantGoogleBusinessProfileConnection = {
  connected: boolean;
  status: RestaurantGoogleBusinessProfileConnectionStatus;
  accountId: string | null;
  accountName: string | null;
  locationId: string | null;
  locationName: string | null;
  locationTitle: string | null;
  availableLocations: RestaurantGoogleBusinessProfileLocationOption[];
  oauthConnectedAt: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: RestaurantGoogleBusinessProfileSyncStatus | null;
  lastSyncError: string | null;
  normalizedProfile: RestaurantGoogleBusinessProfileNormalized | null;
};
