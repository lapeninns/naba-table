'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function CTASection() {
  return (
    <section className="pg-section relative overflow-hidden border-b border-border/70 bg-background">
      <div className="pointer-events-none absolute inset-0 bg-primary/[0.04] pattern-grid-lg" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,hsl(var(--primary)/0.12),transparent)]" />
      <div className="pg-container-sm relative z-10">
        <Card className="pg-panel overflow-hidden border-primary/20 bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.8))] shadow-[var(--pg-shadow-nav)] motion-safe:reveal-up">
          <CardHeader className="flex flex-col gap-2 space-y-0 border-b border-border/60 p-5 text-center sm:gap-3 sm:p-8 md:gap-4 md:p-10 lg:gap-5">
            <CardTitle className="pg-section-title">
              Ready to make your next service the calmest one yet?
            </CardTitle>
            <CardDescription className="pg-lead mx-auto max-w-2xl">
              Let us show you exactly how much time and money Nabatable will save your pub. Claim
              one of our remaining setup spots today.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 px-5 pb-2 pt-5 sm:px-8 md:px-10">
            <div className="flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center sm:gap-4">
              <Button size="guest-lg" className="w-full sm:w-auto" variant="guest-primary" asChild>
                <Link href="/contact">Secure Your Demo &amp; Spot</Link>
              </Button>
              <Button size="guest-lg" className="w-full sm:w-auto" variant="guest-outline" asChild>
                <Link href="#value-stack">View Value &amp; Pricing</Link>
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center px-5 pb-6 pt-2 sm:px-8 sm:pb-8 md:px-10 md:pb-10">
            <p className="text-center text-sm font-medium text-muted-foreground">
              White-Glove setup included. No lock-in contracts.
            </p>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
