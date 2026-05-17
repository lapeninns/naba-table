'use client';

import { useMemo, useState } from 'react';

import { ConfirmDialog } from '@/components/features/restaurant-settings/ConfirmDialog';
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
  const [revokeTarget, setRevokeTarget] = useState<TeamInvite | null>(null);
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

  const handleRevoke = () => {
    if (!revokeTarget || revokeInvite.isPending) {
      return;
    }
    revokeInvite.mutate(
      { restaurantId, inviteId: revokeTarget.id },
      {
        onSuccess: () => setRevokeTarget(null),
      },
    );
  };

  return (
    <SettingsCard
      title="Team invitations"
      description="Track outstanding invites and revoke access when an invitation is no longer needed."
      headerAction={
        <Select value={status} onValueChange={(value) => setStatus(value as TeamInviteStatus)}>
          <SelectTrigger className="w-full md:w-[160px]" aria-label="Filter invitations by status">
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

      <div className="grid gap-3 md:hidden">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-lg" />
          ))
        ) : hasInvites ? (
          inviteRows.map(({ invite, expiresLabel, createdLabel, isExpiredPending }) => (
            <article key={invite.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-all text-sm font-semibold text-foreground">
                    {invite.email}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatTeamRole(invite.role)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge invite={invite} />
                  {isExpiredPending ? <Badge variant="outline">Expired by date</Badge> : null}
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Sent {createdLabel} · Expires {expiresLabel}
              </p>
              {invite.status === 'pending' && canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => setRevokeTarget(invite)}
                  disabled={revokeInvite.isPending}
                >
                  Revoke invite
                </Button>
              ) : null}
            </article>
          ))
        ) : (
          <div className="rounded-lg border p-4 text-sm text-muted-foreground">
            {status === 'pending'
              ? 'No pending invitations. Invite teammates to collaborate on reservations.'
              : 'No invitations match this filter.'}
          </div>
        )}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableCaption className="sr-only">Restaurant team invitations</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent date</TableHead>
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
              inviteRows.map(({ invite, createdLabel, isExpiredPending }) => (
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
                    {createdLabel}
                  </TableCell>
                  <TableCell className="text-right">
                    {invite.status === 'pending' && canManage ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setRevokeTarget(invite)}
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
      </div>
      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevokeTarget(null);
          }
        }}
        title="Revoke invitation?"
        description={
          revokeTarget
            ? `${revokeTarget.email} will no longer be able to use this invitation to access the restaurant.`
            : undefined
        }
        confirmLabel={revokeInvite.isPending ? 'Revoking…' : 'Revoke invite'}
        cancelLabel="Keep invite"
        tone="destructive"
        onConfirm={handleRevoke}
      />
    </SettingsCard>
  );
}
