import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

import type { SupabaseClient } from '@supabase/supabase-js';

export function getRealtimeSupabaseClient(): SupabaseClient {
  return getSupabaseBrowserClient();
}
