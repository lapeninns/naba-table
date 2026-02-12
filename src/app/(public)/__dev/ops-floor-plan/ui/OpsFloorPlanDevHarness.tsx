'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo } from 'react';

import FloorPlanPage from '@/components/features/seating/FloorPlanPage';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';

import type { RestaurantService } from '@/services/ops/restaurants';
import type { TableInventory, TableInventoryService } from '@/services/ops/tables';
import type { Zone } from '@/services/ops/zones';
import type { TableTimelineResponse } from '@/types/ops';

const DEV_RESTAURANT_ID = 'rest-dev';

function createDevRestaurantService(): RestaurantService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unimplemented = (name: string) => async (..._args: any[]) => {
    throw new Error(`[dev][restaurantService] ${name} is not implemented`);
  };

  return {
    listRestaurants: unimplemented('listRestaurants'),
    updateProfile: unimplemented('updateProfile'),
    updateOperatingHours: unimplemented('updateOperatingHours'),
    updateServicePeriods: unimplemented('updateServicePeriods'),
    getTurnBands: unimplemented('getTurnBands'),
    updateTurnBands: unimplemented('updateTurnBands'),

    async getProfile(restaurantId: string) {
      return {
        id: restaurantId,
        name: 'Dev Restaurant',
        slug: 'dev-restaurant',
        timezone: 'America/New_York',
        capacity: 120,
        contactEmail: 'ops@example.com',
        contactPhone: '+15555550100',
        address: '123 Dev Street',
        googleMapUrl: null,
        googleReviewUrl: null,
        bookingPolicy: null,
        logoUrl: null,
        emailSendReminder24h: false,
        emailSendReminderShort: false,
        emailSendReviewRequest: false,
        reservationIntervalMinutes: 15,
        reservationDefaultDurationMinutes: 90,
        reservationLastSeatingBufferMinutes: 15,
        reservationLifecycleGraceMinutes: 10,
      };
    },

    async getOperatingHours(_restaurantId: string) {
      // 0 = Sunday ... 6 = Saturday
      const weekly = Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        opensAt: '17:00',
        closesAt: '23:00',
        isClosed: false,
        notes: null,
        reservationIntervalMinutes: 15,
        reservationSlotTimes: null,
      }));

      return { weekly, overrides: [] };
    },

    async getServicePeriods(_restaurantId: string) {
      return [
        {
          id: 'svc-dinner',
          name: 'Dinner',
          dayOfWeek: null,
          startTime: '17:00',
          endTime: '23:00',
          bookingOption: 'dinner',
        },
      ];
    },
  } satisfies RestaurantService;
}

function createDevZones(): Zone[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'zone-main',
      restaurantId: DEV_RESTAURANT_ID,
      name: 'Main',
      sortOrder: 0,
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'zone-patio',
      restaurantId: DEV_RESTAURANT_ID,
      name: 'Patio',
      sortOrder: 1,
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function createDevTables(): TableInventory[] {
  const base = {
    restaurantId: DEV_RESTAURANT_ID,
    minPartySize: 1,
    maxPartySize: null,
    section: null,
    category: 'dining' as const,
    mobility: 'movable' as const,
    active: true,
    status: 'available' as const,
    notes: null,
  };

  return [
    {
      ...base,
      id: 't-1',
      tableNumber: '1',
      capacity: 2,
      seatingType: 'booth',
      zoneId: 'zone-main',
      zoneName: 'Main',
      zoneActive: true,
      position: { x: 120, y: 180, rotation: 0 },
    },
    {
      ...base,
      id: 't-2',
      tableNumber: '2',
      capacity: 4,
      seatingType: 'standard',
      zoneId: 'zone-main',
      zoneName: 'Main',
      zoneActive: true,
      position: { x: 260, y: 160, rotation: 0 },
    },
    {
      ...base,
      id: 't-3',
      tableNumber: '3',
      capacity: 4,
      seatingType: 'standard',
      zoneId: 'zone-main',
      zoneName: 'Main',
      zoneActive: true,
      position: { x: 420, y: 210, rotation: 8 },
    },
    {
      ...base,
      id: 't-4',
      tableNumber: '4',
      capacity: 2,
      seatingType: 'standard',
      zoneId: 'zone-main',
      zoneName: 'Main',
      zoneActive: true,
      position: { x: 560, y: 170, rotation: -6 },
    },
    {
      ...base,
      id: 't-5',
      tableNumber: '5',
      capacity: 6,
      seatingType: 'standard',
      zoneId: 'zone-patio',
      zoneName: 'Patio',
      zoneActive: true,
      position: { x: 210, y: 420, rotation: 0 },
    },
    {
      ...base,
      id: 't-6',
      tableNumber: '6',
      capacity: 4,
      seatingType: 'standard',
      zoneId: 'zone-patio',
      zoneName: 'Patio',
      zoneActive: true,
      position: { x: 370, y: 420, rotation: 0 },
    },
  ];
}

function buildDevTimeline(dateIso: string, tables: TableInventory[]): TableTimelineResponse {
  const timezone = 'America/New_York';
  const start = `${dateIso}T17:00:00.000Z`;
  const end = `${dateIso}T23:00:00.000Z`;

  const tableRows = tables.map((table, index) => {
    const isReserved = index % 3 === 0;
    const reservationStart = `${dateIso}T19:00:00.000Z`;
    const reservationEnd = `${dateIso}T20:30:00.000Z`;

    const segments = isReserved
      ? [
          {
            start,
            end: reservationStart,
            state: 'available' as const,
            serviceKey: 'dinner' as const,
            booking: null,
            hold: null,
          },
          {
            start: reservationStart,
            end: reservationEnd,
            state: 'reserved' as const,
            serviceKey: 'dinner' as const,
            booking: {
              id: `booking-${table.id}`,
              customerName: 'Alex Johnson',
              partySize: Math.min(table.capacity, 4),
              status: index % 2 === 0 ? ('checked_in' as const) : ('confirmed' as const),
              startAt: reservationStart,
              endAt: reservationEnd,
            },
            hold: null,
          },
          {
            start: reservationEnd,
            end,
            state: 'available' as const,
            serviceKey: 'dinner' as const,
            booking: null,
            hold: null,
          },
        ]
      : [
          {
            start,
            end,
            state: 'available' as const,
            serviceKey: 'dinner' as const,
            booking: null,
            hold: null,
          },
        ];

    return {
      table: {
        id: table.id,
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        zoneId: table.zoneId,
        zoneName: table.zoneName,
        status: table.status,
        active: table.active,
      },
      stats: {
        occupancyMinutes: isReserved ? 90 : 0,
        totalMinutes: 360,
        occupancyPercentage: isReserved ? 25 : 0,
        nextStateAt: isReserved ? reservationStart : null,
      },
      segments,
    };
  });

  return {
    date: dateIso,
    timezone,
    window: { start, end, isClosed: false },
    slots: [],
    services: [],
    summary: null,
    tables: tableRows,
  };
}

function createDevTableInventoryService(): TableInventoryService {
  const tables = createDevTables();

  return {
    async create(_restaurantId, _payload) {
      throw new Error('[dev][tableInventoryService] create is not implemented');
    },

    async update(_tableId, _payload) {
      throw new Error('[dev][tableInventoryService] update is not implemented');
    },

    async remove(_tableId) {
      throw new Error('[dev][tableInventoryService] remove is not implemented');
    },

    async list(_restaurantId: string) {
      return { tables, summary: null };
    },

    async timeline(_restaurantId: string, params = {}) {
      const dateIso = params.date ?? new Date().toISOString().split('T')[0];
      return buildDevTimeline(dateIso, tables);
    },
  } satisfies TableInventoryService;
}

class DevZoneService {
  private readonly zones: Zone[] = createDevZones();

  async list(_restaurantId: string) {
    return this.zones.slice();
  }

  async create(_restaurantId: string, _name: string, _sortOrder?: number, _active?: boolean): Promise<Zone> {
    throw new Error('[dev][zoneService] create is not implemented');
  }

  async update(
    _zoneId: string,
    _payload: { name?: string; sortOrder?: number; active?: boolean },
  ): Promise<Zone> {
    throw new Error('[dev][zoneService] update is not implemented');
  }

  async remove(_zoneId: string): Promise<void> {
    throw new Error('[dev][zoneService] remove is not implemented');
  }
}

export function OpsFloorPlanDevHarness() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false },
        },
      }),
    [],
  );

  const servicesFactories = useMemo(
    () => ({
      restaurantService: () => createDevRestaurantService(),
      tableInventoryService: () => createDevTableInventoryService(),
      zoneService: () => new DevZoneService(),
    }),
    [],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <OpsSessionProvider
        user={{ id: 'user-dev', email: 'dev@example.com' }}
        memberships={[
          {
            restaurantId: DEV_RESTAURANT_ID,
            restaurantName: 'Dev Restaurant',
            restaurantSlug: 'dev-restaurant',
            role: 'manager',
            createdAt: new Date().toISOString(),
          },
        ]}
        initialRestaurantId={DEV_RESTAURANT_ID}
      >
        <OpsServicesProvider factories={servicesFactories}>
          <FloorPlanPage />
        </OpsServicesProvider>
      </OpsSessionProvider>
    </QueryClientProvider>
  );
}
