'use client';

import React, { useMemo } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';

import { PlanStepForm } from './plan-step/PlanStepForm';

import type { State, StepAction } from '../../model/reducer';
import type { WizardActions } from '../../model/store';
import type { AnalyticsEvent } from '@shared/lib/analytics';

const TITLE = 'Plan your visit';
const DESCRIPTION =
  'Choose a date, time, party size, and any preferences. We’ll show the best options available.';

export interface PlanStepProps {
  state: State;
  actions: Pick<WizardActions, 'updateDetails' | 'goToStep'>;
  onActionsChange: (actions: StepAction[]) => void;
  onTrack?: (event: AnalyticsEvent, payload?: Record<string, unknown>) => void;
}

export function PlanStep({ state, actions, onActionsChange, onTrack }: PlanStepProps) {
  const minSelectableDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, []);

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
