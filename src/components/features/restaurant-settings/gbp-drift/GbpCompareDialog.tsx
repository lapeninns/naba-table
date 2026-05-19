'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { GbpCompareFieldRow } from './GbpCompareFieldRow';
import { GBP_DRIFT_SECTION_LABELS, GBP_DRIFT_SECTION_ORDER } from './sectionLabels';
import { useGbpDrift } from './useGbpDrift';

import type { GbpDriftFieldView, GbpDriftFilter } from './types';
import type { DualSyncSectionKey } from '@/server/dual-sync';

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
    <Dialog open={compareDialogOpen} onOpenChange={(open) => (!open ? closeCompare() : undefined)}>
      <DialogContent className="max-h-[90svh] max-w-5xl gap-0 p-0">
        <DialogHeader className="border-b border-border/70 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <DialogTitle>Compare with Google</DialogTitle>
              <DialogDescription>
                Review Nabatable values beside the current Google Business Profile snapshot.
              </DialogDescription>
            </div>
            <ToggleGroup
              type="single"
              value={filter}
              onValueChange={(value) => {
                if (value === 'all' || value === 'drifted_only') setFilter(value);
              }}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="drifted_only" aria-label="Show drifted fields only">
                Drifted only
              </ToggleGroupItem>
              <ToggleGroupItem value="all" aria-label="Show all comparable fields">
                All fields
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90svh-9rem)] px-5 py-4">
          {openSections.length === 0 ? (
            <div className="rounded-md border border-border/70 bg-muted/30 p-6 text-sm text-muted-foreground">
              No Google drift is available for the current filter.
            </div>
          ) : (
            <Accordion type="multiple" defaultValue={openSections} className="flex flex-col gap-3">
              {openSections.map((sectionKey) => {
                const rows = visibleBySection.get(sectionKey) ?? [];
                const drifted = rows.filter((view) => view.effectiveStatus === 'drifted').length;
                return (
                  <AccordionItem
                    key={sectionKey}
                    value={sectionKey}
                    className="rounded-md border border-border/70 px-3"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <span className="flex min-w-0 items-center gap-2 text-left">
                        <span>{GBP_DRIFT_SECTION_LABELS[sectionKey]}</span>
                        <Badge variant={drifted > 0 ? 'default' : 'secondary'}>{drifted}</Badge>
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
        </ScrollArea>

        <DialogFooter className="border-t border-border/70 px-5 py-4">
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
              <Badge variant="secondary" className="ml-2">
                {applyableCount}
              </Badge>
            ) : null}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
