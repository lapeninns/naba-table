import { redirect } from 'next/navigation';

import { LandingPage } from '@/components/landing/LandingPage';
import { MarketingLayout } from '@/components/layouts/MarketingLayout';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { Metadata } from 'next';

const BRAND_NAME = 'Nab a Table';
const PRIMARY_REGION = 'Cambridgeshire, Norfolk and Bedfordshire';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `${BRAND_NAME} - Reserve your table in 30 seconds`,
  description: `Pick your time and party size, add a note, and get an instant confirmation at top restaurants across ${PRIMARY_REGION}. Free to book; no phone calls.`,
  openGraph: {
    title: `${BRAND_NAME} - Reserve your table in 30 seconds`,
    description: `Instant confirmations, live availability, and clear hold windows for every booking across ${PRIMARY_REGION}.`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@nabatable',
  },
  alternates: {
    canonical: 'https://nabatable.com',
  },
};

export default async function Home() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user);

  if (isAuthenticated) {
    redirect('/guest/dashboard');
  }

  return (
    <MarketingLayout showNavbar={false} showFooter={false}>
      <LandingPage isAuthenticated={isAuthenticated} />
    </MarketingLayout>
  );
}
