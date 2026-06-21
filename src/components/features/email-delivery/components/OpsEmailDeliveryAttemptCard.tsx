'use client';

import { Loader2, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import { OpsEmailDeliveryAttemptCardDetails } from './OpsEmailDeliveryAttemptCardDetails';
import { OpsEmailDeliveryAttemptCardHeader } from './OpsEmailDeliveryAttemptCardHeader';
import { buildOpsEmailDeliveryAttemptCardModel } from '../opsEmailDeliveryAttemptCardDomain';

import type { OpsEmailDeliveryAttemptDTO } from '@/types/emailDelivery';

export type OpsEmailDeliveryAttemptCardProps = {
  attempt: OpsEmailDeliveryAttemptDTO;
  timezone: string;
  restaurantId: string;
  canRetry?: boolean;
  isRetrying?: boolean;
  onRetry?: () => void;
};

export function OpsEmailDeliveryAttemptCard({
  attempt,
  timezone,
  restaurantId,
  canRetry = false,
  isRetrying = false,
  onRetry,
}: OpsEmailDeliveryAttemptCardProps) {
  const model = buildOpsEmailDeliveryAttemptCardModel({
    attempt,
    restaurantId,
    timezone,
  });

  return (
    <Card
      className={cn('border-border/60 bg-background', model.statusRailClass)}
      data-attempt-key={model.attemptKey}
    >
      <CardContent className="p-4">
        <Collapsible>
          <OpsEmailDeliveryAttemptCardHeader model={model} />

          {canRetry && onRetry ? (
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRetrying}
                aria-label={`Retry email for ${model.recipientEmail}`}
                onClick={onRetry}
              >
                {isRetrying ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
                ) : (
                  <RotateCcw data-icon="inline-start" aria-hidden />
                )}
                Retry
              </Button>
            </div>
          ) : null}

          <CollapsibleContent className="mt-3">
            <OpsEmailDeliveryAttemptCardDetails model={model} />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
