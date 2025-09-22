"use client";

import React, { useEffect } from "react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/reserve/ui-primitives";
import { bookingHelpers } from "@/components/reserve/helpers";
import { Icon } from "@/components/reserve/icons";
import { track } from "@/lib/analytics";

import type { Action, State } from "../booking-flow/state";

interface ReviewStepProps {
  state: State;
  dispatch: React.Dispatch<Action>;
  onConfirm: () => void | Promise<void>;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({ state, dispatch, onConfirm }) => {
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

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader className="space-y-3">
        <CardTitle className="text-2xl">Review and confirm</CardTitle>
        <CardDescription className="text-sm text-slate-600">
          Double-check the details below. You can edit any section before confirming.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {state.error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <Icon.AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{state.error}</span>
            </div>
          )}
          <dl className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Summary</dt>
              <dd className="text-sm font-semibold text-slate-900">{summaryValue}</dd>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-xs text-slate-600 hover:text-slate-900"
                onClick={() => dispatch({ type: "SET_STEP", step: 1 })}
              >
                Edit selection
              </Button>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Party size</dt>
              <dd className="text-sm font-medium text-slate-900">
                {details.party} {details.party === 1 ? "guest" : "guests"}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Full name</dt>
              <dd className="text-sm font-medium text-slate-900">{details.name}</dd>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-xs text-slate-600 hover:text-slate-900"
                onClick={() => dispatch({ type: "SET_STEP", step: 2 })}
              >
                Edit contact info
              </Button>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt>
              <dd className="text-sm font-medium text-slate-900">{details.email}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Phone</dt>
              <dd className="text-sm font-medium text-slate-900">{details.phone}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Booking type</dt>
              <dd className="text-sm font-medium text-slate-900">{bookingHelpers.formatBookingLabel(details.bookingType)}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Marketing updates</dt>
              <dd className="text-sm font-medium text-slate-900">
                {details.marketingOptIn ? "Subscribed" : "Not subscribed"}
              </dd>
            </div>
            {details.notes && (
              <div className="space-y-1 sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Notes</dt>
                <dd className="text-sm text-slate-700">{details.notes}</dd>
              </div>
            )}
          </dl>
        </div>
      </CardContent>
      <CardFooter className="sticky bottom-0 left-0 right-0 -mx-1 -mb-1 flex flex-col gap-2 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={() => dispatch({ type: "SET_STEP", step: 2 })} className="w-full sm:w-auto">
          Back
        </Button>
        <Button onClick={onConfirm} disabled={state.submitting} className="w-full sm:w-auto">
          {state.submitting ? (
            <>
              <Icon.Spinner className="mr-2 h-4 w-4 animate-spin" /> Processing...
            </>
          ) : (
            "Confirm booking"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};
