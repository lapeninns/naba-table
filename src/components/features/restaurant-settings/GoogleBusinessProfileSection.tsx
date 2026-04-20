'use client';

import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  RefreshCcw,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { GoogleBusinessProfilePanel } from '@/components/features/restaurant-settings/GoogleBusinessProfilePanel';
import { GoogleBusinessProfileProfileAlignmentPanel } from '@/components/features/restaurant-settings/GoogleBusinessProfileProfileAlignmentPanel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useOpsDisconnectGoogleBusinessProfile,
  useOpsGoogleBusinessProfileConnection,
  useOpsLinkGoogleBusinessProfileLocation,
  useOpsSyncGoogleBusinessProfile,
} from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { cn } from '@/lib/utils';
import {
  OPS_RESTAURANTS_BASE,
  type GoogleBusinessProfileAvailableLocation,
  type GoogleBusinessProfileConnection,
} from '@/services/ops/restaurants';

import { GoogleBusinessProfileAttributesSection } from './GoogleBusinessProfileAttributesSection';
import { GoogleBusinessProfileBusinessInfoPanel } from './GoogleBusinessProfileBusinessInfoPanel';
import { GoogleBusinessProfileCoreAlignmentSections } from './GoogleBusinessProfileCoreAlignmentSections';
import { GoogleBusinessProfileOverviewWorkspace, GoogleBusinessProfileSummaryItem } from './GoogleBusinessProfileOverviewWorkspace';
import { GoogleBusinessProfileSyncActionDialog } from './GoogleBusinessProfileSyncActionDialog';
import {
  formatGoogleBusinessProfileDateTime,
  getGoogleBusinessProfileConnectionStatusLabel,
} from './GoogleBusinessProfileUiHelpers';
import { deriveProfileVerification } from './googleBusinessProfileVerification';
import { SettingsJumpNav, type SettingsJumpNavItem } from './SettingsJumpNav';

type GoogleBusinessProfileSectionProps = {
  restaurantId: string | null;
};

type GoogleBusinessProfileSectionData = NonNullable<
  ReturnType<typeof useOpsGoogleBusinessProfileConnection>['data']
>;

type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  tone: 'success' | 'warning' | 'neutral';
};

function statusSummary(data: GoogleBusinessProfileSectionData): string {
  switch (data.status) {
    case 'linked':
      return 'Google is connected, one Business Profile location is linked, and the latest snapshot is ready for review.';
    case 'authorized':
      return 'Google is authorized. Choose the matching Business Profile location to complete setup.';
    case 'pending_auth':
      return 'The OAuth handoff is in progress. Finish the Google flow to return and continue linking.';
    case 'reauth_required':
      return 'The existing Google authorization can no longer be used. Reconnect to restore sync access.';
    case 'sync_error':
      return 'The connection exists, but the latest sync needs attention before this data can be trusted.';
    default:
      return 'Connect a Google account, link one location, and sync the canonical GBP snapshot for this restaurant.';
  }
}

function buildLocationValue(location: GoogleBusinessProfileAvailableLocation): string {
  return JSON.stringify({
    accountName: location.accountName,
    accountId: location.accountId,
    locationName: location.locationName,
    locationId: location.locationId,
  });
}

function formatTimestamp(value: string | null): string {
  return formatGoogleBusinessProfileDateTime(value) ?? 'Not yet synced';
}

function countProfileDrifts(
  profileVerification: ReturnType<typeof deriveProfileVerification>,
): number {
  return Object.values(profileVerification.fields).filter((field) => field.status === 'drifted')
    .length;
}

function countNormalizationDrifts(data: GoogleBusinessProfileSectionData): number {
  const normalization = data.businessInfo.coreNormalization;

  const operatingDrifts =
    normalization.operatingHours.weekly.filter((row) => row.matchesCore === false).length +
    normalization.operatingHours.overrides.filter((row) => row.matchesCore === false).length;

  const serviceDrifts = normalization.servicePeriods.periods.filter(
    (row) => row.matchesCore === false,
  ).length;

  return operatingDrifts + serviceDrifts;
}

function buildActivityItems(data: GoogleBusinessProfileSectionData): ActivityItem[] {
  const items: ActivityItem[] = [];

  if (data.lastError) {
    items.push({
      id: 'error',
      title: 'Sync needs attention',
      detail: data.lastError,
      tone: 'warning',
    });
  }

  if (data.lastPullAt) {
    items.push({
      id: 'pull',
      title: 'Business snapshot refreshed',
      detail: `Google data last fetched ${formatTimestamp(data.lastPullAt)}.`,
      tone: 'success',
    });
  }

  if (data.lastPushAt) {
    items.push({
      id: 'push',
      title: 'Changes pushed to Google',
      detail: `Latest push completed ${formatTimestamp(data.lastPushAt)}.`,
      tone: 'success',
    });
  }

  if (data.externalLocationTitle) {
    items.push({
      id: 'linked',
      title: 'Location linked',
      detail: `${data.externalLocationTitle} is the active Google Business Profile location for this restaurant.`,
      tone: 'neutral',
    });
  }

  if (items.length === 0) {
    items.push({
      id: 'empty',
      title: 'No activity yet',
      detail: 'Connect Google and run the first sync to populate the workspace history.',
      tone: 'neutral',
    });
  }

  return items;
}

function SectionSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/60 bg-background/95 p-6">
        <div className="space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-4 w-full max-w-3xl" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-[640px] w-full" />
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: GoogleBusinessProfileConnection['status'];
}) {
  const tone =
    status === 'linked'
      ? {
          label: 'Active sync',
          icon: CheckCircle2,
          className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        }
      : status === 'sync_error' || status === 'reauth_required'
        ? {
            label: 'Needs attention',
            icon: AlertCircle,
            className: 'border-amber-200 bg-amber-50 text-amber-700',
          }
        : {
            label: getGoogleBusinessProfileConnectionStatusLabel(status),
            icon: ShieldCheck,
            className: 'border-border bg-background text-muted-foreground',
          };

  const Icon = tone.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
        tone.className,
      )}
    >
      <Icon className="size-3.5" />
      {tone.label}
    </Badge>
  );
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-background/95 px-5 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Sync health &amp; activity</h3>
          <p className="text-sm text-muted-foreground">
            Recent connection and snapshot events that explain the current sync state for this
            restaurant.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'mt-1 size-2 rounded-full',
                  item.tone === 'success'
                    ? 'bg-emerald-500'
                    : item.tone === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-slate-400',
                )}
              />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.detail}</p>
              </div>
            </div>
            <Badge variant="outline" className="w-fit">
              {item.tone === 'success'
                ? 'Healthy'
                : item.tone === 'warning'
                  ? 'Check'
                  : 'Info'}
            </Badge>
          </div>
        ))}
      </div>
    </section>
  );
}

const GBP_JUMP_ITEMS: SettingsJumpNavItem[] = [
  { id: 'gbp-connection', label: 'Connection' },
  { id: 'gbp-sync', label: 'Sync health' },
  { id: 'gbp-profile', label: 'Profile alignment' },
  { id: 'gbp-availability', label: 'Availability alignment' },
  { id: 'gbp-context', label: 'Business context' },
];

export function GoogleBusinessProfileSection({ restaurantId }: GoogleBusinessProfileSectionProps) {
  const searchParams = useSearchParams();
  const connectionQuery = useOpsGoogleBusinessProfileConnection(restaurantId);
  const profileQuery = useOpsRestaurantDetails(restaurantId);
  const linkMutation = useOpsLinkGoogleBusinessProfileLocation(restaurantId);
  const disconnectMutation = useOpsDisconnectGoogleBusinessProfile(restaurantId);
  const syncMutation = useOpsSyncGoogleBusinessProfile(restaurantId);
  const [selectedLocationValue, setSelectedLocationValue] = useState('');
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);

  useEffect(() => {
    const gbpStatus = searchParams.get('gbp');
    const message = searchParams.get('message');
    if (!gbpStatus) {
      return;
    }

    if (gbpStatus === 'connected') {
      toast.success('Google Business Profile connected. Choose a location to finish linking.');
    } else if (gbpStatus === 'error') {
      toast.error(message ?? 'Google Business Profile connection failed.');
    }

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('gbp');
      url.searchParams.delete('message');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  const data = connectionQuery.data;

  useEffect(() => {
    if (!data) {
      return;
    }

    if (data.externalLocationName && data.externalAccountName) {
      const linkedLocation = data.availableLocations.find(
        (location) =>
          location.locationName === data.externalLocationName &&
          location.accountName === data.externalAccountName,
      );
      if (linkedLocation) {
        setSelectedLocationValue(buildLocationValue(linkedLocation));
        return;
      }
    }

    if (!selectedLocationValue && data.availableLocations[0]) {
      setSelectedLocationValue(buildLocationValue(data.availableLocations[0]));
    }
  }, [data, selectedLocationValue]);

  if (!restaurantId) {
    return (
      <GoogleBusinessProfilePanel
        title="Google Business Profile"
        description="Connect a Google account and link the matching Business Profile location for the active restaurant."
      >
        <p className="text-sm text-muted-foreground">
          Select a restaurant using the sidebar switcher to manage its Google Business Profile
          connection.
        </p>
      </GoogleBusinessProfilePanel>
    );
  }

  if (connectionQuery.isLoading && !data) {
    return <SectionSkeleton />;
  }

  if (connectionQuery.error) {
    return (
      <GoogleBusinessProfilePanel
        title="Google Business Profile"
        description="Connect Google, choose the correct location, and keep the canonical business profile in sync."
      >
        <Alert variant="destructive">
          <AlertTitle>Unable to load Google Business Profile</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{connectionQuery.error.message}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void connectionQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </GoogleBusinessProfilePanel>
    );
  }

  if (!data) {
    return null;
  }

  const selectedLocation =
    data.availableLocations.find(
      (location) => buildLocationValue(location) === selectedLocationValue,
    ) ?? null;
  const connectHref = `${OPS_RESTAURANTS_BASE}/${restaurantId}/google-business-profile/connect`;
  const hasLinkedLocation = Boolean(data.externalLocationId);
  const manageOnGoogleHref = data.externalPlaceId
    ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(data.externalPlaceId)}`
    : null;
  const profileVerification = deriveProfileVerification({
    profile: profileQuery.data,
    connection: data,
  });
  const totalDriftCount =
    countProfileDrifts(profileVerification) + countNormalizationDrifts(data);
  const noteCount =
    profileVerification.warnings.length +
    data.businessInfo.coreNormalization.operatingHours.warnings.length +
    data.businessInfo.coreNormalization.servicePeriods.warnings.length +
    data.businessInfo.coreNormalization.bookingHours.warnings.length;
  const activityItems = buildActivityItems(data);
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-background/95">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.06),transparent_30%)]" />
        <div className="relative px-5 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusPill status={data.status} />
                  <span className="text-xs text-muted-foreground">
                    Last sync: {formatTimestamp(data.lastPullAt)}
                  </span>
                </div>

                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                    Google Business Profile
                  </h2>
                  <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
                    {statusSummary(data)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void connectionQuery.refetch()}
                  disabled={connectionQuery.isFetching}
                >
                  <RefreshCcw className={cn('size-4', connectionQuery.isFetching && 'animate-spin')} />
                  Refresh
                </Button>
                <Button type="button" size="sm" asChild disabled={!data.isConfigured}>
                  <a href={connectHref}>
                    <ShieldCheck className="size-4" />
                    {data.status === 'unlinked' ? 'Connect Google' : 'Reconnect Google'}
                  </a>
                </Button>
                {hasLinkedLocation ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setSyncDialogOpen(true)}
                    disabled={syncMutation.isPending}
                  >
                    <RefreshCcw className={cn('size-4', syncMutation.isPending && 'animate-spin')} />
                    {syncMutation.isPending ? 'Syncing...' : 'Sync now'}
                  </Button>
                ) : null}
                {manageOnGoogleHref ? (
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={manageOnGoogleHref} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" />
                      Manage on Google
                    </a>
                  </Button>
                ) : null}
                {data.status !== 'unlinked' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      disconnectMutation.mutate(undefined, {
                        onSuccess: () => {
                          setSelectedLocationValue('');
                          toast.success('Google Business Profile disconnected.');
                        },
                        onError: (error) => {
                          toast.error(error.message);
                        },
                      })
                    }
                    disabled={disconnectMutation.isPending}
                  >
                    <Unplug className="size-4" />
                    {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl border border-border/60 bg-background/60 p-4 md:grid-cols-3">
              <GoogleBusinessProfileSummaryItem
                label="Connection"
                value={
                  data.connectedGoogleEmail
                    ? (data.externalLocationTitle ?? 'No location linked')
                    : 'Not connected'
                }
                detail={
                  data.connectedGoogleEmail
                    ? `Authorized as ${data.connectedGoogleEmail}${
                        data.availableLocations.length
                          ? ` · ${data.availableLocations.length} location${data.availableLocations.length === 1 ? '' : 's'} available`
                          : ''
                      }`
                    : `${data.availableLocations.length} location${data.availableLocations.length === 1 ? '' : 's'} discoverable once you connect`
                }
              />
              <GoogleBusinessProfileSummaryItem
                label="Alignment"
                value={
                  totalDriftCount === 0
                    ? 'In sync with Google'
                    : `${totalDriftCount} item${totalDriftCount === 1 ? '' : 's'} need review`
                }
                detail={
                  noteCount > 0
                    ? `${noteCount} normalization note${noteCount === 1 ? '' : 's'} · see details below`
                    : 'Profile and availability currently match the snapshot'
                }
              />
              <GoogleBusinessProfileSummaryItem
                label="Latest snapshot"
                value={formatTimestamp(data.lastPullAt)}
                detail={
                  data.lastPushAt
                    ? `Last push ${formatTimestamp(data.lastPushAt)}`
                    : 'No push to Google recorded yet'
                }
              />
            </div>

            {!data.isConfigured ? (
              <Alert>
                <AlertTitle>Integration not configured</AlertTitle>
                <AlertDescription>
                  Google Business Profile credentials are not available in this environment yet, so
                  the dashboard cannot start the OAuth flow.
                </AlertDescription>
              </Alert>
            ) : null}

            {data.lastError ? (
              <Alert variant="destructive">
                <AlertTitle>Connection notice</AlertTitle>
                <AlertDescription>{data.lastError}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <SettingsJumpNav items={GBP_JUMP_ITEMS} ariaLabel="Google Business Profile sections" />

        <div className="min-w-0 flex-1 space-y-6">
        <div id="gbp-connection" className="space-y-6 scroll-mt-24">
          <GoogleBusinessProfileOverviewWorkspace
            data={data}
            selectedLocation={selectedLocation}
            selectedLocationValue={selectedLocationValue}
            onSelectedLocationValueChange={setSelectedLocationValue}
            buildLocationValue={buildLocationValue}
            onLinkLocation={() => {
              if (!selectedLocation) {
                toast.error('Choose a location before linking.');
                return;
              }

              linkMutation.mutate(
                {
                  accountName: selectedLocation.accountName,
                  accountId: selectedLocation.accountId,
                  locationName: selectedLocation.locationName,
                  locationId: selectedLocation.locationId,
                },
                {
                  onSuccess: () => {
                    toast.success('Google Business Profile location linked.');
                  },
                  onError: (error) => {
                    toast.error(error.message);
                  },
                },
              );
            }}
            isLinking={linkMutation.isPending}
            hasLinkedLocation={hasLinkedLocation}
          />
        </div>

        <div id="gbp-sync" className="space-y-6 scroll-mt-24">
          <ActivityFeed items={activityItems} />
        </div>

        <div id="gbp-profile" className="scroll-mt-24">
          <GoogleBusinessProfileProfileAlignmentPanel
            profile={profileQuery.data}
            profileVerification={profileVerification}
            isProfileLoading={profileQuery.isLoading && !profileQuery.data}
            profileError={profileQuery.error?.message ?? null}
            connectionStatus={data.status}
          />
        </div>

        <div id="gbp-availability" className="scroll-mt-24">
          <GoogleBusinessProfileCoreAlignmentSections
            coreNormalization={data.businessInfo.coreNormalization ?? null}
          />
        </div>

        <div id="gbp-context" className="space-y-6 scroll-mt-24">
          <GoogleBusinessProfileBusinessInfoPanel
            businessName={data.externalLocationTitle}
            businessInfo={data.businessInfo}
            lastPullAt={data.lastPullAt}
          />

          <GoogleBusinessProfileAttributesSection attributes={data.businessInfo.attributes} />
        </div>
        </div>
      </div>

      <GoogleBusinessProfileSyncActionDialog
        open={syncDialogOpen}
        onOpenChange={setSyncDialogOpen}
        title="Fetch latest GBP business information"
        description="Refresh Nabatable's canonical GBP business-information snapshot. This updates the fetched GBP data and verification metadata, but it does not overwrite core profile, hours, or service-period values."
        confirmLabel="Fetch from GBP"
        isPending={syncMutation.isPending}
        errorMessage={syncMutation.error?.message ?? null}
        onConfirm={({ password }) => {
          syncMutation.mutate(
            { password },
            {
              onSuccess: (state) => {
                setSyncDialogOpen(false);
                const warning = state.lastError;
                if (warning) {
                  toast.success('Business information synced, with a partial warning.');
                  toast.warning(warning);
                  return;
                }
                toast.success('Google Business Profile business information synced.');
              },
              onError: (error) => {
                toast.error(error.message);
              },
            },
          );
        }}
      />
    </div>
  );
}
