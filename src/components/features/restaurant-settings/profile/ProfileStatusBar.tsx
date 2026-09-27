'use client';

import { CircleCheck, Minus } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import {
  SETTINGS_CARD_CLASS,
  SETTINGS_INLINE_LINK_CLASS,
  SettingsCard,
  pluralise,
} from '../shared';

import type { ReadinessChecklistItem, ReadinessItemKey } from '../restaurantProfileModel';

type ReadinessProps = {
  /** Every readiness item, required first. */
  items: readonly ReadinessChecklistItem[];
  onFocusItem: (key: ReadinessItemKey) => void;
  className?: string;
};

const ADD_LINK_CLASS =
  'h-auto min-h-0 min-w-0 p-0 text-sm font-medium underline-offset-4 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11';

function readinessCounts(items: readonly ReadinessChecklistItem[]) {
  const done = items.filter((item) => item.complete).length;
  const missingRequired = items.filter((item) => item.required && !item.complete);
  return { done, total: items.length, missingRequired };
}

function requiredHeadline(missingRequiredCount: number) {
  return missingRequiredCount > 0
    ? `${pluralise(missingRequiredCount, 'detail')} needed before guests can book`
    : 'Everything guests need is filled in';
}

/** Segmented bar, one segment per readiness item. Text beside it carries the meaning. */
function ReadinessBar({ done, total, label }: { done: number; total: number; label?: string }) {
  return (
    <div
      className="flex gap-1"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn('h-1.5 flex-1 rounded-full', index < done ? 'bg-primary' : 'bg-muted')}
        />
      ))}
    </div>
  );
}

/**
 * Profile readiness column (from `xl`): what is filled in, required details first, and an
 * "Add" link beside each missing one that scrolls to and focuses its field.
 */
export function ProfileReadinessPanel({ items, onFocusItem, className }: ReadinessProps) {
  const { done, total, missingRequired } = readinessCounts(items);

  return (
    <SettingsCard
      region
      titleId="profile-readiness-title"
      title="Profile readiness"
      description={
        <span className="tabular-nums">
          {done} of {total} details filled in.
        </span>
      }
      className={className}
      contentClassName="flex flex-col gap-3"
    >
      <ReadinessBar done={done} total={total} label={`${done} of ${total} details filled in`} />
      <p className="text-sm font-medium text-foreground">
        {requiredHeadline(missingRequired.length)}
      </p>
      <ul className="flex flex-col divide-y divide-border/60" aria-label="Profile details">
        {items.map((item) => (
          <li key={item.key} className="flex min-h-9 items-center justify-between gap-2 py-1.5">
            <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
              {item.complete ? (
                <CircleCheck className="size-4 shrink-0 text-success-text" aria-hidden />
              ) : (
                <Minus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="min-w-0 truncate">{item.label}</span>
              <span className="sr-only">{item.complete ? ', filled in' : ', missing'}</span>
              {item.required ? null : (
                <span className="shrink-0 text-xs text-muted-foreground">Optional</span>
              )}
            </span>
            {item.complete ? null : (
              <Button
                type="button"
                variant="link"
                className={ADD_LINK_CLASS}
                aria-label={`Add ${item.label}`}
                onClick={() => onFocusItem(item.key)}
              >
                Add
              </Button>
            )}
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}

/** Readiness below `xl`: one line, the bar and "Add …" links for missing required details. */
export function ProfileReadinessSummary({ items, onFocusItem, className }: ReadinessProps) {
  const { done, total, missingRequired } = readinessCounts(items);

  return (
    <Card variant="compact" className={cn(SETTINGS_CARD_CLASS, className)}>
      <section aria-label="Profile readiness" className="flex flex-col gap-2 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-medium text-foreground">
            {requiredHeadline(missingRequired.length)}
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {done} of {total} filled in
          </p>
        </div>
        <ReadinessBar done={done} total={total} />
        {missingRequired.length > 0 ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Needed before guests can book">
            {missingRequired.map((item) => (
              <li key={item.key}>
                <Button
                  type="button"
                  variant="link"
                  className={ADD_LINK_CLASS}
                  onClick={() => onFocusItem(item.key)}
                >
                  Add {item.label.toLowerCase()}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </Card>
  );
}

type ProfileGoogleCardProps = {
  googleLinked: boolean;
  /** Plain-language Google status for this profile. */
  googleDetail: string;
  googleHref: string;
  gbpDriftCount?: number;
  onCompareWithGoogle?: () => void;
  className?: string;
};

/** Google Business Profile status: the optional external listing this profile feeds. */
export function ProfileGoogleCard({
  googleLinked,
  googleDetail,
  googleHref,
  gbpDriftCount = 0,
  onCompareWithGoogle,
  className,
}: ProfileGoogleCardProps) {
  const canCompare = googleLinked && gbpDriftCount > 0 && Boolean(onCompareWithGoogle);
  const action = canCompare ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full sm:w-fit"
      onClick={onCompareWithGoogle}
    >
      Compare with Google ({gbpDriftCount})
    </Button>
  ) : !googleLinked ? (
    <Link
      href={googleHref}
      className={cn(
        SETTINGS_INLINE_LINK_CLASS,
        'inline-flex w-fit items-center text-sm [@media(pointer:coarse)]:min-h-11',
      )}
    >
      Link Google Business Profile
    </Link>
  ) : null;

  return (
    <SettingsCard
      region
      titleId="profile-google-title"
      title="Google Business Profile"
      badges={
        <Badge variant={googleLinked ? 'status-confirmed' : 'outline'}>
          {googleLinked ? 'Linked' : 'Not linked'}
        </Badge>
      }
      description={googleDetail}
      className={className}
      contentClassName={action ? 'flex flex-col' : 'hidden'}
    >
      {action}
    </SettingsCard>
  );
}
