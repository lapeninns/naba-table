'use client';

import { useMemo, useState } from 'react';

import { SettingsCard } from '@/components/features/restaurant-settings/shared/SettingsCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useOpsRevokeTeamInvite, useOpsTeamInvitations } from '@/hooks/ops/useOpsTeamInvitations';

import {
  TEAM_INVITE_STATUS_OPTIONS,
  buildTeamInviteRows,
  formatTeamRole,
  getTeamInviteStatusBadgeVariant,
  getTeamInviteStatusLabel,
} from './teamInviteModel';

import type { TeamInvite, TeamInviteStatus } from '@/services/ops/team';

function StatusBadge({ invite }: { invite: TeamInvite }) {
  return (
    <Badge variant={getTeamInviteStatusBadgeVariant(invite.status)}>
      {getTeamInviteStatusLabel(invite.status)}
    </Badge>
  );
}

type TeamInvitesTableProps = {
  restaurantId: string;
  canManage: boolean;
};

export function TeamInvitesTable({ restaurantId, canManage }: TeamInvitesTableProps) {
  const [status, setStatus] = useState<TeamInviteStatus>('pending');
  const {
    data: invites,
    error,
    isError,
    isLoading,
    isFetching,
  } = useOpsTeamInvitations({ restaurantId, status });
  const revokeInvite = useOpsRevokeTeamInvite();

  const hasInvites = useMemo(() => (invites?.length ?? 0) > 0, [invites]);
  // Cache formatted invite row state so filter/loading updates do not reparse dates for every row.
  const inviteRows = useMemo(() => {
    return buildTeamInviteRows(invites ?? []);
  }, [invites]);

  const handleRevoke = (invite: TeamInvite) => {
    revokeInvite.mutate({ restaurantId, inviteId: invite.id });
  };

  return (
    <SettingsCard
      title="Team invitations"
      description="Track outstanding invites and revoke access when an invitation is no longer needed."
      headerAction={
        <Select value={status} onValueChange={(value) => setStatus(value as TeamInviteStatus)}>
          <SelectTrigger
            className="w-full md:w-[160px]"
            aria-label="Filter invitations by status"
          >
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {TEAM_INVITE_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {getTeamInviteStatusLabel(option)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      }
      footer={
        isFetching ? (
          <p className="text-xs text-muted-foreground" role="status">
            Refreshing…
          </p>
        ) : undefined
      }
    >
        {isError ? (
          <div className="pb-4">
            <Alert variant="destructive">
              <AlertTitle>Invitations could not be loaded</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <Table>
          <TableCaption className="sr-only">Restaurant team invitations</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : hasInvites ? (
              inviteRows.map(({ invite, expiresLabel, isExpiredPending }) => (
                <TableRow key={invite.id}>
                  <TableCell className="min-w-[220px] break-all font-medium">
                    {invite.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatTeamRole(invite.role)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge invite={invite} />
                      {isExpiredPending ? <Badge variant="outline">Expired by date</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[160px] text-muted-foreground">
                    {expiresLabel}
                  </TableCell>
                  <TableCell className="text-right">
                    {invite.status === 'pending' && canManage ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(invite)}
                        disabled={revokeInvite.isPending}
                      >
                        Revoke
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  {status === 'pending'
                    ? 'No pending invitations. Invite teammates to collaborate on reservations.'
                    : 'No invitations match this filter.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
    </SettingsCard>
  );
}
