import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ redirect: redirectMock }));

import LegacyEmailTemplatesPage from '@/app/app/(app)/email-templates/page';
import LegacyTeamManagementPage from '@/app/app/(app)/management/team/page';
import SettingsIndexPage from '@/app/app/(app)/settings/page';
import AvailabilitySettingsPage, {
  metadata as availabilityMetadata,
} from '@/app/app/(app)/settings/restaurant/availability/page';
import RestaurantDiscoverySettingsPage, {
  metadata as discoveryMetadata,
} from '@/app/app/(app)/settings/restaurant/discovery/page';
import RestaurantEmailTemplatesSettingsPage, {
  metadata as emailTemplatesMetadata,
} from '@/app/app/(app)/settings/restaurant/email-templates/page';
import RestaurantFloorLayoutSettingsPage, {
  metadata as floorLayoutMetadata,
} from '@/app/app/(app)/settings/restaurant/floor-layout/page';
import GoogleBusinessProfileSettingsPage, {
  metadata as googleBusinessProfileMetadata,
} from '@/app/app/(app)/settings/restaurant/google-business-profile/page';
import RestaurantMenuSettingsPage, {
  metadata as menuMetadata,
} from '@/app/app/(app)/settings/restaurant/menu/page';
import LegacyOccasionsPage from '@/app/app/(app)/settings/restaurant/occasions/page';
import LegacyOperatingHoursPage from '@/app/app/(app)/settings/restaurant/operating-hours/page';
import RestaurantSettingsIndexPage, {
  metadata as overviewMetadata,
} from '@/app/app/(app)/settings/restaurant/page';
import RestaurantProfileSettingsPage, {
  metadata as profileMetadata,
} from '@/app/app/(app)/settings/restaurant/profile/page';
import LegacyServicePeriodsPage from '@/app/app/(app)/settings/restaurant/service-periods/page';
import StaffCommunicationsSettingsPage, {
  metadata as staffCommunicationsMetadata,
} from '@/app/app/(app)/settings/restaurant/staff-communications/page';
import LegacyTableLayoutPage from '@/app/app/(app)/settings/restaurant/table-layout/page';
import RestaurantTablesSettingsPage, {
  metadata as tablesMetadata,
} from '@/app/app/(app)/settings/restaurant/tables/page';
import RestaurantTeamSettingsPage, {
  metadata as teamMetadata,
} from '@/app/app/(app)/settings/restaurant/team/page';
import LegacyTurnDurationsPage from '@/app/app/(app)/settings/restaurant/turn-durations/page';
import LegacySettingsTablesPage from '@/app/app/(app)/settings/tables/page';
import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';
import { RestaurantSetupOverview } from '@/components/features/restaurant-settings/RestaurantSetupOverview';
import {
  RESTAURANT_SETTINGS_OVERVIEW_ROUTE,
  RESTAURANT_SETTINGS_RETIRED_ROUTES,
  RESTAURANT_SETTINGS_ROUTES,
} from '@/components/features/restaurant-settings/routes';

import type { RestaurantSettingsView } from '@/components/features/restaurant-settings/types';
import type { Metadata } from 'next';

type RoutePageContract = {
  metadata: Metadata;
  page: () => React.ReactNode;
  view: RestaurantSettingsView;
  name: string;
};

const routePageContracts: RoutePageContract[] = [
  {
    metadata: profileMetadata,
    page: RestaurantProfileSettingsPage,
    view: 'profile',
    name: 'Profile',
  },
  {
    metadata: discoveryMetadata,
    page: RestaurantDiscoverySettingsPage,
    view: 'discovery',
    name: 'Discovery',
  },
  {
    metadata: googleBusinessProfileMetadata,
    page: GoogleBusinessProfileSettingsPage,
    view: 'google-business-profile',
    name: 'Google Business Profile',
  },
  {
    metadata: availabilityMetadata,
    page: AvailabilitySettingsPage,
    view: 'availability',
    name: 'Availability',
  },
  { metadata: menuMetadata, page: RestaurantMenuSettingsPage, view: 'menu', name: 'Menu' },
  { metadata: tablesMetadata, page: RestaurantTablesSettingsPage, view: 'tables', name: 'Tables' },
  { metadata: teamMetadata, page: RestaurantTeamSettingsPage, view: 'team', name: 'Team' },
  {
    metadata: staffCommunicationsMetadata,
    page: StaffCommunicationsSettingsPage,
    view: 'staff-communications',
    name: 'Staff communications',
  },
  {
    metadata: floorLayoutMetadata,
    page: RestaurantFloorLayoutSettingsPage,
    view: 'floor-layout',
    name: 'Floor layout',
  },
  {
    metadata: emailTemplatesMetadata,
    page: RestaurantEmailTemplatesSettingsPage,
    view: 'email-templates',
    name: 'Email templates',
  },
];

const retiredRoutePages: Array<{ from: string; to: string; page: () => unknown }> = [
  { from: '/app/settings', to: '/app/settings/restaurant', page: SettingsIndexPage },
  {
    from: '/app/settings/tables',
    to: '/app/settings/restaurant/tables',
    page: LegacySettingsTablesPage,
  },
  {
    from: '/app/management/team',
    to: '/app/settings/restaurant/team',
    page: LegacyTeamManagementPage,
  },
  {
    from: '/app/email-templates',
    to: '/app/settings/restaurant/email-templates',
    page: LegacyEmailTemplatesPage,
  },
  {
    from: '/app/settings/restaurant/table-layout',
    to: '/app/settings/restaurant/floor-layout',
    page: LegacyTableLayoutPage,
  },
  {
    from: '/app/settings/restaurant/operating-hours',
    to: '/app/settings/restaurant/availability#weekly-hours',
    page: LegacyOperatingHoursPage,
  },
  {
    from: '/app/settings/restaurant/service-periods',
    to: '/app/settings/restaurant/availability#service-windows',
    page: LegacyServicePeriodsPage,
  },
  {
    from: '/app/settings/restaurant/turn-durations',
    to: '/app/settings/restaurant/availability#booking-occasions',
    page: LegacyTurnDurationsPage,
  },
  {
    from: '/app/settings/restaurant/occasions',
    to: '/app/settings/restaurant/availability#booking-occasions',
    page: LegacyOccasionsPage,
  },
];

const toSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

describe('restaurant settings route pages', () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it('keeps the index route as the setup overview', () => {
    expect(overviewMetadata.title).toBe('Restaurant setup · Nab a Table Ops');
    expect(RESTAURANT_SETTINGS_OVERVIEW_ROUTE.href).toBe('/app/settings/restaurant');
    expect(RestaurantSettingsIndexPage()).toEqual(
      expect.objectContaining({ type: RestaurantSetupOverview }),
    );
  });

  it.each(routePageContracts)('renders the $view page under its one name', (contract) => {
    expect(contract.page()).toEqual(
      expect.objectContaining({
        props: { view: contract.view },
        type: OpsRestaurantSettingsClient,
      }),
    );
    expect(contract.metadata.title).toBe(`${contract.name} · Nab a Table Ops`);
    expect(contract.metadata.description).toEqual(expect.any(String));
  });

  it('names every settings URL after its page title', () => {
    expect(RESTAURANT_SETTINGS_ROUTES.map((route) => route.view).sort()).toEqual(
      routePageContracts.map((contract) => contract.view).sort(),
    );
    for (const route of RESTAURANT_SETTINGS_ROUTES) {
      expect(route.view).toBe(toSlug(route.title));
      expect(route.href).toBe(`/app/settings/restaurant/${route.view}`);
    }
  });

  it('lists every retired settings URL once, pointing at a live page', () => {
    expect(RESTAURANT_SETTINGS_RETIRED_ROUTES.map(({ from, to }) => ({ from, to }))).toEqual(
      retiredRoutePages.map(({ from, to }) => ({ from, to })),
    );
    const liveHrefs = new Set([
      RESTAURANT_SETTINGS_OVERVIEW_ROUTE.href,
      ...RESTAURANT_SETTINGS_ROUTES.map((route) => route.href),
    ]);
    for (const { to } of RESTAURANT_SETTINGS_RETIRED_ROUTES) {
      expect(liveHrefs.has(to.split('#')[0] ?? '')).toBe(true);
    }
  });

  it.each(retiredRoutePages)('redirects $from to $to', ({ page, to }) => {
    page();
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith(to);
  });
});

describe('links to settings pages', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const sourceRoots = ['src', 'components', 'lib', 'server'];
  const redirectPages = new Set(
    [
      'src/app/app/(app)/settings/page.tsx',
      'src/app/app/(app)/settings/tables/page.tsx',
      'src/app/app/(app)/management/team/page.tsx',
      'src/app/app/(app)/email-templates/page.tsx',
      'src/app/app/(app)/settings/restaurant/table-layout/page.tsx',
      'src/app/app/(app)/settings/restaurant/operating-hours/page.tsx',
      'src/app/app/(app)/settings/restaurant/service-periods/page.tsx',
      'src/app/app/(app)/settings/restaurant/turn-durations/page.tsx',
      'src/app/app/(app)/settings/restaurant/occasions/page.tsx',
      'src/components/features/restaurant-settings/routes.ts',
    ].map((file) => path.join(repoRoot, file)),
  );

  function listSourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) return listSourceFiles(full);
      return /\.(ts|tsx)$/.test(entry) ? [full] : [];
    });
  }

  it('never point at a retired settings URL', () => {
    // Match the retired path as a whole URL segment, with or without the /app prefix.
    const retiredPatterns = RESTAURANT_SETTINGS_RETIRED_ROUTES.filter(
      ({ from }) => from !== '/app/settings',
    ).map(({ from }) => {
      const bare = from.replace(/^\/app/, '').replace(/[/-]/g, (char) => `\\${char}`);
      return new RegExp(`['"\`](?:/app)?${bare}(?:[#?'"\`]|$)`);
    });

    const offenders = sourceRoots
      .flatMap((root) => listSourceFiles(path.join(repoRoot, root)))
      .filter((file) => !redirectPages.has(file))
      .flatMap((file) => {
        const source = readFileSync(file, 'utf8');
        return retiredPatterns
          .filter((pattern) => pattern.test(source))
          .map((pattern) => `${path.relative(repoRoot, file)} ~ ${pattern.source}`);
      });

    expect(offenders).toEqual([]);
  });
});
