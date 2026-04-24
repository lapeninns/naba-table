'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const FAQ_ITEMS = [
  {
    id: 'basic-form',
    question: 'Is this just another basic booking form?',
    answer:
      'No. Basic forms create double-bookings. Nabatable is a complete capacity-management ecosystem that handles reminders, floor plans, and VIP tracking specifically for UK pubs.',
  },
  {
    id: 'stop-no-shows',
    question: 'Will this actually stop no-shows?',
    answer:
      'Yes. By utilizing our automated SMS and email sequences combined with guest-history tracking, we aggressively protect your tables from ghosting guests.',
  },
  {
    id: 'setup-effort',
    question: "I don't have time to set this up. Is it hard?",
    answer:
      "Not at all. That's why we include our White-Glove Setup support. You tell us how your pub runs, and we build the rules into the system for you.",
  },
] as const;

export function FAQSection() {
  return (
    <section id="faq" className="pg-section border-b border-border/70 bg-muted/30">
      <div className="pg-container">
        <Card className="pg-panel overflow-hidden border-primary/15 bg-background/95 shadow-[var(--pg-shadow-soft)] motion-safe:reveal-up">
          <CardHeader className="flex flex-col gap-2 space-y-0 border-b border-border/60 p-5 text-center sm:p-6 md:p-8">
            <p className="pg-kicker">Frequently Asked Questions</p>
            <CardTitle className="pg-section-title">Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6">
            <Accordion type="single" collapsible className="w-full">
              {FAQ_ITEMS.map((item) => (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className="rounded-[var(--pg-radius-md)] border border-border/70 bg-background px-4 shadow-[var(--pg-shadow-xs)] [&:not(:last-child)]:mb-3"
                >
                  <AccordionTrigger className="text-left text-sm sm:text-base">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground sm:text-sm">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
