import {
  getDefaultTemplateVariants,
  getRestaurantBookingEmailTemplateCatalog,
  getRestaurantBookingEmailTemplateGroups,
} from '@/lib/restaurants/email-templates';

import type { Page } from '@playwright/test';

/**
 * Shared API fixtures for the restaurant-settings browser specs. Every `/api/ops/**` call is
 * answered locally so the settings routes render real layouts without Supabase.
 */
export const appPort = process.env.QA_APP_PORT ?? '5180';
export const appHostBaseUrl = `http://app.localhost:${appPort}`;
export const qaAuthCookieName = '__nabatable_qa_ops_auth';
export const qaAuthCookieValue = 'enabled';
export const restaurantId = '11111111-1111-4111-8111-111111111111';

const restaurant = {
  id: restaurantId,
  name: 'QA App Host Restaurant',
  slug: 'qa-app-host',
  isActive: true,
  timezone: 'Europe/London',
  capacity: 48,
  contactEmail: 'qa.ops@example.test',
  contactPhone: '+440000000000',
  address: '1 QA Street, Test Town',
  businessDescription: 'Local QA fixture restaurant for settings command-center proof.',
  managerDailySummaryEnabled: true,
  managerNotificationPhone: '+440000000001',
  googleMapUrl: null,
  googleReviewUrl: null,
  bookingPolicy: 'QA browser fixtures only.',
  logoUrl: null,
  emailSendReminder24h: true,
  emailSendReminderShort: true,
  emailSendReviewRequest: true,
  reservationIntervalMinutes: 15,
  reservationDefaultDurationMinutes: 90,
  reservationLastSeatingBufferMinutes: 15,
  reservationLifecycleGraceMinutes: 30,
  createdAt: '2026-05-16T00:00:00.000Z',
  updatedAt: '2026-05-16T00:00:00.000Z',
  role: 'owner',
};

const emptyDualSyncState = {
  restaurantId,
  coreSnapshot: {},
  gbpSnapshot: {},
  coreSnapshotHash: 'qa-core-hash',
  gbpSnapshotHash: 'qa-gbp-hash',
  fields: [],
  outboundQueue: {
    totalOpen: 0,
    autoExportable: 0,
    missingBaseline: 0,
    lastQueuedAt: null,
  },
  lastSnapshot: null,
  control: null,
};

const operatingHours = {
  updatedAt: '2026-05-16T00:00:00.000Z',
  weekly: Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    opensAt: '12:00',
    closesAt: '22:00',
    isClosed: false,
    notes: null,
    reservationIntervalMinutes: 15,
    reservationSlotTimes: null,
  })),
  overrides: [],
};

const servicePeriods = Array.from({ length: 7 }).flatMap((_, dayOfWeek) => [
  {
    id: `lunch-${dayOfWeek}`,
    name: 'Lunch',
    dayOfWeek,
    startTime: '12:00',
    endTime: '15:00',
    bookingOption: 'lunch',
    updatedAt: null,
  },
  {
    id: `dinner-${dayOfWeek}`,
    name: 'Dinner',
    dayOfWeek,
    startTime: '17:00',
    endTime: '22:00',
    bookingOption: 'dinner',
    updatedAt: null,
  },
]);

const occasions = [
  {
    key: 'lunch',
    label: 'Lunch',
    shortLabel: 'Lunch',
    description: 'Lunch bookings',
    sortOrder: 1,
    defaultStartTime: '12:00',
    defaultEndTime: '15:00',
    isActive: true,
  },
  {
    key: 'dinner',
    label: 'Dinner',
    shortLabel: 'Dinner',
    description: 'Dinner bookings',
    sortOrder: 2,
    defaultStartTime: '17:00',
    defaultEndTime: '22:00',
    isActive: true,
  },
];

const emptyBusinessInfo = {
  details: null,
  addresses: [],
  phoneNumbers: [],
  links: [],
  categories: [],
  serviceAreas: [],
  hours: [],
  specialHours: [],
  attributes: [],
  serviceItems: [],
};

export async function installCommandCenterApiMocks(page: Page) {
  await page.route('**/api/ops/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    if (pathname === '/api/ops/restaurants') {
      await route.fulfill({
        json: {
          items: [restaurant],
          pageInfo: { hasNext: false, page: 1, pageSize: 50, total: 1 },
        },
      });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}`) {
      await route.fulfill({ json: { restaurant } });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/business-context`) {
      const emptyContext = {
        businessDetails: null,
        links: [],
        categories: [],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      };
      await route.fulfill({
        json: { core: emptyContext, providerSnapshot: emptyContext },
      });
      return;
    }

    // The settings client reads the connection from `/details`; older callers use the base path.
    if (
      pathname === `/api/ops/restaurants/${restaurantId}/google-business-profile` ||
      pathname === `/api/ops/restaurants/${restaurantId}/google-business-profile/details`
    ) {
      await route.fulfill({
        json: {
          isConfigured: false,
          provider: 'google_business_profile',
          status: 'unlinked',
          pushEnabled: false,
          connectedGoogleEmail: null,
          connectedGoogleName: null,
          externalAccountId: null,
          externalAccountName: null,
          externalLocationId: null,
          externalLocationName: null,
          externalLocationTitle: null,
          externalPlaceId: null,
          providerTimezone: null,
          lastPullAt: null,
          lastPushAt: null,
          lastError: null,
          availableLocations: [],
          businessInfo: emptyBusinessInfo,
        },
      });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/dual-sync/state`) {
      await route.fulfill({ json: emptyDualSyncState });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/hours`) {
      await route.fulfill({ json: operatingHours });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/service-periods`) {
      await route.fulfill({ json: { periods: servicePeriods } });
      return;
    }

    if (pathname === '/api/ops/occasions') {
      await route.fulfill({ json: { occasions } });
      return;
    }

    if (pathname === '/api/ops/team/invitations') {
      await route.fulfill({
        json: {
          invites: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              restaurantId,
              email: 'pending.manager@example.test',
              role: 'manager',
              status: 'pending',
              expiresAt: '2026-06-16T12:00:00.000Z',
              invitedBy: '99999999-9999-4999-8999-999999999999',
              acceptedAt: null,
              revokedAt: null,
              createdAt: '2026-05-16T12:00:00.000Z',
              updatedAt: '2026-05-16T12:00:00.000Z',
            },
          ],
        },
      });
      return;
    }

    if (pathname === '/api/ops/tables') {
      await route.fulfill({
        json: {
          summary: {
            availableTables: 2,
            serviceCapacities: [],
            totalCapacity: 8,
            totalTables: 2,
            zones: [{ active: true, id: 'zone-main', name: 'Main Dining', sort_order: 0 }],
          },
          tables: [
            {
              id: 'table-1',
              restaurant_id: restaurantId,
              table_number: '1',
              capacity: 4,
              min_party_size: 1,
              max_party_size: null,
              section: null,
              category: 'dining',
              seating_type: 'standard',
              mobility: 'movable',
              zone_id: 'zone-main',
              zone: { id: 'zone-main', name: 'Main Dining', active: true },
              active: true,
              status: 'available',
              position: null,
              notes: null,
            },
          ],
        },
      });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/menus`) {
      await route.fulfill({ json: { menus: [] } });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/email-templates`) {
      await route.fulfill({ json: emailTemplatesSnapshot() });
      return;
    }

    const preview = pathname.match(
      new RegExp(`^/api/ops/restaurants/${restaurantId}/email-templates/([a-z_0-9]+)/preview$`),
    );
    if (preview) {
      await route.fulfill({ json: emailTemplatePreview(preview[1]!) });
      return;
    }

    await route.fulfill({ json: {} });
  });
}

/** Every booking email on its default copy, as GET /email-templates returns it. */
function emailTemplatesSnapshot() {
  const catalog = getRestaurantBookingEmailTemplateCatalog();
  return {
    restaurantId,
    canEdit: true,
    groups: getRestaurantBookingEmailTemplateGroups().map((group) => ({
      key: group.key,
      title: group.title,
      description: group.description,
      templates: catalog
        .filter((definition) => definition.group === group.key)
        .map((definition) => {
          const variants = getDefaultTemplateVariants(definition.key);
          return {
            key: definition.key,
            title: definition.title,
            description: definition.description,
            groupKey: definition.group,
            supportsCtaLabel: definition.supportsCtaLabel,
            availableVariables: [],
            recommendedVariables: definition.recommendedVariables.map((key) => `{{${key}}}`),
            authoringHints: [...definition.authoringHints],
            status: 'default',
            activeVariantCount: variants.length,
            variants,
            defaultVariants: variants,
          };
        }),
    })),
  };
}

function emailTemplatePreview(templateKey: string) {
  return {
    restaurantId,
    preview: {
      templateKey,
      selectedVariantId: `${templateKey}-default-1`,
      selectedVariantName: 'Default',
      subject: 'Your booking at QA App Host Restaurant',
      preheader: 'Preview text',
      headline: 'Preview',
      intro: 'Preview message',
      cue: '',
      ask: '',
      ctaLabel: 'Manage booking',
      ctaUrl: 'https://example.test/manage',
      html: '<html><body><p>Preview</p></body></html>',
      text: 'Preview',
    },
  };
}
