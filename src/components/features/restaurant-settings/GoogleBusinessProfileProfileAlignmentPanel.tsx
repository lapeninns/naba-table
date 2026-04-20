'use client';

import { ExternalLink, Link2, MapPin, Phone, Store } from 'lucide-react';
import Link from 'next/link';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import { GoogleBusinessProfilePanel } from './GoogleBusinessProfilePanel';

import type { deriveProfileVerification } from './googleBusinessProfileVerification';
import type {
  GoogleBusinessProfileConnection,
  GoogleBusinessProfileProfileField,
  RestaurantProfile,
} from '@/services/ops/restaurants';
import type { LucideIcon } from 'lucide-react';

type GoogleBusinessProfileProfileAlignmentPanelProps = {
  profile: RestaurantProfile | null | undefined;
  profileVerification: ReturnType<typeof deriveProfileVerification>;
  isProfileLoading?: boolean;
  profileError?: string | null;
  connectionStatus: GoogleBusinessProfileConnection['status'];
};

const PROFILE_FIELDS: Array<{
  field: GoogleBusinessProfileProfileField;
  label: string;
  icon: LucideIcon;
}> = [
  { field: 'name', label: 'Business name', icon: Store },
  { field: 'contactPhone', label: 'Phone', icon: Phone },
  { field: 'address', label: 'Address', icon: MapPin },
  { field: 'googleMapUrl', label: 'Google Maps URL', icon: Link2 },
  { field: 'googleReviewUrl', label: 'Google review URL', icon: Link2 },
];

function statusTone(status: 'verified' | 'drifted' | 'partial' | 'unavailable') {
  switch (status) {
    case 'verified':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'drifted':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'partial':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'unavailable':
    default:
      return 'border-border bg-muted/50 text-muted-foreground';
  }
}

function statusLabel(status: 'verified' | 'drifted' | 'partial' | 'unavailable') {
  switch (status) {
    case 'verified':
      return 'Verified';
    case 'drifted':
      return 'Drifted';
    case 'partial':
      return 'Partial';
    case 'unavailable':
    default:
      return 'Unavailable';
  }
}

function FieldStatusBadge({
  status,
}: {
  status: 'verified' | 'drifted' | 'partial' | 'unavailable';
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-5 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide',
        statusTone(status),
      )}
    >
      {statusLabel(status)}
    </Badge>
  );
}

function displayText(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

export function GoogleBusinessProfileProfileAlignmentPanel({
  profile,
  profileVerification,
  isProfileLoading = false,
  profileError,
  connectionStatus,
}: GoogleBusinessProfileProfileAlignmentPanelProps) {
  const currentValues = {
    name: profile?.name ?? null,
    contactPhone: profile?.contactPhone ?? null,
    address: profile?.address ?? null,
    googleMapUrl: profile?.googleMapUrl ?? null,
    googleReviewUrl: profile?.googleReviewUrl ?? null,
  };

  if (connectionStatus !== 'linked') {
    return (
      <GoogleBusinessProfilePanel
        title="Profile alignment"
        description="Compare core Nabatable profile fields with Google after a location is linked and a snapshot has been fetched."
      >
        <p className="text-sm text-muted-foreground">
          Connect Google, link the correct location, then run a sync to unlock profile comparison
          and repair actions here.
        </p>
      </GoogleBusinessProfilePanel>
    );
  }

  return (
    <>
      <GoogleBusinessProfilePanel
        title="Profile alignment"
        description="Review the core profile fields Nabatable compares against Google. This section is verification-only; make edits in the canonical restaurant profile settings."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href={opsHref('/settings/restaurant/profile')}>
              <ExternalLink className="size-4" />
              Open restaurant profile
            </Link>
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <p className="text-sm font-medium text-foreground">{profileVerification.summary}</p>
            {profileVerification.warnings.map((warning) => (
              <p key={warning} className="mt-2 text-xs text-muted-foreground">
                {warning}
              </p>
            ))}
          </div>

          {profileError ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to load restaurant profile</AlertTitle>
              <AlertDescription>{profileError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-border/60">
            <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 border-b border-border/60 bg-muted/30 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span>Field</span>
              <span>Google</span>
              <span>Nabatable</span>
              <span className="text-right">Mode</span>
            </div>

            {PROFILE_FIELDS.map(({ field, label, icon: Icon }) => {
              const verification = profileVerification.fields[field];
              const googleValue = displayText(
                verification.providerValue,
                'No Google value available',
              );
              const coreValue = displayText(currentValues[field], 'Not set in Nabatable');

              return (
                <div
                  key={field}
                  className={cn(
                    'grid grid-cols-1 gap-3 border-b border-border/60 px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-start',
                    verification.status === 'drifted' && 'bg-amber-50/40',
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="size-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <FieldStatusBadge status={verification.status} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:hidden">
                      Google
                    </p>
                    {isProfileLoading ? (
                      <Skeleton className="h-4 w-28" />
                    ) : (
                      <p className="text-sm text-foreground break-words">{googleValue}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:hidden">
                      Nabatable
                    </p>
                    {isProfileLoading ? (
                      <Skeleton className="h-4 w-28" />
                    ) : (
                      <p className="text-sm text-foreground break-words">{coreValue}</p>
                    )}
                  </div>

                  <div className="flex items-start justify-end">
                    <span className="text-xs text-muted-foreground">Verification only</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </GoogleBusinessProfilePanel>
    </>
  );
}
