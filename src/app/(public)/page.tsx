import {
  HomeCTASection,
  HomeHeroSection,
  HomeJourneySection,
  HomeMetricsSection,
  HomeTrustedSection,
  HomeReceiptsSection,
} from '@/components/landing/HomeSections';
import { MarketingLayout } from '@/components/layouts/MarketingLayout';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { Metadata } from 'next';

const BRAND_NAME = 'Nab a Table';
const PRIMARY_REGION = 'Cambridgeshire, Norfolk and Bedfordshire';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `${BRAND_NAME} - Book great restaurants in seconds`,
  description: `Search curated restaurants across ${PRIMARY_REGION}, see live openings, and confirm your table in a few simple steps.`,
  openGraph: {
    title: `${BRAND_NAME} - Book great restaurants in seconds`,
    description: `Search curated restaurants across ${PRIMARY_REGION}, see live openings, and confirm your table in a few simple steps with Nab a Table.`,
    type: 'website',
  },
};

export default async function Home() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user);

  return (
    <MarketingLayout>
      <HomeHeroSection isAuthenticated={isAuthenticated} />
      <HomeMetricsSection />
      <HomeTrustedSection />
      <HomeJourneySection />
      <HomeReceiptsSection />
      <HomeCTASection />
    </MarketingLayout>
  );
}
