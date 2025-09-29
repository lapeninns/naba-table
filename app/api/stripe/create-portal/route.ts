import { NextResponse, NextRequest } from "next/server";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";
import { z } from "zod";

import { createCustomerPortal } from "@/libs/stripe";

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    const bodySchema = z.object({
      returnUrl: z.string(),
    });

    const parsed = bodySchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    // User who are not logged in can't make a purchase
    if (!session) {
      return NextResponse.json(
        { error: "You must be logged in to view billing information." },
        { status: 401 }
      );
    } else if (!parsed.data.returnUrl) {
      return NextResponse.json(
        { error: "Return URL is required" },
        { status: 400 }
      );
    }

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session?.user?.id)
      .single();

    if (!data?.customer_id) {
      return NextResponse.json(
        {
          error: "You don't have a billing account yet. Make a purchase first.",
        },
        { status: 400 }
      );
    }

    const stripePortalUrl = await createCustomerPortal({
      customerId: data.customer_id,
      returnUrl: parsed.data.returnUrl,
    });

    return NextResponse.json({
      url: stripePortalUrl,
    });
  } catch (error: unknown) {
    const message = stringifyError(error);
    console.error(message);
    return NextResponse.json({ error: message || "Unable to create billing portal" }, { status: 500 });
  }
}
