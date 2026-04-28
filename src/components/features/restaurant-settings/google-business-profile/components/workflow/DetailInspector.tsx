'use client';

import { ArrowRight, Eye, LockKeyhole, ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import {
  classifyItem,
  formatSectionStatusLabel,
  formatValue,
  humanFieldLabel,
  publishTargetLabel,
  statusVariant,
  visibleItemWarnings,
} from './workflow-utils';

import type { SectionSummary } from './workflow-utils';
import type { GoogleBusinessProfileDraftItem } from '@/services/ops/restaurants';

type DetailInspectorProps = {
  summary: SectionSummary | null;
};

function DiffRow({ item }: { item: GoogleBusinessProfileDraftItem }) {
  const blocked = !item.canPublishToNabatable || item.status === 'unsupported';
  const warnings = visibleItemWarnings(item);
  const isChanged = classifyItem(item) === 'changed';

  return (
    <div
      className={cn(
        'group rounded-lg border p-4 transition-colors duration-150',
        blocked
          ? 'border-destructive/30 bg-destructive/5'
          : isChanged && item.selected
            ? 'border-primary/30 bg-primary/5'
            : isChanged
              ? 'border-border bg-muted/20'
              : 'border-border/40 bg-muted/20',
      )}
      data-testid="gbp-diff-row"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{humanFieldLabel(item)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Read-only field comparison</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
            {blocked ? (
              <Badge variant="destructive" className="gap-1 text-[10px]">
                <ShieldAlert className="size-2.5" aria-hidden /> Blocked
              </Badge>
            ) : item.selected ? (
              <Badge variant="default" className="text-[10px]">
                Selected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                Skipped
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {publishTargetLabel(item)}
            </Badge>
          </div>
        </div>

        {warnings.length > 0 ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            {warnings.join(' · ')}
          </p>
        ) : null}

        {isChanged ? (
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-md border border-border/60 bg-background p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                Current Nabatable
              </p>
              <p className="mt-2 break-words font-mono text-xs leading-relaxed text-muted-foreground">
                {formatValue(item.currentValue)}
              </p>
            </div>

            <div className="hidden items-center sm:flex">
              <ArrowRight className="size-4 text-muted-foreground/40" aria-hidden />
            </div>

            <div className="rounded-md border border-primary/25 bg-background p-3 ring-1 ring-primary/10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                Proposed GBP
              </p>
              <p className="mt-2 break-words font-mono text-xs font-medium leading-relaxed text-foreground">
                {formatValue(item.proposedValue)}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-border/50 bg-background px-3 py-2">
            <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
              {formatValue(item.currentValue)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function DetailInspector({ summary }: DetailInspectorProps) {
  if (!summary) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted/60">
            <Eye className="size-5 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Select a section</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Choose a section from the inbox to inspect changes
          </p>
        </div>
      </div>
    );
  }

  const { section, changedCount, selectedCount, blockedCount, unchangedCount } = summary;
  const changedItems = section.items.filter((item) => classifyItem(item) === 'changed');
  const unchangedItems = section.items.filter((item) => classifyItem(item) === 'unchanged');
  const blockedItems = section.items.filter((item) => classifyItem(item) === 'blocked');

  return (
    <div className="flex h-full flex-col" data-testid={`gbp-inspector-${section.sectionKey}`}>
      <div className="shrink-0 border-b border-border/60 bg-background px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-foreground">{section.label}</h3>
              <Badge variant="outline" className="gap-1 text-[10px]">
                <LockKeyhole className="size-3" aria-hidden />
                Read-only
              </Badge>
            </div>
            {section.summary ? (
              <p className="mt-1 text-xs text-muted-foreground">{section.summary}</p>
            ) : null}
          </div>
          <Badge variant={statusVariant(section.status)} className="shrink-0">
            {formatSectionStatusLabel(section.status)}
          </Badge>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
          {changedCount > 0 ? (
            <span className="rounded-md bg-muted px-2 py-1">
              <span className="font-semibold text-foreground">{selectedCount}</span>/{changedCount}{' '}
              selected
            </span>
          ) : null}
          {blockedCount > 0 ? (
            <span className="rounded-md bg-destructive/10 px-2 py-1 text-destructive">
              {blockedCount} blocked
            </span>
          ) : null}
          {unchangedCount > 0 ? (
            <span className="rounded-md bg-muted px-2 py-1">{unchangedCount} unchanged</span>
          ) : null}
        </div>
        {section.blockedReasons.length > 0 ? (
          <p className="mt-2 rounded-md border border-destructive/25 bg-destructive/5 px-2.5 py-2 text-[11px] text-destructive">
            {section.blockedReasons.join(' ')}
          </p>
        ) : null}
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-4">
          {changedItems.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                Changes ({changedItems.length})
              </p>
              {changedItems.map((item) => (
                <DiffRow key={item.fieldKey} item={item} />
              ))}
            </div>
          ) : null}

          {blockedItems.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="px-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-destructive/60">
                Blocked ({blockedItems.length})
              </p>
              {blockedItems.map((item) => (
                <DiffRow key={item.fieldKey} item={item} />
              ))}
            </div>
          ) : null}

          {unchangedItems.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <p className="px-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/50">
                Unchanged ({unchangedItems.length})
              </p>
              {unchangedItems.map((item) => (
                <DiffRow key={item.fieldKey} item={item} />
              ))}
            </div>
          ) : null}

          {section.items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground/60">
              No items in this section
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
