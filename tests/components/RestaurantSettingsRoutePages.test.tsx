import { describe, expect, it } from 'vitest';

import AvailabilitySettingsPage, {
  metadata as availabilityMetadata,
} from '@/app/app/(app)/settings/restaurant/availability/page';
import GoogleBusinessProfileSettingsPage, {
  metadata as googleBusinessProfileMetadata,
} from '@/app/app/(app)/settings/restaurant/google-business-profile/page';
import RestaurantMenuSettingsPage, {
  metadata as menuMetadata,
} from '@/app/app/(app)/settings/restaurant/menu/page';
import RestaurantSetupSettingsPage, {
  metadata as overviewMetadata,
} from '@/app/app/(app)/settings/restaurant/page';
import RestaurantProfileSettingsPage, {
  metadata as profileMetadata,
} from '@/app/app/(app)/settings/restaurant/profile/page';
import RestaurantTablesSettingsPage, {
  metadata as tablesMetadata,
} from '@/app/app/(app)/settings/restaurant/tables/page';
import RestaurantTeamSettingsPage, {
  metadata as teamMetadata,
} from '@/app/app/(app)/settings/restaurant/team/page';
import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';

import type { RestaurantSettingsView } from '@/components/features/restaurant-settings/types';
import type { Metadata } from 'next';

type RoutePageContract = {
  metadata: Metadata;
  page: () => React.ReactNode;
  view: RestaurantSettingsView;
};

const routePageContracts: RoutePageContract[] = [
  {
    metadata: overviewMetadata,
    page: RestaurantSetupSettingsPage,
    view: 'overview',
  },
  {
    metadata: profileMetadata,
    page: RestaurantProfileSettingsPage,
    view: 'profile',
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

describe('restaurant settings route pages', () => {
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
});
