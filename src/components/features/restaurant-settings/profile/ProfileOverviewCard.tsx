'use client';

import { CheckCircle2, CircleDashed } from 'lucide-react';
import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { ReadinessItemKey, ReadinessSummaryItem } from '../restaurantProfileModel';

type ProfileOverviewCardProps = {
  restaurantName: string;
  logoUrl: string | null;
  bookingSlug: string | null;
  readinessScore: number;
  readinessStageLabel: string;
  completedCount: number;
  totalCount: number;
  missingRequired: readonly ReadinessSummaryItem[];
  missingOptional: readonly ReadinessSummaryItem[];
  googleStatusLabel: string;
  googleStatusDetail: string;
  googleDifferenceCount: number;
  googleHref: string;
  nextActionLabel: string | null;
  nextActionDescription: string;
  onJumpToBooking: () => void;
  onJumpToNextAction: (() => void) | null;
  onFocusItem: (key: ReadinessItemKey) => void;
};

const OPTIONAL_PREVIEW_LIMIT = 2;

function getInitials(value: string) {
  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'R';
}

export function ProfileOverviewCard({
  restaurantName,
  logoUrl,
  bookingSlug,
  readinessScore,
  readinessStageLabel,
  completedCount,
  totalCount,
  missingRequired,
  missingOptional,
  googleStatusLabel,
  googleStatusDetail,
  googleDifferenceCount,
  googleHref,
  nextActionLabel,
  nextActionDescription,
  onJumpToBooking,
  onJumpToNextAction,
  onFocusItem,
}: ProfileOverviewCardProps) {
  const hasBookingSlug = typeof bookingSlug === 'string' && bookingSlug.trim().length > 0;
  const optionalPreview = missingOptional.slice(0, OPTIONAL_PREVIEW_LIMIT);

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="gap-4 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <Avatar className="size-12 rounded-md border border-border/70">
              {logoUrl ? <AvatarImage src={logoUrl} alt={`${restaurantName} logo`} /> : null}
              <AvatarFallback className="rounded-md text-sm font-semibold">
                {getInitials(restaurantName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-2">
              <Badge variant="outline" className="w-fit">
                Profile command center
              </Badge>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="truncate text-xl leading-tight">{restaurantName}</CardTitle>
                <Badge variant="secondary">{readinessStageLabel}</Badge>
              </div>
              <CardDescription className="text-sm leading-6">
                Control guest-facing profile details and manager alerts from one workflow.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={missingRequired.length > 0 ? 'outline' : 'secondary'}>
              {missingRequired.length > 0
                ? `${missingRequired.length} required left`
                : 'Required complete'}
            </Badge>
            <Badge variant={googleDifferenceCount > 0 ? 'outline' : 'secondary'}>
              {googleStatusLabel}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 border-t border-border/60 px-4 py-4 sm:px-5 lg:grid-cols-3">
        <div className="rounded-md border border-border/60 bg-muted/20 p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">Booking URL</p>
          <p className="mt-2 text-sm font-medium text-foreground">
            {hasBookingSlug ? `/${bookingSlug}` : 'Missing booking URL'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onJumpToBooking}>
              {hasBookingSlug ? 'Review URL' : 'Add URL'}
            </Button>
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link href={googleHref}>Compare with Google</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-border/60 bg-muted/20 p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">Next action</p>
          <p className="mt-2 text-sm text-foreground">{nextActionDescription}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {nextActionLabel && onJumpToNextAction ? (
              <Button type="button" size="sm" onClick={onJumpToNextAction}>
                {nextActionLabel}
              </Button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{googleStatusDetail}</p>
        </div>

        <div className="rounded-md border border-border/60 bg-muted/20 p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">Readiness</p>
          <p className="mt-2 text-sm text-foreground">
            <span className="font-semibold">{readinessScore}%</span> ({completedCount}/{totalCount}{' '}
            items)
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {missingRequired.slice(0, 2).map((item) => (
              <Button
                key={item.key}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto justify-between text-left"
                onClick={() => onFocusItem(item.key)}
              >
                <span className="min-w-0 flex-1 text-wrap">{item.label}</span>
                <CircleDashed className="size-3.5 shrink-0 text-destructive" aria-hidden />
              </Button>
            ))}
            {missingRequired.length === 0 && optionalPreview.length > 0
              ? optionalPreview.map((item) => (
                  <Button
                    key={item.key}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto justify-between text-left"
                    onClick={() => onFocusItem(item.key)}
                  >
                    <span className="min-w-0 flex-1 text-wrap">{item.label}</span>
                    <span className="text-xs text-primary">Add</span>
                  </Button>
                ))
              : null}
            {missingRequired.length === 0 && optionalPreview.length === 0 ? (
              <div className="inline-flex items-center gap-2 rounded-md bg-background px-2 py-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-primary" aria-hidden />
                Profile is fully complete.
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
