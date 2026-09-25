'use client';

import { AlertTriangle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

import { pluralise } from '../shared';

import type { ProfileSectionDefinition } from './profileSections';
import type { ReactNode } from 'react';

type ProfileSectionPaneProps = {
  section: ProfileSectionDefinition;
  isDirty: boolean;
  /** Issues currently shown on the page for this section. */
  issueCount: number;
  children: ReactNode;
};

/** Edited or issues marker for a section, always text with an icon for issues. */
function ProfileSectionStatusBadge({
  isDirty,
  issueCount,
}: {
  isDirty: boolean;
  issueCount: number;
}) {
  if (issueCount > 0) {
    return (
      <Badge variant="status-cancelled" className="gap-1">
        <AlertTriangle className="size-3" aria-hidden />
        {pluralise(issueCount, 'issue')}
      </Badge>
    );
  }
  if (isDirty) {
    return <Badge variant="status-pending">Edited</Badge>;
  }
  return null;
}

/** One section of the Restaurant profile page: a card with its audience and status. */
export function ProfileSectionPane({
  section,
  isDirty,
  issueCount,
  children,
}: ProfileSectionPaneProps) {
  const titleId = `profile-section-${section.id}-title`;

  return (
    <Card
      variant="compact"
      className="min-w-0 scroll-mt-28 border-border/70"
      id={section.anchorId}
      role="region"
      aria-labelledby={titleId}
    >
      <header className="flex flex-col gap-1.5 border-b border-border/60 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id={titleId} className="text-base font-semibold leading-6 text-foreground">
            {section.name}
          </h2>
          <Badge variant="outline">{section.audience}</Badge>
          <ProfileSectionStatusBadge isDirty={isDirty} issueCount={issueCount} />
        </div>
        <p className="max-w-prose text-sm leading-5 text-muted-foreground">{section.description}</p>
      </header>
      <div className="@container px-4 py-5 sm:px-5">{children}</div>
    </Card>
  );
}
