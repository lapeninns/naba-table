'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';

import { TeamInviteForm } from './TeamInviteForm';
import { TeamInvitesTable } from './TeamInvitesTable';

export function OpsTeamManagementClient() {
  const { memberships, activeRestaurantId, permissions } = useOpsSession();
  const activeMembership = useOpsActiveMembership();

  if (memberships.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No restaurant access</AlertTitle>
        <AlertDescription>
          Your account is not linked to any restaurants yet. Ask an owner or manager to send you an invitation.
        </AlertDescription>
      </Alert>
    );
  }

  if (!activeRestaurantId || !activeMembership) {
    return <Skeleton className="h-36 w-full" />;
  }

  const canManage = permissions.canManageTeam || isRestaurantAdminRole(activeMembership.role);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Team management</h1>
            <p className="text-sm text-muted-foreground">
              Invite teammates, monitor pending invites, and keep your restaurant staff list up to date.
            </p>
          </div>
        </div>

        {!canManage ? (
          <Alert>
            <AlertTitle>Limited permissions</AlertTitle>
            <AlertDescription>
              Only owners and managers can send invitations. Contact an owner if you need to add teammates.
            </AlertDescription>
          </Alert>
        ) : null}
      </section>

      <section className="space-y-12">
        {canManage ? <TeamInviteForm restaurantId={activeRestaurantId} /> : null}
        <TeamInvitesTable restaurantId={activeRestaurantId} canManage={canManage} />
      </section>
    </div>
  );
}
