'use client';

import { useState, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type GbpTab = 'review' | 'operations';

export type GbpLinkedLayoutProps = {
  readonly overview: ReactNode;
  readonly alerts: ReactNode;
  /** Differences still to review, shown on the tab; null while unknown. */
  readonly differenceCount: number | null;
  readonly review: ReactNode;
  readonly operations: ReactNode;
  readonly operationsNeedAttention: boolean;
  /** Publish, import and outcome dialogs. */
  readonly dialogs?: ReactNode;
};

const TRIGGER =
  'relative min-h-[42px] gap-2 rounded-none px-3 font-medium text-muted-foreground shadow-none after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:bg-primary';

/** A linked listing: overview, what currently limits the page, then Review and Operations tabs. */
export function GbpLinkedLayout({
  overview,
  alerts,
  differenceCount,
  review,
  operations,
  operationsNeedAttention,
  dialogs,
}: GbpLinkedLayoutProps) {
  const [tab, setTab] = useState<GbpTab>('review');

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {overview}
      {alerts}
      <Tabs
        id="gbp-sync-review"
        value={tab}
        onValueChange={(next) => setTab(next as GbpTab)}
        className="flex min-w-0 scroll-mt-24 flex-col gap-4"
      >
        <TabsList
          aria-label="Google Business Profile"
          className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-0"
        >
          <TabsTrigger value="review" className={TRIGGER}>
            Review differences
            {differenceCount !== null ? (
              <Badge variant="secondary" className="rounded-full px-2 py-0 tabular-nums">
                {differenceCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="operations" className={TRIGGER}>
            Operations
            {operationsNeedAttention ? (
              <Badge variant="destructive" className="rounded-full px-2 py-0">
                Needs attention
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="review" className="mt-0 min-w-0">
          {review}
        </TabsContent>
        <TabsContent value="operations" className="mt-0 min-w-0">
          {operations}
        </TabsContent>
      </Tabs>
      {dialogs}
    </div>
  );
}
