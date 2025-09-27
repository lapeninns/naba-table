'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { track } from '@/lib/analytics';
import { DEFAULT_RESTAURANT_ID } from '@/lib/venue';
import { useStickyProgress } from '@reserve/shared/hooks/useStickyProgress';
import { triggerSubtleHaptic } from '@reserve/shared/lib/haptics';
import { bookingHelpers, storageKeys } from '@reserve/shared/utils/booking';

import { useCreateReservation } from '../api/useCreateReservation';
import { getInitialState, reducer } from '../model/reducer';

import type { ApiBooking, ReservationDraft, StepAction } from '../model/reducer';
import type { Reservation } from '@entities/reservation/reservation.schema';

const EMPTY_ACTIONS: StepAction[] = [];

export function useReservationWizard() {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);
  const { rememberDetails, name, email, phone } = state.details;
  const heroRef = useRef<HTMLSpanElement | null>(null);
  const [stickyActions, setStickyActions] = useState<StepAction[]>(EMPTY_ACTIONS);
  const [stickyHeight, setStickyHeight] = useState(0);

  const stepsMeta = useMemo(
    () => [
      { id: 1, label: 'Plan', helper: 'Pick date, time, and party' },
      { id: 2, label: 'Details', helper: 'Share contact information' },
      { id: 3, label: 'Review', helper: 'Double-check and confirm' },
      { id: 4, label: 'Confirmation', helper: 'Your reservation status' },
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
      if (
        prev.length === actions.length &&
        prev.every((action, index) => {
          const next = actions[index];
          return (
            action.id === next.id &&
            action.label === next.label &&
            action.variant === next.variant &&
            action.disabled === next.disabled &&
            action.loading === next.loading
          );
        })
      ) {
        return prev;
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log('[reserve][sticky-actions] updating', { prev, next: actions });
      }
      return actions;
    });
  }, []);

  useEffect(() => {
    setStickyActions(EMPTY_ACTIONS);
  }, [state.step]);

  const selectionSummary = useMemo(() => {
    const formattedDate = state.details.date
      ? bookingHelpers.formatSummaryDate(state.details.date)
      : 'Date not selected';
    const formattedTime = state.details.time
      ? bookingHelpers.formatTime(state.details.time)
      : 'Time not selected';
    const partyText = `${state.details.party} ${state.details.party === 1 ? 'guest' : 'guests'}`;
    const serviceLabel = bookingHelpers.formatBookingLabel(state.details.bookingType);
    const details = [partyText, formattedTime, formattedDate];
    return {
      primary: serviceLabel,
      details,
      srLabel: `${serviceLabel}. ${details.join(', ')}`,
    };
  }, [state.details.bookingType, state.details.date, state.details.party, state.details.time]);

  // Load remembered contact details
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(storageKeys.contacts);
      if (stored) {
        const parsed = JSON.parse(stored) as { name: string; email: string; phone: string };
        if (parsed.name || parsed.email || parsed.phone) {
          dispatch({ type: 'HYDRATE_CONTACTS', payload: { ...parsed, rememberDetails: true } });
        }
      }
    } catch (error) {
      console.error('Failed to load contact details', error);
    }
  }, []);

  // Persist remembered contacts with explicit consent
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (rememberDetails) {
        window.localStorage.setItem(storageKeys.contacts, JSON.stringify({ name, email, phone }));
      } else {
        window.localStorage.removeItem(storageKeys.contacts);
      }
    } catch (error) {
      console.error('Failed to persist contact details', error);
    }
  }, [rememberDetails, name, email, phone]);

  const mutation = useCreateReservation();
  const submitting = state.submitting || mutation.isPending;

  const toApiBooking = useCallback(
    (reservation: Reservation): ApiBooking => ({
      id: reservation.id,
      restaurant_id: reservation.restaurantId,
      customer_id: 'unknown',
      table_id: null,
      booking_date: reservation.bookingDate,
      start_time: reservation.startTime,
      end_time: reservation.endTime ?? reservation.startTime,
      reference: reservation.reference ?? '',
      party_size: reservation.partySize,
      booking_type: reservation.bookingType as ApiBooking['booking_type'],
      seating_preference: reservation.seatingPreference as ApiBooking['seating_preference'],
      status: reservation.status,
      customer_name: reservation.customerName,
      customer_email: reservation.customerEmail,
      customer_phone: reservation.customerPhone,
      notes: reservation.notes ?? null,
      source: 'app',
      marketing_opt_in: reservation.marketingOptIn,
      loyalty_points_awarded: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    [],
  );

  const buildDraft = useCallback((): ReservationDraft | null => {
    const normalizedTime = bookingHelpers.normalizeTime(state.details.time);

    if (!normalizedTime) {
      dispatch({ type: 'SET_ERROR', message: 'Please select a time for your reservation.' });
      return null;
    }

    return {
      restaurantId: state.details.restaurantId || DEFAULT_RESTAURANT_ID,
      date: state.details.date,
      time: normalizedTime,
      party: Math.max(1, state.details.party),
      bookingType:
        state.details.bookingType === 'drinks'
          ? 'drinks'
          : bookingHelpers.bookingTypeFromTime(normalizedTime, state.details.date),
      seating: state.details.seating,
      notes: state.details.notes ? state.details.notes : null,
      name: state.details.name.trim(),
      email: state.details.email.trim(),
      phone: state.details.phone.trim(),
      marketingOptIn: state.details.marketingOptIn,
    };
  }, [state.details]);

  const handleConfirm = useCallback(async () => {
    const draft = buildDraft();
    if (!draft) return;

    dispatch({ type: 'SET_ERROR', message: null });
    dispatch({ type: 'SET_SUBMITTING', value: true });

    try {
      const result = await mutation.mutateAsync({ draft, bookingId: state.editingId ?? undefined });

      dispatch({
        type: 'SET_CONFIRMATION',
        payload: {
          bookings: result.bookings.map(toApiBooking),
          booking: result.booking ? toApiBooking(result.booking) : null,
          lastAction: result.booking ? (state.editingId ? 'update' : 'create') : 'waitlist',
          waitlisted: result.waitlisted,
          allocationPending: result.allocationPending,
        },
      });

      track('booking_created', {
        waitlisted: result.waitlisted ? 1 : 0,
        allocation_pending: result.allocationPending ? 1 : 0,
        party: draft.party,
        start_time: draft.time,
        reference: result.booking?.reference ?? 'pending',
      });
    } catch (error) {
      const message =
        typeof error === 'object' && error && 'message' in error
          ? String((error as { message?: unknown }).message)
          : 'Unable to process booking';
      dispatch({ type: 'SET_ERROR', message });
      dispatch({ type: 'SET_SUBMITTING', value: false });
    }
  }, [buildDraft, mutation, state.editingId, dispatch, toApiBooking]);

  const handleNewBooking = useCallback(() => {
    dispatch({ type: 'SET_ERROR', message: null });
    dispatch({ type: 'RESET_FORM' });
  }, []);

  const handleClose = useCallback(() => {
    navigate('/thank-you');
  }, [navigate]);

  return {
    state,
    dispatch,
    heroRef,
    stepsMeta,
    stickyVisible,
    stickyActions,
    stickyHeight,
    handleStickyHeightChange,
    handleActionsChange,
    selectionSummary,
    handleConfirm,
    handleNewBooking,
    handleClose,
    isSubmitting: submitting,
  };
}
