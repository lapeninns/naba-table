'use client';

import { useMemo } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsSession } from '@/contexts/ops-session';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';

import { TeamInviteForm } from './TeamInviteForm';
import { TeamInvitesTable } from './TeamInvitesTable';

export function OpsTeamManagementClient() {
  const { memberships, activeRestaurantId, setActiveRestaurantId, permissions } = useOpsSession();

  const restaurantOptions = useMemo(
    () =>
      memberships.map((membership) => ({
        id: membership.restaurantId,
        name: membership.restaurantName ?? 'Restaurant',
        role: membership.role,
      })),
    [memberships],
  );

  if (memberships.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No restaurant access</AlertTitle>
        <AlertDescription>Your account is not linked to any restaurants yet. Ask an owner or manager to send you an invitation.</AlertDescription>
      </Alert>
    );
  }

  const selectedRestaurantId = activeRestaurantId ?? restaurantOptions[0]?.id ?? null;

  if (!selectedRestaurantId) {
    return <Skeleton className="h-36 w-full" />;
  }

  const selectedMembership = memberships.find((membership) => membership.restaurantId === selectedRestaurantId) ?? memberships[0];
  const canManage = isRestaurantAdminRole(selectedMembership.role);

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

          <div className="w-full max-w-xs space-y-2">
            <Label htmlFor="ops-team-restaurant" className="text-sm font-medium text-foreground">
              Restaurant
            </Label>
            <select
              id="ops-team-restaurant"
              value={selectedRestaurantId}
              onChange={(event) => setActiveRestaurantId(event.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {restaurantOptions.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name} — {restaurant.role}
                </option>
              ))}
            </select>
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
        {canManage ? <TeamInviteForm restaurantId={selectedRestaurantId} /> : null}
        <TeamInvitesTable restaurantId={selectedRestaurantId} canManage={canManage} />
      </section>
    </div>
  );
}
