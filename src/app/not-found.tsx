import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import config from "@/config";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function NotFound() {
  const supportHref =
    config.email?.supportEmail != null && config.email.supportEmail.length > 0
      ? `mailto:${config.email.supportEmail}`
      : "/support";

  return (
    <main
      id="main-content"
      className="flex min-h-[80vh] flex-col items-center justify-center gap-[var(--sr-space-7)] bg-[var(--sr-color-background)] px-[var(--sr-space-6)] py-[var(--sr-space-8)] text-center text-[var(--sr-color-text-primary)]"
    >
      <div className="sr-stack-md max-w-2xl">
        <span className="inline-flex w-fit items-center justify-center rounded-full bg-primary/10 px-[var(--sr-space-3)] py-[var(--sr-space-1)] text-sm font-medium text-primary">
          404 · Page not found
        </span>
        <h1 className="text-balance text-[var(--sr-font-size-3xl)] font-semibold leading-[var(--sr-line-height-tight)]">
          We can’t find the page you’re looking for
        </h1>
        <p className="text-[var(--sr-font-size-md)] leading-[var(--sr-line-height-relaxed)] text-[var(--sr-color-text-secondary)]">
          The link may be outdated or the page might have moved. Choose one of the options below to
          continue exploring SajiloReserveX.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-[var(--sr-space-3)]">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "default", size: "lg" }),
            "min-w-[12rem] touch-manipulation"
          )}
        >
          Go to home
        </Link>
        <a
          href={supportHref}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "min-w-[12rem] touch-manipulation"
          )}
        >
          Contact support
        </a>
      </div>
    </main>
  );
}
