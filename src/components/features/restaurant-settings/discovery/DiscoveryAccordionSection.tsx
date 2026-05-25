import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

import { GbpDriftBadge } from '../gbpDriftBadges';

import type { DiscoverySectionFrameState } from './discoveryPanelsFrameDomain';
import type { ReactNode } from 'react';

export function DiscoveryAccordionSection({
  section,
  children,
}: {
  section: DiscoverySectionFrameState;
  children: ReactNode;
}) {
  return (
    <AccordionItem key={section.family} value={section.family}>
      <AccordionTrigger aria-label={section.triggerLabel} className="px-4 py-4 hover:no-underline">
        <span className="flex min-w-0 flex-col gap-2">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-foreground">{section.title}</span>
            <GbpDriftBadge fields={section.driftFields} />
            {section.dirty ? <Badge variant="secondary">Unsaved changes</Badge> : null}
            {section.hasError ? <Badge variant="destructive">Needs attention</Badge> : null}
          </span>
          <span className="text-sm font-normal leading-5 text-muted-foreground">
            {section.description}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  );
}
