import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ redirect: redirectMock }));

import AvailabilitySettingsPage, {
  metadata as availabilityMetadata,
} from '@/app/app/(app)/settings/restaurant/availability/page';
import RestaurantDiscoverySettingsPage, {
  metadata as discoveryMetadata,
} from '@/app/app/(app)/settings/restaurant/discovery/page';
import RestaurantEmailTemplatesSettingsPage from '@/app/app/(app)/settings/restaurant/email-templates/page';
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
import StaffCommunicationsSettingsPage, {
  metadata as staffCommunicationsMetadata,
} from '@/app/app/(app)/settings/restaurant/staff-communications/page';
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
import { getRestaurantSettingsAvailabilityAlias } from '@/components/features/restaurant-settings/routes';

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
  slug: string;
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
  {
    metadata: staffCommunicationsMetadata,
    page: StaffCommunicationsSettingsPage,
    view: 'staff-communications',
  },
];

const availabilityAliasPageContracts: AvailabilityAliasPageContract[] = [
  {
    metadata: operatingHoursMetadata,
    page: OperatingHoursSettingsPage,
    slug: 'operating-hours',
  },
  {
    metadata: servicePeriodsMetadata,
    page: ServicePeriodsSettingsPage,
    slug: 'service-periods',
  },
  {
    metadata: turnDurationsMetadata,
    page: TurnDurationsSettingsPage,
    slug: 'turn-durations',
  },
  {
    metadata: occasionsMetadata,
    page: BookingOccasionsSettingsPage,
    slug: 'occasions',
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
    'renders the Availability page for the former $slug route',
    (contract) => {
      const element = contract.page();

      // The page finds the section from the pathname (routes.ts), not from a prop.
      expect(element).toEqual(
        expect.objectContaining({
          props: { view: 'availability' },
          type: OpsRestaurantSettingsClient,
        }),
      );
      expect(contract.metadata.title).toBe('Availability & Booking types · Nab a Table Ops');
      expect(
        getRestaurantSettingsAvailabilityAlias(`/app/settings/restaurant/${contract.slug}`),
      ).not.toBeNull();
    },
  );

  it('titles the Staff communications page from the shared route copy', () => {
    expect(staffCommunicationsMetadata.title).toBe('Staff communications · Nab a Table Ops');
  });

  it('keeps the legacy Email Templates settings route redirecting to the command center', () => {
    RestaurantEmailTemplatesSettingsPage();
    expect(redirectMock).toHaveBeenCalledWith('/app/email-templates');
  });
});
