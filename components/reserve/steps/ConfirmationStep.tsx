"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { bookingHelpers } from "@/components/reserve/helpers";
import { Icon } from "@/components/reserve/icons";
import { DEFAULT_VENUE } from "@/lib/venue";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  toBookingOption,
  type Action,
  type ApiBooking,
  type BookingDetails,
  type BookingEditHandler,
  type BookingMutationHandler,
  type LastAction,
  type State,
  type StepAction,
} from "../booking-flow/state";

interface ConfirmationStepProps {
  state: State;
  dispatch: React.Dispatch<Action>;
  onEdit: BookingEditHandler;
  onCancel: BookingMutationHandler;
  onLookup: () => Promise<void> | void;
  onNewBooking: () => void;
  forceManageView?: boolean;
  // eslint-disable-next-line no-unused-vars
  onActionsChange: (_actions: StepAction[]) => void;
}

interface ConfirmationSummaryProps {
  booking: ApiBooking | null;
  details: BookingDetails;
  waitlisted: boolean;
  allocationPending: boolean;
  lastAction: LastAction;
  onCancelAmend: () => void;
  onViewUpdate: () => void;
  onClose: () => void;
}

const ConfirmationSummaryView: React.FC<ConfirmationSummaryProps> = ({
  booking,
  details,
  waitlisted,
  allocationPending,
  lastAction,
  onCancelAmend,
  onViewUpdate,
  onClose,
}) => {
  const summaryDate = details.date ? bookingHelpers.formatSummaryDate(details.date) : "TBC";
  const summaryTime = details.time ? bookingHelpers.formatTime(details.time) : "TBC";
  const partyText = `${details.party} ${details.party === 1 ? "guest" : "guests"}`;
  const reference = booking?.reference ?? (waitlisted ? "WAITLIST" : "Pending");
  const guestName = booking?.customer_name ?? details.name;
  const isWaitlisted = waitlisted;
  const isAllocationPending = allocationPending && !isWaitlisted;
  const heading = isWaitlisted
    ? "You're on the waiting list"
    : isAllocationPending
      ? "Manual allocation pending"
      : lastAction === "update"
        ? "Booking updated"
        : "Booking confirmed";

  const description = isWaitlisted
    ? `We’ll notify ${details.email} if a table opens near ${summaryTime} on ${summaryDate}.`
    : isAllocationPending
      ? `Our host team will assign the best available table and follow up at ${details.email}.`
      : `A confirmation email has been sent to ${details.email}.`;

  const iconClassName = isWaitlisted ? "text-amber-500" : isAllocationPending ? "text-sky-500" : "text-green-500";
  const HeadingIcon = isWaitlisted ? Icon.Info : isAllocationPending ? Icon.Clock : Icon.CheckCircle;

  const venue = DEFAULT_VENUE;

  return (
    <div className="space-y-6">
      <div
        className={bookingHelpers.cn(
          "flex flex-col gap-3 rounded-2xl border border-srx-border-strong bg-white px-6 py-5 shadow-srx-card sm:flex-row sm:items-center",
          isWaitlisted
            ? "border-l-4 border-l-amber-500"
            : isAllocationPending
              ? "border-l-4 border-l-sky-500"
              : "border-l-4 border-l-emerald-500",
        )}
        role="status"
        aria-live="polite"
      >
        <HeadingIcon className={bookingHelpers.cn("h-10 w-10", iconClassName)} />
        <div className="space-y-1 text-body-sm text-srx-ink-soft">
          <h2 className="text-xl font-semibold text-srx-ink-strong">{heading}</h2>
          <p>{description}</p>
          {isWaitlisted && (
            <p className="text-helper text-srx-ink-soft">
              Tip: keep an eye on your inbox—we’ll release the table to the next guest if we don’t hear back.
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg text-srx-ink-strong">Booking recap</CardTitle>
          <CardDescription className="text-body-sm text-srx-ink-soft">
            Save or update your reservation details below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 text-body-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <dt className="text-srx-ink-soft">Booking reference</dt>
              <dd className="text-base font-semibold text-srx-ink-strong">{reference}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-srx-ink-soft">Guest</dt>
              <dd className="text-base font-medium text-srx-ink-strong">{guestName || "Guest"}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-srx-ink-soft">Date</dt>
              <dd className="text-base font-medium text-srx-ink-strong">{summaryDate}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-srx-ink-soft">Time</dt>
              <dd className="text-base font-medium text-srx-ink-strong">{summaryTime}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-srx-ink-soft">Party</dt>
              <dd className="text-base font-medium text-srx-ink-strong">{partyText}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-srx-ink-soft">Venue</dt>
              <dd className="text-base font-medium text-srx-ink-strong">
                <p>{venue.name}</p>
                <p className="text-helper text-srx-ink-soft">{venue.address}</p>
              </dd>
            </div>
            {details.marketingOptIn && (
              <div className="space-y-1">
                <dt className="text-srx-ink-soft">Marketing updates</dt>
                <dd className="text-base text-srx-ink-strong">Opted in</dd>
              </div>
            )}
            {details.notes && (
              <div className="space-y-1 sm:col-span-2">
                <dt className="text-srx-ink-soft">Notes</dt>
                <dd className="text-base text-srx-ink-strong">{details.notes}</dd>
              </div>
            )}
          </dl>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t border-srx-border-subtle bg-srx-surface-positive-alt/45 px-6 py-4 sm:flex-row sm:justify-end">
          <Button onClick={onCancelAmend} variant="outline" className="w-full sm:w-auto">
            Cancel / Amend
          </Button>
          <Button variant="ghost" className="w-full sm:w-auto" onClick={onViewUpdate}>
            View / Update (login)
          </Button>
          <Button variant="default" className="w-full sm:w-auto" onClick={onClose}>
            Close
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg text-srx-ink-strong">Venue policy</CardTitle>
          <CardDescription className="text-body-sm text-srx-ink-soft">
            {venue.name} · {venue.phone} · {venue.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-body-sm text-srx-ink-soft">{venue.policy}</p>
          <div className="text-body-sm text-srx-ink-soft">
            <p>Need help? Call us on {venue.phone} or email {venue.email}.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const ConfirmationStep: React.FC<ConfirmationStepProps> = ({
  state,
  dispatch,
  onEdit,
  onCancel,
  onLookup,
  onNewBooking,
  forceManageView = false,
  onActionsChange,
}) => {
  const router = useRouter();
  const hasSummary = Boolean(state.lastConfirmed || state.lastAction);
  const initialMode = forceManageView || !hasSummary ? "manage" : "summary";
  const [mode, setMode] = useState<"summary" | "manage">(initialMode);

  useEffect(() => {
    if (forceManageView || !hasSummary) {
      setMode("manage");
    }
  }, [forceManageView, hasSummary]);

  const handleCancelAmend = async () => {
    setMode("manage");
    if (!state.bookings.length) {
      await onLookup();
    }
  };

  const handleViewUpdate = () => {
    router.push("/signin?redirect=/my-bookings");
  };

  const handleClose = () => {
    router.push("/thank-you");
  };

  useEffect(() => {
    const actions: StepAction[] = [];
    if (mode === "summary" && hasSummary) {
      actions.push({
        id: "summary-manage",
        label: "Manage bookings",
        variant: "default",
        onClick: () => setMode("manage"),
      });
      actions.push({
        id: "summary-new",
        label: "New booking",
        variant: "outline",
        onClick: onNewBooking,
      });
    } else {
      if (hasSummary) {
        actions.push({
          id: "manage-back",
          label: "Back to confirmation",
          variant: "outline",
          disabled: state.loading,
          onClick: () => setMode("summary"),
        });
      }
      actions.push({
        id: "manage-new",
        label: "New booking",
        variant: "default",
        disabled: state.loading,
        onClick: onNewBooking,
      });
    }
    onActionsChange(actions);
  }, [hasSummary, mode, onActionsChange, onNewBooking, state.loading]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 md:space-y-10 lg:max-w-5xl xl:max-w-6xl">
      <div className="flex justify-center sm:justify-start">
        <div className="flex rounded-full border border-srx-border-subtle bg-white/90 p-1 shadow-sm backdrop-blur supports-[backdrop-filter]:backdrop-blur-sm">
          {(hasSummary
            ? [
                { id: "summary" as const, label: "Confirmation" },
                { id: "manage" as const, label: "Manage bookings" },
              ]
            : [{ id: "manage" as const, label: "Manage bookings" }]
          ).map((tab) => {
            const isActive = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={bookingHelpers.cn(
                  "rounded-full px-4 py-2 text-body-sm font-medium transition duration-fast ease-srx-standard",
                  isActive
                    ? "bg-[color:var(--srx-brand)] text-white shadow"
                    : "text-srx-ink-soft hover:bg-srx-surface-positive-alt hover:text-srx-ink-strong",
                  tab.id === "summary" && !hasSummary ? "cursor-not-allowed opacity-50" : "",
                )}
                disabled={tab.id === "summary" && !hasSummary}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {mode === "summary" && hasSummary ? (
        <ConfirmationSummaryView
          booking={state.lastConfirmed}
          details={state.details}
          waitlisted={state.waitlisted}
          allocationPending={state.allocationPending}
          lastAction={state.lastAction}
          onCancelAmend={handleCancelAmend}
          onViewUpdate={handleViewUpdate}
          onClose={handleClose}
        />
      ) : (
        <ManageBookings
          state={state}
          dispatch={dispatch}
          onEdit={onEdit}
          onCancel={onCancel}
          onLookup={onLookup}
        />
      )}
    </div>
  );
};

function ManageBookings({
  state,
  dispatch,
  onEdit,
  onCancel,
  onLookup,
}: {
  state: State;
  dispatch: React.Dispatch<Action>;
  onEdit: BookingEditHandler;
  onCancel: BookingMutationHandler;
  onLookup: () => Promise<void> | void;
}) {
  const { bookings, lastConfirmed, lastAction, waitlisted, allocationPending, details, error, loading } = state;
  const [bookingToCancel, setBookingToCancel] = useState<ApiBooking | null>(null);

  const isWaitlisted = waitlisted;
  const isAllocationPending = allocationPending && !isWaitlisted;
  const heading = lastAction === "update" && !isWaitlisted && !isAllocationPending
    ? "Booking updated"
    : isWaitlisted
      ? "You're on the waiting list"
      : isAllocationPending
        ? "Manual allocation pending"
        : "Reservation confirmed";

  const HeadingIcon = isWaitlisted ? Icon.Info : isAllocationPending ? Icon.Clock : Icon.CheckCircle;
  const iconClassName = isWaitlisted ? "text-amber-500" : isAllocationPending ? "text-sky-500" : "text-green-500";
  const confirmationEmail = lastConfirmed?.customer_email ?? details.email;

  const description = isWaitlisted
    ? `We'll notify ${confirmationEmail} if a table opens near ${bookingHelpers.formatTime(details.time)} on ${bookingHelpers.formatDate(details.date)}.`
    : isAllocationPending
      ? `Our host team will assign the best available table and follow up at ${confirmationEmail}.`
      : `A confirmation has been sent to ${confirmationEmail}.`;

  const emailValue = details.email?.trim() ?? "";
  const phoneValue = details.phone?.trim() ?? "";
  const canLookup = Boolean(emailValue && phoneValue);

  const handleLookupSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onLookup();
  };

  const handleConfirmCancel = async () => {
    if (!bookingToCancel) return;
    await onCancel(bookingToCancel);
    setBookingToCancel(null);
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 md:space-y-10 lg:max-w-5xl xl:max-w-6xl">
      <div className="text-center">
        <HeadingIcon className={`mx-auto h-12 w-12 ${iconClassName}`} />
        <h1 className="mt-4 text-[clamp(2rem,1.7rem+0.6vw,2.5rem)] font-bold tracking-tight text-srx-ink-strong">
          {heading}
        </h1>
        {confirmationEmail && (
          <p className="mt-2 text-body-sm text-srx-ink-soft">{description}</p>
        )}
        {error && <p className="mt-4 text-body-sm text-red-600">{error}</p>}
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg text-srx-ink-strong">Your bookings</CardTitle>
          <CardDescription className="text-body-sm text-srx-ink-soft">
            Look up, modify, or cancel upcoming reservations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleLookupSubmit} className="space-y-4 rounded-xl border border-srx-border-subtle bg-white/95 p-5 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="manage-email">Email</Label>
                <Input
                  id="manage-email"
                  type="email"
                  value={details.email}
                  onChange={(event) => dispatch({ type: "SET_FIELD", key: "email", value: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manage-phone">Phone</Label>
                <Input
                  id="manage-phone"
                  type="tel"
                  value={details.phone}
                  onChange={(event) => dispatch({ type: "SET_FIELD", key: "phone", value: event.target.value })}
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={!canLookup || loading} className="w-full sm:w-auto">
              {loading ? (
                <>
                  <Icon.Spinner className="mr-2 h-4 w-4 animate-spin" /> Fetching
                </>
              ) : (
                "Find my bookings"
              )}
            </Button>
          </form>

          {bookings.length > 0 ? (
            <ul className="space-y-4">
              {bookings.map((booking) => (
                <li key={booking.id}>
                  <div className="flex flex-col gap-4 rounded-2xl border border-srx-border-subtle bg-white/95 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-srx-ink-strong">
                        {bookingHelpers.formatDate(booking.booking_date)} at {bookingHelpers.formatTime(booking.start_time)}
                      </p>
                      <p className="text-body-sm text-srx-ink-soft">
                        {booking.party_size} {booking.party_size === 1 ? "guest" : "guests"} · {bookingHelpers.formatBookingLabel(toBookingOption(booking.booking_type))}
                      </p>
                      <p className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">Ref: {booking.reference}</p>
                      <p className="text-helper text-srx-ink-soft">Booked for {booking.customer_name}</p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                      <Button
                        variant="outline"
                        onClick={() => onEdit(booking)}
                        disabled={loading}
                        className="w-full sm:w-auto"
                      >
                        <Icon.Pencil className="mr-2 h-4 w-4" /> Modify
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => setBookingToCancel(booking)}
                        disabled={loading}
                        className="w-full sm:w-auto"
                      >
                        <Icon.Trash2 className="mr-2 h-4 w-4" /> Cancel
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-srx-border-subtle bg-white/80 py-10 text-center text-srx-ink-soft">
              You have no active bookings.
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(bookingToCancel)}
        onOpenChange={(open) => {
          if (!open) setBookingToCancel(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            This action cannot be undone. The reservation will be released immediately.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel aria-label="Close cancellation dialog">Never mind</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                await handleConfirmCancel();
              }}
            >
              Yes, cancel it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
