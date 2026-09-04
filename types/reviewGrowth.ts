export type ReviewGrowthRange = '7d' | '30d';

export type ReviewGrowthChannelMetrics = {
  sent: number;
  delivered: number;
  read: number;
  opened: number;
  clicked: number;
  failed: number;
  costMicrounits: number;
  costCurrency: string | null;
};

export type ReviewGrowthSummary = {
  from: string;
  to: string;
  completedVisits: number;
  eligible: number;
  suppressed: number;
  sent: number;
  reached: number;
  clicked: number;
  newGoogleReviews: number;
  channels: Partial<Record<'whatsapp' | 'email', ReviewGrowthChannelMetrics>>;
};

export type ReviewGrowthSummaryResponse =
  | {
      ok: true;
      restaurantId: string;
      range: ReviewGrowthRange;
      summary: ReviewGrowthSummary;
    }
  | {
      ok: false;
      code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'TRACKING_UNAVAILABLE' | 'INTERNAL';
      error: string;
      message?: string;
    };
