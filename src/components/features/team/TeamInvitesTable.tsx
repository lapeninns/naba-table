'use client';

import { AlertCircle, Ban, CheckCircle2, Clock, RefreshCw, type LucideIcon } from 'lucide-react';
import { useMemo, useRef, useState, type ComponentProps } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/features/restaurant-settings/ConfirmDialog';
import { SettingsCard } from '@/components/features/restaurant-settings/shared/SettingsCard';
import { getSettingsSaveReasonCode } from '@/components/features/restaurant-settings/shared/settingsSaveSequence';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/typography';
import { useOpsRevokeTeamInvite } from '@/hooks/ops/useOpsTeamInvitations';

import {
  TEAM_INVITE_FILTERS,
  TEAM_INVITE_STATUS_LABELS,
  countTeamInvites,
  filterTeamInvites,
  formatTeamInviteDate,
  formatTeamRole,
  type TeamInviteDisplayStatus,
  type TeamInviteFilter,
  type TeamInviteRow,
} from './teamInviteModel';

import type { TeamInvite } from '@/services/ops/team';

const COARSE_TARGET_CLASS = '[@media(pointer:coarse)]:min-h-11';

const STATUS_BADGES: Record<
  TeamInviteDisplayStatus,
  { variant: ComponentProps<typeof Badge>['variant']; Icon: LucideIcon }
> = {
  pending: { variant: 'status-pending', Icon: Clock },
  expired: { variant: 'status-cancelled', Icon: AlertCircle },
  accepted: { variant: 'status-confirmed', Icon: CheckCircle2 },
  revoked: { variant: 'secondary', Icon: Ban },
};

function StatusBadge({ status }: { status: TeamInviteDisplayStatus }) {
  const { variant, Icon } = STATUS_BADGES[status];
  return (
    <Badge variant={variant} className="gap-1 whitespace-nowrap">
      <Icon className="size-3" aria-hidden />
      {TEAM_INVITE_STATUS_LABELS[status]}
    </Badge>
  );
}

function InviteDate({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <time dateTime={value} className="tabular-nums">
      {formatTeamInviteDate(value)}
    </time>
  );
}

function InviteDates({ row }: { row: TeamInviteRow }) {
  const { invite, status } = row;
  return (
    <span className="text-xs leading-5 text-muted-foreground">
      Sent <InviteDate value={invite.createdAt} />
      {status === 'pending' ? (
        <>
          {' · '}Expires <InviteDate value={invite.expiresAt} />
        </>
      ) : null}
      {status === 'expired' ? (
        <>
          {' · '}Expired <InviteDate value={invite.expiresAt} />
        </>
      ) : null}
      {status === 'accepted' && invite.acceptedAt ? (
        <>
          {' · '}Accepted <InviteDate value={invite.acceptedAt} />
        </>
      ) : null}
      {status === 'revoked' && invite.revokedAt ? (
        <>
          {' · '}Revoked <InviteDate value={invite.revokedAt} />
        </>
      ) : null}
    </span>
  );
}

function EmptyInvites({ filter, canManage }: { filter: TeamInviteFilter; canManage: boolean }) {
  const waiting = filter === 'pending';
  return (
    <div className="flex flex-col items-center gap-1 py-6 text-center">
      <p className="text-sm font-medium text-foreground">
        {waiting ? 'No invitations waiting' : 'Nothing here'}
      </p>
      <Text variant="caption" className="max-w-[44ch]">
        {waiting
          ? canManage
            ? 'Invite managers and hosts so you aren’t the only person with access.'
            : 'No one is waiting to accept an invitation.'
          : 'No invitations match this filter.'}
      </Text>
    </div>
  );
}

type TeamInvitesTableProps = {
  restaurantId: string;
  canManage: boolean;
  invites: TeamInvite[] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  onRetry: () => void;
};

export function TeamInvitesTable({
  restaurantId,
  canManage,
  invites,
  isLoading,
  isFetching,
  error,
  onRetry,
}: TeamInvitesTableProps) {
  const [filter, setFilter] = useState<TeamInviteFilter>('pending');
  const [revokeTarget, setRevokeTarget] = useState<TeamInvite | null>(null);
  const filterRefs = useRef<Partial<Record<TeamInviteFilter, HTMLButtonElement | null>>>({});
  const revokeInvite = useOpsRevokeTeamInvite();

  // Filtering happens here, over one 'all' list, so every filter can show its count.
  const counts = useMemo(() => countTeamInvites(invites ?? []), [invites]);
  const rows = useMemo(() => filterTeamInvites(invites ?? [], filter), [invites, filter]);

  const handleRevoke = () => {
    const target = revokeTarget;
    if (!target || revokeInvite.isPending) {
      return;
    }
    revokeInvite.mutate(
      { restaurantId, inviteId: target.id },
      {
        onSuccess: () => {
          setRevokeTarget(null);
          toast.success(`Invitation for ${target.email} revoked.`);
          // The revoked row leaves the Waiting list: return focus to the active filter.
          window.requestAnimationFrame(() => filterRefs.current[filter]?.focus());
        },
        onError: (revokeError) => {
          setRevokeTarget(null);
          toast.error('Invitation wasn’t revoked', {
            description: `Reason code ${getSettingsSaveReasonCode(revokeError)}`,
          });
        },
      },
    );
  };

  // The invitation list is only available to owners and managers. For other roles a failed
  // load is expected, so it gets a calm explanation instead of an error.
  const viewOnlyUnavailable = !canManage && error !== null;

  return (
    <SettingsCard
      title="Invitations"
      description="Invitations expire after 7 days."
      contentClassName="flex flex-col gap-4 pt-4"
      footer={
        isFetching && !isLoading ? (
          <Text variant="caption" role="status">
            Refreshing…
          </Text>
        ) : undefined
      }
    >
      {viewOnlyUnavailable ? (
        <div className="py-2">
          <Text variant="caption">
            Only owners and managers can see the invitations for this restaurant.
          </Text>
        </div>
      ) : (
        <>
          <div role="group" aria-label="Filter invitations" className="flex flex-wrap gap-2">
            {TEAM_INVITE_FILTERS.map((option) => {
              const isActive = filter === option.value;
              return (
                <Button
                  key={option.value}
                  ref={(node) => {
                    filterRefs.current[option.value] = node;
                  }}
                  type="button"
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  aria-pressed={isActive}
                  className={COARSE_TARGET_CLASS}
                  onClick={() => setFilter(option.value)}
                >
                  {option.label}{' '}
                  {isLoading ? null : (
                    <span className="tabular-nums opacity-80">{counts[option.value]}</span>
                  )}
                </Button>
              );
            })}
          </div>

          {error ? (
            <div>
              <Alert variant="destructive">
                <AlertCircle className="size-4" aria-hidden />
                <AlertTitle>Invitations couldn’t be loaded</AlertTitle>
                <AlertDescription className="flex flex-col items-start gap-2 text-foreground">
                  <span>
                    Nothing has changed. <span className="text-muted-foreground">Reason code</span>{' '}
                    <span className="font-mono text-xs">{getSettingsSaveReasonCode(error)}</span>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={COARSE_TARGET_CLASS}
                    onClick={onRetry}
                  >
                    <RefreshCw data-icon="inline-start" aria-hidden />
                    Try again
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          {isLoading ? (
            <ul aria-label="Loading invitations" className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <li key={index}>
                  <Skeleton className="h-14 w-full" />
                </li>
              ))}
            </ul>
          ) : error ? null : rows.length === 0 ? (
            <EmptyInvites filter={filter} canManage={canManage} />
          ) : (
            <ul aria-label="Invitations" className="flex flex-col">
              {rows.map((row) => {
                const { invite, status } = row;
                return (
                  <li
                    key={invite.id}
                    data-testid={`team-invite-${invite.id}`}
                    className="flex flex-col items-start gap-1.5 border-t border-border/60 py-3 md:grid md:grid-cols-[minmax(0,1.4fr)_5rem_auto_minmax(0,1fr)_auto] md:items-center md:gap-3"
                  >
                    <span className="min-w-0 max-w-full break-all text-sm font-medium text-foreground">
                      {invite.email}
                    </span>
                    <span className="text-xs text-muted-foreground md:text-sm">
                      {formatTeamRole(invite.role)}
                    </span>
                    <span>
                      <StatusBadge status={status} />
                    </span>
                    <InviteDates row={row} />
                    <span className="flex empty:hidden md:justify-end">
                      {canManage && status === 'pending' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={COARSE_TARGET_CLASS}
                          onClick={() => setRevokeTarget(invite)}
                          disabled={revokeInvite.isPending}
                        >
                          Revoke <span className="sr-only">invitation for {invite.email}</span>
                        </Button>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevokeTarget(null);
          }
        }}
        title="Revoke invitation?"
        description={
          revokeTarget ? (
            <>
              The link sent to <strong className="break-all">{revokeTarget.email}</strong> stops
              working straight away. You can invite them again later.
            </>
          ) : undefined
        }
        confirmLabel={revokeInvite.isPending ? 'Revoking…' : 'Revoke invitation'}
        cancelLabel="Keep invitation"
        tone="destructive"
        onConfirm={handleRevoke}
      />
    </SettingsCard>
  );
}
