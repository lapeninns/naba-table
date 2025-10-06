"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState, type PropsWithChildren } from "react";

import { WizardDependenciesProvider } from "@features/reservations/wizard/di";
import { BookingWizard } from "@features/reservations/wizard/ui/BookingWizard";
import { track } from "@/lib/analytics";
import type { BookingDetails } from "@features/reservations/wizard/model/reducer";

const defaultQueryOptions = {
  queries: {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  },
};

function BookingFlowProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: defaultQueryOptions }));

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

type BookingWizardWithNavigatorProps = {
  initialDetails?: Partial<BookingDetails>;
};

function BookingWizardWithNavigator({ initialDetails }: BookingWizardWithNavigatorProps) {
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
      <BookingWizard initialDetails={initialDetails} />
    </WizardDependenciesProvider>
  );
}

type BookingFlowPageProps = {
  initialDetails?: Partial<BookingDetails>;
};

export default function BookingFlowPage({ initialDetails }: BookingFlowPageProps = {}) {
  return (
    <BookingFlowProviders>
      <BookingWizardWithNavigator initialDetails={initialDetails} />
    </BookingFlowProviders>
  );
}
