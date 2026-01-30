import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

const realtimeChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
};

const realtimeClient = {
  channel: vi.fn(() => realtimeChannel),
  removeChannel: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
};

vi.mock("@/lib/supabase/realtime-client", () => {
  return {
    getRealtimeSupabaseClient: () => {
      realtimeChannel.subscribe.mockImplementation((cb?: (status: string) => void) => {
        cb?.("SUBSCRIBED");
        return undefined;
      });
      return realtimeClient;
    },
  };
});
