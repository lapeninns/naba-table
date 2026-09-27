'use client';

import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useId, useMemo, useState, type ComponentProps } from 'react';

import { ConfirmDialog } from '@/components/features/restaurant-settings/ConfirmDialog';
import {
  SETTINGS_TOUCH_CONTROL_CLASS,
  SettingsCardEmptyState,
  SettingsLoadErrorAlert,
  SettingsRefreshErrorAlert,
  SETTINGS_REFRESH_ERROR_READ_ONLY_COPY,
  SettingsSegmentedControl,
} from '@/components/features/restaurant-settings/shared';
import { SettingsCard } from '@/components/features/restaurant-settings/shared/SettingsCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/typography';
import { useOpsResendTeamInvite, useOpsRevokeTeamInvite } from '@/hooks/ops/useOpsTeamInvitations';
import { cn } from '@/lib/utils';

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

/**
 * One invitation row. Narrow lists stack it: email and status on the first line, then role,
 * dates and actions. From a 48rem-wide list (a container query, so the settings sidebar and the
 * xl aside are accounted for) it becomes one table-like row. Placement uses grid-column/grid-row
 * only, so the wide values override the stacked ones.
 */
const INVITE_ROW_CLASS =
  'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 border-t border-border/60 py-3 @3xl:grid-cols-[minmax(0,1.4fr)_5rem_auto_minmax(0,1fr)_auto] @3xl:items-center @3xl:gap-y-0';
const INVITE_EMAIL_CLASS =
  'col-[1] row-[1] min-w-0 break-all text-sm font-medium leading-6 text-foreground @3xl:col-[1] @3xl:row-[1]';
const INVITE_ROLE_CLASS =
  'col-[1/-1] row-[2] text-xs text-muted-foreground @3xl:col-[2] @3xl:row-[1] @3xl:text-sm';
const INVITE_BADGE_CLASS = 'col-[2] row-[1] pt-0.5 @3xl:col-[3] @3xl:row-[1] @3xl:pt-0';
const INVITE_DATES_CLASS = 'col-[1/-1] row-[3] @3xl:col-[4] @3xl:row-[1]';
const INVITE_ACTIONS_CLASS =
  'col-[1/-1] row-[4] mt-1.5 flex empty:hidden @3xl:col-[5] @3xl:row-[1] @3xl:mt-0 @3xl:justify-end';

const STATUS_BADGES: Record<
  TeamInviteDisplayStatus,
  { variant: ComponentProps<typeof Badge>['variant']; Icon: LucideIcon }
> = {
  pending: { variant: 'status-pending', Icon: Clock },
  expired: { variant: 'status-cancelled', Icon: AlertCircle },
  accepted: { variant: 'status-confirmed', Icon: CheckCircle2 },
  revoked: { variant: 'status-completed', Icon: Ban },
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

function InviteDates({ row, className }: { row: TeamInviteRow; className?: string }) {
  const { invite, status } = row;
  return (
    <span className={cn('text-xs leading-5 text-muted-foreground', className)}>
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
    <SettingsCardEmptyState
      title={waiting ? 'No invitations waiting' : 'Nothing here'}
      description={
        waiting
          ? canManage
            ? 'Invite managers and hosts so you aren’t the only person with access.'
            : 'No one is waiting to accept an invitation.'
          : 'No invitations match this filter.'
      }
    />
  );
}

type RowAction = 'revoke' | 'resend';

/**
 * Invites with a request in flight, per action. Each row tracks its own request, so revoking
 * or resending one invitation leaves the other rows usable.
 */
function usePendingRowActions() {
  const [pending, setPending] = useState<ReadonlyMap<string, RowAction>>(new Map());
  const track = useCallback(<T,>(inviteId: string, action: RowAction, run: () => Promise<T>) => {
    setPending((current) => new Map(current).set(inviteId, action));
    return run().finally(() => {
      setPending((current) => {
        const next = new Map(current);
        next.delete(inviteId);
        return next;
      });
    });
  }, []);
  return { pending, track };
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
  const filterGroupId = useId();
  const revokeInvite = useOpsRevokeTeamInvite();
  const resendInvite = useOpsResendTeamInvite();
  const { pending, track } = usePendingRowActions();

  // Filtering happens here, over one 'all' list, so every filter can show its count.
  const counts = useMemo(() => countTeamInvites(invites ?? []), [invites]);
  const rows = useMemo(() => filterTeamInvites(invites ?? [], filter), [invites, filter]);

  // Success and error toasts come from the hooks' mutation feedback (C3).
  const handleRevoke = () => {
    const target = revokeTarget;
    if (!target || pending.has(target.id)) {
      return;
    }
    setRevokeTarget(null);
    void track(target.id, 'revoke', () =>
      revokeInvite.mutateAsync({ restaurantId, inviteId: target.id }),
    )
      .then(() => {
        // The revoked row leaves the Waiting list: return focus to the active filter.
        window.requestAnimationFrame(() => {
          document
            .getElementById(filterGroupId)
            ?.querySelector<HTMLElement>('[data-state="on"]')
            ?.focus();
        });
      })
      .catch(() => {});
  };

  const handleResend = (invite: TeamInvite) => {
    if (pending.has(invite.id)) {
      return;
    }
    void track(invite.id, 'resend', () =>
      resendInvite.mutateAsync({ restaurantId, inviteId: invite.id }),
    ).catch(() => {});
  };

  // The invitation list is only available to owners and managers. For other roles a failed
  // load is expected, so it gets a calm explanation instead of an error.
  const viewOnlyUnavailable = !canManage && error !== null;
  // Without data a failed load blocks the list; with data a failed refresh keeps the rows.
  const blockingError = invites === undefined ? error : null;
  const refreshError = invites === undefined ? null : error;

  return (
    <SettingsCard
      title="Invitations"
      description="Invitations expire after 7 days. Resending one sends a new link and the old link stops working."
      contentClassName="flex flex-col gap-4"
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
          {blockingError ? (
            <SettingsLoadErrorAlert
              title="Couldn’t load invitations"
              message="Nothing has changed."
              error={blockingError}
              onRetry={onRetry}
              retrying={isFetching}
            />
          ) : (
            <SettingsSegmentedControl
              id={filterGroupId}
              // A flex-column child would otherwise stretch the track across the whole card.
              className="self-start"
              ariaLabel="Filter invitations"
              value={filter}
              onValueChange={setFilter}
              options={TEAM_INVITE_FILTERS.map((option) => ({
                value: option.value,
                label: option.label,
                count: isLoading ? undefined : counts[option.value],
              }))}
            />
          )}

          {refreshError ? (
            <SettingsRefreshErrorAlert
              error={refreshError}
              onRetry={onRetry}
              message={SETTINGS_REFRESH_ERROR_READ_ONLY_COPY}
            />
          ) : null}

          {isLoading ? (
            <ul aria-label="Loading invitations" className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <li key={index}>
                  <Skeleton className="h-14 w-full" />
                </li>
              ))}
            </ul>
          ) : blockingError ? null : rows.length === 0 ? (
            <EmptyInvites filter={filter} canManage={canManage} />
          ) : (
            <ul aria-label="Invitations" className="@container flex flex-col">
              {rows.map((row) => {
                const { invite, status } = row;
                const rowAction = pending.get(invite.id);
                return (
                  <li
                    key={invite.id}
                    data-testid={`team-invite-${invite.id}`}
                    className={INVITE_ROW_CLASS}
                  >
                    <span className={INVITE_EMAIL_CLASS}>{invite.email}</span>
                    <span className={INVITE_ROLE_CLASS}>{formatTeamRole(invite.role)}</span>
                    <span className={INVITE_BADGE_CLASS}>
                      <StatusBadge status={status} />
                    </span>
                    <InviteDates row={row} className={INVITE_DATES_CLASS} />
                    <span className={INVITE_ACTIONS_CLASS}>
                      {canManage && status === 'pending' ? (
                        <span className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={SETTINGS_TOUCH_CONTROL_CLASS}
                            onClick={() => handleResend(invite)}
                            disabled={pending.has(invite.id)}
                            aria-busy={rowAction === 'resend'}
                          >
                            {rowAction === 'resend' ? (
                              <Loader2
                                data-icon="inline-start"
                                className="animate-spin motion-reduce:animate-none"
                                aria-hidden
                              />
                            ) : (
                              <Send data-icon="inline-start" aria-hidden />
                            )}
                            {rowAction === 'resend' ? 'Resending…' : 'Resend'}{' '}
                            <span className="sr-only">invitation for {invite.email}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={SETTINGS_TOUCH_CONTROL_CLASS}
                            onClick={() => setRevokeTarget(invite)}
                            disabled={pending.has(invite.id)}
                            aria-busy={rowAction === 'revoke'}
                          >
                            {rowAction === 'revoke' ? 'Revoking…' : 'Revoke'}{' '}
                            <span className="sr-only">invitation for {invite.email}</span>
                          </Button>
                        </span>
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
        confirmLabel="Revoke invitation"
        cancelLabel="Keep invitation"
        tone="destructive"
        onConfirm={handleRevoke}
      />
    </SettingsCard>
  );
}
