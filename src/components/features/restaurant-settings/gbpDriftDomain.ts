import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

export function slugifyDualSyncDisplay(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readStableKey(field: DualSyncFieldSummary): string | null {
  const coreStableKey = readString(readObject(field.coreValue)?.stableKey);
  if (coreStableKey) return coreStableKey;
  const gbpStableKey = readString(readObject(field.gbpValue)?.stableKey);
  if (gbpStableKey) return gbpStableKey;
  return null;
}

function normalizeMaybeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function servicePeriodMatches(
  value: unknown,
  identity: ServicePeriodIdentity,
  fallbackStableKey: string,
) {
  const period = readObject(value);
  if (!period) return false;
  const stableKey = readString(period.stableKey);
  if (stableKey && stableKey === fallbackStableKey) return true;
  return (
    period.dayOfWeek === identity.dayOfWeek &&
    period.startTime === identity.startTime &&
    period.endTime === identity.endTime &&
    period.bookingOption === identity.bookingOption &&
    normalizeMaybeText(readString(period.name)) === normalizeMaybeText(identity.name)
  );
}

export type ServicePeriodIdentity = {
  readonly dayOfWeek: number | null;
  readonly startTime: string;
  readonly endTime: string;
  readonly bookingOption: string;
  readonly name: string;
};

export function buildServicePeriodStableKey({
  dayOfWeek,
  startTime,
  endTime,
  bookingOption,
  name,
}: ServicePeriodIdentity): string {
  return [
    dayOfWeek === null ? 'any' : String(dayOfWeek),
    startTime,
    endTime,
    bookingOption,
    name.trim().toLowerCase(),
  ].join('|');
}

export function findServicePeriodDriftField(
  fields: ReadonlyArray<DualSyncFieldSummary>,
  identity: ServicePeriodIdentity,
): DualSyncFieldSummary | null {
  const stableKey = buildServicePeriodStableKey(identity);
  return (
    fields.find((field) => {
      if (field.sectionKey !== 'servicePeriods') return false;
      const fieldStableKey = readStableKey(field);
      if (fieldStableKey) return fieldStableKey === stableKey;
      return (
        servicePeriodMatches(field.coreValue, identity, stableKey) ||
        servicePeriodMatches(field.gbpValue, identity, stableKey) ||
        field.fieldKey === `servicePeriods.${stableKey}`
      );
    }) ?? null
  );
}

export type FoodMenuItemIdentity = {
  readonly menuId: string | null | undefined;
  readonly menuLabel: string;
  readonly sectionId: string | null | undefined;
  readonly sectionLabel: string;
  readonly externalItemId: string;
  readonly itemId: string | null | undefined;
};

export function buildFoodMenuItemStableKey({
  menuId,
  menuLabel,
  sectionId,
  sectionLabel,
  externalItemId,
  itemId,
}: FoodMenuItemIdentity): string {
  return [
    'foodMenu.menu',
    slugifyDualSyncDisplay(menuId || menuLabel || 'menu') || 'menu',
    'section',
    slugifyDualSyncDisplay(sectionId || sectionLabel || 'section') || 'section',
    'item',
    slugifyDualSyncDisplay(externalItemId || itemId || 'item') || 'item',
  ].join('.');
}

export function findFoodMenuItemDriftField(
  fields: ReadonlyArray<DualSyncFieldSummary>,
  identity: FoodMenuItemIdentity,
): DualSyncFieldSummary | null {
  const stableKey = buildFoodMenuItemStableKey(identity);
  const legacyStableKey = `foodMenu.item.${slugifyDualSyncDisplay(identity.sectionLabel || 'menu')}.${slugifyDualSyncDisplay(
    identity.externalItemId || identity.itemId || 'item',
  )}`;
  const safeStableKey = stableKey.trim().replace(/\.+/g, '_').replace(/\s+/g, '-');
  return (
    fields.find((field) => {
      if (field.sectionKey !== 'foodMenus') return false;
      const fieldStableKey = readStableKey(field);
      if (fieldStableKey) {
        return fieldStableKey === stableKey || fieldStableKey === legacyStableKey;
      }
      const coreValue = readObject(field.coreValue);
      const gbpValue = readObject(field.gbpValue);
      const localItemId = identity.itemId ?? identity.externalItemId;
      if (
        readString(coreValue?.externalItemId) === identity.externalItemId ||
        readString(gbpValue?.externalItemId) === identity.externalItemId ||
        readString(coreValue?.localItemId) === localItemId ||
        readString(gbpValue?.localItemId) === localItemId
      ) {
        return true;
      }
      return field.fieldKey.includes(safeStableKey);
    }) ?? null
  );
}
