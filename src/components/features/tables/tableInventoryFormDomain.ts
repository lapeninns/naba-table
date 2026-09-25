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
  | { ok: false; errors: TableFormErrors };

export function buildTableFormDraft(
  table: TableInventory | null,
  zones: ReadonlyArray<Pick<TableZone, 'id' | 'active'>>,
  preferredZoneId?: string | null,
): TableFormDraft {
  const preferred = preferredZoneId
    ? zones.find((zone) => zone.id === preferredZoneId)?.id
    : undefined;
  return {
    zoneId: table?.zoneId ?? preferred ?? zones.find((zone) => zone.active)?.id ?? zones[0]?.id,
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

/** Field order used to focus the first invalid field after a failed save. */
const TABLE_FORM_FIELD_ORDER = [
  'tableNumber',
  'capacity',
  'minPartySize',
  'maxPartySize',
  'zoneId',
  'section',
  'notes',
] as const;

export type TableFormField = (typeof TABLE_FORM_FIELD_ORDER)[number];
export type TableFormErrors = Partial<Record<TableFormField, string>>;

/** Limits restate the server's table schema (`/api/ops/tables`). */
export const TABLE_FORM_LIMITS = {
  tableNumberMax: 50,
  seatsMin: 1,
  seatsMax: 20,
  sectionMax: 100,
  notesMax: 500,
} as const;

export function getFirstInvalidTableField(errors: TableFormErrors): TableFormField | null {
  return TABLE_FORM_FIELD_ORDER.find((field) => Boolean(errors[field])) ?? null;
}

export function getDuplicateTableNumberMessage(tableNumber: string): string {
  return `Table ${tableNumber.trim()} already exists`;
}

export function parseTableFormPayload(
  formData: FormData,
  draft: TableFormDraft,
): TableFormParseResult {
  const errors: TableFormErrors = {};
  const tableNumber = String(formData.get('tableNumber') ?? '').trim();
  const capacity = parseWholeNumber(formData.get('capacity'));
  const minRaw = String(formData.get('minPartySize') ?? '').trim();
  const maxRaw = String(formData.get('maxPartySize') ?? '').trim();
  const minPartySize = minRaw === '' ? 1 : parseWholeNumber(minRaw);
  const maxPartySize = maxRaw === '' ? null : parseWholeNumber(maxRaw);
  const section = normalizeOptionalText(formData.get('section'));
  const notes = normalizeOptionalText(formData.get('notes'));

  if (!tableNumber) {
    errors.tableNumber = 'Enter a table number';
  } else if (tableNumber.length > TABLE_FORM_LIMITS.tableNumberMax) {
    errors.tableNumber = `Use ${TABLE_FORM_LIMITS.tableNumberMax} characters or fewer`;
  }

  if (
    capacity === null ||
    capacity < TABLE_FORM_LIMITS.seatsMin ||
    capacity > TABLE_FORM_LIMITS.seatsMax
  ) {
    errors.capacity = 'Enter seats from 1 to 20';
  }

  if (minPartySize === null || minPartySize < 1) {
    errors.minPartySize = 'Smallest party must be at least 1';
  }

  if (
    maxRaw !== '' &&
    (maxPartySize === null ||
      maxPartySize > TABLE_FORM_LIMITS.seatsMax ||
      (minPartySize !== null && maxPartySize < minPartySize))
  ) {
    errors.maxPartySize = 'Largest party must be at least the smallest party, up to 20';
  }

  if (!draft.zoneId) {
    errors.zoneId = 'Choose a zone';
  }

  if (section && section.length > TABLE_FORM_LIMITS.sectionMax) {
    errors.section = `Use ${TABLE_FORM_LIMITS.sectionMax} characters or fewer`;
  }

  if (notes && notes.length > TABLE_FORM_LIMITS.notesMax) {
    errors.notes = `Use ${TABLE_FORM_LIMITS.notesMax} characters or fewer`;
  }

  if (
    Object.keys(errors).length > 0 ||
    !draft.zoneId ||
    capacity === null ||
    minPartySize === null
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    payload: {
      tableNumber,
      capacity,
      minPartySize,
      maxPartySize,
      section,
      notes,
      zoneId: draft.zoneId,
      category: draft.category,
      seatingType: draft.seatingType,
      mobility: draft.mobility,
      status: draft.status,
      active: draft.active,
    },
  };
}

export type ZoneFormErrors = Partial<Record<'zoneName' | 'sortOrder', string>>;

export type ZoneFormParseResult =
  | { ok: true; payload: ZoneFormPayload }
  | { ok: false; errors: ZoneFormErrors };

/** Limits restate the server's zone schema (`/api/ops/zones`). */
export const ZONE_FORM_LIMITS = { nameMax: 100, sortOrderMin: -1000, sortOrderMax: 1000 } as const;

export function parseZoneFormPayload(formData: FormData): ZoneFormParseResult {
  const errors: ZoneFormErrors = {};
  const name = String(formData.get('zoneName') ?? '').trim();
  const sortOrderRaw = String(formData.get('sortOrder') ?? '').trim();

  if (name.length === 0) {
    errors.zoneName = 'Enter a zone name';
  } else if (name.length > ZONE_FORM_LIMITS.nameMax) {
    errors.zoneName = `Use ${ZONE_FORM_LIMITS.nameMax} characters or fewer`;
  }

  let sortOrder: number | undefined;
  if (sortOrderRaw !== '') {
    const parsed = /^-?\d+$/.test(sortOrderRaw) ? Number.parseInt(sortOrderRaw, 10) : Number.NaN;
    if (
      Number.isNaN(parsed) ||
      parsed < ZONE_FORM_LIMITS.sortOrderMin ||
      parsed > ZONE_FORM_LIMITS.sortOrderMax
    ) {
      errors.sortOrder = 'Enter a whole number from -1000 to 1000';
    } else {
      sortOrder = parsed;
    }
  }

  if (errors.zoneName || errors.sortOrder) {
    return { ok: false, errors };
  }

  return { ok: true, payload: sortOrder === undefined ? { name } : { name, sortOrder } };
}

function parseWholeNumber(value: FormDataEntryValue | string | null): number | null {
  const raw = String(value ?? '').trim();
  if (!/^\d+$/.test(raw)) return null;
  return Number.parseInt(raw, 10);
}

function normalizeOptionalText(value: FormDataEntryValue | null): string | null {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}
