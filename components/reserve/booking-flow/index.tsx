"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Icon } from "@/components/reserve/icons";
import { bookingHelpers, storageKeys } from "@/components/reserve/helpers";
import { track } from "@/lib/analytics";
import { DEFAULT_RESTAURANT_ID } from "@/lib/venue";
import { PlanStep } from "../steps/PlanStep";
import { DetailsStep } from "../steps/DetailsStep";
import { ReviewStep } from "../steps/ReviewStep";
import { ConfirmationStep } from "../steps/ConfirmationStep";
import { StickyProgress } from "./sticky-progress";
import { useStickyProgress } from "./use-sticky-progress";
import { triggerSubtleHaptic } from "./haptics";

// bookingHelpers + storageKeys imported from @/components/reserve/helpers

import { reducer, getInitialState, type ApiBooking } from "./state";

// =============================================================================================
// MAIN COMPONENT
// =============================================================================================
function BookingFlowContent() {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);
  const { rememberDetails, name, email, phone } = state.details;
  const searchParams = useSearchParams();
  const manageInitRef = useRef(false);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const [progressExpanded, setProgressExpanded] = useState(false);
  const stepsMeta = useMemo(
    () => [
      { id: 1, label: "Plan", helper: "Pick date, time, and party" },
      { id: 2, label: "Details", helper: "Share contact information" },
      { id: 3, label: "Review", helper: "Double-check and confirm" },
      { id: 4, label: "Manage", helper: "View confirmation or update" },
    ],
    [],
  );

  const { shouldShow: stickyVisible } = useStickyProgress(heroRef, state.step);
  useEffect(() => {
    if (!stickyVisible) {
      setProgressExpanded(false);
    }
  }, [stickyVisible]);

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

  const handleLookupBookings = useCallback(
    async (overrides?: { email?: string; phone?: string; restaurantId?: string }) => {
      const emailValue = (overrides?.email ?? state.details.email ?? "").trim();
      const phoneValue = (overrides?.phone ?? state.details.phone ?? "").trim();
      const restaurantIdValue =
        overrides?.restaurantId ?? state.details.restaurantId ?? DEFAULT_RESTAURANT_ID;

      if (!emailValue || !phoneValue) {
        dispatch({ type: "SET_ERROR", message: "Provide your email and phone number to manage reservations." });
        return;
      }

      dispatch({ type: "SET_FIELD", key: "email", value: emailValue });
      dispatch({ type: "SET_FIELD", key: "phone", value: phoneValue });
      dispatch({ type: "SET_FIELD", key: "restaurantId", value: restaurantIdValue });

      dispatch({ type: "SET_LOADING", value: true });
      dispatch({ type: "SET_ERROR", message: null });

      try {
        const params = new URLSearchParams({
          email: emailValue,
          phone: phoneValue,
          restaurantId: restaurantIdValue,
        });

        const response = await fetch(`/api/bookings?${params.toString()}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(typeof data?.error === "string" ? data.error : "Unable to load bookings");
        }

        dispatch({ type: "SET_BOOKINGS", bookings: data.bookings ?? [] });
        dispatch({ type: "SET_STEP", step: 4 });
      } catch (error: any) {
        dispatch({ type: "SET_ERROR", message: error?.message ?? "Unable to load bookings" });
      } finally {
        dispatch({ type: "SET_LOADING", value: false });
      }
    },
    [state.details.email, state.details.phone, state.details.restaurantId],
  );

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

  useEffect(() => {
    const view = searchParams.get("view");
    if (view !== "manage" || manageInitRef.current) {
      return;
    }

    manageInitRef.current = true;

    const emailParam = searchParams.get("email") ?? "";
    const phoneParam = searchParams.get("phone") ?? "";
    const restaurantParam =
      searchParams.get("restaurantId") ?? state.details.restaurantId ?? DEFAULT_RESTAURANT_ID;

    if (emailParam) {
      dispatch({ type: "SET_FIELD", key: "email", value: emailParam });
    }
    if (phoneParam) {
      dispatch({ type: "SET_FIELD", key: "phone", value: phoneParam });
    }
    if (restaurantParam) {
      dispatch({ type: "SET_FIELD", key: "restaurantId", value: restaurantParam });
    }

    if (emailParam && phoneParam) {
      void handleLookupBookings({
        email: emailParam,
        phone: phoneParam,
        restaurantId: restaurantParam,
      });
    } else {
      dispatch({ type: "SET_STEP", step: 4 });
      dispatch({
        type: "SET_ERROR",
        message: "Enter your email and phone number to manage reservations.",
      });
    }
  }, [handleLookupBookings, searchParams, state.details.restaurantId]);

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
      party: state.details.party,
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

  const handleEditBooking = (booking: ApiBooking) => {
    dispatch({ type: "SET_ERROR", message: null });
    dispatch({ type: "START_EDIT", bookingId: booking.id });
  };

  const handleNewBooking = () => {
    dispatch({ type: "SET_ERROR", message: null });
    dispatch({ type: "RESET_FORM" });
  };

  const handleCancelBooking = async (booking: ApiBooking) => {
    if (!state.details.email || !state.details.phone) {
      dispatch({ type: "SET_ERROR", message: "Provide your email and phone number to manage reservations." });
      return;
    }

    dispatch({ type: "SET_LOADING", value: true });
    dispatch({ type: "SET_ERROR", message: null });

    const restaurantId = state.details.restaurantId || DEFAULT_RESTAURANT_ID;

    try {
      const params = new URLSearchParams({
        email: state.details.email.trim(),
        phone: state.details.phone.trim(),
        restaurantId,
      });

      const response = await fetch(`/api/bookings/${booking.id}?${params.toString()}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Unable to cancel booking");
      }

      dispatch({ type: "SET_BOOKINGS", bookings: data.bookings ?? [] });
    } catch (error: any) {
      dispatch({ type: "SET_ERROR", message: error?.message ?? "Unable to cancel booking" });
    } finally {
      dispatch({ type: "SET_LOADING", value: false });
    }
  };

  const renderStep = () => {
    switch (state.step) {
      case 1:
        return <PlanStep state={state} dispatch={dispatch} />;
      case 2:
        return <DetailsStep state={state} dispatch={dispatch} />;
      case 3:
        return <ReviewStep state={state} dispatch={dispatch} onConfirm={handleConfirm} />;
      case 4:
        return (
          <ConfirmationStep
            state={state}
            dispatch={dispatch}
            onEdit={handleEditBooking}
            onCancel={handleCancelBooking}
            onLookup={handleLookupBookings}
            onNewBooking={handleNewBooking}
            forceManageView={searchParams.get("view") === "manage"}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <main
        className={bookingHelpers.cn(
          "min-h-screen w-full bg-slate-50 px-4 py-10 font-sans text-slate-800 transition-[padding-bottom] sm:py-16",
          stickyVisible ? "pb-32 sm:pb-28" : "pb-16",
        )}
      >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <section
          ref={heroRef}
          className="rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur supports-[backdrop-filter]:backdrop-blur-sm sm:p-6"
        >
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Reserve your table</h1>
            <p className="text-sm text-slate-600">
              Complete each step to secure your booking. We’ll keep your progress if you need to jump back.
            </p>
            <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">{selectionSummary.partyText}</span>
              <span aria-hidden="true">•</span>
              <span>{selectionSummary.formattedTime}</span>
              <span aria-hidden="true">•</span>
              <span>{selectionSummary.formattedDate}</span>
            </div>
          </div>
        </section>
        <div>{renderStep()}</div>
      </div>
      </main>
      <StickyProgress
        steps={stepsMeta}
        currentStep={state.step}
        summary={selectionSummary}
        visible={stickyVisible}
        expanded={progressExpanded}
        onToggle={() => setProgressExpanded((prev) => !prev)}
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
