'use client';

import { useState } from 'react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTeamInvitations, useRevokeTeamInvite } from '@/hooks/owner/useTeamInvitations';
import type { RestaurantInvite } from '@/lib/owner/team/schema';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  revoked: 'Revoked',
  expired: 'Expired',
  all: 'All',
};

type TeamInvitesTableProps = {
  restaurantId: string;
  canManage: boolean;
};

function formatTimestamp(value: string | null) {
  if (!value) return '—';
  return format(new Date(value), 'MMM d, yyyy • HH:mm');
}

function StatusBadge({ invite }: { invite: RestaurantInvite }) {
  const variant =
    invite.status === 'pending'
      ? 'secondary'
      : invite.status === 'accepted'
        ? 'default'
        : 'outline';

  return <Badge variant={variant}>{STATUS_LABEL[invite.status] ?? invite.status}</Badge>;
}

export function TeamInvitesTable({ restaurantId, canManage }: TeamInvitesTableProps) {
  const [status, setStatus] = useState<'pending' | 'accepted' | 'revoked' | 'expired' | 'all'>('pending');
  const { data: invites, isLoading, isRefetching } = useTeamInvitations({ restaurantId, status });
  const revokeInvite = useRevokeTeamInvite();

  const hasInvites = (invites?.length ?? 0) > 0;

  const handleRevoke = (invite: RestaurantInvite) => {
    revokeInvite.mutate({ restaurantId, inviteId: invite.id });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Pending invitations</h2>
          <p className="text-sm text-slate-600">
            Track outstanding invites and revoke access if someone joins the team early or by mistake.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className="h-9 w-[160px] rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="revoked">Revoked</option>
            <option value="expired">Expired</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="hidden bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
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
          <ul className="divide-y divide-slate-100">
            {invites!.map((invite) => (
              <li
                key={invite.id}
                className="grid grid-cols-1 gap-2 px-4 py-3 text-sm text-slate-700 md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-center"
              >
                <span className="break-all font-medium">{invite.email}</span>
                <span className="capitalize text-slate-600">{invite.role}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge invite={invite} />
                  {invite.status === 'pending' && new Date(invite.expiresAt) < new Date() ? (
                    <span className="text-xs text-amber-600">Expired</span>
                  ) : null}
                </div>
                <span className="text-slate-500">{formatTimestamp(invite.expiresAt)}</span>
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
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            {status === 'pending'
              ? 'No pending invitations. Invite teammates to collaborate on reservations.'
              : 'No invitations match this filter.'}
          </div>
        )}

        {isRefetching ? (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            Refreshing…
          </div>
        ) : null}
      </div>
    </div>
  );
}
