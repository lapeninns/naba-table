import { MapPin, SearchCheck, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import {
  RestaurantSettingsCommandCenter,
  type RestaurantSettingsCommandRailItem,
} from '../../shared';
import {
  AVAILABILITY_SCHEDULE_HREF,
  getConnectedAccountLabel,
  getLocationTitle,
  getStageLabel,
  getStepStatus,
  PROFILE_CONTACT_HREF,
  stepBadgeLabel,
  type GbpAnchorId,
  type GbpWorkflowStage,
} from '../googleBusinessProfileWorkflow';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';
import type { ReactNode } from 'react';

type GbpFrameProps = {
  data: GoogleBusinessProfileConnection | null;
  stage: GbpWorkflowStage;
  overview: ReactNode;
  hasSyncWorkspace: boolean;
  onSelectAnchor: (anchorId: GbpAnchorId) => void;
  children: ReactNode;
};

function GbpFooter() {
  return (
    <span className="flex flex-col gap-2">
      <span>
        <span className="font-medium text-foreground">Related settings.</span> Public profile fields
        (name, address, phone, links) live on{' '}
        <Link href={PROFILE_CONTACT_HREF} className="underline">
          Restaurant profile
        </Link>
        . Hours and meal windows live on{' '}
        <Link href={AVAILABILITY_SCHEDULE_HREF} className="underline">
          Availability &amp; Booking types
        </Link>
        .
      </span>
    </span>
  );
}

export function GbpWorkflowFrame({
  data,
  stage,
  overview,
  hasSyncWorkspace,
  onSelectAnchor,
  children,
}: GbpFrameProps) {
  const connectionStatus = getStepStatus('connect', data, stage);
  const locationStatus = getStepStatus('location', data, stage);
  const reviewStatus = getStepStatus('review', data, stage);
  const locationEnabled =
    data?.status === 'authorized' ||
    data?.status === 'reauth_required' ||
    Boolean(data?.externalLocationId);
  const locationAnchor: GbpAnchorId =
    data?.status === 'authorized' || data?.status === 'reauth_required'
      ? 'gbp-location'
      : 'gbp-connection';
  const workflowSettled = stage === 'linked';
  const accountLabel = getConnectedAccountLabel(data);
  const hasLinkedLocation = Boolean(data?.externalLocationId);

  const railItems: RestaurantSettingsCommandRailItem[] = [
    {
      label: 'Connection',
      description: workflowSettled ? 'Reconnect if needed.' : 'Authorize access.',
      Icon: ShieldCheck,
      onSelect: () => onSelectAnchor('gbp-connection'),
      badge: workflowSettled ? undefined : stepBadgeLabel(connectionStatus),
    },
    {
      label: 'Business location',
      description: locationEnabled
        ? workflowSettled
          ? 'Mapped location.'
          : 'Map one Google listing.'
        : 'Available after the connection is authorized.',
      Icon: MapPin,
      onSelect: locationEnabled ? () => onSelectAnchor(locationAnchor) : () => {},
      badge: workflowSettled ? undefined : stepBadgeLabel(locationStatus),
    },
    ...(hasSyncWorkspace
      ? [
          {
            label: 'Review changes',
            description: 'Compare imports and exports.',
            Icon: SearchCheck,
            onSelect: () => onSelectAnchor('gbp-sync-review'),
            badge: workflowSettled ? 'Next' : stepBadgeLabel(reviewStatus),
          } satisfies RestaurantSettingsCommandRailItem,
        ]
      : []),
  ];

  return (
    <RestaurantSettingsCommandCenter
      eyebrow="Google command center"
      title="Google Business Profile"
      description="Connect Google only when you need import, comparison, and sync-review support for public restaurant details."
      metrics={[
        {
          label: 'Connection',
          value: getStageLabel(stage),
          description: accountLabel,
          variant: workflowSettled ? 'default' : stage === 'issue' ? 'destructive' : 'secondary',
          Icon: ShieldCheck,
        },
        {
          label: 'Location',
          value: hasLinkedLocation ? 'Mapped' : locationEnabled ? 'Choose one' : 'Locked',
          description: getLocationTitle(data),
          variant: hasLinkedLocation ? 'secondary' : 'outline',
          Icon: MapPin,
        },
        {
          label: 'Review',
          value: hasSyncWorkspace ? 'Available' : 'Unavailable',
          description: hasSyncWorkspace ? 'compare imports and exports' : 'connection only',
          variant: hasSyncWorkspace ? 'metric' : 'outline',
          Icon: SearchCheck,
        },
      ]}
      railTitle="Google workflow"
      railDescription={
        workflowSettled
          ? hasSyncWorkspace
            ? 'Setup complete. Jump to review or reconnect.'
            : 'Setup complete. Reconnect if needed.'
          : 'Jump to the current setup step.'
      }
      railItems={railItems}
      footer={<GbpFooter />}
    >
      <div className="flex min-w-0 flex-col gap-4">
        {stage !== 'linked' && (
          <Card className="border-sky-500/20 bg-sky-500/5">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium text-sky-700 dark:text-sky-400">
                Google integration is 100% optional
              </CardTitle>
              <CardDescription className="text-xs">
                Connecting your Google Business Profile is designed to import address details and hours quickly.
                If you prefer, you can skip this step and enter details manually in Nabatable.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
        <div id="gbp-connection" className="scroll-mt-24">
          {overview}
        </div>
        {children}
      </div>
    </RestaurantSettingsCommandCenter>
  );
}
