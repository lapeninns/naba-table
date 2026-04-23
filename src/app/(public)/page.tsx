import { redirect } from 'next/navigation';

import { LandingPage } from '@/components/landing/LandingPage';
import { MarketingLayout } from '@/components/layouts/MarketingLayout';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { Metadata } from 'next';

const BRAND_NAME = 'Nabatable';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `${BRAND_NAME} - The Packed House Pub System`,
  description:
    'Fill your tables, reduce no-shows, and run calmer food-led UK pub services with the Nabatable reservations and capacity growth system.',
  openGraph: {
    title: `${BRAND_NAME} - The Packed House Pub System`,
    description:
      'Automate reservations, reminders, floor planning, and service capacity for modern food-led UK pubs.',
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
