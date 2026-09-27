'use client';

import { AlertTriangle, CheckCircle2, Info, Loader2, MinusCircle } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { opsHref } from '@/lib/url/opsHref';

import { SETTINGS_INLINE_LINK_CLASS } from '../shared/compactSettingsClasses';
import { SettingsCard } from '../shared/SettingsCard';
import { SettingsDirtyBadge } from '../shared/SettingsDirtyBadge';

import type { DiscoveryGoogleStatus } from './discoveryPanelChromeDomain';
import type { DiscoverySectionState } from './discoveryPanelsFrameDomain';
import type { ReactNode } from 'react';

const GOOGLE_CONNECTION_HREF = opsHref(
  '/settings/restaurant/google-business-profile#gbp-connection',
);

const LINK_CLASS = SETTINGS_INLINE_LINK_CLASS;

/** The Google line at the top of a section. Always icon plus text, never colour alone. */
export function DiscoveryGoogleStatusLine({
  status,
  reviewHref,
}: {
  status: DiscoveryGoogleStatus;
  reviewHref: string;
}) {
  let icon: ReactNode;
  let body: ReactNode;
  switch (status.kind) {
    case 'prefilled':
      icon = <Info className="mt-0.5 size-3.5 shrink-0 text-foreground" aria-hidden />;
      body = (
        <>
          <span className="font-medium text-foreground">{status.text}</span> {status.detail}
        </>
      );
      break;
    case 'differs':
      icon = <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-foreground" aria-hidden />;
      body = (
        <>
          {status.text}{' '}
          <Link href={reviewHref} className={LINK_CLASS}>
            Review on Google page
          </Link>
        </>
      );
      break;
    case 'matches':
      icon = <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-foreground" aria-hidden />;
      body = status.text;
      break;
    case 'checking':
      icon = (
        <Loader2
          className="mt-0.5 size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
          aria-hidden
        />
      );
      body = status.text;
      break;
    case 'not-compared':
      icon = <MinusCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />;
      body = status.canLink ? (
        <>
          {status.text}{' '}
          <Link href={GOOGLE_CONNECTION_HREF} className={LINK_CLASS}>
            Link Google Business Profile
          </Link>
        </>
      ) : (
        status.text
      );
      break;
  }

  return (
    <div
      className="flex items-start gap-1.5 border-b border-border/60 bg-muted/30 px-4 py-2.5 text-xs leading-5 text-muted-foreground sm:px-5"
      data-discovery-google-status={status.kind}
    >
      {icon}
      <p className="min-w-0">{body}</p>
    </div>
  );
}

/** One Discovery section on the single scrolling page. */
export function DiscoverySectionCard({
  section,
  googleStatus,
  reviewHref,
  description,
  children,
}: {
  section: DiscoverySectionState;
  googleStatus: DiscoveryGoogleStatus;
  reviewHref: string;
  /** Replaces the plain section description when it needs a link. */
  description?: ReactNode;
  children: ReactNode;
}) {
  const badge = section.badge ? (
    section.badge.tone === 'issue' ? (
      <Badge variant="status-cancelled" className="gap-1">
        <AlertTriangle className="size-3" aria-hidden />
        {section.badge.label}
      </Badge>
    ) : (
      <SettingsDirtyBadge label={section.badge.label} />
    )
  ) : null;

  return (
    <SettingsCard
      id={section.anchorId}
      region
      titleId={`${section.anchorId}-heading`}
      title={section.title}
      description={description ?? section.description}
      badges={badge}
      subheader={<DiscoveryGoogleStatusLine status={googleStatus} reviewHref={reviewHref} />}
      contentClassName="flex min-w-0 flex-col gap-4 @container"
      data-discovery-section={section.family}
    >
      {children}
    </SettingsCard>
  );
}
