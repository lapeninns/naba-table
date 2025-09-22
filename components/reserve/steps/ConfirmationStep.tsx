"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AlertDialog } from "@/components/reserve/booking-flow/alert-dialog";
import { bookingHelpers } from "@/components/reserve/helpers";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/reserve/ui-primitives";
import { Icon } from "@/components/reserve/icons";
import { DEFAULT_VENUE } from "@/lib/venue";

import {
  toBookingOption,
  type Action,
  type ApiBooking,
  type BookingDetails,
  type BookingEditHandler,
  type BookingMutationHandler,
  type LastAction,
  type State,
} from "../booking-flow/state";

interface ConfirmationStepProps {
  state: State;
  dispatch: React.Dispatch<Action>;
  onEdit: BookingEditHandler;
  onCancel: BookingMutationHandler;
  onLookup: () => Promise<void> | void;
  onNewBooking: () => void;
  forceManageView?: boolean;
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
          "flex flex-col gap-3 rounded-2xl border px-5 py-5 sm:flex-row sm:items-center",
          isWaitlisted
            ? "border-amber-200 bg-amber-50"
            : isAllocationPending
              ? "border-sky-200 bg-sky-50"
              : "border-green-200 bg-green-50",
        )}
        role="status"
      >
        <HeadingIcon className={bookingHelpers.cn("h-10 w-10", iconClassName)} />
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-900">{heading}</h2>
          <p className="text-sm text-slate-700">{description}</p>
          {isWaitlisted && (
            <p className="text-xs text-slate-600">
              Tip: keep an eye on your inbox—we’ll release the table to the next guest if we don’t hear back.
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Booking recap</CardTitle>
          <CardDescription>Save or update your reservation details below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-slate-600">Booking reference</dt>
              <dd className="text-base font-semibold text-slate-900">{reference}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-slate-600">Guest</dt>
              <dd className="text-base font-medium text-slate-900">{guestName || "Guest"}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-slate-600">Date</dt>
              <dd className="text-base font-medium text-slate-900">{summaryDate}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-slate-600">Time</dt>
              <dd className="text-base font-medium text-slate-900">{summaryTime}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-slate-600">Party</dt>
              <dd className="text-base font-medium text-slate-900">{partyText}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-slate-600">Venue</dt>
              <dd className="text-base font-medium text-slate-900">
                <p>{venue.name}</p>
                <p className="text-sm text-slate-600">{venue.address}</p>
              </dd>
            </div>
            {details.marketingOptIn && (
              <div className="space-y-1">
                <dt className="text-slate-600">Marketing updates</dt>
                <dd className="text-base text-slate-900">Opted in</dd>
              </div>
            )}
            {details.notes && (
              <div className="space-y-1 sm:col-span-2">
                <dt className="text-slate-600">Notes</dt>
                <dd className="text-base text-slate-900">{details.notes}</dd>
              </div>
            )}
          </dl>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
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
        <CardHeader>
          <CardTitle className="text-lg">Venue policy</CardTitle>
          <CardDescription>
            {venue.name} · {venue.phone} · {venue.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-700">{venue.policy}</p>
          <div className="text-sm text-slate-600">
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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="flex justify-center sm:justify-start">
        <div className="flex rounded-full border border-slate-200 bg-slate-50 p-1">
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
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  isActive ? "bg-white text-slate-900 shadow" : "text-slate-500 hover:text-slate-800",
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
          onNewBooking={onNewBooking}
          onBack={hasSummary ? () => setMode("summary") : undefined}
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
  onNewBooking,
  onBack,
}: {
  state: State;
  dispatch: React.Dispatch<Action>;
  onEdit: BookingEditHandler;
  onCancel: BookingMutationHandler;
  onLookup: () => Promise<void> | void;
  onNewBooking: () => void;
  onBack?: () => void;
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
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="text-center">
        <HeadingIcon className={`mx-auto h-12 w-12 ${iconClassName}`} />
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{heading}</h1>
        {confirmationEmail && (
          <p className="mt-2 text-slate-600">{description}</p>
        )}
        {onBack && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={onBack} disabled={loading}>
              Back to confirmation
            </Button>
          </div>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your bookings</CardTitle>
          <CardDescription>Look up, modify, or cancel upcoming reservations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleLookupSubmit} className="space-y-4 rounded-xl border border-slate-200 p-4">
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
                  <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-slate-900">
                        {bookingHelpers.formatDate(booking.booking_date)} at {bookingHelpers.formatTime(booking.start_time)}
                      </p>
                      <p className="text-sm text-slate-600">
                        {booking.party_size} {booking.party_size === 1 ? "guest" : "guests"} · {bookingHelpers.formatBookingLabel(toBookingOption(booking.booking_type))}
                      </p>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Ref: {booking.reference}</p>
                      <p className="text-xs text-slate-500">Booked for {booking.customer_name}</p>
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
            <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-slate-500">
              You have no active bookings.
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-center border-t border-slate-100 bg-slate-50">
          <Button onClick={onNewBooking} disabled={loading} className="w-full sm:w-auto">
            Make a new booking
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog
        open={Boolean(bookingToCancel)}
        onOpenChange={(open) => {
          if (!open) setBookingToCancel(null);
        }}
        onConfirm={handleConfirmCancel}
        title="Cancel this booking?"
        description="This action cannot be undone. The reservation will be released immediately."
      />
    </div>
  );
}
