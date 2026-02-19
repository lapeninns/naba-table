type ExceptionListItem = {
  value?: unknown;
};

type PosthogEventLike = {
  event?: unknown;
  properties?: {
    $exception_values?: unknown;
    $exception_list?: unknown;
  };
};

type PosthogSuppressionKey = 'indexeddb_update_object_not_found';

type PosthogSuppressionDebugEntry = {
  key: PosthogSuppressionKey;
  message: string;
  path: string;
  at: string;
};

type PosthogSuppressionDebugState = {
  suppressedCountByKey: Record<PosthogSuppressionKey, number>;
  recentSuppressed: PosthogSuppressionDebugEntry[];
};

type PosthogSuppressionMatch = {
  key: PosthogSuppressionKey;
  message: string;
};

const POSTHOG_SUPPRESSION_DEBUG_WINDOW_KEY = '__srxPosthogSuppressionDebug';
const POSTHOG_SUPPRESSION_RECENT_LIMIT = 20;
const NOISY_INDEXED_DB_UPDATE_REJECTION_PATTERN =
  /Object Not Found Matching Id:\d+,\s*MethodName:update,\s*ParamCount:4/i;

function extractExceptionValues(event: PosthogEventLike): string[] {
  const values = event.properties?.$exception_values;
  if (Array.isArray(values)) {
    return values.filter((value): value is string => typeof value === 'string');
  }

  if (typeof values === 'string') {
    return [values];
  }

  const exceptionList = event.properties?.$exception_list;
  if (!Array.isArray(exceptionList)) {
    return [];
  }

  return exceptionList
    .map((entry) => {
      if (typeof entry !== 'object' || !entry) return null;
      const value = (entry as ExceptionListItem).value;
      return typeof value === 'string' ? value : null;
    })
    .filter((value): value is string => Boolean(value));
}

function getPathnameWithSearch(): string {
  if (typeof window === 'undefined') {
    return 'server';
  }

  return `${window.location.pathname}${window.location.search}`;
}

function readSuppressionDebugState(win: Window): PosthogSuppressionDebugState {
  const typedWindow = win as Window & {
    [POSTHOG_SUPPRESSION_DEBUG_WINDOW_KEY]?: PosthogSuppressionDebugState;
  };

  const existing = typedWindow[POSTHOG_SUPPRESSION_DEBUG_WINDOW_KEY];
  if (existing) {
    return existing;
  }

  const initialState: PosthogSuppressionDebugState = {
    suppressedCountByKey: {
      indexeddb_update_object_not_found: 0,
    },
    recentSuppressed: [],
  };
  typedWindow[POSTHOG_SUPPRESSION_DEBUG_WINDOW_KEY] = initialState;
  return initialState;
}

export function getPosthogSuppressionDebugState(): PosthogSuppressionDebugState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // Debug access in browser console:
  // window.__srxPosthogSuppressionDebug
  return readSuppressionDebugState(window);
}

export function recordSuppressedPosthogException(match: PosthogSuppressionMatch): void {
  if (typeof window === 'undefined') {
    return;
  }

  const state = readSuppressionDebugState(window);
  state.suppressedCountByKey[match.key] += 1;
  state.recentSuppressed.unshift({
    key: match.key,
    message: match.message,
    path: getPathnameWithSearch(),
    at: new Date().toISOString(),
  });

  if (state.recentSuppressed.length > POSTHOG_SUPPRESSION_RECENT_LIMIT) {
    state.recentSuppressed = state.recentSuppressed.slice(0, POSTHOG_SUPPRESSION_RECENT_LIMIT);
  }
}

export function matchPosthogExceptionSuppression(
  event: PosthogEventLike | null | undefined,
): PosthogSuppressionMatch | null {
  if (!event || event.event !== '$exception') {
    return null;
  }

  const values = extractExceptionValues(event);
  const matchedValue = values.find((value) => NOISY_INDEXED_DB_UPDATE_REJECTION_PATTERN.test(value));
  if (!matchedValue) {
    return null;
  }

  return {
    key: 'indexeddb_update_object_not_found',
    message: matchedValue,
  };
}

/**
 * Suppresses recurring non-actionable browser storage update rejections that
 * are noisy in production telemetry and not attributable to app business logic.
 */
export function shouldSuppressPosthogExceptionEvent(event: PosthogEventLike | null | undefined): boolean {
  return matchPosthogExceptionSuppression(event) !== null;
}
