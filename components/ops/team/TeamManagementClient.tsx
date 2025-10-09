'use client';

import { useEffect, useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

import { TeamInviteForm } from '@/components/ops/team/TeamInviteForm';
import { TeamInvitesTable } from '@/components/ops/team/TeamInvitesTable';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useRestaurantMemberships } from '@/hooks/owner/useRestaurantMemberships';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';

export function TeamManagementClient() {
  const { data: memberships, isLoading, isError } = useRestaurantMemberships();
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedRestaurantId && memberships && memberships.length > 0) {
      setSelectedRestaurantId(memberships[0]!.restaurantId);
    }
  }, [memberships, selectedRestaurantId]);

  const selectedMembership = useMemo(
    () => memberships?.find((membership) => membership.restaurantId === selectedRestaurantId) ?? null,
    [memberships, selectedRestaurantId],
  );

  const canManage = selectedMembership ? isRestaurantAdminRole(selectedMembership.role) : false;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !memberships || memberships.length === 0) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" aria-hidden />
        <AlertTitle>No restaurant access</AlertTitle>
        <AlertDescription>
          Your account is not linked to any restaurants yet. Ask an owner or manager to send you an invitation.
        </AlertDescription>
      </Alert>
    );
  }

  const adminRoles = memberships.filter((membership) => isRestaurantAdminRole(membership.role));
  const isAdminAnywhere = adminRoles.length > 0;

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Team management</h1>
            <p className="text-sm text-slate-600">
              Invite teammates, monitor pending invites, and keep your restaurant staff list up to date.
            </p>
          </div>

          <select
            value={selectedRestaurantId ?? ''}
            onChange={(event) => setSelectedRestaurantId(event.target.value)}
            className="h-9 w-[220px] rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {memberships.map((membership) => (
              <option key={membership.restaurantId} value={membership.restaurantId}>
                {membership.restaurant.name ?? 'Restaurant'} — {membership.role}
              </option>
            ))}
          </select>
        </div>

        {selectedMembership && !canManage ? (
          <Alert>
            <ShieldAlert className="h-4 w-4" aria-hidden />
            <AlertTitle>Limited permissions</AlertTitle>
            <AlertDescription>
              Only owners and managers can send invitations. Contact an owner if you need to add teammates.
            </AlertDescription>
          </Alert>
        ) : null}
      </section>

      {selectedRestaurantId ? (
        <section className="space-y-12">
          {canManage ? <TeamInviteForm restaurantId={selectedRestaurantId} /> : null}
          <TeamInvitesTable restaurantId={selectedRestaurantId} canManage={canManage} />
        </section>
      ) : (
        <Skeleton className="h-36 w-full" />
      )}
    </div>
  );
}
