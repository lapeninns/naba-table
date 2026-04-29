'use client';

import { format } from 'date-fns';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsRevokeTeamInvite, useOpsTeamInvitations } from '@/hooks/ops/useOpsTeamInvitations';

import type { TeamInvite, TeamInviteStatus } from '@/services/ops/team';

const STATUS_OPTIONS: TeamInviteStatus[] = ['pending', 'accepted', 'revoked', 'expired', 'all'];
const STATUS_LABEL: Record<TeamInviteStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  revoked: 'Revoked',
  expired: 'Expired',
  all: 'All',
};

function formatTimestamp(value: string | null) {
  if (!value) return '—';
  return format(new Date(value), 'MMM d, yyyy • HH:mm');
}

function StatusBadge({ invite }: { invite: TeamInvite }) {
  const variant =
    invite.status === 'pending'
      ? 'secondary'
      : invite.status === 'accepted'
        ? 'default'
        : 'outline';
  return <Badge variant={variant}>{STATUS_LABEL[invite.status] ?? invite.status}</Badge>;
}

type TeamInvitesTableProps = {
  restaurantId: string;
  canManage: boolean;
};

export function TeamInvitesTable({ restaurantId, canManage }: TeamInvitesTableProps) {
  const [status, setStatus] = useState<TeamInviteStatus>('pending');
  const { data: invites, isLoading, isFetching } = useOpsTeamInvitations({ restaurantId, status });
  const revokeInvite = useOpsRevokeTeamInvite();

  const hasInvites = useMemo(() => (invites?.length ?? 0) > 0, [invites]);
  // Cache formatted invite row state so filter/loading updates do not reparse dates for every row.
  const inviteRows = useMemo(() => {
    const now = Date.now();
    return (invites ?? []).map((invite) => ({
      invite,
      expiresLabel: formatTimestamp(invite.expiresAt),
      isExpiredPending: invite.status === 'pending' && new Date(invite.expiresAt).getTime() < now,
    }));
  }, [invites]);

  const handleRevoke = (invite: TeamInvite) => {
    revokeInvite.mutate({ restaurantId, inviteId: invite.id });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Pending invitations</h2>
          <p className="text-sm text-muted-foreground">
            Track outstanding invites and revoke access if someone joins the team early or by
            mistake.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(value) => setStatus(value as TeamInviteStatus)}>
            <SelectTrigger className="h-9 w-[160px]" aria-label="Filter invitations by status">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {STATUS_LABEL[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="hidden bg-muted px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <span>Email</span>
          <span>Role</span>
          <span>Status</span>
          <span>Expires</span>
          <span className="text-right">Actions</span>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : hasInvites ? (
          <ul className="divide-y divide-border/60">
            {inviteRows.map(({ invite, expiresLabel, isExpiredPending }) => (
              <li
                key={invite.id}
                className="grid grid-cols-1 gap-2 px-4 py-3 text-sm text-foreground md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-center"
              >
                <span className="break-all font-medium">{invite.email}</span>
                <span className="capitalize text-muted-foreground">{invite.role}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge invite={invite} />
                  {isExpiredPending ? (
                    <span className="text-xs text-amber-600">Expired</span>
                  ) : null}
                </div>
                <span className="text-muted-foreground">{expiresLabel}</span>
                <div className="flex items-center justify-start gap-2 md:justify-end">
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
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {status === 'pending'
              ? 'No pending invitations. Invite teammates to collaborate on reservations.'
              : 'No invitations match this filter.'}
          </div>
        )}

        {isFetching ? (
          <div className="border-t border-border/60 bg-muted px-4 py-2 text-xs text-muted-foreground">
            Refreshing…
          </div>
        ) : null}
      </div>
    </div>
  );
}
