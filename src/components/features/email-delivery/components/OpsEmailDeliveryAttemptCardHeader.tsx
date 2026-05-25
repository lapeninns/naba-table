'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CollapsibleTrigger } from '@/components/ui/collapsible';
import { CopyButton } from '@/components/ui/copy-button';
import { cn } from '@/lib/utils';

import { OpsEmailDeliveryStatusBadge } from './OpsEmailDeliveryStatusBadge';

import type { OpsEmailDeliveryAttemptCardModel } from '../opsEmailDeliveryAttemptCardDomain';

type OpsEmailDeliveryAttemptCardHeaderProps = {
  model: OpsEmailDeliveryAttemptCardModel;
};

export function OpsEmailDeliveryAttemptCardHeader({
  model,
}: OpsEmailDeliveryAttemptCardHeaderProps) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5">
          <OpsEmailDeliveryStatusBadge status={model.status} />
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <div className="truncate text-sm font-semibold text-foreground" title={model.subject}>
              {model.subject}
            </div>
            {model.variantName ? (
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {model.variantName}
              </Badge>
            ) : null}
            {model.templateType && model.templateType !== model.subject ? (
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {model.templateType}
              </Badge>
            ) : null}
          </div>

          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span
              className={cn(
                'max-w-full break-all',
                model.shouldAllowRecipientWrap ? null : 'sm:truncate',
              )}
              title={model.recipientEmail}
            >
              {model.recipientEmail}
            </span>
            {model.visibleOccurredAtLabel ? (
              <span className="whitespace-nowrap">{model.visibleOccurredAtLabel}</span>
            ) : null}
            {model.visibleBookingLabel ? (
              <span
                className="max-w-full break-words sm:truncate"
                title={model.visibleBookingLabel}
              >
                {model.visibleBookingLabel}
              </span>
            ) : null}
            {model.bookingStartLabel ? (
              <span className="whitespace-nowrap">{model.bookingStartLabel}</span>
            ) : null}
            {model.currentError ? (
              <span className="max-w-full truncate text-destructive" title={model.currentError}>
                {model.currentError}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {model.bookingHref ? (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden h-7 shrink-0 px-2 text-xs sm:inline-flex"
          >
            <Link href={model.bookingHref} prefetch={false}>
              Open booking
            </Link>
          </Button>
        ) : null}

        <CopyButton text={model.messageId} label="message id" className="size-7" />

        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="group size-7"
            aria-label="Toggle attempt details"
          >
            <ChevronDown
              data-icon="inline-start"
              className="transition-transform group-data-[state=open]:rotate-180"
              aria-hidden
            />
          </Button>
        </CollapsibleTrigger>
      </div>
    </div>
  );
}
