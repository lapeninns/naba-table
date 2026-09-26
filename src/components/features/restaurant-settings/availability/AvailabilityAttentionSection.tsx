'use client';

import { AlertTriangle, Info } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import { TOUCH_TARGET_CLASS } from './AvailabilityFields';

import type {
  AvailabilityAttentionAction,
  AvailabilityAttentionItem,
} from './availabilityAttention';

const GOOGLE_REVIEW_HREF = opsHref('/settings/restaurant/google-business-profile#gbp-sync-review');

const TONE_LABEL: Record<AvailabilityAttentionItem['tone'], string> = {
  issue: 'Blocking: ',
  warning: 'Warning: ',
  info: 'Note: ',
};

type AvailabilityAttentionSectionProps = {
  items: AvailabilityAttentionItem[];
  onAction: (action: AvailabilityAttentionAction) => void;
};

/** Hidden when empty. Checks run on the draft, including unsaved changes. */
export function AvailabilityAttentionSection({
  items,
  onAction,
}: AvailabilityAttentionSectionProps) {
  if (items.length === 0) {
    return null;
  }
  return (
    <Card
      aria-labelledby="availability-attention-heading"
      className="overflow-hidden border-border/70 shadow-none"
    >
      <CardHeader className="flex flex-col gap-1 border-b border-border/60 px-4 py-4 sm:px-5">
        <CardTitle
          id="availability-attention-heading"
          role="heading"
          aria-level={2}
          className="text-base leading-6"
        >
          Needs attention
        </CardTitle>
        <CardDescription>Checks run on your settings, including unsaved changes.</CardDescription>
      </CardHeader>
      <ul className="divide-y divide-border/60">
        {items.map((item) => {
          const Icon = item.tone === 'info' ? Info : AlertTriangle;
          return (
            <li
              key={item.id}
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5"
            >
              <Icon
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  item.tone === 'issue'
                    ? 'text-destructive'
                    : item.tone === 'warning'
                      ? 'text-warning-text'
                      : 'text-muted-foreground',
                )}
                aria-hidden
              />
              <p className="text-sm text-foreground">
                <span className="sr-only">{TONE_LABEL[item.tone]}</span>
                {item.text}
              </p>
              <div className="col-start-2 sm:col-start-3">
                {item.action.kind === 'none' ? null : item.action.kind === 'google' ? (
                  <Button asChild variant="outline" size="sm" className={TOUCH_TARGET_CLASS}>
                    <Link href={GOOGLE_REVIEW_HREF}>{item.actionLabel}</Link>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={TOUCH_TARGET_CLASS}
                    onClick={() => onAction(item.action)}
                  >
                    {item.actionLabel}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
