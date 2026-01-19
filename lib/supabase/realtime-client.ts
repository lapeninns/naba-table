import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

function reconnectAfterMs(tries: number): number {
  const intervals = [1000, 2000, 5000, 10000];
  return intervals[tries - 1] ?? 10000;
}

export function getRealtimeSupabaseClient(): SupabaseClient {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error(
        'Supabase realtime client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY',
      );
    }

    browserClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
        heartbeatIntervalMs: 15000,
        reconnectAfterMs,
        worker: typeof window !== 'undefined' && typeof Worker !== 'undefined',
      },
    });
  }

  return browserClient;
}
