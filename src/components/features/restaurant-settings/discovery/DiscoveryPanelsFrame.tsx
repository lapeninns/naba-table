'use client';

import Link from 'next/link';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';

import { Accordion } from '@/components/ui/accordion';
import { Text } from '@/components/ui/typography';
import { opsHref } from '@/lib/url/opsHref';

import { DISCOVERY_SECTION_ORDER, type FamilyKey } from '../businessContextModel';
import { DiscoveryAccordionSection } from './DiscoveryAccordionSection';
import { DiscoveryEmbeddedSectionCard } from './DiscoveryEmbeddedSectionCard';
import {
  buildDiscoverySectionFrameState,
  resolveDiscoveryFamily,
} from './discoveryPanelsFrameDomain';

import type { RestaurantBusinessContextEditor } from '../useRestaurantBusinessContextEditor';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

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
  const buildSection = (family: FamilyKey) =>
    buildDiscoverySectionFrameState({ family, editor, gbpDriftFieldsByFamily });

  if (embedded) {
    return (
      <div className="flex flex-col gap-4">
        {DISCOVERY_SECTION_ORDER.map((family) => {
          const child = findChild(family);

          if (!child) {
            return null;
          }

          return (
            <DiscoveryEmbeddedSectionCard key={family} section={buildSection(family)}>
              {child}
            </DiscoveryEmbeddedSectionCard>
          );
        })}
        <Text variant="caption" className="px-1">
          Google suggestions can pre-fill empty sections; compare source data in the{' '}
          <Link
            href={opsHref('/settings/restaurant/google-business-profile')}
            className="underline"
          >
            GBP workspace
          </Link>
          .
        </Text>
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
          const family = resolveDiscoveryFamily(value);
          if (family) {
            onActiveTabChange(family);
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
            <DiscoveryAccordionSection key={family} section={buildSection(family)}>
              {child}
            </DiscoveryAccordionSection>
          );
        })}
      </Accordion>
      <Text variant="caption" className="px-1">
        See “About Google suggestions” above for import details.{' '}
        <Link href={opsHref('/settings/restaurant/google-business-profile')} className="underline">
          GBP workspace
        </Link>
      </Text>
    </div>
  );
}
