'use client';

import { AlertTriangle, CheckCircle2, Info, Loader2, MinusCircle } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { opsHref } from '@/lib/url/opsHref';

import type { DiscoveryGoogleStatus } from './discoveryPanelChromeDomain';
import type { DiscoverySectionState } from './discoveryPanelsFrameDomain';
import type { ReactNode } from 'react';

const GOOGLE_CONNECTION_HREF = opsHref(
  '/settings/restaurant/google-business-profile#gbp-connection',
);

const LINK_CLASS = 'font-medium text-foreground underline underline-offset-2';

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
  const headingId = `${section.anchorId}-heading`;

  return (
    <section
      id={section.anchorId}
      aria-labelledby={headingId}
      className="min-w-0 scroll-mt-28 overflow-hidden rounded-xl border border-border bg-card text-card-foreground"
      data-discovery-section={section.family}
    >
      <header className="flex flex-col gap-1 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:px-5">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={headingId} className="text-base font-semibold leading-6 text-foreground">
            {section.title}
          </h2>
          <p className="max-w-[65ch] text-sm leading-5 text-muted-foreground">
            {description ?? section.description}
          </p>
        </div>
        {section.badge ? (
          <Badge
            variant={section.badge.tone === 'issue' ? 'status-cancelled' : 'status-pending'}
            className="w-fit shrink-0 gap-1"
          >
            {section.badge.tone === 'issue' ? (
              <AlertTriangle className="size-3" aria-hidden />
            ) : null}
            {section.badge.label}
          </Badge>
        ) : null}
      </header>
      <DiscoveryGoogleStatusLine status={googleStatus} reviewHref={reviewHref} />
      <div className="flex min-w-0 flex-col gap-4 px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}
