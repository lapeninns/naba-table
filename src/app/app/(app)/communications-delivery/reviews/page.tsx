import { ReviewGrowthClient } from '@/components/features/review-growth/ReviewGrowthClient';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Communications Delivery · Review Growth · Nab a Table Ops',
  description: 'Post-visit review funnel, channel comparison, and Google review outcomes.',
};

export default function ReviewGrowthPage() {
  return <ReviewGrowthClient />;
}
