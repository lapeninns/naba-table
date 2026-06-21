import Link from 'next/link';
import { notFound } from 'next/navigation';

import { InviteAcceptanceClient } from '@/components/invite/InviteAcceptanceClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  findInviteByToken,
  inviteHasExpired,
  markInviteExpired,
  resolveInviteContext,
} from '@/server/team/invitations';

import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Team invitation · Nab a Table',
  description: 'Review and accept a restaurant team invitation.',
};

type InvitePageParams = Promise<{ token: string | string[] }>;

function firstToken(value: string | string[]): string | null {
  const token = Array.isArray(value) ? value[0] : value;
  return typeof token === 'string' && token.trim().length >= 10 ? token.trim() : null;
}

function InviteStatusCard({
  title,
  description,
  actionHref = '/auth/signin',
  actionLabel = 'Sign in',
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-xl shadow-sm">
        <CardHeader className="space-y-2 text-center">
          <CardTitle
            className="text-2xl font-semibold text-foreground"
            role="heading"
            aria-level={1}
          >
            {title}
          </CardTitle>
          <CardDescription className="text-muted-foreground">{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

export default async function InvitePage({ params }: { params: InvitePageParams }) {
  const token = firstToken((await params).token);
  if (!token) {
    notFound();
  }

  const invite = await findInviteByToken(token);
  if (!invite) {
    notFound();
  }

  if (invite.status === 'revoked') {
    return (
      <InviteStatusCard
        title="Invitation revoked"
        description="This team invitation is no longer available."
      />
    );
  }

  if (invite.status === 'accepted') {
    return (
      <InviteStatusCard
        title="Invitation already accepted"
        description="Sign in with the invited account to continue to the restaurant workspace."
        actionHref="/app"
        actionLabel="Open workspace"
      />
    );
  }

  if (invite.status === 'expired' || inviteHasExpired(invite)) {
    if (invite.status === 'pending') {
      await markInviteExpired(invite.id);
    }
    return (
      <InviteStatusCard
        title="Invitation expired"
        description="Ask the restaurant owner or manager to send a fresh invitation."
      />
    );
  }

  const { restaurantName, inviterName } = await resolveInviteContext(invite);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
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
    </main>
  );
}
