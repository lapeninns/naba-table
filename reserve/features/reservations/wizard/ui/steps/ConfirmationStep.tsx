'use client';

import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import React, { useMemo } from 'react';

import { useConfirmationStep } from '@features/reservations/wizard/hooks/useConfirmationStep';
import { Alert, AlertDescription, AlertIcon } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';

import type { ConfirmationStepProps } from './confirmation-step/types';

const STATUS_ICON_MAP = {
  confirmed: { Icon: CheckCircle2, className: 'text-emerald-500' },
  updated: { Icon: CheckCircle2, className: 'text-emerald-500' },
} as const;

const FEEDBACK_ICON_MAP = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
} as const;

export function ConfirmationStep(props: ConfirmationStepProps) {
  const controller = useConfirmationStep(props);

  const { Icon: StatusIcon, className: statusIconClass } = STATUS_ICON_MAP[controller.status];

  const FeedbackIcon = useMemo(() => {
    if (!controller.feedback) return null;
    return FEEDBACK_ICON_MAP[controller.feedback.variant];
  }, [controller.feedback]);

  return (
    <Card className="mx-auto w-full max-w-4xl lg:max-w-5xl">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-3">
          <StatusIcon className={`h-6 w-6 ${statusIconClass}`} aria-hidden />
          <CardTitle className="text-[clamp(1.75rem,1.45rem+0.6vw,2.2rem)] text-foreground">
            {controller.heading}
          </CardTitle>
        </div>
        <CardDescription className="text-sm text-muted-foreground">
          {controller.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="sr-only" aria-live="polite">
          {`Reference ${controller.reference}. Reservation for ${controller.partyText} at ${controller.summaryTime} on ${controller.summaryDate}.`}
        </p>
        {controller.feedback ? (
          <Alert
            variant={
              controller.feedback.variant === 'error'
                ? 'destructive'
                : controller.feedback.variant === 'warning'
                  ? 'warning'
                  : controller.feedback.variant === 'success'
                    ? 'success'
                    : 'info'
            }
            role={controller.feedback.variant === 'error' ? 'alert' : 'status'}
            className="items-start gap-3"
          >
            <AlertIcon>
              {FeedbackIcon ? <FeedbackIcon className="h-4 w-4" aria-hidden /> : null}
            </AlertIcon>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <AlertDescription>{controller.feedback.message}</AlertDescription>
              <Button
                variant="ghost"
                size="sm"
                onClick={controller.dismissFeedback}
                className="self-end sm:self-auto"
              >
                Dismiss
              </Button>
            </div>
          </Alert>
        ) : null}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Reference
              </dt>
              <dd className="text-sm font-semibold text-foreground">{controller.reference}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Guest</dt>
              <dd className="text-sm font-semibold text-foreground">{controller.guestName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">When</dt>
              <dd className="text-sm font-medium text-foreground">
                {controller.summaryDate} at {controller.summaryTime}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Guests</dt>
              <dd className="text-sm font-medium text-foreground">{controller.partyText}</dd>
            </div>
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}

export type { ConfirmationStepProps } from './confirmation-step/types';
