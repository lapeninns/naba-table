'use client';

import { AlertTriangle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import { SettingsCard, SettingsDirtyBadge, pluralise } from '../shared';

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
    return <SettingsDirtyBadge />;
  }
  return null;
}

/** One section of the Restaurant profile page: a settings card with its audience and status. */
export function ProfileSectionPane({
  section,
  isDirty,
  issueCount,
  children,
}: ProfileSectionPaneProps) {
  return (
    <SettingsCard
      id={section.anchorId}
      region
      titleId={`profile-section-${section.id}-title`}
      title={section.name}
      description={section.description}
      badges={
        <>
          <Badge variant="outline">{section.audience}</Badge>
          <ProfileSectionStatusBadge isDirty={isDirty} issueCount={issueCount} />
        </>
      }
      contentClassName="@container"
    >
      {children}
    </SettingsCard>
  );
}
