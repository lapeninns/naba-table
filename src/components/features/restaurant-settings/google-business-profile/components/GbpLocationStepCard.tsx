'use client';

import { AlertCircle, CheckCircle2, ExternalLink, Lock, MapPin } from 'lucide-react';

import { OpsStatusBadge } from '@/components/features/ops-shell/patterns/OpsStatusBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import { GbpDetailList } from './GbpDetailList';
import { GbpStepCard } from './GbpStepCard';

import type { GoogleBusinessProfileLinkedLocationDetails } from '../googleBusinessProfileSectionStateDomain';
import type { GbpLocationStep } from '../googleBusinessProfileWorkflow';

export type GbpLocationStepCardProps = {
  readonly step: GbpLocationStep;
  readonly linkedLocation: GoogleBusinessProfileLinkedLocationDetails | null;
  readonly hasLinkedLocation: boolean;
  readonly needsReconnect: boolean;
  readonly manageHref: string | null;
  readonly onChooseLocation: () => void;
  readonly locationsErrorMessage: string | null;
  readonly onRetryLocations: () => void;
  readonly isRetryingLocations: boolean;
};

const DESCRIPTIONS: Record<GbpLocationStep, string> = {
  locked: 'Available once Google is connected.',
  choose: 'Choose which Google listing belongs to this restaurant.',
  chosen: 'The Google listing this restaurant is linked to.',
};

export function GbpLocationStepCard({
  step,
  linkedLocation,
  hasLinkedLocation,
  needsReconnect,
  manageHref,
  onChooseLocation,
  locationsErrorMessage,
  onRetryLocations,
  isRetryingLocations,
}: GbpLocationStepCardProps) {
  return (
    <GbpStepCard
      id="gbp-location"
      testId="gbp-location-card"
      step={2}
      title="Business location"
      description={DESCRIPTIONS[step]}
      done={step === 'chosen'}
      status={
        step === 'chosen' ? (
          <OpsStatusBadge tone="success" icon={CheckCircle2} label="Location chosen" />
        ) : null
      }
    >
      {step === 'locked' ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" aria-hidden />
          Locked until step 1 is done.
        </p>
      ) : null}

      {step !== 'locked' && linkedLocation ? (
        <GbpDetailList
          items={[
            { label: 'Business', value: linkedLocation.business },
            { label: 'Account', value: linkedLocation.account },
            { label: 'Address', value: linkedLocation.address },
          ]}
        />
      ) : null}

      {step === 'chosen' ? (
        <p className="text-sm text-muted-foreground">
          To use a different listing, disconnect and connect Google again.
        </p>
      ) : null}

      {step === 'choose' && needsReconnect ? (
        <p className="text-sm text-muted-foreground">
          Reconnect Google in step 1 before you change the listing.
        </p>
      ) : null}

      {step === 'choose' && locationsErrorMessage ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>Location refresh failed</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="break-words">{locationsErrorMessage}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRetryLocations}
              disabled={isRetryingLocations}
            >
              {isRetryingLocations ? 'Retrying…' : 'Retry locations'}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {step !== 'locked' ? (
        <div className="flex flex-wrap items-center gap-2">
          {step === 'choose' ? (
            <Button
              type="button"
              variant={hasLinkedLocation ? 'outline' : 'default'}
              onClick={onChooseLocation}
              className="[@media(pointer:coarse)]:min-h-11"
            >
              <MapPin data-icon="inline-start" aria-hidden />
              {hasLinkedLocation ? 'Change location' : 'Choose location'}
            </Button>
          ) : null}
          {manageHref && step === 'chosen' ? (
            <Button
              type="button"
              variant="outline"
              asChild
              className="[@media(pointer:coarse)]:min-h-11"
            >
              <a href={manageHref} target="_blank" rel="noreferrer">
                <ExternalLink data-icon="inline-start" aria-hidden />
                Manage on Google
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}
    </GbpStepCard>
  );
}
