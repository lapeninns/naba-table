import { describe, expect, it, vi } from 'vitest';

const getSupabaseBrowserClient = vi.fn(() => ({ channel: vi.fn() }));

vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowserClient,
}));

describe('getRealtimeSupabaseClient', () => {
  it('reuses the shared browser client', async () => {
    const { getRealtimeSupabaseClient } = await import('@/lib/supabase/realtime-client');

    const client = getRealtimeSupabaseClient();

    expect(client).toBe(getSupabaseBrowserClient.mock.results[0]?.value);
    expect(getSupabaseBrowserClient).toHaveBeenCalledTimes(1);
  });
});
