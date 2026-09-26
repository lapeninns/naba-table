import type { TableFormState, TableZone } from './tableInventoryModel';
import type { TableInventory, TableInventorySummary } from '@/services/ops/tables';

export type ZoneFormPayload = {
  name: string;
  /** Zone this one is placed before on the page; null places it at the end. */
  beforeZoneId: string | null;
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

/** The table editor's working copy: text fields stay as typed until the save parses them. */
export type TableDraft = {
  tableNumber: string;
  capacity: string;
  minPartySize: string;
  maxPartySize: string;
  zoneId: string | undefined;
  mobility: TableFormState['mobility'];
  active: boolean;
  status: TableFormState['status'];
  seatingType: TableFormState['seatingType'];
  category: TableFormState['category'];
  section: string;
  notes: string;
};

const NEW_TABLE_SEATS = 4;

export function buildTableDraft(
  table: TableInventory | null,
  zones: ReadonlyArray<Pick<TableZone, 'id' | 'active'>>,
  preferredZoneId?: string | null,
): TableDraft {
  const base = buildTableFormDraft(table, zones, preferredZoneId);
  return {
    tableNumber: table?.tableNumber ?? '',
    capacity: String(table?.capacity ?? NEW_TABLE_SEATS),
    minPartySize: String(table?.minPartySize ?? 1),
    maxPartySize: table?.maxPartySize == null ? '' : String(table.maxPartySize),
    zoneId: base.zoneId,
    mobility: base.mobility,
    active: base.active,
    status: base.status,
    seatingType: base.seatingType,
    category: base.category,
    section: table?.section ?? '',
    notes: table?.notes ?? '',
  };
}

export function isTableDraftDirty(draft: TableDraft, initial: TableDraft): boolean {
  return (Object.keys(initial) as Array<keyof TableDraft>).some(
    (key) => draft[key] !== initial[key],
  );
}

export function parseTableDraft(draft: TableDraft): TableFormParseResult {
  const errors: TableFormErrors = {};
  const tableNumber = draft.tableNumber.trim();
  const capacity = parseWholeNumber(draft.capacity);
  const minRaw = draft.minPartySize.trim();
  const maxRaw = draft.maxPartySize.trim();
  const minPartySize = minRaw === '' ? 1 : parseWholeNumber(minRaw);
  const maxPartySize = maxRaw === '' ? null : parseWholeNumber(maxRaw);
  const section = normalizeOptionalText(draft.section);
  const notes = normalizeOptionalText(draft.notes);

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
  } else if (
    // The allocator never seats more than a fixed table's seats (`deriveTableRules`).
    draft.mobility === 'fixed' &&
    maxPartySize !== null &&
    capacity !== null &&
    maxPartySize > capacity
  ) {
    errors.maxPartySize = `A fixed table can’t take more than its ${capacity} seats`;
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

export function parseTableFormPayload(
  formData: FormData,
  draft: TableFormDraft,
): TableFormParseResult {
  const text = (name: string) => String(formData.get(name) ?? '');
  return parseTableDraft({
    tableNumber: text('tableNumber'),
    capacity: text('capacity'),
    minPartySize: text('minPartySize'),
    maxPartySize: text('maxPartySize'),
    section: text('section'),
    notes: text('notes'),
    zoneId: draft.zoneId,
    category: draft.category,
    seatingType: draft.seatingType,
    mobility: draft.mobility,
    status: draft.status,
    active: draft.active,
  });
}

export type ZoneFormErrors = Partial<Record<'zoneName', string>>;

export type ZoneFormParseResult =
  | { ok: true; payload: ZoneFormPayload }
  | { ok: false; errors: ZoneFormErrors };

/** Limits restate the server's zone schema (`/api/ops/zones`). */
export const ZONE_FORM_LIMITS = { nameMax: 100 } as const;

export function parseZoneFormPayload(
  values: { name: string; beforeZoneId: string | null },
  zones: ReadonlyArray<Pick<TableZone, 'id' | 'name'>>,
  editingZoneId: string | null,
): ZoneFormParseResult {
  const name = values.name.trim();
  const key = name.toLocaleLowerCase('en-GB');

  if (name.length === 0) {
    return { ok: false, errors: { zoneName: 'Enter a zone name' } };
  }
  if (name.length > ZONE_FORM_LIMITS.nameMax) {
    return {
      ok: false,
      errors: { zoneName: `Use ${ZONE_FORM_LIMITS.nameMax} characters or fewer` },
    };
  }
  if (
    zones.some(
      (zone) => zone.id !== editingZoneId && zone.name.trim().toLocaleLowerCase('en-GB') === key,
    )
  ) {
    return { ok: false, errors: { zoneName: 'A zone with this name already exists' } };
  }

  return { ok: true, payload: { name, beforeZoneId: values.beforeZoneId } };
}

function parseWholeNumber(value: FormDataEntryValue | string | null): number | null {
  const raw = String(value ?? '').trim();
  if (!/^\d+$/.test(raw)) return null;
  return Number.parseInt(raw, 10);
}

function normalizeOptionalText(value: FormDataEntryValue | string | null): string | null {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}
