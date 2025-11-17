
import { InviteAcceptanceClient } from "@/components/invite/InviteAcceptanceClient";
import { InviteInvalidState } from "@/components/invite/InviteInvalidState";
import { HeaderActions, PageShell } from "@/components/guest-account/PageShell";
import {
  findInviteByToken,
  inviteHasExpired,
  markInviteExpired,
  resolveInviteContext,
} from "@/server/team/invitations";

import type { Metadata } from "next";

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
    return (
      <InvitePageShell
        title="Invitation not found"
        description="The link may be incorrect or already used. Request a new invite or sign in with your account."
      >
        <InviteInvalidState reason="not_found" />
      </InvitePageShell>
    );
  }

  if (invite.status === "revoked") {
    return (
      <InvitePageShell
        title="Invitation revoked"
        description="This invite is no longer active. Contact your admin to request a new one."
      >
        <InviteInvalidState reason="revoked" />
      </InvitePageShell>
    );
  }

  if (invite.status === "accepted") {
    return (
      <InvitePageShell
        title="Already accepted"
        description="Sign in to continue or ask your admin for help if you can’t access your account."
      >
        <InviteInvalidState reason="accepted" />
      </InvitePageShell>
    );
  }

  if (invite.status === "expired" || inviteHasExpired(invite)) {
    if (invite.status === "pending") {
      await markInviteExpired(invite.id);
    }
    return (
      <InvitePageShell
        title="Invitation expired"
        description="Ask your restaurant admin to send a fresh link."
      >
        <InviteInvalidState reason="expired" />
      </InvitePageShell>
    );
  }

  const { restaurantName, inviterName } = await resolveInviteContext(invite);

  return (
    <InvitePageShell
      title="You’re invited"
      description={`Join ${restaurantName} to collaborate and manage bookings.`}
    >
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
    </InvitePageShell>
  );
}

function InvitePageShell({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <PageShell
      eyebrow="Team invite"
      title={title}
      description={description}
      maxWidthClassName="max-w-3xl"
      actions={<HeaderActions secondary={{ href: '/signin', label: 'Sign in', variant: 'outline' }} />}
    >
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">{children}</div>
    </PageShell>
  );
}
