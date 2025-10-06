import { useCallback, useMemo, useReducer, useRef } from 'react';

import {
  getInitialDetails,
  getInitialState,
  reducer,
  type Action,
  type BookingDetails,
  type State,
  type WizardStep,
} from './reducer';

import type { Dispatch } from 'react';

export type ConfirmationPayload = {
  bookings: State['bookings'];
  booking: State['lastConfirmed'];
  lastAction: Exclude<State['lastAction'], null>;
  waitlisted: boolean;
  allocationPending: boolean;
};

export type WizardActions = {
  goToStep: (step: WizardStep) => void;
  updateDetails: <Key extends keyof BookingDetails>(key: Key, value: BookingDetails[Key]) => void;
  setSubmitting: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setError: (message: string | null) => void;
  clearError: () => void;
  setBookings: (bookings: State['bookings']) => void;
  applyConfirmation: (payload: ConfirmationPayload) => void;
  startEdit: (bookingId: string) => void;
  resetForm: () => void;
  hydrateContacts: (
    payload: Pick<BookingDetails, 'name' | 'email' | 'phone'> & { rememberDetails?: boolean },
  ) => void;
};

const createActions = (
  dispatch: Dispatch<Action>,
  resolveInitialDetails: () => Partial<BookingDetails> | undefined,
): WizardActions => ({
  goToStep: (step) => dispatch({ type: 'SET_STEP', step }),
  updateDetails: (key, value) => dispatch({ type: 'SET_FIELD', key, value }),
  setSubmitting: (value) => dispatch({ type: 'SET_SUBMITTING', value }),
  setLoading: (value) => dispatch({ type: 'SET_LOADING', value }),
  setError: (message) => dispatch({ type: 'SET_ERROR', message }),
  clearError: () => dispatch({ type: 'SET_ERROR', message: null }),
  setBookings: (bookings) => dispatch({ type: 'SET_BOOKINGS', bookings }),
  applyConfirmation: (payload) =>
    dispatch({
      type: 'SET_CONFIRMATION',
      payload: {
        bookings: payload.bookings,
        booking: payload.booking,
        lastAction: payload.lastAction,
        waitlisted: payload.waitlisted,
        allocationPending: payload.allocationPending,
      },
    }),
  startEdit: (bookingId) => dispatch({ type: 'START_EDIT', bookingId }),
  resetForm: () => dispatch({ type: 'RESET_FORM', initialDetails: resolveInitialDetails() }),
  hydrateContacts: (payload) => dispatch({ type: 'HYDRATE_CONTACTS', payload }),
});

export const useWizardStore = (initialDetails?: Partial<BookingDetails>) => {
  const initialSnapshotRef = useRef<BookingDetails | null>(null);

  if (initialSnapshotRef.current === null) {
    initialSnapshotRef.current = getInitialDetails(initialDetails);
  }

  const [state, dispatch] = useReducer(reducer, initialSnapshotRef.current, (overrides) =>
    getInitialState(overrides ?? undefined),
  );

  const resolveInitialDetails = useCallback(() => initialSnapshotRef.current ?? undefined, []);

  const actions = useMemo(
    () => createActions(dispatch, resolveInitialDetails),
    [dispatch, resolveInitialDetails],
  );

  return { state, actions } as const;
};

export type WizardStore = ReturnType<typeof useWizardStore>;
