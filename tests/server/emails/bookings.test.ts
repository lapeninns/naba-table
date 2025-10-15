import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.BASE_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_SITE_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role";

import { makeBookingRecord } from "@/tests/helpers/opsFactories";

const sendEmailMock = vi.fn();

vi.mock("@/libs/resend", () => ({
  sendEmail: sendEmailMock,
}));

vi.mock("@/server/supabase", () => ({
  getServiceSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: "rest-1",
              name: "Fictional Venue",
              timezone: "Europe/London",
              contact_email: "hello@fictionalvenue.com",
              contact_phone: "+44 20 7946 0998",
              address: "123 Example Street",
              booking_policy: "",
            },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/config", () => ({
  default: {
    email: { supportEmail: "support@sajiloreservex.com" },
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    app: { url: "http://localhost:3000" },
  },
}));

const emailsModule = await import("@/server/emails/bookings");
const {
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
  sendBookingUpdateEmail,
} = emailsModule;

const booking = makeBookingRecord({
  restaurant_id: "rest-1",
  customer_email: "alex@example.com",
  reference: "ABC123",
  start_at: "2025-01-10T18:00:00Z",
  end_at: "2025-01-10T20:00:00Z",
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("booking email templates", () => {
  it("sends confirmation email with ICS attachment for confirmed booking", async () => {
    await sendBookingConfirmationEmail(booking);

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const payload = sendEmailMock.mock.calls[0][0];
    expect(payload.to).toBe("alex@example.com");
    expect(payload.subject).toContain("reservation");
    expect(payload.attachments?.[0]?.filename).toContain("ABC123");
  });

  it("sends update notification email", async () => {
    await sendBookingUpdateEmail({ ...booking, status: "confirmed" });

    const payload = sendEmailMock.mock.calls[0][0];
    expect(payload.subject).toContain("updated");
  });

  it("sends cancellation email with calendar attachment", async () => {
    await sendBookingCancellationEmail({ ...booking, status: "cancelled" });

    const payload = sendEmailMock.mock.calls[0][0];
    expect(payload.subject).toContain("cancelled");
    expect(payload.attachments?.[0]?.filename).toContain("ABC123");
  });
});
