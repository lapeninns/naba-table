"use client";

import Link from "next/link";
import { useMemo } from "react";


import { buttonVariants } from "@/components/ui/button";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { cn } from "@/lib/utils";

import type { VariantProps } from "class-variance-authority";

type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
type ButtonSize = VariantProps<typeof buttonVariants>["size"];

type Action = {
  href: string;
  label: string;
  ariaLabel?: string;
};

type ResolveResult = {
  primary: Action;
  secondary?: Action;
};

type MarketingSessionActionsProps = {
  mode?: "booking" | "account";
  size?: Extract<ButtonSize, "sm" | "primary" | "lg">;
  showSecondary?: boolean;
  className?: string;
  primaryVariant?: ButtonVariant;
  secondaryVariant?: ButtonVariant;
};

const defaultsByMode: Record<NonNullable<MarketingSessionActionsProps["mode"]>, {
  primary: ButtonVariant;
  secondary: ButtonVariant;
  showSecondary: boolean;
}> = {
  booking: {
    primary: "default",
    secondary: "outline",
    showSecondary: true,
  },
  account: {
    primary: "default",
    secondary: "outline",
    showSecondary: false,
  },
};

function resolveActions(mode: "booking" | "account", isAuthenticated: boolean): ResolveResult {
  if (mode === "account") {
    if (isAuthenticated) {
      return {
        primary: { href: "/my-bookings", label: "Go to My bookings" },
        secondary: { href: "/profile/manage", label: "Manage profile" },
      };
    }

    return {
      primary: { href: "/signin", label: "Sign in" },
    };
  }

  if (isAuthenticated) {
    return {
      primary: { href: "/my-bookings", label: "Go to My bookings" },
      secondary: { href: "/profile/manage", label: "Manage profile" },
    };
  }

  return {
    primary: { href: "#restaurants", label: "Browse restaurants", ariaLabel: "Browse partner restaurants" },
    secondary: { href: "/signin", label: "Sign in" },
  };
}

export function MarketingSessionActions({
  mode = "booking",
  size = "sm",
  showSecondary,
  className,
  primaryVariant,
  secondaryVariant,
}: MarketingSessionActionsProps) {
  const { user } = useSupabaseSession();
  const isAuthenticated = Boolean(user);

  const resolved = useMemo(() => resolveActions(mode, isAuthenticated), [mode, isAuthenticated]);

  const defaults = defaultsByMode[mode];
  const allowSecondary = showSecondary ?? defaults.showSecondary;

  const primaryButtonVariant = primaryVariant ?? defaults.primary;
  const secondaryButtonVariant = secondaryVariant ?? defaults.secondary;

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center", className)}>
      <Link
        href={resolved.primary.href}
        className={cn(buttonVariants({ variant: primaryButtonVariant, size }))}
        aria-label={resolved.primary.ariaLabel ?? resolved.primary.label}
      >
        {resolved.primary.label}
      </Link>
      {allowSecondary && resolved.secondary ? (
        <Link
          href={resolved.secondary.href}
          className={cn(buttonVariants({ variant: secondaryButtonVariant, size }))}
        >
          {resolved.secondary.label}
        </Link>
      ) : null}
    </div>
  );
}
