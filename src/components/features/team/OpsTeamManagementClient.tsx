'use client';

import { RESTAURANT_SETTINGS_ROUTE_MAP } from '@/components/features/restaurant-settings/routes';
import {
  RestaurantSettingsCommandCenter,
  SETTINGS_ASIDE_CLASS,
  SETTINGS_ASIDE_GRID_CLASS,
  SettingsNoRestaurantState,
  SettingsStatusFacts,
} from '@/components/features/restaurant-settings/shared';
import { SettingsCard } from '@/components/features/restaurant-settings/shared/SettingsCard';
import { Text } from '@/components/ui/typography';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useOpsTeamInvitations } from '@/hooks/ops/useOpsTeamInvitations';
import { isRestaurantAdminRole, type RestaurantRole } from '@/lib/owner/auth/roles';
import { cn } from '@/lib/utils';

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
      <Text variant="caption">Ask an owner or manager to send the invitation.</Text>
    </SettingsCard>
  );
}

export function OpsTeamManagementClient() {
  const { activeRestaurantId, permissions } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  // One request for every invitation: the filters and their counts are worked out on the client.
  const invitations = useOpsTeamInvitations({
    restaurantId: activeRestaurantId,
    status: 'all',
  });

  if (!activeRestaurantId || !activeMembership) {
    return (
      <RestaurantSettingsCommandCenter
        title={TEAM_ROUTE.title}
        description={TEAM_ROUTE.description}
      >
        <SettingsNoRestaurantState task="invite people and manage their invitations" />
      </RestaurantSettingsCommandCenter>
    );
  }

  const role = activeMembership.role as RestaurantRole;
  const canManage = permissions.canManageTeam || isRestaurantAdminRole(role);
  const invites = invitations.data ?? NO_INVITES;

  return (
    <RestaurantSettingsCommandCenter
      title={TEAM_ROUTE.title}
      description={TEAM_ROUTE.description}
      status={
        <SettingsStatusFacts>
          <span>{getTeamAccessLine(role, canManage)}</span>
        </SettingsStatusFacts>
      }
    >
      {/* The invite card is the page's main task, so it stays first below xl (R7 exception). */}
      <div className={SETTINGS_ASIDE_GRID_CLASS}>
        <div
          id="team-invite"
          className={cn(SETTINGS_ASIDE_CLASS, 'scroll-mt-28 xl:col-start-2 xl:row-start-1')}
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
