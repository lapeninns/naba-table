'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { ProfileSectionDefinition } from './profileSections';
import type { ReactNode } from 'react';

type ProfileSectionPaneProps = {
  section: ProfileSectionDefinition;
  isActive: boolean;
  isDirty: boolean;
  isMissingRequired: boolean;
  children: ReactNode;
};

export function ProfileSectionPane({
  section,
  isActive,
  isDirty,
  isMissingRequired,
  children,
}: ProfileSectionPaneProps) {
  return (
    <Card
      id={section.anchorId}
      variant="compact"
      hidden={!isActive}
      className={cn('border-border/70 shadow-none', !isActive && 'hidden')}
    >
      <CardHeader className="gap-2 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{section.paneTitle}</CardTitle>
              <Badge variant="outline">{section.audience}</Badge>
              {isDirty ? <Badge>Unsaved</Badge> : null}
              {!isDirty && isMissingRequired ? (
                <Badge variant="outline" className="border-dashed">
                  Required
                </Badge>
              ) : null}
            </div>
            <CardDescription className="mt-1">{section.paneDescription}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-5 sm:px-5">{children}</CardContent>
    </Card>
  );
}
