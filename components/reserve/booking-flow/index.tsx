"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { WizardDependenciesProvider } from "@features/reservations/wizard/di";
import { BookingWizard } from "@features/reservations/wizard/ui/BookingWizard";
import { track } from "@/lib/analytics";
import { configureQueryPersistence } from "@/lib/query/persist";
import type { BookingDetails, BookingWizardMode } from "@features/reservations/wizard/model/reducer";

const defaultQueryOptions = {
  queries: {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  },
};

function BookingFlowProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: defaultQueryOptions }));
  useEffect(() => configureQueryPersistence(queryClient, { storageKey: "reserve.booking-flow.cache" }), [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

type BookingWizardWithNavigatorProps = {
  initialDetails?: Partial<BookingDetails>;
  mode?: BookingWizardMode;
  layoutElement?: "main" | "div";
};

function BookingWizardWithNavigator({ initialDetails, mode = "customer", layoutElement = "main" }: BookingWizardWithNavigatorProps) {
  const router = useRouter();

  const dependencies = useMemo(
    () => ({
      analytics: {
        track,
      },
      navigator: {
        push: (path: string) => router.push(path),
        replace: (path: string) => router.replace(path),
        back: () => router.back(),
      },
    }),
    [router],
  );

  return (
    <WizardDependenciesProvider value={dependencies}>
      <BookingWizard initialDetails={initialDetails} mode={mode} layoutElement={layoutElement} />
    </WizardDependenciesProvider>
  );
}

type BookingFlowPageProps = {
  initialDetails?: Partial<BookingDetails>;
  mode?: BookingWizardMode;
  layoutElement?: "main" | "div";
};

export default function BookingFlowPage({ initialDetails, mode = "customer", layoutElement = "main" }: BookingFlowPageProps = {}) {
  return (
    <BookingFlowProviders>
      <BookingWizardWithNavigator initialDetails={initialDetails} mode={mode} layoutElement={layoutElement} />
    </BookingFlowProviders>
  );
}
