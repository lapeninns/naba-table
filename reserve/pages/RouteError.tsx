'use client';

import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

import { Icon } from '@reserve/shared/ui/icons';
import { env } from '@shared/config/env';

export function ReserveErrorBoundary() {
  const error = useRouteError();

  let title = 'Something went wrong';
  let description = 'Please refresh the page or try again shortly.';

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    description = error.data?.message ?? description;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-16 text-center text-slate-700">
      <Icon.AlertCircle className="mb-4 h-10 w-10 text-red-500" aria-hidden />
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-md text-base text-slate-600">{description}</p>
      <button
        type="button"
        onClick={() => window.location.assign(env.ROUTER_BASE_PATH)}
        className="mt-6 rounded-md bg-srx-ink-strong px-4 py-2 text-white hover:bg-srx-ink-strong/90"
      >
        Retry
      </button>
    </main>
  );
}
