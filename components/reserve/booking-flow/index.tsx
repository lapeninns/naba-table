"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { Icon } from "@/components/reserve/icons";
import { bookingHelpers, storageKeys } from "@/components/reserve/helpers";
import { track } from "@/lib/analytics";
import { DEFAULT_RESTAURANT_ID } from "@/lib/venue";
import { StickyProgress } from "./sticky-progress";
import { useStickyProgress } from "./use-sticky-progress";
import { triggerSubtleHaptic } from "./haptics";

const StepSkeleton: React.FC = () => (
  <div className="animate-pulse rounded-2xl border border-srx-border-subtle bg-white/70 p-6 shadow-sm">
    <div className="h-6 w-40 rounded-lg bg-slate-200/80" />
    <div className="mt-6 space-y-3">
      <div className="h-4 w-full rounded bg-slate-200/70" />
      <div className="h-4 w-3/4 rounded bg-slate-200/70" />
      <div className="h-4 w-2/3 rounded bg-slate-200/70" />
    </div>
  </div>
);

const PlanStep = dynamic(() => import("../steps/PlanStep").then((mod) => mod.PlanStep), {
  loading: () => <StepSkeleton />,
});
const DetailsStep = dynamic(() => import("../steps/DetailsStep").then((mod) => mod.DetailsStep), {
  loading: () => <StepSkeleton />,
});
const ReviewStep = dynamic(() => import("../steps/ReviewStep").then((mod) => mod.ReviewStep), {
  loading: () => <StepSkeleton />,
});
const ConfirmationStep = dynamic(
  () => import("../steps/ConfirmationStep").then((mod) => mod.ConfirmationStep),
  {
    loading: () => <StepSkeleton />,
  },
);

// bookingHelpers + storageKeys imported from @/components/reserve/helpers

import { reducer, getInitialState, type StepAction } from "./state";

// =============================================================================================
// MAIN COMPONENT
// =============================================================================================
function BookingFlowContent() {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);
  const { rememberDetails, name, email, phone } = state.details;
  const heroRef = useRef<HTMLElement | null>(null);
  const [stickyActions, setStickyActions] = useState<StepAction[]>([]);
  const [stickyHeight, setStickyHeight] = useState(0);
  const stepsMeta = useMemo(
    () => [
      { id: 1, label: "Plan", helper: "Pick date, time, and party" },
      { id: 2, label: "Details", helper: "Share contact information" },
      { id: 3, label: "Review", helper: "Double-check and confirm" },
      { id: 4, label: "Confirmation", helper: "Your reservation status" },
    ],
    [],
  );

  const { shouldShow: stickyVisible } = useStickyProgress(heroRef);

  const handleStickyHeightChange = useCallback((height: number) => {
    setStickyHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
  }, []);

  const previousStepRef = useRef(state.step);
  useEffect(() => {
    if (previousStepRef.current !== state.step) {
      triggerSubtleHaptic();
      previousStepRef.current = state.step;
    }
  }, [state.step]);

  const previousVisibilityRef = useRef(stickyVisible);
  useEffect(() => {
    if (stickyVisible && !previousVisibilityRef.current) {
      triggerSubtleHaptic(5);
    }
    previousVisibilityRef.current = stickyVisible;
  }, [stickyVisible]);

  const handleActionsChange = useCallback((actions: StepAction[]) => {
    setStickyActions((prev) => {
      if (prev.length === actions.length && prev.every((action, index) => {
        const next = actions[index];
        return (
          action.id === next.id &&
          action.label === next.label &&
          action.variant === next.variant &&
          action.disabled === next.disabled &&
          action.loading === next.loading
        );
      })) {
        return prev;
      }
      if (process.env.NODE_ENV !== "production") {
        console.log("[sticky-actions] updating", { prev, next: actions });
      }
      return actions;
    });
  }, []);

  useEffect(() => {
    setStickyActions([]);
  }, [state.step]);

  const selectionSummary = useMemo(() => {
    const formattedDate = state.details.date ? bookingHelpers.formatSummaryDate(state.details.date) : "Choose a date";
    const formattedTime = state.details.time ? bookingHelpers.formatTime(state.details.time) : "Pick a time";
    const partyText = state.details.party
      ? `${state.details.party} ${state.details.party === 1 ? "guest" : "guests"}`
      : "Add guests";
    return {
      formattedDate,
      formattedTime,
      partyText,
    };
  }, [state.details.date, state.details.party, state.details.time]);

  // Load remembered contact details
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(storageKeys.contacts);
      if (stored) {
        const parsed = JSON.parse(stored) as { name: string; email: string; phone: string };
        if (parsed.name || parsed.email || parsed.phone) {
          dispatch({ type: "HYDRATE_CONTACTS", payload: { ...parsed, rememberDetails: true } });
        }
      }
    } catch (error) {
      console.error("Failed to load contact details", error);
    }
  }, []);

  // Persist remembered contacts with explicit consent
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (rememberDetails) {
        window.localStorage.setItem(storageKeys.contacts, JSON.stringify({ name, email, phone }));
      } else {
        window.localStorage.removeItem(storageKeys.contacts);
      }
    } catch (error) {
      console.error("Failed to persist contact details", error);
    }
  }, [rememberDetails, name, email, phone]);

  const handleConfirm = async () => {
    const normalizedTime = bookingHelpers.normalizeTime(state.details.time);

    if (!normalizedTime) {
      dispatch({ type: "SET_ERROR", message: "Please select a time for your reservation." });
      return;
    }

    dispatch({ type: "SET_ERROR", message: null });
    dispatch({ type: "SET_SUBMITTING", value: true });

    const restaurantId = state.details.restaurantId || DEFAULT_RESTAURANT_ID;
    const payload = {
      restaurantId,
      date: state.details.date,
      time: normalizedTime,
      party: Math.max(1, state.details.party),
      bookingType:
        state.details.bookingType === "drinks"
          ? "drinks"
          : bookingHelpers.bookingTypeFromTime(normalizedTime, state.details.date),
      seating: state.details.seating,
      notes: state.details.notes ? state.details.notes : undefined,
      name: state.details.name.trim(),
      email: state.details.email.trim(),
      phone: state.details.phone.trim(),
      marketingOptIn: state.details.marketingOptIn,
    };

    const isUpdate = Boolean(state.editingId);
    const endpoint = isUpdate ? `/api/bookings/${state.editingId}` : "/api/bookings";
    const method = isUpdate ? "PUT" : "POST";

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 202) {
        track("booking_created", {
          waitlisted: 1,
          allocation_pending: data.allocationPending ? 1 : 0,
          party: state.details.party,
          start_time: normalizedTime,
        });
        dispatch({
          type: "SET_CONFIRMATION",
          payload: {
            bookings: data.bookings ?? [],
            booking: null,
            lastAction: "waitlist",
            waitlisted: true,
            allocationPending: Boolean(data.allocationPending),
          },
        });
        return;
      }

      if (!response.ok) {
        const message = typeof data?.error === "string" ? data.error : "Unable to process booking";
        dispatch({ type: "SET_ERROR", message });
        dispatch({ type: "SET_SUBMITTING", value: false });
        return;
      }

      dispatch({
        type: "SET_CONFIRMATION",
        payload: {
          bookings: data.bookings ?? [],
          booking: data.booking ?? null,
          lastAction:
            data.waitlisted || data.allocationPending
              ? "waitlist"
              : isUpdate
                ? "update"
                : "create",
          waitlisted: Boolean(data.waitlisted),
          allocationPending: Boolean(data.allocationPending),
        },
      });

      if (data?.booking) {
        track("booking_created", {
          waitlisted: data.waitlisted ? 1 : 0,
          allocation_pending: data.allocationPending ? 1 : 0,
          party: data.booking.party_size,
          start_time: data.booking.start_time,
          reference: data.booking.reference,
        });
      }
    } catch (error: any) {
      dispatch({
        type: "SET_ERROR",
        message: error?.message ?? "Unable to process booking",
      });
      dispatch({ type: "SET_SUBMITTING", value: false });
    }
  };

  const handleNewBooking = useCallback(() => {
    dispatch({ type: "SET_ERROR", message: null });
    dispatch({ type: "RESET_FORM" });
  }, []);

  const renderStep = () => {
    switch (state.step) {
      case 1:
        return <PlanStep state={state} dispatch={dispatch} onActionsChange={handleActionsChange} />;
      case 2:
        return <DetailsStep state={state} dispatch={dispatch} onActionsChange={handleActionsChange} />;
      case 3:
        return (
          <ReviewStep
            state={state}
            dispatch={dispatch}
            onConfirm={handleConfirm}
            onActionsChange={handleActionsChange}
          />
        );
      case 4:
        return (
          <ConfirmationStep
            state={state}
            onNewBooking={handleNewBooking}
            onActionsChange={handleActionsChange}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <main
        style={stickyVisible ? { paddingBottom: `calc(${stickyHeight}px + env(safe-area-inset-bottom, 0px) + 1.5rem)` } : undefined}
        className={bookingHelpers.cn(
          "min-h-screen w-full bg-slate-50 px-4 pb-24 pt-10 font-sans text-srx-ink-strong transition-[padding-bottom] sm:pt-16 md:px-8 lg:px-12",
        )}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 sm:gap-12 md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
          <span ref={heroRef} aria-hidden className="block h-px w-full" />
          {renderStep()}
        </div>
      </main>
      <StickyProgress
        steps={stepsMeta}
        currentStep={state.step}
        summary={selectionSummary}
        visible={stickyVisible}
        actions={stickyActions}
        onHeightChange={handleStickyHeightChange}
      />
    </>
  );
}

export default function BookingFlowPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-12">
        <div className="space-y-3 text-center text-slate-600">
          <Icon.Spinner className="mx-auto h-8 w-8 animate-spin" />
          <p>Loading reservation flow…</p>
        </div>
      </main>
    }>
      <BookingFlowContent />
    </Suspense>
  );
}
