'use client';

import { ShieldCheck } from 'lucide-react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { RESTAURANT_SETTINGS_ROUTE_MAP } from '@/components/features/restaurant-settings/routes';
import { RestaurantSettingsCommandCenter } from '@/components/features/restaurant-settings/shared';
import { SettingsCard } from '@/components/features/restaurant-settings/shared/SettingsCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/typography';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useOpsTeamInvitations } from '@/hooks/ops/useOpsTeamInvitations';
import { isRestaurantAdminRole, type RestaurantRole } from '@/lib/owner/auth/roles';

import { TeamInviteForm } from './TeamInviteForm';
import { formatTeamRoleWithArticle } from './teamInviteModel';
import { TeamInvitesTable } from './TeamInvitesTable';

import type { TeamInvite } from '@/services/ops/team';

const TEAM_ROUTE = RESTAURANT_SETTINGS_ROUTE_MAP.team;
const NO_INVITES: TeamInvite[] = [];

function getTeamAccessLine(role: RestaurantRole, canManage: boolean): string {
  const signedInAs = `You’re signed in as ${formatTeamRoleWithArticle(role)}`;
  return canManage
    ? `${signedInAs}, so you can invite people and revoke invitations.`
    : `${signedInAs}. Only owners and managers can invite people or revoke invitations.`;
}

function ViewOnlyInviteCard() {
  return (
    <SettingsCard title="Invite someone" description="Only owners and managers can invite people.">
      <Text variant="caption" className="pt-3">
        Ask an owner or manager to send the invitation.
      </Text>
    </SettingsCard>
  );
}

export function OpsTeamManagementClient() {
  const { memberships, activeRestaurantId, permissions } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  // One request for every invitation: the filters and their counts are worked out on the client.
  const invitations = useOpsTeamInvitations({
    restaurantId: activeRestaurantId,
    status: 'all',
  });

  if (memberships.length === 0) {
    return (
      <OpsEmptyState
        title="No restaurant access"
        description="Your account is not linked to any restaurants yet. Ask an owner or manager to send you an invitation."
      />
    );
  }

  if (!activeRestaurantId || !activeMembership) {
    return <Skeleton className="h-36 w-full" />;
  }

  const role = activeMembership.role as RestaurantRole;
  const canManage = permissions.canManageTeam || isRestaurantAdminRole(role);
  const invites = invitations.data ?? NO_INVITES;

  return (
    <RestaurantSettingsCommandCenter
      title={TEAM_ROUTE.title}
      description={TEAM_ROUTE.description}
      status={
        <p className="flex items-start gap-2 text-sm text-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>{getTeamAccessLine(role, canManage)}</span>
        </p>
      }
    >
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22.5rem]">
        <div
          id="team-invite"
          className="min-w-0 scroll-mt-28 xl:sticky xl:top-4 xl:col-start-2 xl:row-start-1"
        >
          {canManage ? (
            <TeamInviteForm restaurantId={activeRestaurantId} existingInvites={invites} />
          ) : (
            <ViewOnlyInviteCard />
          )}
        </div>
        <div id="team-invitations" className="min-w-0 scroll-mt-28 xl:col-start-1 xl:row-start-1">
          <TeamInvitesTable
            restaurantId={activeRestaurantId}
            canManage={canManage}
            invites={invitations.data}
            isLoading={invitations.isLoading}
            isFetching={invitations.isFetching}
            error={invitations.error}
            onRetry={() => {
              void invitations.refetch();
            }}
          />
        </div>
      </div>
    </RestaurantSettingsCommandCenter>
  );
}
