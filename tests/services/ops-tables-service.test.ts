import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchJsonMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/http/fetchJson', () => ({
  fetchJson: fetchJsonMock,
}));

import { createBrowserTableInventoryService } from '@/src/services/ops/tables';

function makeTable(overrides: Record<string, unknown> = {}) {
  return {
    id: 'table-1',
    restaurant_id: 'restaurant-1',
    table_number: '1',
    capacity: 4,
    min_party_size: 1,
    max_party_size: 4,
    section: 'main',
    category: 'standard',
    seating_type: 'indoor',
    mobility: 'fixed',
    zone_id: 'zone-1',
    active: true,
    status: 'available',
    position: { x: 12, y: 24 },
    notes: 'Window table',
    zone: { id: 'zone-1', name: 'Main', active: true },
    ...overrides,
  };
}

describe('createBrowserTableInventoryService', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
    fetchJsonMock.mockResolvedValue({ table: makeTable() });
  });

  it('omits undefined fields from PATCH payloads', async () => {
    const service = createBrowserTableInventoryService();

    await service.update('table-1', { capacity: 6 });

    expect(fetchJsonMock).toHaveBeenCalledWith('/api/ops/tables/table-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacity: 6 }),
    });
    const body = JSON.parse(fetchJsonMock.mock.calls[0]?.[1]?.body as string) as Record<
      string,
      unknown
    >;
    expect(body).not.toHaveProperty('position');
    expect(body).not.toHaveProperty('notes');
  });

  it('preserves explicit null fields in PATCH payloads', async () => {
    const service = createBrowserTableInventoryService();
    fetchJsonMock.mockResolvedValueOnce({
      table: makeTable({
        position: null,
        notes: null,
      }),
    });

    await service.update('table-1', {
      position: null,
      notes: null,
    });

    expect(fetchJsonMock).toHaveBeenCalledWith('/api/ops/tables/table-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: null, notes: null }),
    });
  });
});
