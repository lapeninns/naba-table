"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import useOnlineStatus from "@/hooks/useOnlineStatus";

type QueuedAction = {
  id: string;
  bookingId: string;
  action: string;
  label: string;
  perform: () => Promise<unknown>;
  createdAt: number;
};

type BookingOfflineQueueContextValue = {
  isOffline: boolean;
  pending: QueuedAction[];
  enqueue: (action: Omit<QueuedAction, "id" | "createdAt">) => string;
  dequeue: (id: string) => void;
  isQueued: (bookingId: string) => boolean;
  flush: () => Promise<void>;
  getPendingAction: (bookingId: string) => QueuedAction | null;
};

const BookingOfflineQueueContext = createContext<BookingOfflineQueueContextValue | null>(null);

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 11);
}

export function BookingOfflineQueueProvider({ children }: { children: ReactNode }) {
  const isOnline = useOnlineStatus();
  const [pending, setPending] = useState<QueuedAction[]>([]);
  const queueRef = useRef<QueuedAction[]>([]);
  const flushingRef = useRef(false);

  useEffect(() => {
    queueRef.current = pending;
  }, [pending]);

  const enqueue: BookingOfflineQueueContextValue["enqueue"] = useCallback((action) => {
    const entry: QueuedAction = {
      ...action,
      id: generateId(),
      createdAt: Date.now(),
    };
    setPending((previous) => {
      const next = [...previous, entry];
      queueRef.current = next;
      return next;
    });
    return entry.id;
  }, []);

  const dequeue: BookingOfflineQueueContextValue["dequeue"] = useCallback((id) => {
    setPending((previous) => {
      const next = previous.filter((entry) => entry.id !== id);
      queueRef.current = next;
      return next;
    });
  }, []);

  const isQueued: BookingOfflineQueueContextValue["isQueued"] = useCallback((bookingId) => {
    if (!bookingId) return false;
    return pending.some((entry) => entry.bookingId === bookingId);
  }, [pending]);

  const getPendingAction: BookingOfflineQueueContextValue["getPendingAction"] = useCallback((bookingId) => {
    if (!bookingId) return null;
    return pending.find((entry) => entry.bookingId === bookingId) ?? null;
  }, [pending]);

  const flushQueue = useCallback(async () => {
    if (isOnline && queueRef.current.length === 0) {
      return;
    }
    if (!isOnline || flushingRef.current) {
      return;
    }
    flushingRef.current = true;
    try {
       
      while (true) {
        if (!isOnline) {
          break;
        }
        const [next, ...rest] = queueRef.current;
        if (!next) {
          break;
        }
        try {
          await next.perform();
          queueRef.current = rest;
          setPending(rest);
        } catch (error) {
          console.error("[bookingOfflineQueue] failed to process queued action", error);
          break;
        }
      }
    } finally {
      flushingRef.current = false;
    }
  }, [isOnline]);

  useEffect(() => {
    if (isOnline) {
      void flushQueue();
    }
  }, [flushQueue, isOnline]);

  const value = useMemo<BookingOfflineQueueContextValue>(
    () => ({
      isOffline: !isOnline,
      pending,
      enqueue,
      dequeue,
      isQueued,
      flush: flushQueue,
      getPendingAction,
    }),
    [dequeue, enqueue, flushQueue, getPendingAction, isOnline, isQueued, pending],
  );

  return <BookingOfflineQueueContext.Provider value={value}>{children}</BookingOfflineQueueContext.Provider>;
}

export function useBookingOfflineQueue(): BookingOfflineQueueContextValue | null {
  return useContext(BookingOfflineQueueContext);
}
