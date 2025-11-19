import { fetchJson } from '@/lib/http/fetchJson';

const OPS_ZONES_BASE = '/api/zones';

export type Zone = {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type ZoneDto = {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const mapZone = (dto: ZoneDto): Zone => ({
  id: dto.id,
  restaurantId: dto.restaurant_id,
  name: dto.name,
  sortOrder: dto.sort_order ?? 0,
  createdAt: dto.created_at,
  updatedAt: dto.updated_at,
});

export type ListZonesResponse = {
  zones: ZoneDto[];
};

export default class ZoneService {
  async list(restaurantId: string): Promise<Zone[]> {
    const response = await fetchJson<ListZonesResponse>(`${OPS_ZONES_BASE}?restaurantId=${restaurantId}`);
    return (response.zones ?? []).map(mapZone);
  }

  async create(restaurantId: string, name: string, sortOrder?: number): Promise<Zone> {
    const response = await fetchJson<{ zone: ZoneDto }>(OPS_ZONES_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, name, sortOrder }),
    });
    return mapZone(response.zone);
  }

  async update(zoneId: string, payload: { name?: string; sortOrder?: number }): Promise<Zone> {
    const response = await fetchJson<{ zone: ZoneDto }>(`${OPS_ZONES_BASE}/${zoneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return mapZone(response.zone);
  }

  async remove(zoneId: string): Promise<void> {
    await fetchJson<{ success: boolean }>(`${OPS_ZONES_BASE}/${zoneId}`, {
      method: 'DELETE',
    });
  }
}
