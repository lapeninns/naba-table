import { NextResponse } from "next/server";
import { z } from "zod";

import { getRouteHandlerSupabaseClient } from "@/server/supabase";
import { requireAdminMembership } from "@/server/team/access";
import { revokeRestaurantInvite } from "@/server/team/invitations";

import type { NextRequest} from "next/server";

const paramsSchema = z.object({ inviteId: z.string().uuid() });

const searchSchema = z.object({ restaurantId: z.string().uuid() });

export async function DELETE(request: NextRequest, context: { params: Promise<{ inviteId: string }> }) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[team/invitations][DELETE] auth error", authError.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid invitation identifier" }, { status: 400 });
  }

  const parsedSearch = searchSchema.safeParse({ restaurantId: request.nextUrl.searchParams.get("restaurantId") });

  if (!parsedSearch.success) {
    return NextResponse.json({ error: "Restaurant context is required" }, { status: 400 });
  }

  const { inviteId } = parsedParams.data;
  const { restaurantId } = parsedSearch.data;

  try {
    await requireAdminMembership({ userId: user.id, restaurantId });
    const invite = await revokeRestaurantInvite({
      inviteId,
      restaurantId,
      authClient: supabase,
    });

    return NextResponse.json({
      invite: {
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
      },
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const code = (error as { code?: string }).code;
      if (code === "MEMBERSHIP_NOT_FOUND" || code === "MEMBERSHIP_ROLE_DENIED") {
        return NextResponse.json({ error: "Not authorized to revoke invitations" }, { status: 403 });
      }
      if (code === "INVITE_NOT_FOUND") {
        return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
      }
    }

    console.error("[team/invitations][DELETE] failed", error);
    return NextResponse.json({ error: "Unable to revoke invitation" }, { status: 500 });
  }
}
