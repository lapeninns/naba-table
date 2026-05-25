'use client';

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
};

export function OpsEmailDeliveryAttemptCard({
  attempt,
  timezone,
  restaurantId,
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

          <CollapsibleContent className="mt-3">
            <OpsEmailDeliveryAttemptCardDetails model={model} />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
