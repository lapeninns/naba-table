import { NextResponse, NextRequest } from "next/server";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";
import { z } from "zod";

import { createCheckout } from "@/libs/stripe";

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

// This function is used to create a Stripe Checkout Session (one-time payment or subscription)
// It's called by the <ButtonCheckout /> component
// Users must be authenticated. It will prefill the Checkout data with their email and/or credit card (if any)
export async function POST(req: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    // User who are not logged in can't make a purchase
    if (!session) {
      return NextResponse.json(
        { error: "You must be logged in to make a purchase." },
        { status: 401 }
      );
    }

    const bodySchema = z.object({
      priceId: z.string(),
      mode: z.enum(["payment", "subscription"]).optional(),
      successUrl: z.string(),
      cancelUrl: z.string(),
      couponId: z.string().optional(),
    });

    const parsed = bodySchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { priceId, mode, successUrl, cancelUrl, couponId } = parsed.data;

    if (!priceId) {
      return NextResponse.json(
        { error: "Price ID is required" },
        { status: 400 }
      );
    } else if (!successUrl || !cancelUrl) {
      return NextResponse.json(
        { error: "Success and cancel URLs are required" },
        { status: 400 }
      );
    } else if (!mode) {
      return NextResponse.json(
        {
          error:
            "Mode is required (either 'payment' for one-time payments or 'subscription' for recurring subscription)",
        },
        { status: 400 }
      );
    }

    // Search for a profile with unique ID equals to the user session ID (in table called 'profiles')
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session?.user?.id)
      .single();

    // If no profile found, create one. This is used to store the Stripe customer ID
    if (!data) {
      await supabase.from("profiles").insert({
        id: session.user.id,
        price_id: priceId,
        email: session?.user?.email,
      });
    }

    const resolvedMode = mode as "payment" | "subscription";

    const stripeSessionURL = await createCheckout({
      priceId,
      mode: resolvedMode,
      successUrl,
      cancelUrl,
      clientReferenceId: session.user.id,
      user: {
        email: session?.user?.email,
        // If the user has already purchased, it will automatically prefill it's credit card
        customerId: data?.customer_id,
      },
      // If you send coupons from the frontend, you can pass it here
      couponId,
    });

    return NextResponse.json({ url: stripeSessionURL });
  } catch (error: unknown) {
    const message = stringifyError(error);
    console.error(message);
    return NextResponse.json({ error: message || "Unable to create checkout session" }, { status: 500 });
  }
}
