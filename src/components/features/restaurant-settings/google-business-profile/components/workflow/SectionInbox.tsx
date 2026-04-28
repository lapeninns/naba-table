'use client';

import { AlertCircle, CheckCircle2, ChevronDown, Clock, FileWarning, Inbox } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import { formatSectionStatusLabel, statusVariant } from './workflow-utils';

import type { SectionSummary } from './workflow-utils';
import type { GoogleBusinessProfileDraftSection } from '@/services/ops/restaurants';

type SectionInboxProps = {
  summaries: SectionSummary[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  totalSelected: number;
  totalChanged: number;
};

function sectionIcon(section: GoogleBusinessProfileDraftSection, summary: SectionSummary) {
  const cls = 'size-3.5 shrink-0';
  if (section.status === 'blocked' || section.status === 'stale') {
    return <AlertCircle className={cn(cls, 'text-destructive')} />;
  }
  if (summary.blockedCount > 0) {
    return <FileWarning className={cn(cls, 'text-amber-500')} />;
  }
  if (summary.changedCount > 0 && summary.selectedCount === summary.changedCount) {
    return <CheckCircle2 className={cn(cls, 'text-emerald-500')} />;
  }
  if (summary.changedCount > 0) {
    return <Clock className={cn(cls, 'text-blue-500')} />;
  }
  return <Inbox className={cn(cls, 'text-muted-foreground/50')} />;
}

export function SectionInbox({
  summaries,
  selectedKey,
  onSelect,
  totalSelected,
  totalChanged,
}: SectionInboxProps) {
  const activeSections = summaries.filter((s) => s.isActive);
  const quietSections = summaries.filter((s) => !s.isActive);
  const [quietOpen, setQuietOpen] = useState(false);

  return (
    <div className="flex h-full flex-col" data-testid="gbp-section-inbox">
      <div className="shrink-0 border-b border-border/60 bg-muted/20 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Review queue
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Read-only sections with proposed GBP changes.
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0 tabular-nums">
            {totalSelected}/{totalChanged}
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-2">
          {activeSections.length > 0 ? (
            <div className="flex flex-col gap-1">
              {activeSections.map(({ section, changedCount, selectedCount, blockedCount }, _i) => {
                const summary = summaries.find((s) => s.section.sectionKey === section.sectionKey)!;
                const isSelected = selectedKey === section.sectionKey;
                return (
                  <button
                    key={section.sectionKey}
                    type="button"
                    onClick={() => onSelect(section.sectionKey)}
                    data-testid={`gbp-inbox-${section.sectionKey}`}
                    className={cn(
                      'group flex w-full items-start gap-3 rounded-md border px-3 py-3 text-left outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      isSelected
                        ? 'border-primary/30 bg-primary/5 shadow-sm'
                        : 'border-transparent bg-background hover:border-border hover:bg-muted/40',
                    )}
                  >
                    <span className="mt-0.5 rounded-md bg-muted p-1">
                      {sectionIcon(section, summary)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'truncate text-[13px] font-medium leading-tight',
                          isSelected ? 'text-foreground' : 'text-foreground/80',
                        )}
                      >
                        {section.label}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {changedCount > 0 ? (
                          <span className="text-[10px] tabular-nums text-muted-foreground">
                            {selectedCount}/{changedCount} selected
                          </span>
                        ) : null}
                        {blockedCount > 0 ? (
                          <Badge variant="destructive" className="h-4 px-1 text-[9px]">
                            {blockedCount} blocked
                          </Badge>
                        ) : null}
                        <Badge
                          variant={statusVariant(section.status)}
                          className="h-4 px-1 text-[9px]"
                        >
                          {formatSectionStatusLabel(section.status)}
                        </Badge>
                      </div>
                    </div>
                    {changedCount > 0 && selectedCount === changedCount ? (
                      <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
                    ) : changedCount > 0 && selectedCount > 0 ? (
                      <span className="mt-2 size-2 shrink-0 rounded-full bg-muted-foreground/50" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {quietSections.length > 0 ? (
            <Collapsible open={quietOpen} onOpenChange={setQuietOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="group flex w-full items-center gap-3 rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-3 text-left outline-none transition-all duration-150 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <CheckCircle2 className="size-3.5 shrink-0 text-primary/70" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-muted-foreground">
                      No changes in {quietSections.length} section
                      {quietSections.length === 1 ? '' : 's'}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground/60">
                      {quietSections.map((s) => s.section.label).join(', ')}
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      'size-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-200',
                      quietOpen && 'rotate-180',
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 flex flex-col gap-1 pl-2">
                {quietSections.map(({ section }) => {
                  const summary = summaries.find(
                    (s) => s.section.sectionKey === section.sectionKey,
                  )!;
                  const isSelected = selectedKey === section.sectionKey;
                  return (
                    <button
                      key={section.sectionKey}
                      type="button"
                      onClick={() => onSelect(section.sectionKey)}
                      className={cn(
                        'group flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        isSelected ? 'bg-muted/80 ring-1 ring-border/40' : 'hover:bg-muted/40',
                      )}
                    >
                      <span className="mt-0.5">{sectionIcon(section, summary)}</span>
                      <p className="truncate text-[12px] text-muted-foreground">{section.label}</p>
                    </button>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
