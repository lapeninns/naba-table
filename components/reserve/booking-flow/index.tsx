"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { track } from "@/lib/analytics";
import { configureQueryPersistence } from "@/lib/query/persist";
import { WizardDependenciesProvider } from "@features/reservations/wizard/di";
import { useWizardStore } from "@features/reservations/wizard/model/store";
import { BookingWizard } from "@features/reservations/wizard/ui/BookingWizard";

import type { WizardStep } from "@features/reservations/wizard/model/reducer";
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
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  // Keep the wizard step in the URL (?step=plan|details|review|confirm) for shareability and proper history.
  const { state, actions } = useWizardStore();

  // Map between numeric steps and string slugs
  const stepToSlug = (step: WizardStep) => {
    switch (step) {
      case 1: return "plan";
      case 2: return "details";
      case 3: return "review";
      case 4: return "confirm";
      default: return "plan";
    }
  };
  const slugToStep = (slug: string | null): WizardStep => {
    switch (slug) {
      case "plan": return 1;
      case "details": return 2;
      case "review": return 3;
      case "confirm": return 4;
      default: return 1;
    }
  };

  // On mount, hydrate step from URL (if present)
  useEffect(() => {
    const urlStep = searchParams?.get("step");
    if (urlStep) {
      const parsed = slugToStep(urlStep);
      if (parsed !== state.step) {
        actions.goToStep(parsed);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When step changes, reflect it in the URL (shallow replace)
  useEffect(() => {
    if (!pathname) return;
    const current = searchParams ? new URLSearchParams(searchParams.toString()) : new URLSearchParams();
    const nextSlug = stepToSlug(state.step);
    if (current.get("step") !== nextSlug) {
      current.set("step", nextSlug);
      const href = `${pathname}?${current.toString()}`;
      router.replace(href);
    }
  }, [state.step, pathname, searchParams, router]);

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
      <BookingWizardWithNavigator
        initialDetails={initialDetails}
        mode={mode}
        layoutElement={layoutElement}
      />
    </BookingFlowProviders>
  );
}
