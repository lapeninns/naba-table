import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';

import type { OpsBookingStatus } from '@/types/ops';
import { getAllowedTargets, validateTransition, type TransitionValidationOptions } from '../lib/booking/state-machine';

type BookingIdentifier = string;

export type BookingSnapshot = {
  id: BookingIdentifier;
  status: OpsBookingStatus;
  updatedAt?: string | null;
};

export type OptimisticTransition = {
  targetStatus: OpsBookingStatus;
  startedAt: number;
  payload?: Record<string, unknown>;
};

type BookingMachineEntry = {
  id: BookingIdentifier;
  status: OpsBookingStatus;
  updatedAt?: string | null;
  optimistic?: OptimisticTransition | null;
};

type BookingMachineState = {
  entries: Record<BookingIdentifier, BookingMachineEntry>;
};

type RegisterAction = {
  type: 'REGISTER';
  payload: BookingSnapshot[];
};

type BeginTransitionAction = {
  type: 'BEGIN_TRANSITION';
  payload: {
    id: BookingIdentifier;
    targetStatus: OpsBookingStatus;
    meta?: Record<string, unknown>;
  };
};

type CommitTransitionAction = {
  type: 'COMMIT_TRANSITION';
  payload: BookingSnapshot;
};

type RollbackTransitionAction = {
  type: 'ROLLBACK_TRANSITION';
  payload: { id: BookingIdentifier };
};

type BookingMachineAction =
  | RegisterAction
  | BeginTransitionAction
  | CommitTransitionAction
  | RollbackTransitionAction;

export const bookingStateMachineInitialState: BookingMachineState = {
  entries: {},
};

function applyRegister(state: BookingMachineState, payload: BookingSnapshot[]): BookingMachineState {
  if (payload.length === 0) return state;
  // Short-circuit identical snapshots so consumers don't re-render indefinitely.
  let hasChanges = false;
  let nextEntries = state.entries;

  for (const snapshot of payload) {
    const existing = state.entries[snapshot.id];
    const resolvedUpdatedAt = snapshot.updatedAt ?? existing?.updatedAt ?? null;

    if (!existing) {
      if (!hasChanges) {
        hasChanges = true;
        nextEntries = { ...state.entries };
      }
      nextEntries[snapshot.id] = {
        id: snapshot.id,
        status: snapshot.status,
        updatedAt: resolvedUpdatedAt,
        optimistic: null,
      };
      continue;
    }

    const currentUpdatedAt = existing.updatedAt ?? null;
    const statusChanged = existing.status !== snapshot.status;
    const updatedAtChanged = currentUpdatedAt !== resolvedUpdatedAt;

    if (!statusChanged && !updatedAtChanged) {
      continue;
    }

    if (!hasChanges) {
      hasChanges = true;
      nextEntries = { ...state.entries };
    }

    nextEntries[snapshot.id] = {
      id: snapshot.id,
      status: snapshot.status,
      updatedAt: resolvedUpdatedAt,
      optimistic: existing.optimistic ?? null,
    };
  }

  if (!hasChanges) {
    return state;
  }

  return { entries: nextEntries };
}

function applyBeginTransition(
  state: BookingMachineState,
  payload: BeginTransitionAction['payload'],
): BookingMachineState {
  const entry = state.entries[payload.id];
  if (!entry) {
    return state;
  }
  const optimistic: OptimisticTransition = {
    targetStatus: payload.targetStatus,
    startedAt: Date.now(),
    payload: payload.meta,
  };
  return {
    entries: {
      ...state.entries,
      [payload.id]: {
        ...entry,
        optimistic,
      },
    },
  };
}

function applyCommitTransition(
  state: BookingMachineState,
  payload: CommitTransitionAction['payload'],
): BookingMachineState {
  const entry = state.entries[payload.id];
  if (!entry) {
    return state;
  }
  return {
    entries: {
      ...state.entries,
      [payload.id]: {
        id: payload.id,
        status: payload.status,
        updatedAt: payload.updatedAt ?? null,
        optimistic: null,
      },
    },
  };
}

function applyRollbackTransition(
  state: BookingMachineState,
  payload: RollbackTransitionAction['payload'],
): BookingMachineState {
  const entry = state.entries[payload.id];
  if (!entry || !entry.optimistic) {
    return state;
  }
  return {
    entries: {
      ...state.entries,
      [payload.id]: {
        ...entry,
        optimistic: null,
      },
    },
  };
}

export function bookingMachineReducer(state: BookingMachineState, action: BookingMachineAction): BookingMachineState {
  switch (action.type) {
    case 'REGISTER':
      return applyRegister(state, action.payload);
    case 'BEGIN_TRANSITION':
      return applyBeginTransition(state, action.payload);
    case 'COMMIT_TRANSITION':
      return applyCommitTransition(state, action.payload);
    case 'ROLLBACK_TRANSITION':
      return applyRollbackTransition(state, action.payload);
    default:
      return state;
  }
}

export type BookingStateMachineContextValue = {
  state: BookingMachineState;
  registerBookings: (snapshots: BookingSnapshot[]) => void;
  beginTransition: (
    id: BookingIdentifier,
    targetStatus: OpsBookingStatus,
    meta?: Record<string, unknown>,
  ) => BeginTransitionResult;
  commitTransition: (snapshot: BookingSnapshot) => void;
  rollbackTransition: (id: BookingIdentifier) => void;
  getEntry: (id: BookingIdentifier) => BookingMachineEntry | null;
};

export type BeginTransitionResult =
  | { valid: true; allowedTargets: OpsBookingStatus[] }
  | { valid: false; reason?: string; allowedTargets: OpsBookingStatus[] };

const BookingStateMachineContext = createContext<BookingStateMachineContextValue | null>(null);

export type BookingStateMachineProviderProps = {
  children: ReactNode;
  initialBookings?: BookingSnapshot[];
};

export function BookingStateMachineProvider({ children, initialBookings = [] }: BookingStateMachineProviderProps) {
  const [state, dispatch] = useReducer(bookingMachineReducer, bookingStateMachineInitialState, () =>
    applyRegister(bookingStateMachineInitialState, initialBookings),
  );

  const registerBookings = useCallback((snapshots: BookingSnapshot[]) => {
    if (snapshots.length === 0) return;
    dispatch({ type: 'REGISTER', payload: snapshots });
  }, []);

  const beginTransition = useCallback<BookingStateMachineContextValue['beginTransition']>((id, targetStatus, meta) => {
    const entry = state.entries[id];
    if (!entry) {
      return { valid: false, reason: 'Unknown booking', allowedTargets: [] };
    }
    const validation = validateTransition(entry.optimistic?.targetStatus ?? entry.status, targetStatus, {
      allowSameState: false,
    } satisfies TransitionValidationOptions);
    if (!validation.allowed) {
      return {
        valid: false,
        reason: validation.reason,
        allowedTargets: validation.allowedTargets,
      };
    }
    dispatch({ type: 'BEGIN_TRANSITION', payload: { id, targetStatus, meta } });
    return {
      valid: true,
      allowedTargets: validation.allowedTargets,
    };
  }, [state.entries]);

  const commitTransition = useCallback((snapshot: BookingSnapshot) => {
    dispatch({ type: 'COMMIT_TRANSITION', payload: snapshot });
  }, []);

  const rollbackTransition = useCallback((id: BookingIdentifier) => {
    dispatch({ type: 'ROLLBACK_TRANSITION', payload: { id } });
  }, []);

  const getEntry = useCallback<BookingStateMachineContextValue['getEntry']>(
    (id) => state.entries[id] ?? null,
    [state.entries],
  );

  const value = useMemo<BookingStateMachineContextValue>(
    () => ({
      state,
      registerBookings,
      beginTransition,
      commitTransition,
      rollbackTransition,
      getEntry,
    }),
    [state, registerBookings, beginTransition, commitTransition, rollbackTransition, getEntry],
  );

  return <BookingStateMachineContext.Provider value={value}>{children}</BookingStateMachineContext.Provider>;
}

export function useBookingStateMachine(): BookingStateMachineContextValue {
  const context = useContext(BookingStateMachineContext);
  if (!context) {
    throw new Error('useBookingStateMachine must be used within a BookingStateMachineProvider');
  }
  return context;
}

export function useOptionalBookingStateMachine(): BookingStateMachineContextValue | null {
  return useContext(BookingStateMachineContext);
}

export function useBookingEntry(id: BookingIdentifier): BookingMachineEntry | null {
  const { getEntry } = useBookingStateMachine();
  return getEntry(id);
}

export function deriveEffectiveStatus(entry: BookingMachineEntry | null): OpsBookingStatus | null {
  if (!entry) return null;
  if (entry.optimistic) {
    return entry.optimistic.targetStatus;
  }
  return entry.status;
}

export function getAvailableTransitions(status: OpsBookingStatus): OpsBookingStatus[] {
  return getAllowedTargets(status, { includeSelf: false });
}

export type BookingStateSnapshot = {
  id: BookingIdentifier | null;
  status: OpsBookingStatus | null;
  effectiveStatus: OpsBookingStatus | null;
  optimistic: OptimisticTransition | null;
  isTransitioning: boolean;
  updatedAt: string | null;
};

function computeBookingStateSnapshot(entry: BookingMachineEntry | null): BookingStateSnapshot {
  if (!entry) {
    return {
      id: null,
      status: null,
      effectiveStatus: null,
      optimistic: null,
      isTransitioning: false,
      updatedAt: null,
    };
  }
  const effectiveStatus = deriveEffectiveStatus(entry);
  return {
    id: entry.id,
    status: entry.status,
    effectiveStatus,
    optimistic: entry.optimistic ?? null,
    isTransitioning: Boolean(entry.optimistic),
    updatedAt: entry.updatedAt ?? null,
  };
}

export function useBookingState(id: BookingIdentifier): BookingStateSnapshot {
  const { state } = useBookingStateMachine();
  const entry = state.entries[id] ?? null;
  return useMemo(() => computeBookingStateSnapshot(entry), [entry]);
}

export function useOptionalBookingState(id: BookingIdentifier): BookingStateSnapshot | null {
  const context = useOptionalBookingStateMachine();
  const entry = context?.state.entries[id] ?? null;
  return useMemo(
    () => (context ? computeBookingStateSnapshot(entry) : null),
    [context, entry],
  );
}

export type CommitBookingOptions = {
  status: OpsBookingStatus;
  updatedAt?: string | null;
};

export type BookingActionDispatchers = {
  begin: (targetStatus: OpsBookingStatus, meta?: Record<string, unknown>) => BeginTransitionResult;
  commit: (options: CommitBookingOptions) => void;
  rollback: () => void;
  allowedTargets: OpsBookingStatus[];
  currentStatus: OpsBookingStatus | null;
  effectiveStatus: OpsBookingStatus | null;
  isTransitioning: boolean;
};

export function useBookingActions(id: BookingIdentifier): BookingActionDispatchers {
  const context = useBookingStateMachine();
  const entry = context.state.entries[id] ?? null;
  const effectiveStatus = deriveEffectiveStatus(entry);
  const allowedTargets = useMemo(
    () => (effectiveStatus ? getAvailableTransitions(effectiveStatus) : []),
    [effectiveStatus],
  );

  const begin = useCallback(
    (targetStatus: OpsBookingStatus, meta?: Record<string, unknown>) =>
      context.beginTransition(id, targetStatus, meta),
    [context, id],
  );

  const commit = useCallback(
    ({ status, updatedAt }: CommitBookingOptions) =>
      context.commitTransition({
        id,
        status,
        updatedAt: updatedAt ?? null,
      }),
    [context, id],
  );

  const rollback = useCallback(() => context.rollbackTransition(id), [context, id]);

  return useMemo<BookingActionDispatchers>(
    () => ({
      begin,
      commit,
      rollback,
      allowedTargets,
      currentStatus: entry?.status ?? null,
      effectiveStatus,
      isTransitioning: Boolean(entry?.optimistic),
    }),
    [allowedTargets, begin, commit, rollback, entry, effectiveStatus],
  );
}

export function useOptionalBookingActions(id: BookingIdentifier): BookingActionDispatchers | null {
  const context = useOptionalBookingStateMachine();
  const entry = context?.state.entries[id] ?? null;
  const effectiveStatus = deriveEffectiveStatus(entry);
  const allowedTargets = useMemo(
    () => (effectiveStatus ? getAvailableTransitions(effectiveStatus) : []),
    [effectiveStatus],
  );

  const begin = useCallback(
    (targetStatus: OpsBookingStatus, meta?: Record<string, unknown>) => {
      if (!context) {
        const invalid: BeginTransitionResult = { valid: false, allowedTargets: [] };
        return invalid;
      }
      return context.beginTransition(id, targetStatus, meta);
    },
    [context, id],
  );

  const commit = useCallback(
    ({ status, updatedAt }: CommitBookingOptions) => {
      if (!context) {
        return;
      }
      context.commitTransition({
        id,
        status,
        updatedAt: updatedAt ?? null,
      });
    },
    [context, id],
  );

  const rollback = useCallback(() => {
    if (!context) {
      return;
    }
    context.rollbackTransition(id);
  }, [context, id]);

  return useMemo<BookingActionDispatchers | null>(
    () =>
      context
        ? {
            begin,
            commit,
            rollback,
            allowedTargets,
            currentStatus: entry?.status ?? null,
            effectiveStatus,
            isTransitioning: Boolean(entry?.optimistic),
          }
        : null,
    [allowedTargets, begin, commit, rollback, context, entry, effectiveStatus],
  );
}
