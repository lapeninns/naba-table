import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { GbpDriftBadge } from '../gbpDriftBadges';

import type { DiscoverySectionFrameState } from './discoveryPanelsFrameDomain';
import type { ReactNode } from 'react';

export function DiscoveryEmbeddedSectionCard({
  section,
  children,
}: {
  section: DiscoverySectionFrameState;
  children: ReactNode;
}) {
  return (
    <Card
      key={section.family}
      id={`profile-discovery-${section.family}`}
      variant="compact"
      className="scroll-mt-28"
    >
      <CardHeader className="gap-2 border-b border-border/60 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">
            <h3>{section.title}</h3>
          </CardTitle>
          <GbpDriftBadge fields={section.driftFields} />
          {section.dirty ? <Badge variant="secondary">Unsaved changes</Badge> : null}
          {section.hasError ? <Badge variant="destructive">Needs attention</Badge> : null}
        </div>
        <CardDescription className="text-sm leading-5">{section.description}</CardDescription>
      </CardHeader>
      <CardContent className="px-4 py-4">{children}</CardContent>
    </Card>
  );
}
