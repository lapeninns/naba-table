import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/libs/resend";
import { sendBookingConfirmationEmail } from "@/server/emails/bookings";
import type { BookingRecord } from "@/server/bookings";

const isProd = process.env.NODE_ENV === "production";
const accessToken = process.env.TEST_EMAIL_ACCESS_TOKEN ?? "";
const rateLimitWindowMs = 60_000;
const rateLimitMax = Number(process.env.TEST_EMAIL_RATE_LIMIT ?? "10");

const defaultOrigins = [
  process.env.NEXT_PUBLIC_SITE_URL,
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean) as string[];

const configuredOrigins = (process.env.TEST_EMAIL_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...configuredOrigins]))
  .map((value) => {
    try {
      return new URL(value).origin;
    } catch {
      return value.replace(/\/+$/, "");
    }
  })
  .filter(Boolean);

type RateRecord = { count: number; expiresAt: number };
const rateLimiter = new Map<string, RateRecord>();

function normalizeOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, "");
  }
}

function extractClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  if ("ip" in req) {
    const candidate = (req as NextRequest & { ip?: string | null }).ip;
    if (candidate) {
      return candidate;
    }
  }
  return "unknown";
}

function isOriginAllowed(req: NextRequest): boolean {
  if (!allowedOrigins.length) {
    return !isProd;
  }

  const originCandidates = [
    normalizeOrigin(req.headers.get("origin")),
    normalizeOrigin(req.headers.get("referer")),
  ].filter(Boolean) as string[];

  if (!originCandidates.length) {
    return !isProd;
  }

  return originCandidates.some((candidate) => allowedOrigins.includes(candidate));
}

function extractToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const headerToken = req.headers.get("x-test-email-token");
  return headerToken ? headerToken.trim() : null;
}

function hitRateLimit(key: string): boolean {
  const now = Date.now();
  const record = rateLimiter.get(key);

  if (!record || record.expiresAt <= now) {
    rateLimiter.set(key, { count: 1, expiresAt: now + rateLimitWindowMs });
    return false;
  }

  if (record.count + 1 > rateLimitMax) {
    return true;
  }

  record.count += 1;
  rateLimiter.set(key, record);
  return false;
}

function guardRequest(req: NextRequest): NextResponse | null {
  if (!isOriginAllowed(req)) {
    return NextResponse.json({ error: "Origin not permitted" }, { status: 403 });
  }

  if (accessToken) {
    const token = extractToken(req);
    if (!token || token !== accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (isProd) {
    return NextResponse.json({ error: "Endpoint disabled" }, { status: 403 });
  }

  if (isProd) {
    const ip = extractClientIp(req);
    if (hitRateLimit(ip)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  const guard = guardRequest(req);
  if (guard) return guard;

  try {
    const { type, email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    if (type === "simple") {
      // Test simple email sending
      await sendEmail({
        to: email,
        subject: "Test Email from SajiloReserveX",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h1>Test Email</h1>
            <p>This is a test email to verify that Resend is configured correctly.</p>
            <p>If you receive this email, the integration is working!</p>
            <p>Sent at: ${new Date().toISOString()}</p>
          </div>
        `,
        text: `Test Email\n\nThis is a test email to verify that Resend is configured correctly.\n\nIf you receive this email, the integration is working!\n\nSent at: ${new Date().toISOString()}`,
      });

      return NextResponse.json({
        success: true,
        message: "Simple test email sent successfully",
      });
    } else if (type === "booking") {
      // Test booking confirmation email with mock data
      const mockBooking: BookingRecord = {
        id: "test-booking-id",
        customer_id: "test-customer-id",
        reference: "TEST123",
        restaurant_id: "mock-restaurant-id",
        table_id: "mock-table-id",
        booking_date: "2025-09-25",
        start_time: "19:00",
        end_time: "21:00",
        party_size: 2,
        booking_type: "dinner",
        seating_preference: "any",
        status: "confirmed",
        customer_name: "Test Customer",
        customer_email: email,
        customer_phone: "+1234567890",
        notes: "Test booking for email verification",
        marketing_opt_in: false,
        loyalty_points_awarded: 0,
        source: "test",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await sendBookingConfirmationEmail(mockBooking);

      return NextResponse.json({
        success: true,
        message: "Booking confirmation test email sent successfully",
        bookingReference: mockBooking.reference,
      });
    }

    return NextResponse.json(
      { error: "Invalid type. Use 'simple' or 'booking'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[test-email] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to send test email",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const guard = guardRequest(req);
  if (guard) return guard;

  return NextResponse.json({
    message: "Email test endpoint",
    usage: {
      method: "POST",
      body: {
        type: "'simple' | 'booking'",
        email: "recipient@example.com",
      },
    },
    examples: [
      {
        description: "Send simple test email",
        body: {
          type: "simple",
          email: "test@example.com",
        },
      },
      {
        description: "Send booking confirmation test email",
        body: {
          type: "booking",
          email: "test@example.com",
        },
      },
    ],
  });
}
