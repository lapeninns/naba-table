import ZoneService, { type Zone } from '@/services/ops/zones';

import { DEV_RESTAURANT_ID, DEV_ZONE_MAIN_ID, DEV_ZONE_PATIO_ID } from '../devIds';



import type {
  CreateTablePayload,
  ListTablesParams,
  ListTablesResult,
  TableInventory,
  TableInventoryService,
  UpdateTablePayload,
} from '@/services/ops/tables';
import type { TableTimelineResponse, TableTimelineRow, TableTimelineSegment } from '@/types/ops';


type MutableTablesState = {
  zones: Zone[];
  tables: TableInventory[];
};

function makeZone(id: string, name: string, active: boolean, sortOrder: number): Zone {
  const now = new Date().toISOString();
  return {
    id,
    restaurantId: DEV_RESTAURANT_ID,
    name,
    sortOrder,
    active,
    createdAt: now,
    updatedAt: now,
  };
}

function makeTable(input: {
  id: string;
  tableNumber: string;
  capacity: number;
  zoneId: string;
  zoneName: string;
  zoneActive: boolean;
  seatingType: TableInventory['seatingType'];
  category: TableInventory['category'];
}): TableInventory {
  return {
    id: input.id,
    restaurantId: DEV_RESTAURANT_ID,
    tableNumber: input.tableNumber,
    capacity: input.capacity,
    minPartySize: 1,
    maxPartySize: input.capacity + 2,
    section: input.zoneName,
    category: input.category,
    seatingType: input.seatingType,
    mobility: 'movable',
    zoneId: input.zoneId,
    zoneName: input.zoneName,
    zoneActive: input.zoneActive,
    active: true,
    status: 'available',
    position: { x: Math.random() * 1000, y: Math.random() * 700, rotation: 0 },
    notes: null,
  };
}

function buildInitialState(): MutableTablesState {
  const zones: Zone[] = [
    makeZone(DEV_ZONE_MAIN_ID, 'Main', true, 0),
    makeZone(DEV_ZONE_PATIO_ID, 'Patio', true, 1),
    makeZone('66666666-6666-4666-8666-666666666666', 'VIP (inactive)', false, 2),
  ];

  const tables: TableInventory[] = [
    makeTable({
      id: 't-12',
      tableNumber: '12',
      capacity: 4,
      zoneId: DEV_ZONE_MAIN_ID,
      zoneName: 'Main',
      zoneActive: true,
      seatingType: 'standard',
      category: 'dining',
    }),
    makeTable({
      id: 't-7',
      tableNumber: '7',
      capacity: 2,
      zoneId: DEV_ZONE_MAIN_ID,
      zoneName: 'Main',
      zoneActive: true,
      seatingType: 'booth',
      category: 'dining',
    }),
    makeTable({
      id: 't-3',
      tableNumber: '3',
      capacity: 4,
      zoneId: DEV_ZONE_PATIO_ID,
      zoneName: 'Patio',
      zoneActive: true,
      seatingType: 'standard',
      category: 'patio',
    }),
  ];

  const generated = Array.from({ length: 62 }, (_, idx) => {
    const n = 20 + idx;
    const zone = zones[idx % 2]!;
    const capacity = [2, 4, 6, 8][idx % 4]!;
    return makeTable({
      id: `t-${n}`,
      tableNumber: String(n),
      capacity,
      zoneId: zone.id,
      zoneName: zone.name,
      zoneActive: zone.active,
      seatingType: idx % 5 === 0 ? 'booth' : 'standard',
      category: zone.name === 'Patio' ? 'patio' : 'dining',
    });
  });

  return { zones, tables: [...tables, ...generated] };
}

export class DevZoneService extends ZoneService {
  constructor(private readonly state: MutableTablesState) {
    super();
  }

  async list(restaurantId: string): Promise<Zone[]> {
    if (restaurantId !== DEV_RESTAURANT_ID) {
      throw new Error('[dev][zoneService] unknown restaurant');
    }
    return this.state.zones;
  }

  async create(restaurantId: string, name: string, sortOrder?: number, active?: boolean): Promise<Zone> {
    if (restaurantId !== DEV_RESTAURANT_ID) {
      throw new Error('[dev][zoneService] unknown restaurant');
    }
    const id = `zone-${Date.now()}`;
    const zone = makeZone(id, name, active ?? true, sortOrder ?? this.state.zones.length);
    this.state.zones = [...this.state.zones, zone];
    return zone;
  }

  async update(zoneId: string, payload: { name?: string; sortOrder?: number; active?: boolean }): Promise<Zone> {
    const idx = this.state.zones.findIndex((z) => z.id === zoneId);
    if (idx === -1) throw new Error('[dev][zoneService] zone not found');
    const existing = this.state.zones[idx]!;
    const next: Zone = {
      ...existing,
      name: payload.name ?? existing.name,
      sortOrder: payload.sortOrder ?? existing.sortOrder,
      active: payload.active ?? existing.active,
      updatedAt: new Date().toISOString(),
    };
    this.state.zones = this.state.zones.map((z) => (z.id === zoneId ? next : z));
    return next;
  }

  async remove(zoneId: string): Promise<void> {
    this.state.zones = this.state.zones.filter((z) => z.id !== zoneId);
    // Mark any tables in the deleted zone as inactive (so the UI doesn't crash on references).
    this.state.tables = this.state.tables.map((t) =>
      t.zoneId === zoneId ? { ...t, active: false, zoneActive: false } : t,
    );
  }
}

export class DevTableInventoryService implements TableInventoryService {
  constructor(private readonly state: MutableTablesState) {}

  async list(restaurantId: string, params: ListTablesParams = {}): Promise<ListTablesResult> {
    if (restaurantId !== DEV_RESTAURANT_ID) {
      throw new Error('[dev][tables] unknown restaurant');
    }
    let tables = this.state.tables.slice();
    if (params.zoneId) tables = tables.filter((t) => t.zoneId === params.zoneId);
    if (params.section) tables = tables.filter((t) => (t.section ?? '') === params.section);
    if (params.status) tables = tables.filter((t) => t.status === params.status);

    const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
    const availableTables = tables.filter((t) => t.active && t.status === 'available').length;
    const zones = this.state.zones.map((z) => ({ id: z.id, name: z.name, active: z.active }));

    return {
      tables,
      summary: {
        totalTables: tables.length,
        totalCapacity,
        availableTables,
        zones,
        serviceCapacities: [
          {
            key: 'lunch',
            label: 'Lunch',
            capacity: Math.round(totalCapacity * 0.6),
            tablesConsidered: tables.length,
            turnsPerTable: 2,
            seatsPerTurn: totalCapacity,
            assumptions: { windowMinutes: 180, turnMinutes: 75, bufferMinutes: 15, intervalMinutes: 15 },
          },
          {
            key: 'dinner',
            label: 'Dinner',
            capacity: totalCapacity,
            tablesConsidered: tables.length,
            turnsPerTable: 3,
            seatsPerTurn: totalCapacity,
            assumptions: { windowMinutes: 300, turnMinutes: 90, bufferMinutes: 15, intervalMinutes: 15 },
          },
        ],
      },
    };
  }

  async create(restaurantId: string, payload: CreateTablePayload): Promise<TableInventory> {
    if (restaurantId !== DEV_RESTAURANT_ID) {
      throw new Error('[dev][tables] unknown restaurant');
    }
    const zone = this.state.zones.find((z) => z.id === payload.zoneId);
    if (!zone) throw new Error('[dev][tables] unknown zone');

    const id = `t-${Date.now()}`;
    const table: TableInventory = {
      id,
      restaurantId,
      tableNumber: payload.tableNumber,
      capacity: payload.capacity,
      minPartySize: payload.minPartySize,
      maxPartySize: payload.maxPartySize ?? null,
      section: payload.section ?? null,
      category: payload.category,
      seatingType: payload.seatingType,
      mobility: payload.mobility,
      zoneId: payload.zoneId,
      zoneName: zone.name,
      zoneActive: zone.active,
      active: payload.active,
      status: payload.status,
      position: payload.position ?? null,
      notes: payload.notes ?? null,
    };
    this.state.tables = [...this.state.tables, table];
    return table;
  }

  async update(tableId: string, payload: UpdateTablePayload): Promise<TableInventory> {
    const idx = this.state.tables.findIndex((t) => t.id === tableId);
    if (idx === -1) throw new Error('[dev][tables] table not found');
    const existing = this.state.tables[idx]!;
    const zoneId = payload.zoneId ?? existing.zoneId;
    const zone = this.state.zones.find((z) => z.id === zoneId) ?? null;

    const next: TableInventory = {
      ...existing,
      tableNumber: payload.tableNumber ?? existing.tableNumber,
      capacity: payload.capacity ?? existing.capacity,
      minPartySize: payload.minPartySize ?? existing.minPartySize,
      maxPartySize: payload.maxPartySize ?? existing.maxPartySize,
      section: payload.section ?? existing.section,
      category: payload.category ?? existing.category,
      seatingType: payload.seatingType ?? existing.seatingType,
      mobility: payload.mobility ?? existing.mobility,
      zoneId,
      zoneName: zone?.name ?? existing.zoneName,
      zoneActive: zone?.active ?? existing.zoneActive,
      active: payload.active ?? existing.active,
      status: payload.status ?? existing.status,
      position: payload.position ?? existing.position,
      notes: payload.notes ?? existing.notes,
    };

    this.state.tables = this.state.tables.map((t) => (t.id === tableId ? next : t));
    return next;
  }

  async remove(tableId: string): Promise<void> {
    this.state.tables = this.state.tables.filter((t) => t.id !== tableId);
  }

  async timeline(restaurantId: string, params?: { date?: string | null; zoneId?: string | null; service?: 'lunch' | 'dinner' | 'all' }): Promise<TableTimelineResponse> {
    if (restaurantId !== DEV_RESTAURANT_ID) {
      throw new Error('[dev][tables] unknown restaurant');
    }
    const date = params?.date ?? '2026-02-10';
    const timezone = 'Europe/London';
    const zoneId = params?.zoneId ?? null;
    const service = params?.service ?? 'all';

    const tables = zoneId ? this.state.tables.filter((t) => t.zoneId === zoneId) : this.state.tables;

    const windowStart = '11:00';
    const windowEnd = '23:00';

    const makeSegment = (input: Partial<TableTimelineSegment> & Pick<TableTimelineSegment, 'start' | 'end' | 'state' | 'serviceKey'>): TableTimelineSegment => ({
      booking: null,
      hold: null,
      ...input,
    });

    const rows: TableTimelineRow[] = tables.slice(0, 40).map((t, i) => {
      const status: TableTimelineRow['table']['status'] =
        i % 12 === 0 ? 'out_of_service' : i % 7 === 0 ? 'occupied' : i % 5 === 0 ? 'reserved' : 'available';
      const zone = this.state.zones.find((z) => z.id === t.zoneId) ?? null;
      const segments: TableTimelineSegment[] = [
        makeSegment({ start: `${date}T12:00:00Z`, end: `${date}T13:30:00Z`, state: 'available', serviceKey: 'lunch' }),
        makeSegment({ start: `${date}T13:30:00Z`, end: `${date}T15:00:00Z`, state: 'reserved', serviceKey: 'lunch' }),
        makeSegment({ start: `${date}T17:00:00Z`, end: `${date}T18:30:00Z`, state: 'available', serviceKey: 'dinner' }),
        makeSegment({ start: `${date}T18:30:00Z`, end: `${date}T20:00:00Z`, state: 'hold', serviceKey: 'dinner' }),
        makeSegment({ start: `${date}T20:00:00Z`, end: `${date}T22:30:00Z`, state: 'reserved', serviceKey: 'dinner' }),
      ];

      return {
        table: {
          id: t.id,
          tableNumber: t.tableNumber,
          capacity: t.capacity,
          zoneId: zone?.id ?? null,
          zoneName: zone?.name ?? null,
          status: status === 'occupied' ? 'occupied' : status === 'out_of_service' ? 'out_of_service' : status === 'reserved' ? 'reserved' : 'available',
          active: t.active,
        },
        stats: {
          occupancyMinutes: 120,
          totalMinutes: 720,
          occupancyPercentage: 0.22,
          nextStateAt: `${date}T18:30:00Z`,
        },
        segments: service === 'all' ? segments : segments.filter((s) => s.serviceKey === service),
      };
    });

    const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
    const zones = this.state.zones.map((z) => ({ id: z.id, name: z.name, active: z.active }));

    return {
      date,
      timezone,
      window: { start: windowStart, end: windowEnd, isClosed: false },
      slots: [],
      services: [
        { key: 'lunch', label: 'Lunch', start: '12:00', end: '15:00', slotCount: 12 },
        { key: 'dinner', label: 'Dinner', start: '17:00', end: '23:00', slotCount: 24 },
      ],
      summary: {
        totalTables: tables.length,
        totalCapacity,
        availableTables: tables.filter((t) => t.active && t.status === 'available').length,
        zones,
        serviceCapacities: [
          {
            key: 'lunch',
            label: 'Lunch',
            capacity: Math.round(totalCapacity * 0.6),
            tablesConsidered: tables.length,
            turnsPerTable: 2,
            seatsPerTurn: totalCapacity,
            assumptions: { windowMinutes: 180, turnMinutes: 75, bufferMinutes: 15, intervalMinutes: 15 },
          },
          {
            key: 'dinner',
            label: 'Dinner',
            capacity: totalCapacity,
            tablesConsidered: tables.length,
            turnsPerTable: 3,
            seatsPerTurn: totalCapacity,
            assumptions: { windowMinutes: 300, turnMinutes: 90, bufferMinutes: 15, intervalMinutes: 15 },
          },
        ],
      },
      tables: rows,
    };
  }
}

export function createDevTablesState(): MutableTablesState {
  return buildInitialState();
}

