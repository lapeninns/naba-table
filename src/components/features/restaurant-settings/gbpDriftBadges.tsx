'use client';

import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOpsDualSync } from '@/hooks/ops/useOpsDualSync';
import { cn } from '@/lib/utils';

import { fieldNeedsOperatorChoice } from './dual-sync/workspace-progress';
import { openSettingsCompare } from './gbp/openSettingsCompare';
import { useOptionalGbpDrift } from './gbp-drift/useGbpDrift';

import type { DualSyncSectionKey } from '@/server/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

type DriftSectionKey = Extract<
  DualSyncSectionKey,
  | 'operatingHours'
  | 'servicePeriods'
  | 'businessContext.categories'
  | 'businessContext.serviceAreas'
  | 'businessContext.attributes'
  | 'businessContext.serviceItems'
  | 'foodMenus'
>;

const REVIEWABLE_SECTION_KEYS = new Set<DriftSectionKey>([
  'operatingHours',
  'servicePeriods',
  'businessContext.categories',
  'businessContext.serviceAreas',
  'businessContext.attributes',
  'businessContext.serviceItems',
  'foodMenus',
]);

export interface WorkspaceGbpDriftCheck {
  readonly fields: ReadonlyArray<DualSyncFieldSummary>;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly getField: (fieldKey: string) => DualSyncFieldSummary | null;
  readonly getFieldsByPrefix: (prefix: string) => ReadonlyArray<DualSyncFieldSummary>;
  readonly getFieldsBySection: (sectionKey: DriftSectionKey) => ReadonlyArray<DualSyncFieldSummary>;
}

export function useWorkspaceGbpDriftCheck({
  restaurantId,
  sectionKeys,
}: {
  readonly restaurantId: string | null;
  readonly sectionKeys?: ReadonlyArray<DriftSectionKey>;
}): WorkspaceGbpDriftCheck {
  const driftContext = useOptionalGbpDrift();
  const { stateQuery } = useOpsDualSync({ restaurantId: driftContext ? null : restaurantId });
  const allowedSections = useMemo(
    () => new Set(sectionKeys ?? REVIEWABLE_SECTION_KEYS),
    [sectionKeys],
  );
  const fields = useMemo(() => {
    if (driftContext) {
      return driftContext.fieldViews
        .filter(
          (view) =>
            REVIEWABLE_SECTION_KEYS.has(view.sectionKey as DriftSectionKey) &&
            allowedSections.has(view.sectionKey as DriftSectionKey) &&
            (view.savedNeedsReview || view.liveStatus === 'drifted'),
        )
        .map(
          (view): DualSyncFieldSummary & { sectionKey: DriftSectionKey } =>
            view.field as DualSyncFieldSummary & { sectionKey: DriftSectionKey },
        );
    }

    return (stateQuery.data?.fields ?? []).filter(
      (field): field is DualSyncFieldSummary & { sectionKey: DriftSectionKey } =>
        REVIEWABLE_SECTION_KEYS.has(field.sectionKey as DriftSectionKey) &&
        allowedSections.has(field.sectionKey as DriftSectionKey) &&
        fieldNeedsOperatorChoice(field),
    );
  }, [allowedSections, driftContext, stateQuery.data?.fields]);
  const fieldsByKey = useMemo(
    () => new Map(fields.map((field) => [field.fieldKey, field])),
    [fields],
  );

  return {
    fields,
    isLoading: driftContext?.isLoading ?? stateQuery.isLoading,
    isError: stateQuery.isError,
    getField: (fieldKey) => fieldsByKey.get(fieldKey) ?? null,
    getFieldsByPrefix: (prefix) => fields.filter((field) => field.fieldKey.startsWith(prefix)),
    getFieldsBySection: (sectionKey) => fields.filter((field) => field.sectionKey === sectionKey),
  };
}

export function GbpDriftBadge({
  fields,
  label = 'Google review',
  className,
}: {
  readonly fields: ReadonlyArray<DualSyncFieldSummary | null | undefined>;
  readonly label?: string;
  readonly className?: string;
}) {
  const drift = useOptionalGbpDrift();
  const visibleFields = fields.filter((field): field is DualSyncFieldSummary => Boolean(field));

  if (visibleFields.length === 0) {
    return null;
  }

  const countLabel =
    visibleFields.length === 1
      ? `${label}: ${visibleFields[0]?.label ?? '1 field'}`
      : `${label}: ${visibleFields.length} fields`;
  const tooltipLabel = visibleFields
    .slice(0, 4)
    .map((field) => field.label)
    .join(', ');
  const overflow = visibleFields.length > 4 ? `, +${visibleFields.length - 4} more` : '';
  const handleCompare = () => {
    if (!drift) return;
    if (visibleFields.length === 1) {
      openSettingsCompare(drift.openCompare, {
        preset: 'field',
        fieldKey: visibleFields[0].fieldKey,
        sectionKey: visibleFields[0].sectionKey as DualSyncSectionKey,
      });
      return;
    }
    drift.openCompare({
      sectionKeys: [
        ...new Set(visibleFields.map((field) => field.sectionKey as DualSyncSectionKey)),
      ],
      filter: 'drifted_only',
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-auto p-0 hover:bg-transparent"
      onClick={handleCompare}
      disabled={!drift}
      aria-label={countLabel}
      title={`${tooltipLabel}${overflow}`}
    >
      <Badge
        variant="outline"
        className={cn('gap-1.5 border-primary/40 bg-primary/5 text-primary', className)}
      >
        <AlertTriangle aria-hidden className="size-3" />
        {visibleFields.length === 1 ? 'Google review' : `${visibleFields.length} reviews`}
      </Badge>
    </Button>
  );
}

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
