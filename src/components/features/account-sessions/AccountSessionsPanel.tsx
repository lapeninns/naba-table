'use client';

import { format, formatDistanceToNowStrict } from 'date-fns';
import {
  CalendarClock,
  CircleHelp,
  Clock3,
  Globe2,
  History,
  Languages,
  Laptop,
  MapPin,
  MonitorSmartphone,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Tablet,
} from 'lucide-react';
import { useState } from 'react';

import { OpsStatusBadge } from '@/components/features/ops-shell/patterns/OpsStatusBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountSessions, useRenameAccountDevice } from '@/hooks/useAccountSessions';
import { cn } from '@/lib/utils';

import type { AccountSession } from '@/lib/account/session-schema';
import type { LucideIcon } from 'lucide-react';

type AccountSessionsPanelProps = {
  className?: string;
};

const deviceIcons: Record<AccountSession['device']['kind'], LucideIcon> = {
  desktop: Laptop,
  mobile: Smartphone,
  tablet: Tablet,
  unknown: MonitorSmartphone,
};

function formatRelativeDate(value: string): string {
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true });
}

function formatExactDate(value: string): string {
  return format(new Date(value), "d MMM yyyy 'at' HH:mm");
}

function SessionTimestamp({ value }: { value: string }) {
  return (
    <time dateTime={value} title={formatExactDate(value)}>
      {formatRelativeDate(value)}
    </time>
  );
}

function formatLocation(session: AccountSession): string | null {
  const location = session.approximateLocation;
  if (!location) return null;
  return [location.city ?? location.region, location.countryCode].filter(Boolean).join(', ');
}

function RenameDeviceDialog({ session }: { session: AccountSession }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(session.device.name ?? '');
  const renameMutation = useRenameAccountDevice();

  if (!session.device.id) return null;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setName(session.device.name ?? '');
      renameMutation.reset();
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    renameMutation.mutate(
      { deviceId: session.device.id!, name },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          aria-label={`Rename ${session.device.name ?? session.device.label}`}
        >
          <Pencil className="size-3.5" aria-hidden />
          Rename
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Name this device</DialogTitle>
            <DialogDescription>
              Use a familiar name such as “Reception iPad”. Only you can see it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-5">
            <Label htmlFor={`device-name-${session.id}`}>Device name</Label>
            <Input
              id={`device-name-${session.id}`}
              value={name}
              maxLength={60}
              autoComplete="off"
              placeholder={session.device.label}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
            {renameMutation.isError ? (
              <p className="text-sm text-destructive">Couldn’t rename this device. Try again.</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={renameMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || renameMutation.isPending}>
              {renameMutation.isPending ? 'Saving…' : 'Save name'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SessionRow({ session }: { session: AccountSession }) {
  const DeviceIcon = deviceIcons[session.device.kind];
  const location = formatLocation(session);
  const displayName = session.device.name ?? session.device.label;

  return (
    <li className="grid gap-4 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start sm:px-5">
      <div
        className={cn(
          'flex size-10 items-center justify-center rounded-xl border bg-background text-muted-foreground',
          session.isCurrent && 'border-primary/30 bg-primary/5 text-primary',
        )}
      >
        <DeviceIcon className="size-5" aria-hidden />
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-start gap-2">
          <h3 className="font-semibold text-foreground">{displayName}</h3>
          {session.isCurrent ? <OpsStatusBadge label="This device" tone="info" /> : null}
          {!session.isCurrent && session.isActive ? (
            <OpsStatusBadge label="Active" tone="success" />
          ) : null}
          {!session.isActive ? <OpsStatusBadge label="Ended" tone="neutral" /> : null}
          {session.assuranceLevel === 'aal2' || session.assuranceLevel === 'aal3' ? (
            <OpsStatusBadge label="2-step verified" tone="success" />
          ) : null}
        </div>

        {session.device.name ? (
          <p className="text-sm text-muted-foreground">{session.device.label}</p>
        ) : null}

        <dl className="grid gap-x-6 gap-y-1.5 text-sm text-muted-foreground sm:grid-cols-2">
          <div className="flex min-w-0 items-center gap-2">
            <Clock3 className="size-4 shrink-0" aria-hidden />
            <dt className="sr-only">Signed in</dt>
            <dd>
              Signed in <SessionTimestamp value={session.signedInAt} />
            </dd>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <RefreshCw className="size-4 shrink-0" aria-hidden />
            <dt className="sr-only">Last active</dt>
            <dd>
              {session.isCurrent ? 'Active now' : 'Last used'}{' '}
              {!session.isCurrent ? <SessionTimestamp value={session.lastActiveAt} /> : null}
            </dd>
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:col-span-2">
            <MapPin className="size-4 shrink-0" aria-hidden />
            <dt className="sr-only">Approximate location</dt>
            <dd>{location ? `${location} (approximate)` : 'Approximate location unavailable'}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-2">
          <RenameDeviceDialog session={session} />
          <details className="group text-sm text-muted-foreground">
            <summary
              className="w-fit cursor-pointer list-none rounded-md px-2 py-1 text-xs font-medium hover:bg-muted hover:text-foreground"
              aria-label={`Session details for ${displayName}`}
            >
              Session details
            </summary>
            <dl className="mt-2 grid gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 sm:grid-cols-2">
              <div className="flex min-w-0 items-center gap-2">
                <ShieldCheck className="size-4 shrink-0" aria-hidden />
                <dt className="sr-only">Security</dt>
                <dd>
                  {session.assuranceLevel === 'aal2' || session.assuranceLevel === 'aal3'
                    ? 'Two-step verification used'
                    : 'Standard sign-in'}
                </dd>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <CalendarClock className="size-4 shrink-0" aria-hidden />
                <dt className="sr-only">Session expiry or end</dt>
                <dd>
                  {session.signedOutAt ? (
                    <>
                      Ended <SessionTimestamp value={session.signedOutAt} />
                    </>
                  ) : session.expiresAt ? (
                    <>
                      Expires <SessionTimestamp value={session.expiresAt} />
                    </>
                  ) : (
                    'Expiry managed automatically'
                  )}
                </dd>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <RefreshCw className="size-4 shrink-0" aria-hidden />
                <dt className="sr-only">Credentials refreshed</dt>
                <dd>
                  {session.refreshedAt ? (
                    <>
                      Refreshed <SessionTimestamp value={session.refreshedAt} />
                    </>
                  ) : (
                    'Refresh time unavailable'
                  )}
                </dd>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <History className="size-4 shrink-0" aria-hidden />
                <dt className="sr-only">Device history</dt>
                <dd>
                  {session.device.firstSeenAt ? (
                    <>
                      First seen <SessionTimestamp value={session.device.firstSeenAt} />
                      {session.device.sessionCount > 0
                        ? ` · ${session.device.sessionCount} ${session.device.sessionCount === 1 ? 'session' : 'sessions'}`
                        : null}
                    </>
                  ) : (
                    'Device history starts with this session'
                  )}
                </dd>
              </div>
              {session.device.timeZone ? (
                <div className="flex min-w-0 items-center gap-2">
                  <Globe2 className="size-4 shrink-0" aria-hidden />
                  <dt className="sr-only">Time zone</dt>
                  <dd>{session.device.timeZone}</dd>
                </div>
              ) : null}
              {session.device.locale ? (
                <div className="flex min-w-0 items-center gap-2">
                  <Languages className="size-4 shrink-0" aria-hidden />
                  <dt className="sr-only">Browser language</dt>
                  <dd>{session.device.locale}</dd>
                </div>
              ) : null}
              <div className="flex min-w-0 items-center gap-2 sm:col-span-2">
                <MapPin className="size-4 shrink-0" aria-hidden />
                <dt className="sr-only">IP address</dt>
                <dd className="truncate font-[var(--pg-font-mono)] text-xs">
                  {session.ipAddress ? `IP ${session.ipAddress}` : 'IP address unavailable'}
                </dd>
              </div>
            </dl>
          </details>
        </div>
      </div>

      <div className="hidden pt-1 text-right text-xs text-muted-foreground sm:block">
        {session.isActive ? 'Connected' : 'Recent history'}
      </div>
    </li>
  );
}

function SessionGroup({
  title,
  description,
  sessions,
}: {
  title: string;
  description: string;
  sessions: AccountSession[];
}) {
  if (sessions.length === 0) return null;

  return (
    <Card className="overflow-hidden border-border/70 shadow-none">
      <CardHeader className="border-b border-border/70 bg-muted/25 px-4 py-4 sm:px-5">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border/70">
          {sessions.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SessionsLoading() {
  return (
    <div className="space-y-4" aria-label="Loading device sessions" aria-busy="true">
      {[0, 1].map((group) => (
        <Card key={group} className="overflow-hidden border-border/70 shadow-none">
          <CardHeader className="border-b border-border/70 px-5 py-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </CardHeader>
          <CardContent className="flex gap-4 px-5 py-5">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-52 max-w-full" />
              <Skeleton className="h-4 w-72 max-w-full" />
              <Skeleton className="h-4 w-40 max-w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AccountSessionsPanel({ className }: AccountSessionsPanelProps) {
  const sessionsQuery = useAccountSessions();

  if (sessionsQuery.isPending) {
    return <SessionsLoading />;
  }

  if (sessionsQuery.isError) {
    return (
      <Alert variant="destructive" className={className}>
        <CircleHelp className="size-4" aria-hidden />
        <AlertTitle>Couldn’t load devices</AlertTitle>
        <AlertDescription>
          <span>Your session history is temporarily unavailable.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 w-fit"
            onClick={() => void sessionsQuery.refetch()}
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const activeSessions = sessionsQuery.data.filter((session) => session.isActive);
  const endedSessions = sessionsQuery.data.filter((session) => !session.isActive);

  if (sessionsQuery.data.length === 0) {
    return (
      <Alert className={className}>
        <MonitorSmartphone className="size-4" aria-hidden />
        <AlertTitle>No session activity yet</AlertTitle>
        <AlertDescription>
          This device will appear after its first activity check. Older sessions from before this
          feature was enabled may not be available.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <SessionGroup
        title="Connected devices"
        description="Sessions that can currently access this account."
        sessions={activeSessions}
      />
      <SessionGroup
        title="Recent session history"
        description="Signed-out and expired sessions, ordered by their last activity."
        sessions={endedSessions}
      />
      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        Activity updates while the app is open. Device names are estimated from the browser, and
        session history starts when this feature is enabled.
      </p>
    </div>
  );
}
