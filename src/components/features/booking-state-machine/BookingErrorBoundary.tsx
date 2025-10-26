"use client";

import { Component, type ErrorInfo, type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { ConflictResolver } from "./ConflictResolver";

import type { OpsBookingStatus } from "@/types/ops";


type ErrorKind = "network" | "permission" | "unknown";

type BookingErrorBoundaryProps = {
  children: ReactNode;
  onRetry?: () => void;
  className?: string;
};

type ConflictPayload = {
  bookingId: string;
  attemptedStatus?: OpsBookingStatus;
  currentStatus?: OpsBookingStatus | null;
  message?: string;
  updatedAt?: string | null;
  onReload?: (() => void) | null;
};

type BookingErrorBoundaryContextValue = {
  reportError: (error: unknown) => void;
  reportConflict: (payload: ConflictPayload) => void;
  resolveConflict: () => void;
  resetError: () => void;
};

const BookingErrorBoundaryContext = createContext<BookingErrorBoundaryContextValue | null>(null);

type ErrorCatcherProps = {
  onError: (error: Error, info: ErrorInfo) => void;
  children: ReactNode;
};

type ErrorCatcherState = {
  hasError: boolean;
};

class ErrorCatcher extends Component<ErrorCatcherProps, ErrorCatcherState> {
  constructor(props: ErrorCatcherProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorCatcherState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError(error, info);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === "string") {
    return new Error(error);
  }
  return new Error("An unexpected error occurred while updating bookings.");
}

function classifyError(error: Error): ErrorKind {
  if ("status" in error && typeof (error as { status?: unknown }).status === "number") {
    const status = (error as { status?: number }).status ?? 0;
    if (status === 403) return "permission";
    if (status >= 500 || status === 0) return "network";
  }
  if (error.message.toLowerCase().includes("network")) {
    return "network";
  }
  return "unknown";
}

type ErrorFallbackProps = {
  error: Error;
  onRetry?: () => void;
  onDismiss: () => void;
};

function ErrorFallback({ error, onRetry, onDismiss }: ErrorFallbackProps) {
  const kind = classifyError(error);
  const title =
    kind === "network"
      ? "We lost the connection"
      : kind === "permission"
        ? "You don’t have access"
        : "Something went wrong";

  const description =
    kind === "network"
      ? "Please check your connection and try again. Your previous changes were rolled back."
      : kind === "permission"
        ? "You don’t have the required permissions to perform this action. Ask an administrator to review your access."
        : error.message;

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
      <Alert variant="destructive">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </Alert>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {onRetry ? (
          <Button type="button" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}

export function BookingErrorBoundary({ children, onRetry, className }: BookingErrorBoundaryProps) {
  const [error, setError] = useState<Error | null>(null);
  const [conflict, setConflict] = useState<ConflictPayload | null>(null);
  const [boundaryKey, setBoundaryKey] = useState(0);

  const handleCaughtError = useCallback((caught: Error) => {
    setError(normalizeError(caught));
  }, []);

  const handleDismiss = useCallback(() => {
    setError(null);
    setBoundaryKey((value) => value + 1);
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setBoundaryKey((value) => value + 1);
    onRetry?.();
  }, [onRetry]);

  const handleResolveConflict = useCallback(() => {
    setConflict(null);
  }, []);

  const contextValue = useMemo<BookingErrorBoundaryContextValue>(
    () => ({
      reportError: (err: unknown) => {
        setError(normalizeError(err));
      },
      reportConflict: (payload: ConflictPayload) => {
        setConflict(payload);
      },
      resolveConflict: () => {
        setConflict(null);
      },
      resetError: handleDismiss,
    }),
    [handleDismiss],
  );

  return (
    <BookingErrorBoundaryContext.Provider value={contextValue}>
      <div className={className}>
        {error ? (
          <ErrorFallback error={error} onRetry={onRetry ? handleRetry : undefined} onDismiss={handleDismiss} />
        ) : null}
        <ErrorCatcher
          key={boundaryKey}
          onError={(caught) => {
            handleCaughtError(caught);
          }}
        >
          {error ? null : children}
        </ErrorCatcher>
      </div>
      {conflict ? (
        <ConflictResolver
          conflict={conflict}
          onClose={() => {
            handleResolveConflict();
          }}
        />
      ) : null}
    </BookingErrorBoundaryContext.Provider>
  );
}

export function useBookingErrorBoundary(): BookingErrorBoundaryContextValue | null {
  return useContext(BookingErrorBoundaryContext);
}

export type { ConflictPayload };
