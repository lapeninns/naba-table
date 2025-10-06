import { NextResponse, NextRequest } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";

import configFile from "@/config";
import { env } from "@/lib/env";
import { findCheckoutSession, getStripeClient } from "@/libs/stripe";
import { getServiceSupabaseClient } from "@/server/supabase";
import { recordObservabilityEvent } from "@/server/observability";
import type { Json, TablesInsert } from "@/types/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const webhookSecret = env.stripe.webhookSecret;

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function readLegacyPriceId(lineItem: Stripe.InvoiceLineItem): string | undefined {
  const candidate = (lineItem as Stripe.InvoiceLineItem & { price_id?: unknown }).price_id;
  return typeof candidate === "string" ? candidate : undefined;
}

function readExpandedPriceId(lineItem: Stripe.InvoiceLineItem | undefined): string | undefined {
  if (!lineItem) return undefined;
  const candidate = (lineItem as Stripe.InvoiceLineItem & { price?: Stripe.Price | null }).price;
  if (!candidate || typeof candidate !== "object") return undefined;
  return typeof candidate.id === "string" ? candidate.id : undefined;
}

function resolveCustomerId(
  value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && "id" in value && typeof value.id === "string") {
    return value.id;
  }

  return null;
}

export async function POST(req: NextRequest) {
  const secret = webhookSecret;
  if (!secret) {
    return NextResponse.json({ error: "Missing Stripe webhook secret" }, { status: 500 });
  }

  let stripe: Stripe;
  try {
    stripe = getStripeClient();
  } catch (error) {
    console.error("[stripe][webhook] Stripe client initialisation failed", error);
    return NextResponse.json({ error: "Missing Stripe configuration" }, { status: 500 });
  }

  const rawBody = await req.text();
  const headerList = await headers();
  const signature = headerList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const verifiedSignature = signature;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, verifiedSignature, secret);
  } catch (err) {
    console.error("[stripe][webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let supabase: ReturnType<typeof getServiceSupabaseClient>;
  try {
    supabase = getServiceSupabaseClient();
  } catch (error) {
    console.error("[stripe][webhook] Supabase client initialisation failed", error);
    return NextResponse.json({ error: "Missing Supabase configuration" }, { status: 500 });
  }

  const db = supabase as any;

  const eventId = event.id;
  const serializedEvent = JSON.parse(JSON.stringify(event)) as Json;

  const { data: existingEvent, error: lookupError } = await db
    .from("stripe_events")
    .select("id,status")
    .eq("event_id", eventId)
    .maybeSingle();

  if (lookupError && lookupError.code !== "PGRST116") {
    console.error("[stripe][webhook] Failed to lookup existing event", lookupError);
    return NextResponse.json({ error: "Event lookup failed" }, { status: 500 });
  }

  if (existingEvent) {
    void recordObservabilityEvent({
      source: "api.stripe-webhook",
      eventType: "stripe.event.duplicate",
      severity: "warning",
      context: { eventId, eventType: event.type },
    });
    return NextResponse.json({ received: true, duplicate: true });
  }

  const eventRow: TablesInsert<"stripe_events"> = {
    event_id: eventId,
    event_type: event.type,
    payload: serializedEvent,
  };

  const insertResult = await db
    .from("stripe_events")
    .insert(eventRow)
    .select("id")
    .single();

  if (insertResult.error) {
    void recordObservabilityEvent({
      source: "api.stripe-webhook",
      eventType: "stripe.event.persistence_failed",
      severity: "error",
      context: {
        eventId,
        eventType: event.type,
        message: insertResult.error.message,
      },
    });
    if (insertResult.error.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[stripe][webhook] Failed to persist Stripe event", stringifyError(insertResult.error));
    return NextResponse.json({ error: "Event persistence failed" }, { status: 500 });
  }

  const eventRowId = insertResult.data?.id ?? null;
  let processingStatus: "processed" | "ignored" | "failed" = "ignored";

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const stripeObject: Stripe.Checkout.Session = event.data.object as Stripe.Checkout.Session;
        const session = await findCheckoutSession(stripeObject.id);

        const customerId = resolveCustomerId(session?.customer);
        const priceId = session?.line_items?.data[0]?.price?.id;
        const userId = stripeObject.client_reference_id;
        const plan = configFile.stripe.plans.find((p) => p.priceId === priceId);

        if (plan && customerId && userId) {
          await db
            .from("profiles")
            .update({
              customer_id: customerId,
              price_id: priceId,
              has_access: true,
            })
            .eq("id", userId);
        }

        processingStatus = "processed";
        break;
      }

      case "customer.subscription.deleted": {
        const stripeObject: Stripe.Subscription = event.data.object as Stripe.Subscription;
        const subscription = await stripe.subscriptions.retrieve(stripeObject.id);
        const customerId = resolveCustomerId(subscription.customer);

        if (customerId) {
          await db
            .from("profiles")
            .update({ has_access: false })
            .eq("customer_id", customerId);
        }

        processingStatus = "processed";
        break;
      }

      case "invoice.paid": {
        const stripeObject: Stripe.Invoice = event.data.object as Stripe.Invoice;
        const [lineItem] = stripeObject.lines.data;
        const expandedPriceId = readExpandedPriceId(lineItem);
        const priceId = lineItem
          ? readLegacyPriceId(lineItem) ??
            expandedPriceId ??
            (typeof lineItem.metadata?.price_id === "string" ? lineItem.metadata.price_id : undefined)
          : undefined;
        const customerId = resolveCustomerId(stripeObject.customer);

        if (customerId) {
          const { data: profile } = await db
            .from("profiles")
            .select("*")
            .eq("customer_id", customerId)
            .maybeSingle();

          if (profile && profile.price_id === priceId) {
            await db
              .from("profiles")
              .update({ has_access: true })
              .eq("customer_id", customerId);
          }
        }

        processingStatus = "processed";
        break;
      }

      case "checkout.session.expired":
      case "customer.subscription.updated":
      case "invoice.payment_failed": {
        processingStatus = "ignored";
        break;
      }

      default: {
        processingStatus = "ignored";
        break;
      }
    }
  } catch (error: unknown) {
    processingStatus = "failed";
    console.error("[stripe][webhook] Processing error", stringifyError(error));
    void recordObservabilityEvent({
      source: "api.stripe-webhook",
      eventType: "stripe.event.processing_failed",
      severity: "critical",
      context: {
        eventId,
        eventType: event.type,
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  } finally {
    if (eventRowId) {
      const { error: updateError } = await db
        .from("stripe_events")
        .update({
          processed_at: new Date().toISOString(),
          status: processingStatus,
        })
        .eq("id", eventRowId);

      if (updateError) {
        console.error("[stripe][webhook] Failed to update stripe_events", updateError);
      }
    }
  }

  return NextResponse.json({ received: true });
}
