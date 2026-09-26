import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ZodError } from 'zod';

import { HttpError } from '@/lib/http/errors';
import { toUserMessage } from '@/lib/http/userMessage';
import {
  applyQueryDefaults,
  DEFAULT_QUERY_GC_TIME,
  DEFAULT_QUERY_STALE_TIME,
} from '@/lib/query/staleTimes';

import type { AppMutationMeta } from '@/lib/query/meta';

const MAX_QUERY_RETRIES = 2;

/**
 * Retries only failures that can succeed on a second attempt: network errors, 5xx, 408 and 429.
 * Other 4xx answers (a 401 would also re-trigger the sign-in redirect per attempt), unparseable
 * responses and schema validation errors fail at once.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) {
    return false;
  }
  if (error instanceof HttpError) {
    return (
      error.status >= 500 ||
      error.status === 408 ||
      error.status === 429 ||
      error.code === 'READ_ERROR'
    );
  }
  return !(error instanceof ZodError);
}

/** The toast surface used for mutation feedback; injectable so tests need no DOM toaster. */
export type MutationToastNotifier = {
  success: (message: string) => void;
  error: (message: string) => void;
};

const sonnerNotifier: MutationToastNotifier = {
  success: (message) => {
    toast.success(message);
  },
  error: (message) => {
    toast.error(message);
  },
};

function resolveSuccessMessage(
  feedback: NonNullable<AppMutationMeta['feedback']>,
  data: unknown,
  variables: unknown,
): string | null {
  const { success } = feedback;
  if (success === undefined) return null;
  if (typeof success === 'string') return success;
  try {
    return success(data, variables);
  } catch {
    // A broken copy function must never turn a successful mutation into a failure.
    return null;
  }
}

function resolveErrorMessage(
  feedback: NonNullable<AppMutationMeta['feedback']>,
  error: unknown,
): string | null {
  const { error: errorFeedback } = feedback;
  if (errorFeedback === false) return null;
  if (typeof errorFeedback === 'string') return errorFeedback;
  return toUserMessage(error, errorFeedback ?? {});
}

/**
 * Global mutation feedback (contract C3): one toast per settled mutation, and only for
 * mutations that opt in through `meta.feedback`, so hooks without it keep their behaviour.
 */
export function createMutationFeedbackCache(notify: MutationToastNotifier): MutationCache {
  return new MutationCache({
    onSuccess: (data, variables, _onMutateResult, mutation) => {
      const feedback = mutation.meta?.feedback;
      if (!feedback) return;
      const message = resolveSuccessMessage(feedback, data, variables);
      if (message) notify.success(message);
    },
    onError: (error, _variables, _onMutateResult, mutation) => {
      const feedback = mutation.meta?.feedback;
      if (!feedback) return;
      const message = resolveErrorMessage(feedback, error);
      if (message) notify.error(message);
    },
  });
}

export type CreateAppQueryClientOptions = {
  notify?: MutationToastNotifier;
};

export function createAppQueryClient(options: CreateAppQueryClientOptions = {}): QueryClient {
  const queryClient = new QueryClient({
    mutationCache: createMutationFeedbackCache(options.notify ?? sonnerNotifier),
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
        refetchOnWindowFocus: false,
        staleTime: DEFAULT_QUERY_STALE_TIME,
        gcTime: DEFAULT_QUERY_GC_TIME,
      },
      mutations: {
        // Writes are not idempotent by default; hooks that are safe to retry opt in.
        retry: 0,
        networkMode: 'online',
      },
    },
  });
  applyQueryDefaults(queryClient);
  return queryClient;
}
