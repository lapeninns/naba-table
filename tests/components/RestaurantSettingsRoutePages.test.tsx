import { describe, expect, it } from 'vitest';

import AvailabilitySettingsPage, {
  metadata as availabilityMetadata,
} from '@/app/app/(app)/settings/restaurant/availability/page';
import RestaurantDiscoverySettingsPage, {
  metadata as discoveryMetadata,
} from '@/app/app/(app)/settings/restaurant/discovery/page';
import GoogleBusinessProfileSettingsPage, {
  metadata as googleBusinessProfileMetadata,
} from '@/app/app/(app)/settings/restaurant/google-business-profile/page';
import RestaurantMenuSettingsPage, {
  metadata as menuMetadata,
} from '@/app/app/(app)/settings/restaurant/menu/page';
import BookingOccasionsSettingsPage, {
  metadata as occasionsMetadata,
} from '@/app/app/(app)/settings/restaurant/occasions/page';
import OperatingHoursSettingsPage, {
  metadata as operatingHoursMetadata,
} from '@/app/app/(app)/settings/restaurant/operating-hours/page';
import RestaurantSettingsIndexPage, {
  metadata as overviewMetadata,
} from '@/app/app/(app)/settings/restaurant/page';
import RestaurantProfileSettingsPage, {
  metadata as profileMetadata,
} from '@/app/app/(app)/settings/restaurant/profile/page';
import ServicePeriodsSettingsPage, {
  metadata as servicePeriodsMetadata,
} from '@/app/app/(app)/settings/restaurant/service-periods/page';
import RestaurantTablesSettingsPage, {
  metadata as tablesMetadata,
} from '@/app/app/(app)/settings/restaurant/tables/page';
import RestaurantTeamSettingsPage, {
  metadata as teamMetadata,
} from '@/app/app/(app)/settings/restaurant/team/page';
import TurnDurationsSettingsPage, {
  metadata as turnDurationsMetadata,
} from '@/app/app/(app)/settings/restaurant/turn-durations/page';
import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';
import { RestaurantSetupOverview } from '@/components/features/restaurant-settings/RestaurantSetupOverview';

import type { RestaurantSettingsView } from '@/components/features/restaurant-settings/types';
import type { Metadata } from 'next';

type RoutePageContract = {
  metadata: Metadata;
  page: () => React.ReactNode;
  view: RestaurantSettingsView;
};

type AvailabilityAliasPageContract = {
  metadata: Metadata;
  page: () => React.ReactNode;
  availabilityWorkspace: 'schedule' | 'booking-types';
};

const routePageContracts: RoutePageContract[] = [
  {
    metadata: profileMetadata,
    page: RestaurantProfileSettingsPage,
    view: 'profile',
  },
  {
    metadata: discoveryMetadata,
    page: RestaurantDiscoverySettingsPage,
    view: 'discovery',
  },
  {
    metadata: googleBusinessProfileMetadata,
    page: GoogleBusinessProfileSettingsPage,
    view: 'google-business-profile',
  },
  {
    metadata: availabilityMetadata,
    page: AvailabilitySettingsPage,
    view: 'availability',
  },
  {
    metadata: menuMetadata,
    page: RestaurantMenuSettingsPage,
    view: 'menu',
  },
  {
    metadata: tablesMetadata,
    page: RestaurantTablesSettingsPage,
    view: 'tables',
  },
  {
    metadata: teamMetadata,
    page: RestaurantTeamSettingsPage,
    view: 'team',
  },
];

const availabilityAliasPageContracts: AvailabilityAliasPageContract[] = [
  {
    metadata: operatingHoursMetadata,
    page: OperatingHoursSettingsPage,
    availabilityWorkspace: 'schedule',
  },
  {
    metadata: servicePeriodsMetadata,
    page: ServicePeriodsSettingsPage,
    availabilityWorkspace: 'schedule',
  },
  {
    metadata: turnDurationsMetadata,
    page: TurnDurationsSettingsPage,
    availabilityWorkspace: 'booking-types',
  },
  {
    metadata: occasionsMetadata,
    page: BookingOccasionsSettingsPage,
    availabilityWorkspace: 'booking-types',
  },
];

describe('restaurant settings route pages', () => {
  it('keeps the index route as the setup overview instead of a profile handoff page', () => {
    expect(overviewMetadata.title).toBe('Restaurant setup · Nab a Table Ops');
    expect(RestaurantSettingsIndexPage()).toEqual(
      expect.objectContaining({
        type: RestaurantSetupOverview,
      }),
    );
  });

  it.each(routePageContracts)('keeps the $view page as metadata plus view handoff', (contract) => {
    const element = contract.page();

    expect(element).toEqual(
      expect.objectContaining({
        props: { view: contract.view },
        type: OpsRestaurantSettingsClient,
      }),
    );
    expect(contract.metadata.title).toEqual(expect.any(String));
    expect(contract.metadata.description).toEqual(expect.any(String));
  });

  it.each(availabilityAliasPageContracts)(
    'keeps availability alias pages wired to the requested workspace',
    (contract) => {
      const element = contract.page();

      expect(element).toEqual(
        expect.objectContaining({
          props: {
            availabilityWorkspace: contract.availabilityWorkspace,
            view: 'availability',
          },
          type: OpsRestaurantSettingsClient,
        }),
      );
      expect(contract.metadata.title).toEqual(expect.any(String));
      expect(contract.metadata.description).toEqual(expect.any(String));
    },
  );
});
