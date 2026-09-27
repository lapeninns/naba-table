'use client';

import dynamic from 'next/dynamic';
import { useEffect, type ReactNode } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { cn } from '@/lib/utils';

import { RESTAURANT_SETTINGS_ROUTE_MAP } from './routes';
import { SETTINGS_COMPACT_ROUTE_STACK_CLASS, SettingsSectionSkeleton } from './shared';
import { useRestaurantSettingsContext } from './shell/useRestaurantSettingsContext';

import type { RestaurantSettingsView } from './types';

const RestaurantProfileSection = dynamic(
  () => import('./RestaurantProfileSection').then((m) => m.RestaurantProfileSection),
  {
    loading: () => <SettingsSectionSkeleton label="Loading profile" />,
  },
);

const RestaurantBusinessContextSection = dynamic(
  () =>
    import('./RestaurantBusinessContextSection').then((m) => m.RestaurantBusinessContextSection),
  {
    loading: () => <SettingsSectionSkeleton label="Loading discovery details" />,
  },
);

const GoogleBusinessProfileSection = dynamic(
  () =>
    import('./google-business-profile/GoogleBusinessProfileSection').then(
      (m) => m.GoogleBusinessProfileSection,
    ),
  {
    loading: () => <SettingsSectionSkeleton label="Loading Google Business Profile" />,
  },
);

const AvailabilitySettingsPage = dynamic(
  () => import('./availability/AvailabilitySettingsPage').then((m) => m.AvailabilitySettingsPage),
  {
    loading: () => <SettingsSectionSkeleton label="Loading availability" />,
  },
);

const OpsMenuManagementClient = dynamic(
  () => import('../menu').then((m) => m.OpsMenuManagementClient),
  {
    loading: () => <SettingsSectionSkeleton label="Loading menu" />,
  },
);

const TableInventoryClient = dynamic(
  () => import('../tables/TableInventoryClient').then((m) => m.default),
  {
    loading: () => <SettingsSectionSkeleton label="Loading tables" />,
  },
);

const OpsTeamManagementClient = dynamic(
  () => import('../team').then((m) => m.OpsTeamManagementClient),
  {
    loading: () => <SettingsSectionSkeleton label="Loading team" />,
  },
);

const StaffCommunicationsSection = dynamic(
  () =>
    import('./staff-communications/StaffCommunicationsSection').then(
      (m) => m.StaffCommunicationsSection,
    ),
  {
    loading: () => <SettingsSectionSkeleton label="Loading staff communications" />,
  },
);

const FloorLayoutWorkspace = dynamic(
  () => import('../floor-plan/FloorPlanClient').then((m) => m.FloorLayoutClient),
  {
    loading: () => <SettingsSectionSkeleton label="Loading floor layout" variant="workspace" />,
  },
);

const OpsEmailTemplatesClient = dynamic(
  () => import('../email-templates/OpsEmailTemplatesClient').then((m) => m.OpsEmailTemplatesClient),
  {
    loading: () => <SettingsSectionSkeleton label="Loading email templates" variant="workspace" />,
  },
);

export type OpsRestaurantSettingsClientProps = {
  defaultRestaurantId?: string | null;
  view: RestaurantSettingsView;
};

export function OpsRestaurantSettingsClient({
  defaultRestaurantId,
  view,
}: OpsRestaurantSettingsClientProps) {
  const {
    memberships,
    activeRestaurantId,
    restaurantId: selectedRestaurantId,
    setActiveRestaurantId,
  } = useRestaurantSettingsContext();

  useEffect(() => {
    if (activeRestaurantId) {
      return;
    }
    if (defaultRestaurantId) {
      setActiveRestaurantId(defaultRestaurantId);
      return;
    }
    if (memberships[0]) {
      setActiveRestaurantId(memberships[0].restaurantId);
    }
  }, [activeRestaurantId, defaultRestaurantId, memberships, setActiveRestaurantId]);

  if (memberships.length === 0) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center p-8">
        <OpsEmptyState
          title="No restaurant access"
          description="You need access to at least one restaurant to manage settings. Contact an owner or admin for access."
        />
      </section>
    );
  }

  const renderByView: Record<
    RestaurantSettingsView,
    (context: { restaurantId: string | null }) => ReactNode
  > = {
    profile: ({ restaurantId }) => <RestaurantProfileSection restaurantId={restaurantId} />,
    discovery: ({ restaurantId }) => (
      <RestaurantBusinessContextSection restaurantId={restaurantId} />
    ),
    'google-business-profile': ({ restaurantId }) => (
      <GoogleBusinessProfileSection restaurantId={restaurantId} />
    ),
    availability: ({ restaurantId }) => <AvailabilitySettingsPage restaurantId={restaurantId} />,
    menu: () => <OpsMenuManagementClient />,
    tables: () => <TableInventoryClient />,
    team: () => <OpsTeamManagementClient />,
    'staff-communications': ({ restaurantId }) => (
      <StaffCommunicationsSection restaurantId={restaurantId} />
    ),
    'floor-layout': () => <FloorLayoutWorkspace />,
    'email-templates': () => <OpsEmailTemplatesClient />,
  };

  const workspace = RESTAURANT_SETTINGS_ROUTE_MAP[view].layout === 'workspace';

  return (
    <div className={cn(SETTINGS_COMPACT_ROUTE_STACK_CLASS, workspace && 'min-h-0 flex-1')}>
      {renderByView[view]({ restaurantId: selectedRestaurantId })}
    </div>
  );
}
