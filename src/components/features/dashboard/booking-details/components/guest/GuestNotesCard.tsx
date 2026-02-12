'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

import { ClickToCopy } from '../ClickToCopy';

export type GuestNotesCardProps = {
  bookingNotes: string | null;
  profileNotes: string | null;
};

export function GuestNotesCard({ bookingNotes, profileNotes }: GuestNotesCardProps) {
  if (!bookingNotes && !profileNotes) return null;

  return (
    <Card className="border-slate-200/60 bg-white shadow-sm">
      <CardContent className="p-4">
        <Accordion type="single" collapsible>
          {bookingNotes ? (
            <AccordionItem value="notes" className="border-none">
              <AccordionTrigger className="py-2 hover:no-underline">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Notes & requests
                  </span>
                  <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                    1
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="space-y-2">
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm text-foreground">
                    {bookingNotes}
                  </div>
                  <ClickToCopy text={bookingNotes} label="notes" compact />
                </div>
              </AccordionContent>
            </AccordionItem>
          ) : null}

          {profileNotes ? (
            <AccordionItem value="profile" className="border-none">
              <AccordionTrigger className="py-2 hover:no-underline">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Guest profile notes
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="rounded-lg border bg-muted/30 p-3 text-sm text-foreground">
                  {profileNotes}
                </div>
              </AccordionContent>
            </AccordionItem>
          ) : null}
        </Accordion>
      </CardContent>
    </Card>
  );
}

export default GuestNotesCard;
