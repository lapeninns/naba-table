import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { findInviteByToken, inviteHasExpired, markInviteExpired, resolveInviteContext } from "@/server/team/invitations";

const paramsSchema = z.object({
  token: z.string().min(10),
});

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  try {
    const invite = await findInviteByToken(parsed.data.token);

    if (!invite) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invite.status === "revoked") {
      return NextResponse.json({ error: "Invitation revoked" }, { status: 410 });
    }

    if (invite.status === "accepted") {
      return NextResponse.json({ error: "Invitation already accepted" }, { status: 409 });
    }

    if (invite.status === "expired" || inviteHasExpired(invite)) {
      if (invite.status === "pending") {
        await markInviteExpired(invite.id);
      }
      return NextResponse.json({ error: "Invitation expired" }, { status: 410 });
    }

    const { restaurantName, inviterName } = await resolveInviteContext(invite);

    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expires_at,
        restaurant: {
          id: invite.restaurant_id,
          name: restaurantName,
        },
        inviter: inviterName,
      },
    });
  } catch (error) {
    console.error("[api/team/invitations/token][GET] failed", error);
    return NextResponse.json({ error: "Unable to load invitation" }, { status: 500 });
  }
}
