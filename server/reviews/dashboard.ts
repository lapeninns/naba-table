import 'server-only';

import { z } from 'zod';

import { getServiceSupabaseClient } from '@/server/supabase';

import type { ReviewGrowthRange, ReviewGrowthSummary } from '@/types/reviewGrowth';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const channelSchema = z.object({
  sent: z.number().int().nonnegative(),
  delivered: z.number().int().nonnegative(),
  read: z.number().int().nonnegative(),
  opened: z.number().int().nonnegative(),
  clicked: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  costMicrounits: z.number().nonnegative(),
  costCurrency: z.string().length(3).nullable(),
});

const summarySchema = z.object({
  from: z.iso.datetime({ offset: true }),
  to: z.iso.datetime({ offset: true }),
  completedVisits: z.number().int().nonnegative(),
  eligible: z.number().int().nonnegative(),
  suppressed: z.number().int().nonnegative(),
  sent: z.number().int().nonnegative(),
  reached: z.number().int().nonnegative(),
  clicked: z.number().int().nonnegative(),
  newGoogleReviews: z.number().int().nonnegative(),
  channels: z.object({ whatsapp: channelSchema.optional(), email: channelSchema.optional() }),
});

export class ReviewGrowthTrackingUnavailableError extends Error {
  constructor() {
    super('Review growth tracking is unavailable.');
    this.name = 'ReviewGrowthTrackingUnavailableError';
  }
}

export async function getReviewGrowthDashboard(
  input: { restaurantId: string; range: ReviewGrowthRange; now?: Date },
  client: Pick<SupabaseClient<Database>, 'rpc'> = getServiceSupabaseClient(),
): Promise<ReviewGrowthSummary> {
  const now = input.now ?? new Date();
  const from = new Date(now.getTime() - (input.range === '30d' ? 30 : 7) * 86_400_000);
  const { data, error } = await client.rpc('get_review_growth_dashboard_v1', {
    p_from: from.toISOString(),
    p_restaurant_id: input.restaurantId,
    p_to: now.toISOString(),
  });
  if (error) throw new ReviewGrowthTrackingUnavailableError();
  const parsed = summarySchema.safeParse(data);
  if (!parsed.success) throw new ReviewGrowthTrackingUnavailableError();
  return parsed.data;
}
