'use client';

import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';

import { DEFAULT_RESERVATION_INTERVAL_MINUTES } from '@reserve/shared/config/reservations';

import type {
  AccountDetails,
  OnboardingState,
  OnboardingStep,
  OperatingHour,
  RestaurantProfile,
  ServicePeriod,
  TableInventoryItem,
  Zone,
} from '../types';

const DEFAULT_TIMEZONE = 'Europe/London';
const STORAGE_KEY = 'nabatable:onboarding:draft:v1';

const DEFAULT_STATE: OnboardingState = {
  step: 1,
  restaurantId: null,
  account: undefined,
  profile: {
    name: '',
    slug: '',
    timezone: DEFAULT_TIMEZONE,
    contactEmail: '',
    contactPhone: '',
    reservationIntervalMinutes: DEFAULT_RESERVATION_INTERVAL_MINUTES,
    reservationDefaultDurationMinutes: 90,
    reservationLastSeatingBufferMinutes: 120,
    emailSendReminder24h: true,
    emailSendReminderShort: true,
    emailSendReviewRequest: true,
  },
  operatingHours: Array.from({ length: 7 }).map((_, index) => ({
    dayOfWeek: index,
    opensAt: null,
    closesAt: null,
    isClosed: true,
    notes: null,
  })),
  servicePeriods: [],
  zones: [],
  tables: [],
  loading: false,
  error: null,
};

type Action =
  | { type: 'SET_STEP'; step: OnboardingStep }
  | { type: 'SET_ACCOUNT'; account: AccountDetails }
  | { type: 'SET_RESTAURANT'; restaurantId: string }
  | { type: 'SET_PROFILE'; profile: RestaurantProfile }
  | { type: 'SET_OPERATING_HOURS'; hours: OperatingHour[] }
  | { type: 'SET_SERVICE_PERIODS'; periods: ServicePeriod[] }
  | { type: 'SET_ZONES'; zones: Zone[] }
  | { type: 'SET_TABLES'; tables: TableInventoryItem[] }
  | { type: 'SET_LOADING'; value: boolean }
  | { type: 'SET_ERROR'; message: string | null }
  | { type: 'RESET'; initial?: Partial<OnboardingState> };

function reducer(state: OnboardingState, action: Action): OnboardingState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step };
    case 'SET_ACCOUNT':
      return { ...state, account: action.account };
    case 'SET_RESTAURANT':
      return { ...state, restaurantId: action.restaurantId };
    case 'SET_PROFILE':
      return { ...state, profile: action.profile };
    case 'SET_OPERATING_HOURS':
      return { ...state, operatingHours: action.hours };
    case 'SET_SERVICE_PERIODS':
      return { ...state, servicePeriods: action.periods };
    case 'SET_ZONES':
      return { ...state, zones: action.zones };
    case 'SET_TABLES':
      return { ...state, tables: action.tables };
    case 'SET_LOADING':
      return { ...state, loading: action.value };
    case 'SET_ERROR':
      return { ...state, error: action.message };
    case 'RESET':
      return { ...DEFAULT_STATE, ...action.initial };
    default:
      return state;
  }
}

function isOnboardingStep(value: unknown): value is OnboardingStep {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6;
}

function sanitizePersistedState(value: unknown): Partial<OnboardingState> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const source = value as Partial<OnboardingState>;
  return {
    ...source,
    step: isOnboardingStep(source.step) ? source.step : DEFAULT_STATE.step,
    loading: false,
    error: null,
  };
}

function getInitialState(initialState?: Partial<OnboardingState>): OnboardingState {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_STATE, ...initialState };
  }

  try {
    const persistedRaw = window.sessionStorage.getItem(STORAGE_KEY);
    const persisted = persistedRaw ? sanitizePersistedState(JSON.parse(persistedRaw)) : {};
    return { ...DEFAULT_STATE, ...persisted, ...initialState };
  } catch {
    return { ...DEFAULT_STATE, ...initialState };
  }
}

export type OnboardingContextValue = {
  state: OnboardingState;
  setStep: (step: OnboardingStep) => void;
  setAccount: (account: AccountDetails) => void;
  setRestaurantId: (restaurantId: string) => void;
  setProfile: (profile: RestaurantProfile) => void;
  setOperatingHours: (hours: OperatingHour[]) => void;
  setServicePeriods: (periods: ServicePeriod[]) => void;
  setZones: (zones: Zone[]) => void;
  setTables: (tables: TableInventoryItem[]) => void;
  setLoading: (value: boolean) => void;
  setError: (message: string | null) => void;
  reset: (initial?: Partial<OnboardingState>) => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({
  children,
  initialState,
}: {
  children: React.ReactNode;
  initialState?: Partial<OnboardingState>;
}) {
  const [state, dispatch] = useReducer(reducer, initialState, getInitialState);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const persistedState: OnboardingState = {
      ...state,
      loading: false,
      error: null,
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  }, [state]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      state,
      setStep: (step) => dispatch({ type: 'SET_STEP', step }),
      setAccount: (account) => dispatch({ type: 'SET_ACCOUNT', account }),
      setRestaurantId: (restaurantId) => dispatch({ type: 'SET_RESTAURANT', restaurantId }),
      setProfile: (profile) => dispatch({ type: 'SET_PROFILE', profile }),
      setOperatingHours: (hours) => dispatch({ type: 'SET_OPERATING_HOURS', hours }),
      setServicePeriods: (periods) => dispatch({ type: 'SET_SERVICE_PERIODS', periods }),
      setZones: (zones) => dispatch({ type: 'SET_ZONES', zones }),
      setTables: (tables) => dispatch({ type: 'SET_TABLES', tables }),
      setLoading: (value) => dispatch({ type: 'SET_LOADING', value }),
      setError: (message) => dispatch({ type: 'SET_ERROR', message }),
      reset: (initial) => dispatch({ type: 'RESET', initial }),
    }),
    [state],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return ctx;
}
