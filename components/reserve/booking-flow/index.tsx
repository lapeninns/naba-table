"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState, type PropsWithChildren } from "react";

import { WizardDependenciesProvider } from "@features/reservations/wizard/di";
import { BookingWizard } from "@features/reservations/wizard/ui/BookingWizard";
import { track } from "@/lib/analytics";

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

function BookingWizardWithNavigator() {
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
      <BookingWizard />
    </WizardDependenciesProvider>
  );
}

export default function BookingFlowPage() {
  return (
    <BookingFlowProviders>
      <BookingWizardWithNavigator />
    </BookingFlowProviders>
  );
}
