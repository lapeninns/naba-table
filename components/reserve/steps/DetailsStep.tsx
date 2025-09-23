"use client";

import React, { useCallback, useEffect, useState } from "react";

import { Field } from "@/components/reserve/booking-flow/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { bookingHelpers } from "@/components/reserve/helpers";
import { Icon } from "@/components/reserve/icons";
import { track } from "@/lib/analytics";

import type { Action, State, StepAction } from "../booking-flow/state";

interface DetailsStepProps {
  state: State;
  dispatch: React.Dispatch<Action>;
  // eslint-disable-next-line no-unused-vars
  onActionsChange: (_actions: StepAction[]) => void;
}

export const DetailsStep: React.FC<DetailsStepProps> = ({ state, dispatch, onActionsChange }) => {
  const { name, email, phone, agree, rememberDetails, marketingOptIn } = state.details;
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const nameOk = name.trim().length >= 2;
  const emailOk = bookingHelpers.isEmail(email);
  const phoneOk = bookingHelpers.isUKPhone(phone);
  const canContinue = nameOk && emailOk && phoneOk && agree;
  const showAgreementError = attemptedSubmit && !agree;

  const handleBack = useCallback(() => {
    dispatch({ type: "SET_STEP", step: 1 });
  }, [dispatch]);

  const handleContinue = useCallback(() => {
    setAttemptedSubmit(true);
    if (!canContinue) return;
    track("details_submit", {
      marketing_opt_in: marketingOptIn ? 1 : 0,
      terms_checked: agree ? 1 : 0,
    });
    dispatch({ type: "SET_STEP", step: 3 });
  }, [agree, canContinue, dispatch, marketingOptIn]);

  useEffect(() => {
    const actions: StepAction[] = [
      {
        id: "details-back",
        label: "Back",
        icon: "ChevronLeft",
        variant: "outline",
        onClick: handleBack,
      },
      {
        id: "details-review",
        label: "Review booking",
        icon: "Check",
        variant: "default",
        disabled: !canContinue,
        onClick: handleContinue,
      },
    ];
    onActionsChange(actions);
  }, [canContinue, handleBack, handleContinue, onActionsChange]);

  return (
    <Card className="mx-auto w-full max-w-4xl lg:max-w-5xl">
      <CardHeader className="space-y-4">
        <CardTitle className="text-[clamp(1.75rem,1.45rem+0.6vw,2.2rem)] text-srx-ink-strong">
          Tell us how to reach you
        </CardTitle>
        <CardDescription className="text-body-sm text-srx-ink-soft">
          We’ll send confirmation and any updates to the contact details below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 md:space-y-8">
        <section className="space-y-4 rounded-xl border border-srx-border-subtle bg-white/95 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-srx-ink-strong">Contact details</h3>
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

        <section className="space-y-4 rounded-xl border border-srx-border-subtle bg-white/95 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-srx-ink-strong">Preferences</h3>
          <div className="space-y-3">
            <label className="flex items-start gap-3 text-body-sm text-srx-ink-soft">
              <Checkbox
                checked={rememberDetails}
                onChange={(event) => dispatch({ type: "SET_FIELD", key: "rememberDetails", value: event.target.checked })}
              />
              <span>
                Save contact details for next time
                <span className="block text-helper text-srx-ink-soft">
                  We’ll pre-fill your info on this device.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-body-sm text-srx-ink-soft">
              <Checkbox
                checked={marketingOptIn}
                onChange={(event) => dispatch({ type: "SET_FIELD", key: "marketingOptIn", value: event.target.checked })}
              />
              <span>
                Send me occasional updates
                <span className="block text-helper text-srx-ink-soft">
                  News on seasonal menus and exclusive events.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-srx-border-strong bg-srx-surface-positive-alt/50 p-4 text-body-sm text-srx-ink-soft">
              <Checkbox
                checked={agree}
                onChange={(event) => dispatch({ type: "SET_FIELD", key: "agree", value: event.target.checked })}
              />
              <span>
                I agree to the terms and privacy notice
                <span className="block text-helper text-srx-ink-soft">
                  Required to confirm your booking. View our
                  <a href="/terms" className="ml-1 text-srx-ink-strong underline underline-offset-4">
                    terms
                  </a>
                  and
                  <a href="/privacy-policy" className="ml-1 text-srx-ink-strong underline underline-offset-4">
                    privacy policy
                  </a>
                  .
                </span>
              </span>
            </label>
            {showAgreementError && (
              <p className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-body-sm text-red-600">
                <Icon.AlertCircle className="h-4 w-4" /> Please accept the terms to continue.
              </p>
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  );
};
