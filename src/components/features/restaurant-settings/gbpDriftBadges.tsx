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

const NO_DRIFT_FIELDS: ReadonlyArray<DualSyncFieldSummary> = [];

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
  const isLoading = driftContext?.isLoading ?? stateQuery.isLoading;
  const isError = stateQuery.isError;

  // One stable object per set of drift fields, so callers can list it in memo and effect deps.
  return useMemo(() => {
    const fieldsByKey = new Map(fields.map((field) => [field.fieldKey, field]));
    const fieldsBySection = new Map<DriftSectionKey, DualSyncFieldSummary[]>();
    for (const field of fields) {
      const sectionFields = fieldsBySection.get(field.sectionKey);
      if (sectionFields) sectionFields.push(field);
      else fieldsBySection.set(field.sectionKey, [field]);
    }

    return {
      fields,
      isLoading,
      isError,
      getField: (fieldKey) => fieldsByKey.get(fieldKey) ?? null,
      getFieldsByPrefix: (prefix) => fields.filter((field) => field.fieldKey.startsWith(prefix)),
      // Sections without drift share one empty array.
      getFieldsBySection: (sectionKey) => fieldsBySection.get(sectionKey) ?? NO_DRIFT_FIELDS,
    };
  }, [fields, isError, isLoading]);
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
