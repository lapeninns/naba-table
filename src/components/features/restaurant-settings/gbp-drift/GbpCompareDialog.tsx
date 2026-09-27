'use client';

import { useEffect, useMemo, useState } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { GbpCompareFieldRow } from './GbpCompareFieldRow';
import { GBP_DRIFT_SECTION_LABELS, GBP_DRIFT_SECTION_ORDER } from './sectionLabels';
import { useGbpDrift } from './useGbpDrift';
import { SettingsDialog } from '../shared/SettingsDialog';
import { SettingsSegmentedControl } from '../shared/SettingsSegmentedControl';

import type { GbpDriftFieldView, GbpDriftFilter } from './types';
import type { DualSyncSectionKey } from '@/server/dual-sync';

const FILTER_OPTIONS = [
  { value: 'drifted_only', label: 'Drifted only', ariaLabel: 'Show drifted fields only' },
  { value: 'all', label: 'All fields', ariaLabel: 'Show all comparable fields' },
] as const satisfies ReadonlyArray<{ value: GbpDriftFilter; label: string; ariaLabel: string }>;

function isVisibleForFilter(view: GbpDriftFieldView, filter: GbpDriftFilter) {
  if (filter === 'all') return true;
  return view.effectiveStatus === 'drifted';
}

export function GbpCompareDialog() {
  const {
    compareDialogOpen,
    closeCompare,
    compareOptions,
    fieldViews,
    applyAllFromGoogle,
    isApplying,
  } = useGbpDrift();
  const [filter, setFilter] = useState<GbpDriftFilter>(compareOptions.filter ?? 'drifted_only');

  useEffect(() => {
    if (compareDialogOpen) {
      setFilter(compareOptions.filter ?? 'drifted_only');
    }
  }, [compareDialogOpen, compareOptions.filter]);

  const sectionFilter = useMemo(() => {
    if (compareOptions.sectionKeys) return new Set(compareOptions.sectionKeys);
    if (compareOptions.sectionKey) return new Set<DualSyncSectionKey>([compareOptions.sectionKey]);
    return null;
  }, [compareOptions.sectionKey, compareOptions.sectionKeys]);

  const visibleBySection = useMemo(() => {
    const grouped = new Map<DualSyncSectionKey, GbpDriftFieldView[]>();
    for (const view of fieldViews) {
      if (sectionFilter && !sectionFilter.has(view.sectionKey)) continue;
      if (compareOptions.fieldKey && compareOptions.fieldKey !== view.fieldKey) continue;
      if (!isVisibleForFilter(view, filter)) continue;
      const arr = grouped.get(view.sectionKey) ?? [];
      arr.push(view);
      grouped.set(view.sectionKey, arr);
    }
    return grouped;
  }, [compareOptions.fieldKey, fieldViews, filter, sectionFilter]);

  const openSections = useMemo(
    () => GBP_DRIFT_SECTION_ORDER.filter((sectionKey) => visibleBySection.has(sectionKey)),
    [visibleBySection],
  );
  const applyableCount = openSections.reduce((total, sectionKey) => {
    const rows = visibleBySection.get(sectionKey) ?? [];
    return (
      total + rows.filter((view) => view.canImport && view.effectiveStatus === 'drifted').length
    );
  }, 0);

  useEffect(() => {
    if (!compareDialogOpen || !compareOptions.fieldKey) return;
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-gbp-field-key="${CSS.escape(compareOptions.fieldKey ?? '')}"]`)
        ?.scrollIntoView({ block: 'center' });
    });
  }, [compareDialogOpen, compareOptions.fieldKey, filter]);

  return (
    <SettingsDialog
      open={compareDialogOpen}
      onOpenChange={(open) => (!open ? closeCompare() : undefined)}
      size="xl"
      title="Compare with Google"
      description="Review Nabatable values beside the current Google Business Profile snapshot."
      footer={
        <>
          <Button type="button" variant="outline" onClick={closeCompare}>
            Close
          </Button>
          <Button
            type="button"
            disabled={applyableCount === 0 || isApplying}
            onClick={() => void applyAllFromGoogle({ ...compareOptions, filter })}
          >
            Apply all Google fields
            {applyableCount > 0 ? (
              <Badge variant="secondary" className="ml-2 tabular-nums">
                {applyableCount}
              </Badge>
            ) : null}
          </Button>
        </>
      }
    >
      <SettingsSegmentedControl<GbpDriftFilter>
        value={filter}
        onValueChange={setFilter}
        options={FILTER_OPTIONS}
        ariaLabel="Fields to show"
        size="sm"
        className="self-start"
      />
      {openSections.length === 0 ? (
        <OpsEmptyState
          size="compact"
          title="No drift to show"
          description="No Google drift is available for the current filter."
        />
      ) : (
        <Accordion type="multiple" defaultValue={openSections} className="flex flex-col gap-3">
          {openSections.map((sectionKey) => {
            const rows = visibleBySection.get(sectionKey) ?? [];
            const drifted = rows.filter((view) => view.effectiveStatus === 'drifted').length;
            return (
              <AccordionItem
                key={sectionKey}
                value={sectionKey}
                className="rounded-lg border border-border/60 px-3"
              >
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex min-w-0 items-center gap-2 text-left">
                    <span>{GBP_DRIFT_SECTION_LABELS[sectionKey]}</span>
                    <Badge
                      variant={drifted > 0 ? 'status-pending' : 'secondary'}
                      className="tabular-nums"
                    >
                      {drifted}
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-3 pb-3">
                    {rows.map((view) => (
                      <GbpCompareFieldRow key={view.fieldKey} view={view} />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </SettingsDialog>
  );
}
