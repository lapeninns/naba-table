import Link from "next/link";
import type { ReactNode } from "react";

type AuthPageProps = {
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function AuthPage({ title, description, footer, children }: AuthPageProps) {
  return (
    <main className="flex min-h-screen flex-col items-center bg-slate-50">
      <a
        href="#auth-form"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow"
      >
        Skip to content
      </a>
      <div className="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
        <div className="w-full space-y-6">
          <div className="space-y-3 text-center">
            <Link href="/" className="text-sm font-semibold text-primary hover:underline">
              ← Back to home
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <div id="auth-form" className="w-full">
            {children}
          </div>
        </div>
        {footer && (
          <div className="text-center text-sm text-muted-foreground">
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}
