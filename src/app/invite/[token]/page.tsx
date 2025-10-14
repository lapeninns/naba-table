import type { Metadata } from "next";

import { InviteAcceptanceClient } from "@/components/invite/InviteAcceptanceClient";
import { InviteInvalidState } from "@/components/invite/InviteInvalidState";
import {
  findInviteByToken,
  inviteHasExpired,
  markInviteExpired,
  resolveInviteContext,
} from "@/server/team/invitations";

type PageProps = {
  params: Promise<{ token: string }>;
};

export const metadata: Metadata = {
  title: "Accept your SajiloReserveX invitation",
  description: "Join your restaurant team on SajiloReserveX.",
};

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;
  const invite = await findInviteByToken(token);

  if (!invite) {
    return <InviteInvalidState reason="not_found" />;
  }

  if (invite.status === "revoked") {
    return <InviteInvalidState reason="revoked" />;
  }

  if (invite.status === "accepted") {
    return <InviteInvalidState reason="accepted" />;
  }

  if (invite.status === "expired" || inviteHasExpired(invite)) {
    if (invite.status === "pending") {
      await markInviteExpired(invite.id);
    }
    return <InviteInvalidState reason="expired" />;
  }

  const { restaurantName, inviterName } = await resolveInviteContext(invite);

  return (
    <InviteAcceptanceClient
      token={token}
      invite={{
        email: invite.email,
        role: invite.role,
        restaurantId: invite.restaurant_id,
        restaurantName,
        inviterName,
        expiresAt: invite.expires_at,
      }}
    />
  );
}
