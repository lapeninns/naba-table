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
    id: 'guarantee-90',
    question: 'The 90-Day No-Show Recovery Guarantee',
    answer:
      "If we don't recover at least 3x our fee in no-show or late-cancel revenue within 90 days, we work for free until we do.",
  },
  {
    id: 'anti-guarantee',
    question: 'The "Anti-Guarantee"',
    answer:
      'We have no long-term contracts. We have to earn your business every single month. If you hate making more money, you can leave at any time.',
  },
  {
    id: 'pricing',
    question: 'How does pricing work?',
    answer:
      'We abandoned the commodity model. We charge a one-time "White Glove" setup (£3k-£9k) and a monthly Profit-Engine fee (£299-£899).',
  },
] as const;

export function FAQSection() {
  return (
    <section
      id="faq"
      className="border-b border-border bg-muted/40 py-12 sm:py-16 md:py-20 lg:py-24"
    >
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 md:px-8 2xl:px-10">
        <Card className="motion-safe:reveal-up">
          <CardHeader className="flex flex-col gap-1.5 space-y-0 p-4 pb-0 text-center sm:gap-2 sm:p-6 sm:pb-0 md:p-8 md:pb-0">
            <CardTitle className="text-2xl sm:text-3xl">Guarantees &amp; objections</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 md:p-6">
            <Accordion type="single" collapsible className="w-full">
              {FAQ_ITEMS.map((item) => (
                <AccordionItem key={item.id} value={item.id} className="border-border px-1">
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
