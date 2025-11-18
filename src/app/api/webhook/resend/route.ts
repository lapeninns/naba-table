// src/app/api/webhook/resend/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabaseClient } from "@/server/supabase";
import { recordObservabilityEvent } from "@/server/observability";

// This is a simplified representation. In a real app, you'd use the Resend SDK or a more robust verification method.
// For this example, we'll assume a simple shared secret check.
const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

type ResendWebhookEvent = {
  type:
    | "email.sent"
    | "email.delivered"
    | "email.delivery_delayed"
    | "email.complaint"
    | "email.bounced"
    | "email.opened"
    | "email.clicked";
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

export async function POST(req: NextRequest) {
  // 1. --- Webhook Security ---
  const signature = req.headers.get("authorization");
  if (`Bearer ${RESEND_WEBHOOK_SECRET}` !== signature) {
    console.warn("[webhook][resend] Invalid signature received");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const event = (await req.json()) as ResendWebhookEvent;
    const recipientEmail = event.data.to[0];

    if (!recipientEmail) {
      return NextResponse.json({ error: "No recipient email found" }, { status: 400 });
    }

    // 2. --- Handle Relevant Events ---
    switch (event.type) {
      case "email.bounced":
      case "email.complaint": {
        console.log(`[webhook][resend] Received ${event.type} for ${recipientEmail}`);

        const supabase = getServiceSupabaseClient();

        // Find the user profile by email (case-insensitive due to citext)
        const { data: profile, error } = await supabase
          .from("user_profiles")
          .select("id, is_email_suppressed")
          .eq("email", recipientEmail)
          .maybeSingle();

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

          console.log(`[webhook][resend] Suppression flag set for ${recipientEmail}`);
          await recordObservabilityEvent({
            source: "webhook.resend",
            eventType: "email_suppression.added",
            severity: "warning",
            context: {
              email: recipientEmail,
              reason: event.type,
            },
          });
        } else if (profile) {
          console.log(`[webhook][resend] Suppression flag already set for ${recipientEmail}`);
        } else {
          console.log(`[webhook][resend] No user profile found for email: ${recipientEmail}`);
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
