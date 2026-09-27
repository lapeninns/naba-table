'use client';

import { useState, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  SETTINGS_TABS_LIST_CLASS,
  SETTINGS_TABS_TRIGGER_CLASS,
} from '../../shared/compactSettingsClasses';
import { SettingsOverflowFrame } from '../../shared/SettingsOverflowFrame';

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
        {/* On a narrow phone the two tabs and their badges can outgrow the row: they scroll with
            an edge fade, and the active tab stays in view. */}
        <SettingsOverflowFrame revealKey={tab}>
          <TabsList aria-label="Google Business Profile" className={SETTINGS_TABS_LIST_CLASS}>
            <TabsTrigger value="review" className={SETTINGS_TABS_TRIGGER_CLASS}>
              Review differences
              {differenceCount !== null ? (
                <Badge variant="secondary" className="px-2 py-0 tabular-nums">
                  {differenceCount}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="operations" className={SETTINGS_TABS_TRIGGER_CLASS}>
              Operations
              {operationsNeedAttention ? (
                <Badge variant="status-cancelled" className="px-2 py-0">
                  Needs attention
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </SettingsOverflowFrame>
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
