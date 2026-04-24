import { getServerComponentSupabaseClient } from '@/server/supabase';

export type GuestAuthState = {
  isAuthenticated: boolean;
};

export async function getGuestAuthState(): Promise<GuestAuthState> {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return {
    isAuthenticated: Boolean(user && !error),
  };
}
