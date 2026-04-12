'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';

export function CTASection() {
  return (
    <section className="relative overflow-hidden bg-background py-32">
      <div className="pattern-grid-lg absolute inset-0 bg-primary opacity-[0.03]" />
      <div className="max-w-4xl mx-auto px-6 text-center relative z-10 motion-safe:reveal-up">
        <h2 className="mb-6 text-4xl font-extrabold text-foreground md:text-5xl">
          Ready to stop burning £150 per no-show?
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-xl text-muted-foreground">
          We&apos;ll show you exactly how to automate busy work and reclaim 20 hours of your week.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button
            size="lg"
            className="rounded-4xl border-border bg-background px-8 py-4 text-base text-foreground hover:bg-muted"
            variant="outline"
            asChild
          >
            <Link href="/contact">Contact Sales</Link>
          </Button>
        </div>
        <p className="mt-6 text-sm font-medium text-muted-foreground">
          Setup takes &lt; 24h. We handle heavy lifting.
        </p>
      </div>
    </section>
  );
}
