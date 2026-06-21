import { redirect } from 'next/navigation';

import { LandingPage } from '@/components/landing/LandingPage';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { Metadata } from 'next';

const BRAND_NAME = 'Nabatable';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `${BRAND_NAME} — The 'Packed House' Pub System | Fill Tables & Eradicate No-Shows`,
  description:
    'Stop chasing bookings and losing money to empty seats. Nabatable is the only all-in-one system that automates reservations, eliminates seating chaos, and guarantees calmer, more profitable services for food-led UK pubs.',
  openGraph: {
    title: `${BRAND_NAME} — Fill Your Tables & Eradicate No-Shows Without Lifting A Finger`,
    description:
      'The all-in-one reservations and capacity growth system for modern food-led UK pubs. Automated reminders, smart floor planning, and white-glove setup included.',
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

  return <LandingPage isAuthenticated={isAuthenticated} />;
}
