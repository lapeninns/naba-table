import { NextResponse } from "next/server";
import { z } from "zod";

import { RESTAURANT_ROLE_OPTIONS } from "@/lib/owner/auth/roles";
import { ensureProfileRow } from "@/lib/profile/server";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";
import { requireAdminMembership } from "@/server/team/access";
import { createRestaurantInvite, listRestaurantInvites } from "@/server/team/invitations";

import type { NextRequest} from "next/server";

export const dynamic = "force-dynamic";

const STATUS_FILTER_OPTIONS = ["pending", "accepted", "revoked", "expired", "all"] as const;
type StatusFilter = (typeof STATUS_FILTER_OPTIONS)[number];

const listSchema = z.object({
  restaurantId: z.string().uuid(),
  status: z.enum(STATUS_FILTER_OPTIONS).optional(),
});

const createSchema = z.object({
  restaurantId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(RESTAURANT_ROLE_OPTIONS),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

const DEFAULT_EXPIRY_DAYS = 7;

function computeExpiry(expiresAt?: string): string {
  if (expiresAt) {
    return expiresAt;
  }
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + DEFAULT_EXPIRY_DAYS);
  return expiry.toISOString();
}

function serializeInvite(invite: Awaited<ReturnType<typeof listRestaurantInvites>>[number]) {
  return {
    id: invite.id,
    restaurantId: invite.restaurant_id,
    email: invite.email,
    role: invite.role,
    status: invite.status,
    expiresAt: invite.expires_at,
    invitedBy: invite.invited_by,
    acceptedAt: invite.accepted_at,
    revokedAt: invite.revoked_at,
    createdAt: invite.created_at,
    updatedAt: invite.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[team/invitations][GET] auth error", authError.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const parsed = listSchema.safeParse({
    restaurantId: request.nextUrl.searchParams.get("restaurantId"),
    status: request.nextUrl.searchParams.get("status") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid filters", details: parsed.error.flatten() }, { status: 400 });
  }

  const { restaurantId, status: statusFilter } = parsed.data;
  const status: StatusFilter = statusFilter ?? "pending";

  try {
    await requireAdminMembership({ userId: user.id, restaurantId });
    const invites = await listRestaurantInvites({
      restaurantId,
      authClient: supabase,
      status,
    });
    return NextResponse.json({
      invites: invites.map(serializeInvite),
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const code = (error as { code?: string }).code;
      if (code === "MEMBERSHIP_NOT_FOUND" || code === "MEMBERSHIP_ROLE_DENIED") {
        return NextResponse.json({ error: "Not authorized to manage invitations" }, { status: 403 });
      }
    }

    console.error("[team/invitations][GET] failed", error);
    return NextResponse.json({ error: "Unable to load invitations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[team/invitations][POST] auth error", authError.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invitation payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const { restaurantId, email, role, expiresAt: requestedExpiry } = parsed.data;

  try {
    await requireAdminMembership({ userId: user.id, restaurantId });
    const expiresAt = computeExpiry(requestedExpiry);

    await ensureProfileRow(supabase, user);

    const { invite, token, inviteUrl } = await createRestaurantInvite({
      restaurantId,
      email,
      role,
      invitedBy: user.id,
      expiresAt,
      authClient: supabase,
    });

    return NextResponse.json(
      {
        invite: serializeInvite(invite),
        token,
        inviteUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const code = (error as { code?: string }).code;
      if (code === "MEMBERSHIP_NOT_FOUND" || code === "MEMBERSHIP_ROLE_DENIED") {
        return NextResponse.json({ error: "Not authorized to create invitations" }, { status: 403 });
      }
      if (code === "INVITE_ALREADY_EXISTS") {
        return NextResponse.json({ error: "An invitation for this email is already pending" }, { status: 409 });
      }
      if (code === "INVALID_INVITE_ROLE") {
        return NextResponse.json({ error: "Unsupported role" }, { status: 422 });
      }
    }

    console.error("[team/invitations][POST] failed", error);
    return NextResponse.json({ error: "Unable to create invitation" }, { status: 500 });
  }
}
