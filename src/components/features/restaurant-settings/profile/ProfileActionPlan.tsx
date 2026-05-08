'use client';

import { AlertCircle, CheckCircle2, CircleDot } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { ReadinessItemKey, ReadinessSummaryItem } from '../restaurantProfileModel';

type ProfileActionPlanProps = {
  missingRequired: readonly ReadinessSummaryItem[];
  missingOptional: readonly ReadinessSummaryItem[];
  onFocusItem: (key: ReadinessItemKey) => void;
};

const MAX_OPTIONAL_ACTIONS = 3;

export function ProfileActionPlan({
  missingRequired,
  missingOptional,
  onFocusItem,
}: ProfileActionPlanProps) {
  const optionalPreview = missingOptional.slice(0, MAX_OPTIONAL_ACTIONS);
  const isComplete = missingRequired.length === 0 && missingOptional.length === 0;

  return (
    <Card
      variant="compact"
      className="border-border/70 shadow-none"
      aria-label="Profile action plan"
    >
      <CardHeader className="gap-1 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              {isComplete ? (
                <CheckCircle2 className="size-4 text-primary" aria-hidden />
              ) : (
                <CircleDot className="size-4 text-primary" aria-hidden />
              )}
              Action plan
            </CardTitle>
            <CardDescription className="text-xs">
              {isComplete
                ? 'The profile has every readiness item filled.'
                : 'Work through the highest-impact items first.'}
            </CardDescription>
          </div>
          <Badge variant={missingRequired.length > 0 ? 'outline' : 'secondary'}>
            {missingRequired.length > 0 ? `${missingRequired.length} required` : 'Ready'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4 pb-4">
        {isComplete ? (
          <div className="rounded-md bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            No fixes are queued. Keep details current when the venue changes.
          </div>
        ) : null}

        {missingRequired.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Required to go live
            </p>
            {missingRequired.map((item) => (
              <Button
                key={item.key}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto min-h-10 justify-between gap-3 px-3 py-2 text-left"
                onClick={() => onFocusItem(item.key)}
              >
                <span className="min-w-0 flex-1 text-wrap">{item.label}</span>
                <AlertCircle className="size-3.5 shrink-0 text-destructive" aria-hidden />
              </Button>
            ))}
          </div>
        ) : null}

        {optionalPreview.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Polish next
            </p>
            {optionalPreview.map((item) => (
              <Button
                key={item.key}
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto min-h-10 justify-between gap-3 px-3 py-2 text-left"
                onClick={() => onFocusItem(item.key)}
              >
                <span className="min-w-0 flex-1 text-wrap">{item.label}</span>
                <span className="text-xs text-primary">Add</span>
              </Button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
