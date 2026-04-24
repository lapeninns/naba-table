'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Icon } from '../shared/Icons';

export function GuaranteeSection() {
  return (
    <section id="guarantee" className="pg-section border-b border-border/70 bg-background">
      <div className="pg-container">
        <Card className="pg-panel overflow-hidden border-primary/15 bg-[linear-gradient(180deg,hsl(var(--muted)/0.7),hsl(var(--background)))] motion-safe:reveal-up">
          <CardHeader className="flex flex-col items-center gap-3 space-y-0 border-b border-border/60 p-5 text-center sm:p-8 md:p-10">
            <Badge variant="guest-chip" className="pg-chip">
              Risk Reversal
            </Badge>
            <CardTitle className="pg-section-title">
              The &quot;Packed Pub&quot; Conditional Guarantee
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 px-5 pb-6 pt-5 sm:px-8 sm:pb-8 md:grid-cols-[6fr_4fr] md:px-10 md:pb-10">
            <div className="pg-panel border-border/70 bg-background/92 p-4 sm:p-5 md:p-6">
              <p className="pg-lead text-center md:text-left">
                We are so confident that Nabatable will eradicate your booking chaos that we offer
                a Service Guarantee. If our system doesn&apos;t noticeably reduce your no-shows and
                streamline your table turns in the first 30 days, we will refund your setup fee and
                keep working for you for free until it does.
              </p>
            </div>
            <div className="pg-panel border-primary/20 bg-primary/[0.06] p-4 sm:p-5 md:p-6">
              <div className="mb-2 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider text-primary md:justify-start">
                <Icon name="lock" className="size-4" />
                Scarcity Notice
              </div>
              <p className="text-center text-sm leading-relaxed text-muted-foreground sm:text-base md:text-left">
                Because we provide a &quot;Done-For-You&quot; White-Glove setup to ensure your
                pub&apos;s rules are perfectly integrated, we can only onboard 5 new pubs per month.
                We currently have 2 spots remaining for this month.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
