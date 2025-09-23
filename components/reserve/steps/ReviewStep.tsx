"use client";

import React, { useCallback, useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { bookingHelpers } from "@/components/reserve/helpers";
import { Icon } from "@/components/reserve/icons";
import { track } from "@/lib/analytics";

import type { Action, State, StepAction } from "../booking-flow/state";

interface ReviewStepProps {
  state: State;
  dispatch: React.Dispatch<Action>;
  onConfirm: () => void | Promise<void>;
  // eslint-disable-next-line no-unused-vars
  onActionsChange: (_actions: StepAction[]) => void;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({ state, dispatch, onConfirm, onActionsChange }) => {
  const details = state.details;

  useEffect(() => {
    if (details.date && details.time) {
      track("confirm_open", {
        date: details.date,
        time: details.time,
        party: details.party,
      });
    } else {
      track("confirm_open");
    }
  }, [details.date, details.time, details.party]);

  const summaryValue = details.date && details.time
    ? `${details.party} at ${bookingHelpers.formatTime(details.time)} on ${bookingHelpers.formatSummaryDate(details.date)}`
    : `${details.party} guest${details.party === 1 ? "" : "s"}`;

  const handleBack = useCallback(() => {
    dispatch({ type: "SET_STEP", step: 2 });
  }, [dispatch]);

  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  useEffect(() => {
    const actions: StepAction[] = [
      {
        id: "review-back",
        label: "Back",
        variant: "outline",
        onClick: handleBack,
      },
      {
        id: "review-confirm",
        label: state.submitting ? "Processing..." : "Confirm booking",
        variant: "default",
        disabled: state.submitting,
        loading: state.submitting,
        onClick: handleConfirm,
      },
    ];
    onActionsChange(actions);
  }, [handleBack, handleConfirm, onActionsChange, state.submitting]);

  return (
    <Card className="mx-auto w-full max-w-4xl lg:max-w-5xl">
      <CardHeader className="space-y-4">
        <CardTitle className="text-[clamp(1.75rem,1.45rem+0.6vw,2.2rem)] text-srx-ink-strong">
          Review and confirm
        </CardTitle>
        <CardDescription className="text-body-sm text-srx-ink-soft">
          Double-check the details below. You can edit any section before confirming.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {state.error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-700">
              <Icon.AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{state.error}</span>
            </div>
          )}
          <dl className="grid gap-4 rounded-2xl border border-srx-border-subtle bg-white/95 p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">Summary</dt>
              <dd className="text-body-sm font-semibold text-srx-ink-strong">{summaryValue}</dd>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-helper text-srx-ink-soft hover:text-srx-ink-strong"
                onClick={() => dispatch({ type: "SET_STEP", step: 1 })}
              >
                Edit selection
              </Button>
            </div>
            <div className="space-y-1">
              <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">Party size</dt>
              <dd className="text-body-sm font-medium text-srx-ink-strong">
                {details.party} {details.party === 1 ? "guest" : "guests"}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">Full name</dt>
              <dd className="text-body-sm font-medium text-srx-ink-strong">{details.name}</dd>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-helper text-srx-ink-soft hover:text-srx-ink-strong"
                onClick={() => dispatch({ type: "SET_STEP", step: 2 })}
              >
                Edit contact info
              </Button>
            </div>
            <div className="space-y-1">
              <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">Email</dt>
              <dd className="text-body-sm font-medium text-srx-ink-strong">{details.email}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">Phone</dt>
              <dd className="text-body-sm font-medium text-srx-ink-strong">{details.phone}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">Booking type</dt>
              <dd className="text-body-sm font-medium text-srx-ink-strong">{bookingHelpers.formatBookingLabel(details.bookingType)}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">Marketing updates</dt>
              <dd className="text-body-sm font-medium text-srx-ink-strong">
                {details.marketingOptIn ? "Subscribed" : "Not subscribed"}
              </dd>
            </div>
            {details.notes && (
              <div className="space-y-1 sm:col-span-2">
                <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">Notes</dt>
                <dd className="text-body-sm text-srx-ink-soft">{details.notes}</dd>
              </div>
            )}
          </dl>
        </div>
      </CardContent>
    </Card>
  );
};
