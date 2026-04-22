'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export function CTASection() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-background py-16 sm:py-20 md:py-24 lg:py-28 xl:py-32">
      <div className="pointer-events-none absolute inset-0 bg-primary/[0.03] pattern-grid-lg" />
      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 sm:px-6 md:px-8 2xl:px-10">
        <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm motion-safe:reveal-up">
          <CardHeader className="flex flex-col gap-2 space-y-0 p-5 text-center sm:gap-3 sm:p-8 md:gap-4 md:p-10 lg:gap-5">
            <CardTitle className="text-2xl font-extrabold sm:text-3xl md:text-4xl lg:text-5xl">
              Ready to stop burning £150 per no-show?
            </CardTitle>
            <CardDescription className="mx-auto max-w-2xl text-base sm:text-lg md:text-xl">
              We&apos;ll show you exactly how to automate busy work and reclaim 20 hours of your week.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 px-5 pb-2 pt-0 sm:px-8 md:px-10">
            <div className="flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center sm:gap-4">
              <Button size="lg" className="w-full sm:w-auto" variant="default" asChild>
                <Link href="/contact">Contact sales</Link>
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center px-5 pb-6 pt-0 sm:px-8 sm:pb-8 md:px-10 md:pb-10">
            <p className="text-center text-sm font-medium text-muted-foreground">
              Setup takes &lt; 24h. We handle the heavy lifting.
            </p>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
