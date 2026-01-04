import { redirect } from 'next/navigation';

import { RoleSelectionPage } from '@/components/auth/RoleSelectionPage';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In or Book a Table - Nab a Table',
  description: 'Choose your path: Book a table as a guest or manage your restaurant as an owner.',
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = 'force-dynamic';

export default async function AuthPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user);

  // Redirect authenticated users to their appropriate dashboard
  if (isAuthenticated && user) {
    // Check user metadata for role preference
    const userRole = user.user_metadata?.role as string | undefined;

    if (userRole === 'owner') {
      redirect('/app');
    } else if (userRole === 'admin') {
      redirect('/app');
    } else {
      // Default to guest dashboard if role is 'guest' or undefined
      redirect('/guest/dashboard');
    }
  }

  // Show role selection page for unauthenticated users
  return <RoleSelectionPage />;
}
