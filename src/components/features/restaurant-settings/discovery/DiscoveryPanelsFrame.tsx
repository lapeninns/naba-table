'use client';

import Link from 'next/link';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { opsHref } from '@/lib/url/opsHref';

import {
  DISCOVERY_SECTION_DESCRIPTIONS,
  DISCOVERY_SECTION_ORDER,
  TAB_LABELS,
  type FamilyKey,
} from '../businessContextModel';
import { GbpDriftBadge } from '../gbpDriftBadges';

import type { RestaurantBusinessContextEditor } from '../useRestaurantBusinessContextEditor';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

function isDiscoveryFamily(value: string): value is FamilyKey {
  return DISCOVERY_SECTION_ORDER.includes(value as FamilyKey);
}

function formatDiscoveryTriggerLabel(family: FamilyKey, editor: RestaurantBusinessContextEditor) {
  return [
    TAB_LABELS[family],
    editor.dirty[family] ? 'unsaved changes' : null,
    editor.errors[family] ? 'needs attention' : null,
  ]
    .filter(Boolean)
    .join(', ');
}

export function DiscoveryPanelsFrame({
  embedded,
  activeTab,
  onActiveTabChange,
  editor,
  gbpDriftFieldsByFamily,
  children,
}: {
  embedded: boolean;
  activeTab: FamilyKey | '';
  onActiveTabChange: (value: FamilyKey | '') => void;
  editor: RestaurantBusinessContextEditor;
  gbpDriftFieldsByFamily?: Readonly<Record<FamilyKey, ReadonlyArray<DualSyncFieldSummary>>>;
  children: ReactNode;
}) {
  const childArray = Children.toArray(children);
  const findChild = (family: FamilyKey) =>
    childArray.find(
      (child): child is ReactElement<{ family: FamilyKey }> =>
        isValidElement<{ family: FamilyKey }>(child) && child.props.family === family,
    );

  if (embedded) {
    return (
      <div className="flex flex-col gap-4">
        {DISCOVERY_SECTION_ORDER.map((family) => {
          const child = findChild(family);

          if (!child) {
            return null;
          }

          return (
            <Card
              key={family}
              id={`profile-discovery-${family}`}
              variant="compact"
              className="scroll-mt-28"
            >
              <CardHeader className="gap-2 border-b border-border/60 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">
                    <h3>{TAB_LABELS[family]}</h3>
                  </CardTitle>
                  <GbpDriftBadge fields={gbpDriftFieldsByFamily?.[family] ?? []} />
                  {editor.dirty[family] ? <Badge variant="secondary">Unsaved changes</Badge> : null}
                  {editor.errors[family] ? (
                    <Badge variant="destructive">Needs attention</Badge>
                  ) : null}
                </div>
                <CardDescription className="text-sm leading-5">
                  {DISCOVERY_SECTION_DESCRIPTIONS[family]}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 py-4">{child}</CardContent>
            </Card>
          );
        })}
        <p className="px-1 text-xs text-muted-foreground">
          Google suggestions can pre-fill empty sections; compare source data in the{' '}
          <Link
            href={opsHref('/settings/restaurant/google-business-profile')}
            className="underline"
          >
            GBP workspace
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Accordion
        type="single"
        collapsible
        value={activeTab}
        onValueChange={(value) => {
          if (!value) {
            onActiveTabChange('');
            return;
          }
          if (isDiscoveryFamily(value)) {
            onActiveTabChange(value);
          }
        }}
        className="rounded-lg border border-border/60"
      >
        {DISCOVERY_SECTION_ORDER.map((family) => {
          const child = findChild(family);

          if (!child) {
            return null;
          }

          return (
            <AccordionItem key={family} value={family}>
              <AccordionTrigger
                aria-label={formatDiscoveryTriggerLabel(family, editor)}
                className="px-4 py-4 hover:no-underline"
              >
                <span className="flex min-w-0 flex-col gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-foreground">
                      {TAB_LABELS[family]}
                    </span>
                    <GbpDriftBadge fields={gbpDriftFieldsByFamily?.[family] ?? []} />
                    {editor.dirty[family] ? (
                      <Badge variant="secondary">Unsaved changes</Badge>
                    ) : null}
                    {editor.errors[family] ? (
                      <Badge variant="destructive">Needs attention</Badge>
                    ) : null}
                  </span>
                  <span className="text-sm font-normal leading-5 text-muted-foreground">
                    {DISCOVERY_SECTION_DESCRIPTIONS[family]}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>{child}</AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
      <p className="px-1 text-xs text-muted-foreground">
        See “About Google suggestions” above for import details.{' '}
        <Link href={opsHref('/settings/restaurant/google-business-profile')} className="underline">
          GBP workspace
        </Link>
      </p>
    </div>
  );
}
