'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Icon } from '../shared/Icons';

export function GuaranteeSection() {
  return (
    <section id="guarantee" className="pg-section border-b border-border/70 bg-background">
      <div className="pg-container">
        <Card className="pg-panel overflow-hidden border-primary/15 bg-card motion-safe:reveal-up">
          <CardHeader className="flex flex-col items-center gap-3 space-y-0 border-b border-border/60 p-5 text-center sm:p-8 md:p-10">
            <Badge variant="guest-chip" className="pg-chip">
              Risk Reversal
            </Badge>
            <CardTitle className="pg-section-title">
              The &quot;calmer service&quot; onboarding promise
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 px-5 pb-6 pt-5 sm:px-8 sm:pb-8 md:grid-cols-[6fr_4fr] md:px-10 md:pb-10">
            <div className="pg-panel border-border/70 bg-background/92 p-4 sm:p-5 md:p-6">
              <p className="pg-lead text-center md:text-left">
                We do not hand you an empty system and leave your team to configure it. We build the
                booking rules, reminders, table logic, and manager view around your actual service
                model, then keep refining until the workflow is usable.
              </p>
            </div>
            <div className="pg-panel border-primary/20 bg-primary/[0.06] p-4 sm:p-5 md:p-6">
              <div className="mb-2 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider text-primary md:justify-start">
                <Icon name="lock" className="size-4" />
                Scarcity Notice
              </div>
              <p className="text-center text-sm leading-relaxed text-muted-foreground sm:text-base md:text-left">
                Because setup is hands-on, onboarding stays limited. We currently have 2 White-Glove
                setup slots remaining for this month.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
