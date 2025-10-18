import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function getRealtimeSupabaseClient(): SupabaseClient {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error("Supabase realtime client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }

    browserClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 2,
        },
      },
    });
  }

  return browserClient;
}
