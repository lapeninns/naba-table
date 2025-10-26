import { fetchJson } from '@/lib/http/fetchJson';

import type { OpsServiceError } from '@/types/ops';
import type { Tables } from '@/types/supabase';

const OPS_TABLES_BASE = '/api/ops/tables';

type TableInventoryRow = Tables<'table_inventory'>;

type TableInventoryDto = TableInventoryRow & {
  zone?: { id: string; name: string | null } | null;
};

type ServiceCapacitySummaryDto = {
  key: 'lunch' | 'dinner';
  label: string;
  capacity: number;
  tablesConsidered: number;
  turnsPerTable: number;
  seatsPerTurn: number;
  assumptions: {
    windowMinutes: number;
    turnMinutes: number;
    bufferMinutes: number;
    intervalMinutes: number | null;
  };
};

type TableInventorySummaryDto = {
  totalTables: number;
  totalCapacity: number;
  availableTables: number;
  zones: { id: string; name: string }[];
  serviceCapacities?: ServiceCapacitySummaryDto[];
};

type ListTablesResponseDto = {
  tables: TableInventoryDto[];
  summary?: TableInventorySummaryDto;
};

export type TableInventory = {
  id: string;
  restaurantId: string;
  tableNumber: string;
  capacity: number;
  minPartySize: number;
  maxPartySize: number | null;
  section: string | null;
  category: TableInventoryDto['category'];
  seatingType: TableInventoryDto['seating_type'];
  mobility: TableInventoryDto['mobility'];
  zoneId: string;
  zoneName: string | null;
  active: boolean;
  status: TableInventoryDto['status'];
  position: Record<string, unknown> | null;
  notes: string | null;
};

export type TableInventorySummary = {
  totalTables: number;
  totalCapacity: number;
  availableTables: number;
  zones: { id: string; name: string }[];
  serviceCapacities: ServiceCapacitySummaryDto[];
};

export type ListTablesParams = {
  section?: string | null;
  zoneId?: string | null;
  status?: TableInventoryDto['status'] | null;
};

export type CreateTablePayload = {
  tableNumber: string;
  capacity: number;
  minPartySize: number;
  maxPartySize?: number | null;
  section?: string | null;
  category: TableInventoryDto['category'];
  seatingType: TableInventoryDto['seating_type'];
  mobility: TableInventoryDto['mobility'];
  zoneId: string;
  status: TableInventoryDto['status'];
  active: boolean;
  position?: Record<string, unknown> | null;
  notes?: string | null;
};

export type UpdateTablePayload = Partial<CreateTablePayload> & {
  tableNumber?: string;
};

export type ListTablesResult = {
  tables: TableInventory[];
  summary: TableInventorySummary | null;
};

export interface TableInventoryService {
  list(restaurantId: string, params?: ListTablesParams): Promise<ListTablesResult>;
  create(restaurantId: string, payload: CreateTablePayload): Promise<TableInventory>;
  update(tableId: string, payload: UpdateTablePayload): Promise<TableInventory>;
  remove(tableId: string): Promise<void>;
}

export type TableInventoryServiceFactory = () => TableInventoryService;

export class NotImplementedTableInventoryService implements TableInventoryService {
  private error(message: string): never {
    throw new Error(`[ops][tables] ${message}`);
  }

  list(): Promise<ListTablesResult> {
    this.error('list not implemented');
  }

  create(): Promise<TableInventory> {
    this.error('create not implemented');
  }

  update(): Promise<TableInventory> {
    this.error('update not implemented');
  }

  remove(): Promise<void> {
    this.error('remove not implemented');
  }
}

export function createTableInventoryService(factory?: TableInventoryServiceFactory): TableInventoryService {
  try {
    return factory ? factory() : createBrowserTableInventoryService();
  } catch (error) {
    if (error instanceof Error) {
      console.error('[ops][tables] failed to instantiate service', error.message);
    }
    return new NotImplementedTableInventoryService();
  }
}

export type TableInventoryServiceError = OpsServiceError | Error;

function mapTableInventory(dto: TableInventoryDto): TableInventory {
  const position = normalizePosition(dto.position);
  return {
    id: dto.id,
    restaurantId: dto.restaurant_id,
    tableNumber: dto.table_number,
    capacity: dto.capacity,
    minPartySize: dto.min_party_size,
    maxPartySize: dto.max_party_size ?? null,
    section: dto.section ?? null,
    category: dto.category,
    seatingType: dto.seating_type,
    mobility: dto.mobility,
    zoneId: dto.zone_id,
    zoneName: dto.zone?.name ?? null,
    active: dto.active,
    status: dto.status,
    position,
    notes: dto.notes ?? null,
  };
}

function normalizePosition(value: TableInventoryDto["position"]): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const { x, y, rotation } = value as { x?: number; y?: number; rotation?: number };
  if (typeof x !== 'number' || typeof y !== 'number') {
    return null;
  }

  const normalized: Record<string, unknown> = {
    x,
    y,
  };

  if (typeof rotation === 'number') {
    normalized.rotation = rotation;
  }

  return normalized;
}

function mapSummary(dto: TableInventorySummaryDto | undefined): TableInventorySummary | null {
  if (!dto) {
    return null;
  }
  return {
    totalTables: dto.totalTables,
    totalCapacity: dto.totalCapacity,
    availableTables: dto.availableTables,
    zones: dto.zones ?? [],
    serviceCapacities: dto.serviceCapacities ?? [],
  };
}

export function createBrowserTableInventoryService(): TableInventoryService {
  return {
    async list(restaurantId, params = {}) {
      const searchParams = new URLSearchParams({ restaurantId });
      if (params.section) {
        searchParams.set('section', params.section);
      }
      if (params.zoneId) {
        searchParams.set('zoneId', params.zoneId);
      }
      if (params.status) {
        searchParams.set('status', params.status);
      }

      const response = await fetchJson<ListTablesResponseDto>(`${OPS_TABLES_BASE}?${searchParams.toString()}`);
      return {
        tables: (response.tables ?? []).map(mapTableInventory),
        summary: mapSummary(response.summary),
      };
    },

    async create(restaurantId, payload) {
      const response = await fetchJson<{ table: TableInventoryDto }>(OPS_TABLES_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
          status: payload.status,
          active: payload.active,
          position: payload.position ?? null,
          notes: payload.notes ?? null,
        }),
      });
      return mapTableInventory(response.table);
    },

    async update(tableId, payload) {
      const response = await fetchJson<{ table: TableInventoryDto }>(`${OPS_TABLES_BASE}/${tableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: payload.tableNumber,
          capacity: payload.capacity,
          minPartySize: payload.minPartySize,
          maxPartySize: payload.maxPartySize,
          section: payload.section,
          category: payload.category,
          seatingType: payload.seatingType,
          mobility: payload.mobility,
          zoneId: payload.zoneId,
          status: payload.status,
          active: payload.active,
          position: payload.position ?? null,
          notes: payload.notes ?? null,
        }),
      });
      return mapTableInventory(response.table);
    },

    async remove(tableId) {
      await fetchJson<{ success: boolean }>(`${OPS_TABLES_BASE}/${tableId}`, {
        method: 'DELETE',
      });
    },

  };
}
