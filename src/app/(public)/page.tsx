import {
  HomeCTASection,
  HomeHeroSection,
  HomeJourneySection,
  HomeMetricsSection,
} from '@/components/landing/HomeSections';
import { MarketingLayout } from '@/components/layouts/MarketingLayout';

import type { Metadata } from 'next';

const BRAND_NAME = 'Nab a Table';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `${BRAND_NAME} - UK's Best Last Minute Reservations`,
  description: 'Skip the weeks of waiting. We monitor top pubs, gastros, and Michelin-star venues across the UK to notify you the second a table opens up.',
  openGraph: {
    title: `${BRAND_NAME} - UK's Best Last Minute Reservations`,
    description: 'The hottest tables in the UK, nabbed instantly.',
    type: 'website',
  },
};

export default function Home() {
  return (
    <MarketingLayout>
      <HomeHeroSection />
      <HomeMetricsSection />
      <HomeJourneySection />
      <HomeCTASection />
    </MarketingLayout>
  );
}
