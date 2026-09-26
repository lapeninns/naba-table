'use client';

import { AlertCircle, OctagonAlert, Unplug } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { HttpError } from '@/lib/http/errors';
import { cn } from '@/lib/utils';

import { GbpPublishOutcomeBadge } from '../../dual-sync/GbpPublishOutcomeBadge';
import { getSafeSettingsErrorMessage } from '../../shared/settingsErrorCopy';
import { formatGbpTime } from '../gbpPageModel';

import type { useOpsGbpOperatorState } from '@/hooks/ops/useOpsGoogleBusinessProfile';
import type { GbpTerminalNoticesResponseV1 } from '@/services/ops/dual-sync';

export type GbpOperatorQueries = ReturnType<typeof useOpsGbpOperatorState>;

type SyncControls = {
  readonly paused: boolean;
  readonly pauseReason: string;
  readonly queued: number;
  readonly toggle: {
    readonly label: string;
    readonly onClick: () => void;
    readonly disabled: boolean;
  };
  readonly publishQueued: {
    readonly label: string;
    readonly onClick: () => void;
    readonly disabled: boolean;
    readonly hint: string | null;
  };
};

export type GbpOperationsPanelProps = {
  /** Write state and the password-confirmed switches; null for staff who cannot manage settings. */
  readonly operator: GbpOperatorQueries | null;
  /** Pause/resume and queued changes; null when the comparison workspace is unavailable. */
  readonly sync: SyncControls | null;
  /** Lazy diagnostic panels (health, jobs, operations). */
  readonly diagnostics: ReactNode | null;
  readonly onRequestDisconnect: (() => void) | null;
  readonly isDisconnecting: boolean;
};

function Card({
  title,
  description,
  action,
  wide = false,
  children,
  testId,
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  wide?: boolean;
  children?: ReactNode;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className={cn('min-w-0 rounded-xl border bg-background', wide && '@4xl:col-span-2')}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 pt-4 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-0.5 max-w-[72ch] text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      <div className="grid gap-3 px-4 pb-4 pt-3 sm:px-5">{children}</div>
    </section>
  );
}

function ControlRow({
  title,
  detail,
  action,
}: {
  title: string;
  detail: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t py-2.5 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-[1_1_220px]">
        <b className="block font-semibold">{title}</b>
        <span className="text-sm text-muted-foreground">{detail}</span>
      </div>
      {action}
    </div>
  );
}

const CONTROL_UPDATE_FAILED = 'Google controls could not be updated.';

function WritesCard({ operator }: { operator: GbpOperatorQueries }) {
  const [password, setPassword] = useState('');
  const [passwordMissing, setPasswordMissing] = useState(false);
  const state = operator.connectionQuery.data ?? operator.setWriteAccessMutation.data;
  const pending =
    operator.setWriteAccessMutation.isPending ||
    operator.setNotificationParticipationMutation.isPending;
  const mutationError =
    operator.setWriteAccessMutation.error ??
    operator.setNotificationParticipationMutation.error ??
    null;

  const runProtected = async (kind: 'write' | 'notifications') => {
    if (!state) return;
    if (!password) {
      setPasswordMissing(true);
      document.getElementById('gbp-operator-password')?.focus();
      return;
    }
    try {
      if (kind === 'write') {
        await operator.setWriteAccessMutation.mutateAsync({
          eligible: state.writeState !== 'eligible',
          password,
        });
        toast.success(
          state.writeState === 'eligible'
            ? 'Google writes turned off.'
            : 'Google writes turned on.',
        );
      } else {
        await operator.setNotificationParticipationMutation.mutateAsync({
          enabled: !state.notifications.enabled,
          password,
        });
        toast.success(
          state.notifications.enabled
            ? 'Google notifications turned off.'
            : 'Google notifications turned on.',
        );
      }
      setPassword('');
    } catch (error) {
      toast.error(getSafeSettingsErrorMessage(error, CONTROL_UPDATE_FAILED));
    }
  };

  let body: ReactNode;
  if (operator.connectionQuery.isLoading) {
    body = (
      <p role="status" className="text-sm text-muted-foreground">
        Loading Google write controls…
      </p>
    );
  } else if (operator.connectionQuery.error || !state) {
    body = (
      <Alert variant="destructive">
        <OctagonAlert className="size-4" aria-hidden />
        <AlertTitle>Unavailable</AlertTitle>
        <AlertDescription>Write state could not be loaded. Writes stay off.</AlertDescription>
      </Alert>
    );
  } else {
    const writesOn = state.writeState === 'eligible';
    body = (
      <>
        <ControlRow
          title={`Google writes: ${writesOn ? 'on' : 'off'}`}
          detail={
            <>
              <span className="font-mono text-xs">{state.writeState}</span>
              {state.reasonCode ? (
                <>
                  {' · '}
                  <span className="font-mono text-xs">{state.reasonCode}</span>
                </>
              ) : null}
            </>
          }
          action={
            <Button
              type="button"
              size="sm"
              variant={writesOn ? 'destructive' : 'outline'}
              disabled={
                pending || state.writeState === 'revoking' || (!writesOn && !state.rollout.eligible)
              }
              onClick={() => void runProtected('write')}
            >
              {writesOn ? 'Turn off Google writes' : 'Turn on Google writes'}
            </Button>
          }
        />
        {state.pendingUpdates.state === 'known' ? (
          <ControlRow
            title="Pending Google updates"
            detail={
              <span className="mt-1 flex flex-wrap gap-1">
                {[
                  ...state.pendingUpdates.locationMasks,
                  ...state.pendingUpdates.attributePaths,
                ].map((path) => (
                  <Badge key={path} variant="outline" className="font-mono font-normal">
                    {path}
                  </Badge>
                ))}
              </span>
            }
            action={null}
          />
        ) : null}
        <ControlRow
          title={`Google notifications: ${state.notifications.enabled ? 'on' : 'off'}`}
          detail={
            state.notifications.enabled
              ? `Participating · ${state.notifications.refCount} linked ${state.notifications.refCount === 1 ? 'location shares' : 'locations share'} the topic`
              : 'Nabatable is not told when the listing changes on Google'
          }
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => void runProtected('notifications')}
            >
              {state.notifications.enabled ? 'Turn off notifications' : 'Turn on notifications'}
            </Button>
          }
        />
        {mutationError ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" aria-hidden />
            <AlertTitle>
              {mutationError instanceof HttpError &&
              mutationError.code === 'GBP_NOTIFICATION_TOPIC_CONFLICT'
                ? 'Google notification topic conflict'
                : 'Google control update failed'}
            </AlertTitle>
            <AlertDescription>
              {getSafeSettingsErrorMessage(mutationError, CONTROL_UPDATE_FAILED)}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="grid max-w-sm gap-1.5">
          <Label htmlFor="gbp-operator-password">Confirm your password</Label>
          <Input
            id="gbp-operator-password"
            type="password"
            autoComplete="current-password"
            aria-describedby="gbp-operator-password-help"
            aria-invalid={passwordMissing || undefined}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordMissing(false);
            }}
            disabled={pending}
          />
          <p
            id="gbp-operator-password-help"
            className={cn(
              'text-xs',
              passwordMissing ? 'font-semibold text-destructive' : 'text-muted-foreground',
            )}
          >
            {passwordMissing
              ? 'Enter your password to confirm.'
              : 'Needed for either change above.'}
          </p>
        </div>
      </>
    );
  }

  return (
    <Card
      testId="gbp-operator-controls"
      title="Google writes and notifications"
      description="Each change asks for your password. Turning writes off stops all publishing straight away."
    >
      {body}
    </Card>
  );
}

/** What to do about one outcome; a notice can carry a provider and an operational instruction. */
function outcomeActions(notice: GbpTerminalNoticesResponseV1['notices'][number]): string[] {
  const actions: string[] = [];
  if (notice.providerInstruction === 'refresh_then_create_new_preview') {
    actions.push('Get the latest from Google, check the listing, then create a new preview.');
  }
  if (
    notice.operationalDeliveryInstruction === 'in_app_notice_available_verify_operational_channel'
  ) {
    actions.push('Verify the operational notification channel.');
  }
  if (!actions.length) {
    actions.push(
      notice.terminal_kind === 'failed' ? 'Check the value, then send it again.' : 'Nothing to do.',
    );
  }
  return actions;
}

function OutcomesCard({ operator }: { operator: GbpOperatorQueries }) {
  const data = operator.terminalNoticesQuery.data;
  return (
    <Card
      wide
      title="Provider outcomes"
      description="What Google confirmed for each write. An unknown outcome is never shown as success."
      action={
        data ? (
          <span className="text-xs text-muted-foreground">As of {formatGbpTime(data.asOf)}</span>
        ) : null
      }
    >
      {!data ? (
        <p className="text-sm text-muted-foreground">
          {operator.terminalNoticesQuery.isLoading
            ? 'Loading outcomes…'
            : 'No outcome data is available.'}
        </p>
      ) : data.notices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No provider outcomes yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Safe reason code</TableHead>
                <TableHead>What to do</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.notices.map((notice) => (
                <TableRow key={notice.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatGbpTime(notice.terminal_at)}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-2">
                      <GbpPublishOutcomeBadge status={notice.terminal_kind} />
                      <span className="font-mono text-xs text-muted-foreground">
                        {notice.status}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{notice.safe_reason_code}</TableCell>
                  <TableCell>
                    {outcomeActions(notice).map((action) => (
                      <span key={action} className="block">
                        {action}
                      </span>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

/** Operations: the controls and evidence behind publishing, for admins and on-call staff. */
export function GbpOperationsPanel({
  operator,
  sync,
  diagnostics,
  onRequestDisconnect,
  isDisconnecting,
}: GbpOperationsPanelProps) {
  return (
    <div className="@container">
      <div className="grid gap-4 @4xl:grid-cols-2">
        {operator ? <WritesCard operator={operator} /> : null}
        {sync ? (
          <Card
            title="Sync"
            description={
              sync.paused
                ? 'Paused. Nothing is compared or published.'
                : 'Active. Nabatable compares with Google when you get the latest.'
            }
          >
            <ControlRow
              title={sync.paused ? 'Sync paused' : 'Sync active'}
              detail={sync.paused ? sync.pauseReason : 'Pausing clears undecided choices.'}
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-gbp-action="control"
                  onClick={sync.toggle.onClick}
                  disabled={sync.toggle.disabled}
                >
                  {sync.toggle.label}
                </Button>
              }
            />
            <ControlRow
              title={`${sync.queued} ${sync.queued === 1 ? 'change' : 'changes'} queued for Google`}
              detail={
                sync.publishQueued.hint ??
                'Changes saved in Nabatable that are waiting to be sent to Google.'
              }
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-gbp-action="autoExport"
                  onClick={sync.publishQueued.onClick}
                  disabled={sync.publishQueued.disabled}
                >
                  {sync.publishQueued.label}
                </Button>
              }
            />
          </Card>
        ) : null}
        {operator ? <OutcomesCard operator={operator} /> : null}
        {diagnostics ? (
          <Card
            wide
            title="Diagnostics"
            description="Operational health, pending changes, queue recovery, publishes and operations. Loaded when opened."
          >
            {diagnostics}
          </Card>
        ) : null}
        {onRequestDisconnect ? (
          <Card
            wide
            title="Disconnect"
            description="Nabatable stops comparing with this Google listing and publishing to it. The listing on Google and your Nabatable settings stay as they are."
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="gbp-disconnect-button"
                onClick={onRequestDisconnect}
                disabled={isDisconnecting}
              >
                <Unplug data-icon="inline-start" aria-hidden />
                {isDisconnecting ? 'Disconnecting…' : 'Disconnect Google…'}
              </Button>
            }
          />
        ) : null}
      </div>
    </div>
  );
}
