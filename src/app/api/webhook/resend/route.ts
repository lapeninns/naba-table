// src/app/api/webhook/resend/route.ts
import { NextResponse } from "next/server";
import { Resend, type WebhookEvent } from "resend";

import {
  recordEmailDeliveryLog,
  findLatestEmailDeliveryByMessageId,
  type EmailDeliveryStatus,
} from "@/server/emails/email-delivery-log";
import { recordObservabilityEvent } from "@/server/observability";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;
const resendWebhookVerifier = new Resend();

type ResendWebhookEvent = {
  type:
    | Extract<WebhookEvent, "email.sent">
    | Extract<WebhookEvent, "email.delivered">
    | Extract<WebhookEvent, "email.delivery_delayed">
    | Extract<WebhookEvent, "email.complained">
    | Extract<WebhookEvent, "email.bounced">
    | Extract<WebhookEvent, "email.opened">
    | Extract<WebhookEvent, "email.clicked">
    | Extract<WebhookEvent, "email.failed">
    | "email.complaint";
  created_at: string;
  data: {
    email_id: string;
    to: string[];
    // ... other fields depending on the event type
    bounce?: {
      type: string;
      message: string;
    };
  };
};

type UserProfileRow = {
  id: string;
  is_email_suppressed: boolean | null;
};

export async function POST(req: NextRequest) {
  // 1. --- Webhook Security ---
  if (!RESEND_WEBHOOK_SECRET) {
    console.error("[webhook][resend] RESEND_WEBHOOK_SECRET missing; refusing webhook");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const payload = await req.text();
  const svixId = req.headers.get("svix-id")?.trim();
  const svixTimestamp = req.headers.get("svix-timestamp")?.trim();
  const svixSignature = req.headers.get("svix-signature")?.trim();

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn("[webhook][resend] Missing svix verification headers");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const event = resendWebhookVerifier.webhooks.verify({
      payload,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      webhookSecret: RESEND_WEBHOOK_SECRET,
    }) as ResendWebhookEvent;

    const recipients = event.data.to ?? [];
    const primaryRecipient = recipients[0] ?? null;

    if (!primaryRecipient) {
      return NextResponse.json({ error: "No recipient email found" }, { status: 400 });
    }

    const statusMap: Partial<Record<ResendWebhookEvent["type"], EmailDeliveryStatus>> = {
      "email.sent": "sent",
      "email.delivered": "delivered",
      "email.delivery_delayed": "delivery_delayed",
      "email.complained": "complained",
      "email.complaint": "complained",
      "email.bounced": "bounced",
      "email.failed": "failed",
    };

    const mappedStatus = statusMap[event.type] ?? null;
    const occurredAt = event.created_at || new Date().toISOString();
    const errorDetails = event.data.bounce?.message ?? null;

    if (mappedStatus) {
      for (const recipientEmail of recipients) {
        const linkage = await findLatestEmailDeliveryByMessageId({
          messageId: event.data.email_id,
          recipientEmail,
        });

        await recordEmailDeliveryLog({
          bookingId: linkage?.bookingId ?? null,
          restaurantId: linkage?.restaurantId ?? null,
          emailType: linkage?.emailType ?? null,
          templateType: linkage?.templateType ?? null,
          recipientEmail,
          messageId: event.data.email_id,
          status: mappedStatus,
          provider: "resend",
          providerEventId: null,
          occurredAt,
          error: errorDetails,
          metadata: {
            eventType: event.type,
            // Do not include raw recipient email in metadata; it's already stored in the column.
          },
        });
      }
    }

    // 2. --- Handle Relevant Events ---
    switch (event.type) {
      case "email.bounced":
      case "email.complained":
      case "email.complaint": {
        const supabase = getServiceSupabaseClient();

        // Find the user profile by email (case-insensitive due to citext)
        const { data: profileData, error } = await supabase
          .from("user_profiles")
          .select("id, is_email_suppressed")
          .eq("email", primaryRecipient)
          .maybeSingle();

        const profile = profileData as UserProfileRow | null;

        if (error) {
          throw new Error(`Failed to query user_profiles: ${error.message}`);
        }

        if (profile && !profile.is_email_suppressed) {
          // 3. --- Update Suppression Flag ---
          const { error: updateError } = await supabase
            .from("user_profiles")
            .update({ is_email_suppressed: true, updated_at: new Date().toISOString() })
            .eq("id", profile.id);

          if (updateError) {
            throw new Error(`Failed to update suppression flag: ${updateError.message}`);
          }

          await recordObservabilityEvent({
            source: "webhook.resend",
            eventType: "email_suppression.added",
            severity: "warning",
            context: {
              reason: event.type,
            },
          });
        }
        break;
      }

      // Note: Resend doesn't have a native "unsubscribe" event via webhook in the same way.
      // This would typically be handled by a link in the email that directs to a page in your app,
      // which then calls an API to set the suppression flag. The 'List-Unsubscribe' header is also key.

      default:
        // console.log(`[webhook][resend] Received unhandled event type: ${event.type}`);
        break;
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.name === "WebhookVerificationError") {
      console.warn("[webhook][resend] Invalid signature received");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("[webhook][resend] Error processing webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await recordObservabilityEvent({
      source: "webhook.resend",
      eventType: "webhook.processing_failed",
      severity: "error",
      context: {
        error: errorMessage,
      },
    });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
