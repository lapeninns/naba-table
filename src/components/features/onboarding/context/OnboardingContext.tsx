'use client';

import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';

import { DEFAULT_RESERVATION_INTERVAL_MINUTES } from '@reserve/shared/config/reservations';

import { applyServerResume } from '../onboardingResume';

import type {
  AccountDetails,
  OnboardingResume,
  OnboardingState,
  OnboardingStep,
  OperatingHour,
  RestaurantProfile,
  ServicePeriod,
  TableInventoryItem,
  Zone,
} from '../types';

const DEFAULT_TIMEZONE = 'Europe/London';
export const ONBOARDING_DRAFT_STORAGE_KEY = 'nabatable:onboarding:draft:v1';
const STORAGE_KEY = ONBOARDING_DRAFT_STORAGE_KEY;

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
      return { ...state, account: redactAccountDetails(action.account) };
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

function redactAccountDetails(account: AccountDetails | undefined): AccountDetails | undefined {
  if (!account) {
    return undefined;
  }

  return {
    email: account.email,
    mode: account.mode,
  };
}

function isOnboardingStep(value: unknown): value is OnboardingStep {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6;
}

/** Drops the fields the server supplies on each render (`session`, `alreadyOnboarded`). */
function withoutServerFacts(value: Partial<OnboardingState>): Partial<OnboardingState> {
  const copy: Partial<OnboardingState> = { ...value };
  delete copy.session;
  delete copy.alreadyOnboarded;
  return copy;
}

function sanitizePersistedState(value: unknown): Partial<OnboardingState> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  // Session facts come from the server on every render and are never restored.
  const source = withoutServerFacts(value as Partial<OnboardingState>);
  return {
    ...source,
    account: redactAccountDetails(source.account),
    step: isOnboardingStep(source.step) ? source.step : DEFAULT_STATE.step,
    loading: false,
    error: null,
  };
}

type InitArgs = { initialState?: Partial<OnboardingState>; resume?: OnboardingResume };

function readPersistedDraft(): Partial<OnboardingState> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const persistedRaw = window.sessionStorage.getItem(STORAGE_KEY);
    return persistedRaw ? sanitizePersistedState(JSON.parse(persistedRaw)) : {};
  } catch {
    return {};
  }
}

function getInitialState({ initialState, resume }: InitArgs): OnboardingState {
  const draft: OnboardingState = { ...DEFAULT_STATE, ...readPersistedDraft(), ...initialState };
  return applyServerResume(draft, resume, DEFAULT_STATE);
}

function persistDraft(state: OnboardingState) {
  const draft = withoutServerFacts(state);
  const persistedState = {
    ...draft,
    account: redactAccountDetails(state.account),
    loading: false,
    error: null,
  };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  } catch {
    // Storage can be unavailable (private mode, quota); the wizard still works in memory.
  }
}

/** Removes the stored draft, e.g. after launch. */
export function clearPersistedOnboardingDraft() {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
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
  /**
   * Deletes the stored draft and stops persisting it (used right before leaving the
   * wizard after launch). In-memory state is kept so the page does not re-route while
   * the browser navigates away.
   */
  discardDraft: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({
  children,
  initialState,
  resume,
}: {
  children: React.ReactNode;
  initialState?: Partial<OnboardingState>;
  resume?: OnboardingResume;
}) {
  const [state, dispatch] = useReducer(reducer, { initialState, resume }, getInitialState);
  const clearedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || clearedRef.current) {
      return;
    }
    persistDraft(state);
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
      discardDraft: () => {
        clearedRef.current = true;
        clearPersistedOnboardingDraft();
      },
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
