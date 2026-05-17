'use client';

import { CheckCircle2, CircleDashed } from 'lucide-react';
import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
  onCompareWithGoogle?: () => void;
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
  onCompareWithGoogle,
}: ProfileOverviewCardProps) {
  const hasBookingSlug = typeof bookingSlug === 'string' && bookingSlug.trim().length > 0;
  const optionalPreview = missingOptional.slice(0, OPTIONAL_PREVIEW_LIMIT);

  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="grid gap-3 px-4 py-3 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-10 rounded-md border border-border/70">
            {logoUrl ? <AvatarImage src={logoUrl} alt={`${restaurantName} logo`} /> : null}
            <AvatarFallback className="rounded-md text-xs font-semibold">
              {getInitials(restaurantName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="truncate text-base font-semibold leading-6 text-foreground">
                {restaurantName}
              </p>
              <Badge variant="secondary">{readinessStageLabel}</Badge>
              <Badge variant={missingRequired.length > 0 ? 'outline' : 'secondary'}>
                {missingRequired.length > 0
                  ? `${missingRequired.length} required left`
                  : 'Required complete'}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {hasBookingSlug ? `/${bookingSlug}` : 'Missing booking URL'} · {completedCount}/
              {totalCount} items complete · {googleStatusDetail}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={googleDifferenceCount > 0 ? 'outline' : 'secondary'}>
              {googleStatusLabel}
            </Badge>
            <Badge variant="outline">{readinessScore}% ready</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onJumpToBooking}>
              {hasBookingSlug ? 'Review URL' : 'Add URL'}
            </Button>
            {nextActionLabel && onJumpToNextAction ? (
              <Button type="button" size="sm" onClick={onJumpToNextAction}>
                {nextActionLabel}
              </Button>
            ) : null}
            {onCompareWithGoogle ? (
              <Button type="button" variant="ghost" size="sm" onClick={onCompareWithGoogle}>
                Compare with Google
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href={googleHref}>Compare with Google</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:col-span-2">
          <p className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">
            {nextActionDescription}
          </p>
          {missingRequired.length > 0
            ? missingRequired.slice(0, 2).map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto text-left"
                  onClick={() => onFocusItem(item.key)}
                >
                  <span className="min-w-0 text-wrap">{item.label}</span>
                  <CircleDashed className="size-3.5 shrink-0 text-destructive" aria-hidden />
                </Button>
              ))
            : null}
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
      </CardContent>
    </Card>
  );
}
