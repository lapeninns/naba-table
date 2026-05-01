'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';

import { OpsEmailDeliveryAttemptCard } from '@/components/features/email-delivery/components/OpsEmailDeliveryAttemptCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { OpsEmailDeliveryAttemptDTO } from '@/types/emailDelivery';

export type OpsEmailDeliveryResultsCardProps = {
  attempts: OpsEmailDeliveryAttemptDTO[];
  timezone: string;
  restaurantId: string;
  page: number;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export function OpsEmailDeliveryResultsCard({
  attempts,
  timezone,
  restaurantId,
  page,
  hasNext,
  onPrev,
  onNext,
}: OpsEmailDeliveryResultsCardProps) {
  const items = useMemo(() => {
    return attempts.map((attempt) => ({
      key: `${attempt.messageId}__${attempt.recipientEmail.toLowerCase()}`,
      attempt,
    }));
  }, [attempts]);

  return (
    <section aria-label="Email delivery attempts" className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Attempts
          </div>
          <Badge variant="secondary">{attempts.length}</Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPrev} disabled={page <= 1}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">Page {page}</span>
          <Button variant="outline" size="sm" onClick={onNext} disabled={!hasNext}>
            Next
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {items.map(({ key, attempt }) => (
          <OpsEmailDeliveryAttemptCard
            key={key}
            attempt={attempt}
            timezone={timezone}
            restaurantId={restaurantId}
          />
        ))}
      </div>
    </section>
  );
}
