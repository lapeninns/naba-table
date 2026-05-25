import type { TableFormState, TableZone } from './tableInventoryModel';
import type { TableInventory, TableInventorySummary } from '@/services/ops/tables';

export type ZoneFormPayload = {
  name: string;
  sortOrder?: number;
};

export type TableFormDraft = Pick<
  TableFormState,
  'active' | 'category' | 'mobility' | 'seatingType' | 'status'
> & {
  zoneId?: string;
};

export type TableFormParseResult =
  | { ok: true; payload: TableFormState }
  | { ok: false; error: string };

export function buildTableFormDraft(
  table: TableInventory | null,
  zones: Pick<TableZone, 'id' | 'active'>[],
): TableFormDraft {
  return {
    zoneId: table?.zoneId ?? zones.find((zone) => zone.active)?.id ?? zones[0]?.id,
    category: table?.category ?? 'dining',
    seatingType: table?.seatingType ?? 'standard',
    mobility: table?.mobility ?? 'movable',
    status: table?.status ?? 'available',
    active: table?.active ?? true,
  };
}

export function getSelectedTableZone<TZone extends Pick<TableZone, 'id'>>(
  zones: TZone[],
  zoneId: string | undefined,
): TZone | null {
  if (!zoneId) return null;
  return zones.find((zone) => zone.id === zoneId) ?? null;
}

export function buildTableInventoryZones(
  summary: TableInventorySummary | null,
  fallbackZones: ReadonlyArray<TableZone>,
): TableZone[] {
  const source = summary
    ? summary.zones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        active: zone.active,
        sortOrder: zone.sortOrder,
      }))
    : fallbackZones;

  return source.slice().sort((a, b) => {
    const orderA = a.sortOrder ?? 0;
    const orderB = b.sortOrder ?? 0;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.name.localeCompare(b.name);
  });
}

export function buildTableInventoryZoneOptions(
  zones: ReadonlyArray<TableZone>,
): Array<Pick<TableZone, 'id' | 'name' | 'active'>> {
  return zones.map((zone) => ({ id: zone.id, name: zone.name, active: zone.active }));
}

export function parseTableFormPayload(
  formData: FormData,
  draft: TableFormDraft,
): TableFormParseResult {
  const tableNumber = String(formData.get('tableNumber') ?? '').trim();
  const capacity = parseInteger(formData.get('capacity'), 0) ?? 0;

  if (!tableNumber) {
    return { ok: false, error: 'Enter a table number before saving.' };
  }

  if (capacity < 1) {
    return { ok: false, error: 'Capacity must be at least 1 cover.' };
  }

  if (!draft.zoneId) {
    return { ok: false, error: 'Choose a zone before saving this table.' };
  }

  const minPartySize = parseInteger(formData.get('minPartySize'), 1) ?? 1;
  const maxPartySize = parseInteger(formData.get('maxPartySize'), null);

  if (maxPartySize !== null && maxPartySize < minPartySize) {
    return {
      ok: false,
      error: 'Max party size must be greater than or equal to the min party size.',
    };
  }

  return {
    ok: true,
    payload: {
      tableNumber,
      capacity,
      minPartySize,
      maxPartySize,
      section: normalizeOptionalText(formData.get('section')),
      notes: normalizeOptionalText(formData.get('notes')),
      zoneId: draft.zoneId,
      category: draft.category,
      seatingType: draft.seatingType,
      mobility: draft.mobility,
      status: draft.status,
      active: draft.active,
    },
  };
}

export function parseZoneFormPayload(formData: FormData): ZoneFormPayload | null {
  const name = String(formData.get('zoneName') ?? '').trim();
  if (name.length === 0) {
    return null;
  }

  const sortOrderRaw = formData.get('sortOrder');
  if (sortOrderRaw === null || sortOrderRaw === '') {
    return { name };
  }

  const parsed = Number.parseInt(String(sortOrderRaw), 10);
  return {
    name,
    sortOrder: Number.isNaN(parsed) ? undefined : parsed,
  };
}

function parseInteger(value: FormDataEntryValue | null, fallback: number | null): number | null {
  if (!value) return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeOptionalText(value: FormDataEntryValue | null): string | null {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}
