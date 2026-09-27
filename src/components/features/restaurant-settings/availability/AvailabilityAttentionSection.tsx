'use client';

import { AlertTriangle, Info } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import { TOUCH_TARGET_CLASS } from './AvailabilityFields';
import { SettingsCard } from '../shared/SettingsCard';

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

/** Action labels can name a booking type, so they wrap rather than overflow a phone row. */
const ATTENTION_ACTION_CLASS = 'h-auto min-h-8 max-w-full whitespace-normal py-1.5 text-left';

/** Hidden when empty. Checks run on the draft, including unsaved changes. */
export function AvailabilityAttentionSection({
  items,
  onAction,
}: AvailabilityAttentionSectionProps) {
  if (items.length === 0) {
    return null;
  }
  return (
    <SettingsCard
      region
      titleId="availability-attention-heading"
      title="Needs attention"
      description="Checks run on your settings, including unsaved changes."
      contentClassName="p-0 @container sm:p-0"
    >
      <ul className="divide-y divide-border/60">
        {items.map((item) => {
          const Icon = item.tone === 'info' ? Info : AlertTriangle;
          return (
            <li
              key={item.id}
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 px-4 py-3 @lg:grid-cols-[auto_minmax(0,1fr)_auto] @lg:items-center sm:px-5"
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
              <div className="col-start-2 @lg:col-start-3">
                {item.action.kind === 'none' ? null : item.action.kind === 'google' ? (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className={cn(ATTENTION_ACTION_CLASS, TOUCH_TARGET_CLASS)}
                  >
                    <Link href={GOOGLE_REVIEW_HREF}>{item.actionLabel}</Link>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(ATTENTION_ACTION_CLASS, TOUCH_TARGET_CLASS)}
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
    </SettingsCard>
  );
}
