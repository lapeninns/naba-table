'use client';

import { ShieldCheck, UserPlus, Users } from 'lucide-react';
import { useCallback, useState } from 'react';

import { RestaurantSettingsCommandCenter } from '@/components/features/restaurant-settings/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';

import { TeamInviteForm } from './TeamInviteForm';
import { TeamInvitesTable } from './TeamInvitesTable';

type TeamWorkspace = 'invite' | 'invitations';

export function OpsTeamManagementClient() {
  const { memberships, activeRestaurantId, permissions } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const [activeWorkspace, setActiveWorkspace] = useState<TeamWorkspace>('invite');
  const selectWorkspace = useCallback((workspace: TeamWorkspace) => {
    setActiveWorkspace(workspace);
    window.history.replaceState(
      null,
      '',
      workspace === 'invite' ? '#team-invite' : '#team-invitations',
    );
  }, []);

  if (memberships.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No restaurant access</AlertTitle>
        <AlertDescription>
          Your account is not linked to any restaurants yet. Ask an owner or manager to send you an
          invitation.
        </AlertDescription>
      </Alert>
    );
  }

  if (!activeRestaurantId || !activeMembership) {
    return <Skeleton className="h-36 w-full" />;
  }

  const canManage = permissions.canManageTeam || isRestaurantAdminRole(activeMembership.role);
  const visibleWorkspace = canManage ? activeWorkspace : 'invitations';

  return (
    <RestaurantSettingsCommandCenter
      eyebrow="Team command center"
      title="Team"
      description="Invite staff, review pending access, and keep team permissions clear without leaving restaurant settings."
      metrics={[
        {
          label: 'Your role',
          value: activeMembership.role,
          description: canManage ? 'can manage invites' : 'view-only team access',
          variant: canManage ? 'default' : 'secondary',
          Icon: ShieldCheck,
        },
        {
          label: 'Invite access',
          value: canManage ? 'Enabled' : 'Limited',
          description: 'owners and managers only',
          variant: canManage ? 'secondary' : 'metric',
          Icon: UserPlus,
        },
      ]}
      railTitle="Team workflow"
      railDescription="Invite first, then review pending or accepted invitations below."
      railItems={[
        ...(canManage
          ? [
              {
                label: 'Invite member',
                description: 'Send access to a manager or host.',
                href: '#team-invite',
                Icon: UserPlus,
                isActive: visibleWorkspace === 'invite',
                onSelect: () => selectWorkspace('invite'),
              },
            ]
          : []),
        {
          label: 'Invitations',
          description: 'Review pending, accepted, expired, or revoked invites.',
          href: '#team-invitations',
          Icon: Users,
          isActive: visibleWorkspace === 'invitations',
          onSelect: () => selectWorkspace('invitations'),
        },
      ]}
      footer="Role rules stay unchanged: only owners and managers can send or revoke invitations."
    >
      <div className="flex flex-col gap-6">
        {!canManage ? (
          <Alert>
            <AlertTitle>Limited permissions</AlertTitle>
            <AlertDescription>
              Only owners and managers can send invitations. Contact an owner if you need to add
              teammates.
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="flex flex-col gap-6">
          {canManage ? (
            <div
              id="team-invite"
              hidden={visibleWorkspace !== 'invite'}
              className={visibleWorkspace !== 'invite' ? 'hidden scroll-mt-28' : 'scroll-mt-28'}
            >
              <TeamInviteForm restaurantId={activeRestaurantId} />
            </div>
          ) : null}
          <div
            id="team-invitations"
            hidden={visibleWorkspace !== 'invitations'}
            className={visibleWorkspace !== 'invitations' ? 'hidden scroll-mt-28' : 'scroll-mt-28'}
          >
            <TeamInvitesTable restaurantId={activeRestaurantId} canManage={canManage} />
          </div>
        </section>
      </div>
    </RestaurantSettingsCommandCenter>
  );
}
