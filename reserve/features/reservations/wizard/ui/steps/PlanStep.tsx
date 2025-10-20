'use client';

import { AlertTriangle } from 'lucide-react';
import React, { useMemo } from 'react';

import { Alert, AlertDescription, AlertIcon } from '@shared/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';

import { PlanStepForm } from './plan-step/PlanStepForm';

import type { State, StepAction } from '../../model/reducer';
import type { WizardActions } from '../../model/store';
import type { AnalyticsEvent } from '@shared/lib/analytics';

function getMinSelectableDate(timezone: string | null | undefined) {
  const now = new Date();

  if (!timezone) {
    now.setHours(0, 0, 0, 0);
    return now;
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const year = Number.parseInt(parts.find((part) => part.type === 'year')?.value ?? '', 10);
    const month = Number.parseInt(parts.find((part) => part.type === 'month')?.value ?? '', 10);
    const day = Number.parseInt(parts.find((part) => part.type === 'day')?.value ?? '', 10);

    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[plan-step] failed to derive timezone-adjusted min date', {
        timezone,
        error,
      });
    }
  }

  now.setHours(0, 0, 0, 0);
  return now;
}

const TITLE = 'Plan your visit';
const DESCRIPTION =
  'Choose a date, time, party size, and any preferences. We’ll show the best options available.';

export interface PlanStepProps {
  state: State;
  actions: Pick<WizardActions, 'updateDetails' | 'goToStep'>;
  onActionsChange: (actions: StepAction[]) => void;
  onTrack?: (event: AnalyticsEvent, payload?: Record<string, unknown>) => void;
  planAlert?: string | null;
}

export function PlanStep({ state, actions, onActionsChange, onTrack, planAlert }: PlanStepProps) {
  const minSelectableDate = useMemo(() => {
    return getMinSelectableDate(state.details.restaurantTimezone);
  }, [state.details.restaurantTimezone]);

  const alertMessage = planAlert ?? state.error;

  return (
    <Card className="mx-auto w-full max-w-4xl lg:max-w-5xl">
      <CardHeader className="space-y-4">
        <CardTitle className="text-[clamp(1.75rem,1.45rem+0.6vw,2.2rem)] text-foreground">
          {TITLE}
        </CardTitle>
        <CardDescription className="text-body-sm text-muted-foreground">
          {DESCRIPTION}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {alertMessage ? (
          <Alert variant="destructive" role="alert" className="items-start">
            <AlertIcon>
              <AlertTriangle className="h-4 w-4" aria-hidden />
            </AlertIcon>
            <AlertDescription>{alertMessage}</AlertDescription>
          </Alert>
        ) : null}
        <PlanStepForm
          state={state}
          actions={actions}
          onActionsChange={onActionsChange}
          onTrack={onTrack}
          minDate={minSelectableDate}
        />
      </CardContent>
    </Card>
  );
}
