"use client";

import React, { useState } from "react";

import { Field } from "@/components/reserve/booking-flow/form";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
} from "@/components/reserve/ui-primitives";
import { bookingHelpers } from "@/components/reserve/helpers";
import { Icon } from "@/components/reserve/icons";
import { track } from "@/lib/analytics";

import type { Action, State } from "../booking-flow/state";

interface DetailsStepProps {
  state: State;
  dispatch: React.Dispatch<Action>;
}

export const DetailsStep: React.FC<DetailsStepProps> = ({ state, dispatch }) => {
  const { name, email, phone, agree, rememberDetails, marketingOptIn } = state.details;
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const nameOk = name.trim().length >= 2;
  const emailOk = bookingHelpers.isEmail(email);
  const phoneOk = bookingHelpers.isUKPhone(phone);
  const canContinue = nameOk && emailOk && phoneOk && agree;
  const showAgreementError = attemptedSubmit && !agree;

  const handleContinue = () => {
    setAttemptedSubmit(true);
    if (!canContinue) return;
    track("details_submit", {
      marketing_opt_in: marketingOptIn ? 1 : 0,
      terms_checked: agree ? 1 : 0,
    });
    dispatch({ type: "SET_STEP", step: 3 });
  };

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader className="space-y-3">
        <CardTitle className="text-2xl">Tell us how to reach you</CardTitle>
        <CardDescription className="text-sm text-slate-600">
          We’ll send confirmation and any updates to the contact details below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-4 rounded-xl border border-slate-200 p-4">
          <h3 className="text-base font-semibold text-slate-900">Contact details</h3>
          <div className="space-y-4">
            <Field
              id="name"
              label="Full name"
              required
              error={name && !nameOk ? "Please enter at least two characters." : ""}
            >
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(event) => dispatch({ type: "SET_FIELD", key: "name", value: event.target.value })}
                placeholder="Jane Smith"
                autoComplete="name"
              />
            </Field>
            <Field
              id="email"
              label="Email address"
              required
              error={email && !emailOk ? "Please enter a valid email." : ""}
            >
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => dispatch({ type: "SET_FIELD", key: "email", value: event.target.value })}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </Field>
            <Field
              id="phone"
              label="UK phone number"
              required
              error={phone && !phoneOk ? "Please enter a valid UK mobile number (e.g., 07123 456789)." : ""}
            >
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => dispatch({ type: "SET_FIELD", key: "phone", value: event.target.value })}
                placeholder="07123 456789"
                autoComplete="tel"
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 p-4">
          <h3 className="text-base font-semibold text-slate-900">Preferences</h3>
          <div className="space-y-3">
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <Checkbox
                checked={rememberDetails}
                onChange={(event) => dispatch({ type: "SET_FIELD", key: "rememberDetails", value: event.target.checked })}
              />
              <span>
                Save contact details for next time
                <span className="block text-xs text-slate-500">
                  We’ll pre-fill your info on this device.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <Checkbox
                checked={marketingOptIn}
                onChange={(event) => dispatch({ type: "SET_FIELD", key: "marketingOptIn", value: event.target.checked })}
              />
              <span>
                Send me occasional updates
                <span className="block text-xs text-slate-500">
                  News on seasonal menus and exclusive events.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <Checkbox
                checked={agree}
                onChange={(event) => dispatch({ type: "SET_FIELD", key: "agree", value: event.target.checked })}
              />
              <span>
                I agree to the terms and privacy notice
                <span className="block text-xs text-slate-500">
                  Required to confirm your booking. View our
                  <a href="/terms" className="ml-1 text-slate-900 underline">
                    terms
                  </a>
                  and
                  <a href="/privacy-policy" className="ml-1 text-slate-900 underline">
                    privacy policy
                  </a>
                  .
                </span>
              </span>
            </label>
            {showAgreementError && (
              <p className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                <Icon.AlertCircle className="h-4 w-4" /> Please accept the terms to continue.
              </p>
            )}
          </div>
        </section>
      </CardContent>
      <CardFooter className="sticky bottom-0 left-0 right-0 -mx-1 -mb-1 flex flex-col gap-2 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={() => dispatch({ type: "SET_STEP", step: 1 })} className="w-full sm:w-auto">
          Back
        </Button>
        <Button onClick={handleContinue} disabled={!canContinue} className="w-full sm:w-auto">
          Review booking
        </Button>
      </CardFooter>
    </Card>
  );
};
